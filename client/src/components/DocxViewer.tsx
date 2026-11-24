import { useEffect, useRef, useState } from "react";
import mammoth from "mammoth";
import type { ReadTheme } from "../types";

interface Props {
  data: ArrayBuffer;
  theme: ReadTheme;
  startPage: number; // percent scrolled
  onPageChange: (percent: number, total: number) => void;
}

export default function DocxViewer({ data, theme, startPage, onPageChange }: Props) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const article = useRef<HTMLElement>(null);
  const cb = useRef(onPageChange);
  cb.current = onPageChange;

  useEffect(() => {
    let cancelled = false;
    setHtml("");
    mammoth
      .convertToHtml({ arrayBuffer: data })
      .then((r) => !cancelled && setHtml(r.value))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [data]);

  // Restore scroll position and report progress as a percentage.
  useEffect(() => {
    if (!html) return;
    const scroller = article.current?.closest<HTMLElement>(".reader");
    if (!scroller) return;
    const max = () => Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = (startPage / 100) * max();
    cb.current(startPage, 100);
    const onScroll = () => cb.current(Math.min(100, Math.round((scroller.scrollTop / max()) * 100)), 100);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  if (error) return <p className="error" role="alert">Could not open this document: {error}</p>;
  if (!html) return <p className="status">Loading document…</p>;
  // Mammoth output is plain structural HTML. TODO: sanitize with DOMPurify before shipping publicly.
  return <article ref={article} className={`docx docx--${theme}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
