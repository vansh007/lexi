import { useEffect, useState, useCallback } from "react";
import type { SelectionInfo } from "../types";

const CONTEXT_RADIUS = 450; // chars of surrounding text on each side

function classify(text: string): "word" | "sentence" {
  const t = text.trim();
  return /^[\p{L}'’-]+[.,;:!?)"”]*$/u.test(t) && t.length <= 40 ? "word" : "sentence";
}

/** Find the paragraph-ish text around the selection so the AI can use context. */
function surroundingText(range: Range, selected: string): string {
  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  let el = node as HTMLElement | null;

  // DOCX: nearest block element. PDF: the whole text layer of that page.
  const block = el?.closest("p, li, h1, h2, h3, h4, blockquote, .textLayer") as HTMLElement | null;
  const full = (block?.innerText ?? block?.textContent ?? selected).replace(/\s+/g, " ").trim();

  const idx = full.indexOf(selected.replace(/\s+/g, " "));
  if (idx === -1) return full.slice(0, CONTEXT_RADIUS * 2);
  return full.slice(Math.max(0, idx - CONTEXT_RADIUS), idx + selected.length + CONTEXT_RADIUS);
}

/**
 * Watches for text selections inside `container`. Returns the current selection
 * (or null) and a `clear` function.
 */
export function useTextSelection(container: React.RefObject<HTMLElement>) {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);

  const clear = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const onMouseUp = () => {
      // Wait a tick so the browser finalizes the selection.
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!el.contains(range.commonAncestorContainer)) return;

        const text = sel.toString().replace(/\s+/g, " ").trim();
        if (!text || text.length > 1500) return;

        const r = range.getBoundingClientRect();
        const startEl = range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startContainer.parentElement
          : (range.startContainer as HTMLElement);
        const pageAttr = startEl?.closest<HTMLElement>(".pdf-page")?.dataset.page;
        setSelection({
          page: pageAttr ? Number(pageAttr) : undefined,
          text,
          kind: classify(text),
          context: surroundingText(range, text),
          rect: { top: r.top, left: r.left, bottom: r.bottom, right: r.right },
        });
      }, 0);
    };

    const onMouseDown = (e: MouseEvent) => {
      // Starting a new selection (outside the popup) dismisses the old one.
      if ((e.target as HTMLElement).closest(".popup")) return;
      setSelection(null);
    };

    el.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      el.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [container]);

  return { selection, clear };
}
