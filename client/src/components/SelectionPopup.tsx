import { useLayoutEffect, useRef, useState } from "react";
import type { SelectionInfo } from "../types";
import WordCard from "./WordCard";
import SentenceCard from "./SentenceCard";

interface Props {
  selection: SelectionInfo;
  saved: boolean;
  passageSaved: boolean;
  onSave: (word: string, meaning: string) => void;
  onSavePassage: () => void;
  onClose: () => void;
}

const GAP = 10;
const MARGIN = 12;

export default function SelectionPopup({ selection, saved, passageSaved, onSave, onSavePassage, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Place the popup under the selection; flip above if there's no room. Keep it on screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const { rect } = selection;
    let top = rect.bottom + GAP;
    if (top + height > window.innerHeight - MARGIN) top = Math.max(MARGIN, rect.top - height - GAP);
    let left = rect.left + (rect.right - rect.left) / 2 - width / 2;
    left = Math.min(Math.max(MARGIN, left), window.innerWidth - width - MARGIN);
    setPos({ top, left });
  }, [selection, saved, passageSaved]);

  return (
    <div
      ref={ref}
      className="popup"
      style={{ top: pos.top, left: pos.left }}
      // Keep the text selected while interacting with the popup.
      onMouseDown={(e) => { if (!(e.target as HTMLElement).closest("button")) e.preventDefault(); }}
      role="dialog"
      aria-label="Reading assistant"
    >
      <button className="popup__close" onClick={onClose} aria-label="Close">×</button>
      {selection.kind === "word" ? (
        <WordCard selection={selection} saved={saved} onSave={onSave} />
      ) : (
        <SentenceCard selection={selection} saved={passageSaved} onSavePassage={onSavePassage} />
      )}
    </div>
  );
}
