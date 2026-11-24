import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import type { OutlineItem, ReadTheme } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

type TextLayerInstance = InstanceType<typeof pdfjsLib.TextLayer>;

export interface SearchHit { page: number; snippet: string }

export interface PdfHandle {
  goToPage: (n: number) => void;
  getPageText: (n: number) => Promise<string>;
  search: (q: string) => Promise<SearchHit[]>;
}

interface Props {
  data: ArrayBuffer;
  scale: number;
  theme: ReadTheme;
  startPage: number;
  onReady: (info: { total: number; outline: OutlineItem[] }) => void;
  onPageChange: (page: number, total: number) => void;
}

async function buildOutline(doc: PDFDocumentProxy): Promise<OutlineItem[]> {
  const raw = await doc.getOutline();
  if (!raw) return [];
  const out: OutlineItem[] = [];
  async function walk(items: any[], depth: number) {
    for (const it of items) {
      try {
        let dest = it.dest;
        if (typeof dest === "string") dest = await doc.getDestination(dest);
        if (Array.isArray(dest)) {
          const ref = dest[0];
          const idx = typeof ref === "object" ? await doc.getPageIndex(ref) : ref;
          out.push({ title: String(it.title).trim(), page: idx + 1, depth });
        }
      } catch { /* skip entries we can't resolve */ }
      if (it.items?.length && depth < 2) await walk(it.items, depth + 1);
    }
  }
  await walk(raw, 0);
  return out;
}

/**
 * Renders a PDF lazily: every page gets a correctly sized placeholder, but only pages
 * near the viewport are drawn. That keeps 300-page books fast and light on memory.
 */
const PdfViewer = forwardRef<PdfHandle, Props>(function PdfViewer(
  { data, scale, theme, startPage, onReady, onPageChange }, ref
) {
  const host = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [noText, setNoText] = useState(false);
  const textCache = useRef(new Map<number, string>());
  const currentPage = useRef(startPage);
  const callbacks = useRef({ onReady, onPageChange });
  callbacks.current = { onReady, onPageChange };

  // 1. Load the document.
  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setError("");
    setNoText(false);
    textCache.current.clear();
    currentPage.current = startPage;

    // pdf.js transfers the buffer to its worker, so hand it a copy.
    const task = pdfjsLib.getDocument({ data: data.slice(0) });
    task.promise
      .then(async (doc) => {
        if (cancelled) { doc.destroy(); return; }
        setPdf(doc);
        const outline = await buildOutline(doc).catch(() => []);
        if (!cancelled) callbacks.current.onReady({ total: doc.numPages, outline });
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; task.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // 2. Lay out placeholders and render pages on demand. Re-runs when zoom changes.
  useEffect(() => {
    if (!pdf || !host.current) return;
    const container = host.current;
    const scroller = container.closest(".reader") as HTMLElement;
    let cancelled = false;
    let raf = 0;
    let pagesChecked = 0;
    let itemsSeen = 0;
    container.replaceChildren();

    const pages: HTMLDivElement[] = [];
    type Entry = { task?: RenderTask; text?: TextLayerInstance; stale?: boolean };
    const rendered = new Map<number, Entry>();

    const renderPage = async (n: number) => {
      if (cancelled || rendered.has(n)) return;
      const entry: Entry = {};
      rendered.set(n, entry);
      const el = pages[n - 1];
      try {
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale });
        if (entry.stale) return;
        el.style.width = `${viewport.width}px`;
        el.style.height = `${viewport.height}px`;

        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        el.classList.remove("pdf-page--blank");
        el.appendChild(canvas);

        entry.task = page.render({
          canvasContext: canvas.getContext("2d")!,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        await entry.task.promise;
        if (entry.stale) return;

        const textContent = await page.getTextContent();
        if (entry.stale) return;
        const layer = document.createElement("div");
        layer.className = "textLayer";
        el.appendChild(layer);
        entry.text = new pdfjsLib.TextLayer({ textContentSource: textContent, container: layer, viewport });
        await entry.text.render();

        pagesChecked++;
        itemsSeen += textContent.items.length;
        if (pagesChecked >= 3 && itemsSeen === 0) setNoText(true);
      } catch (e) {
        if ((e as Error)?.name !== "RenderingCancelledException") console.warn(`[lexi] page ${n} failed`, e);
      }
    };

    const release = (n: number) => {
      const entry = rendered.get(n);
      if (!entry) return;
      entry.stale = true;
      entry.task?.cancel();
      entry.text?.cancel();
      rendered.delete(n);
      pages[n - 1].replaceChildren();
      pages[n - 1].classList.add("pdf-page--blank");
    };

    const nearObserver = new IntersectionObserver(
      (list) => list.forEach((e) => {
        if (e.isIntersecting) renderPage(Number((e.target as HTMLElement).dataset.page));
      }),
      { root: scroller, rootMargin: "1500px 0px" }
    );
    const farObserver = new IntersectionObserver(
      (list) => list.forEach((e) => {
        if (!e.isIntersecting) release(Number((e.target as HTMLElement).dataset.page));
      }),
      { root: scroller, rootMargin: "4000px 0px" }
    );

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = scroller.scrollTop + scroller.clientHeight * 0.35;
        let lo = 0, hi = pages.length - 1;
        while (lo < hi) {
          const m = (lo + hi + 1) >> 1;
          if (pages[m].offsetTop <= mid) lo = m; else hi = m - 1;
        }
        const n = lo + 1;
        if (n !== currentPage.current) {
          currentPage.current = n;
          callbacks.current.onPageChange(n, pdf.numPages);
        }
      });
    };

    (async () => {
      const first = await pdf.getPage(1);
      if (cancelled) return;
      const vp = first.getViewport({ scale });
      for (let n = 1; n <= pdf.numPages; n++) {
        const el = document.createElement("div");
        el.className = "pdf-page pdf-page--blank";
        el.dataset.page = String(n);
        el.style.width = `${vp.width}px`;
        el.style.height = `${vp.height}px`;
        el.style.setProperty("--scale-factor", String(scale));
        container.appendChild(el);
        pages.push(el);
      }
      const target = Math.min(Math.max(currentPage.current, 1), pdf.numPages);
      currentPage.current = target;
      scroller.scrollTop = pages[target - 1].offsetTop - 16;
      callbacks.current.onPageChange(target, pdf.numPages);

      pages.forEach((p) => { nearObserver.observe(p); farObserver.observe(p); });
      scroller.addEventListener("scroll", onScroll, { passive: true });
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", onScroll);
      nearObserver.disconnect();
      farObserver.disconnect();
      [...rendered.keys()].forEach(release);
    };
  }, [pdf, scale]);

  const pageText = async (n: number): Promise<string> => {
    if (!pdf) return "";
    const cached = textCache.current.get(n);
    if (cached !== undefined) return cached;
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    const text = tc.items
      .map((i: any) => (i.str ?? "") + (i.hasEOL ? "\n" : " "))
      .join("")
      .replace(/[ \t]+/g, " ")
      .trim();
    textCache.current.set(n, text);
    return text;
  };

  useImperativeHandle(ref, () => ({
    goToPage(n) {
      const el = host.current?.querySelector<HTMLElement>(`[data-page="${n}"]`);
      const scroller = host.current?.closest<HTMLElement>(".reader");
      if (el && scroller) scroller.scrollTo({ top: el.offsetTop - 16 });
    },
    getPageText: pageText,
    async search(q) {
      const needle = q.trim().toLowerCase();
      if (needle.length < 2 || !pdf) return [];
      const hits: SearchHit[] = [];
      for (let n = 1; n <= pdf.numPages && hits.length < 80; n++) {
        const text = await pageText(n);
        const lower = text.toLowerCase();
        let from = 0;
        for (let k = 0; k < 3; k++) {
          const i = lower.indexOf(needle, from);
          if (i === -1) break;
          hits.push({
            page: n,
            snippet: (i > 40 ? "…" : "") + text.slice(Math.max(0, i - 40), i + needle.length + 60) + "…",
          });
          from = i + needle.length;
        }
      }
      return hits;
    },
  }), [pdf]);

  return (
    <>
      {!pdf && !error && <p className="status">Loading PDF…</p>}
      {error && <p className="error" role="alert">Could not open this PDF: {error}</p>}
      {noText && (
        <p className="error" role="alert">
          This PDF has no selectable text (it looks scanned). Lexi can't read it yet.
        </p>
      )}
      <div ref={host} className={`pdf-pages theme-${theme}`} />
    </>
  );
});

export default PdfViewer;
