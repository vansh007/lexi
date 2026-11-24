import { useState } from "react";
import type { NotebookItem, Passage } from "../types";
import Flashcards from "./Flashcards";

interface Props {
  words: NotebookItem[];
  passages: Passage[];
  docName?: string;
  onGoTo: (page: number) => void;
  onRemoveWord: (id: string) => void;
  onRemovePassage: (id: string) => void;
}

/** The "Saved" tab: words (with flashcard review) and passages. */
export default function Notebook({ words, passages, docName, onGoTo, onRemoveWord, onRemovePassage }: Props) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const toggle = (id: string) =>
    setRevealed((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  if (reviewing) return <Flashcards items={words} onClose={() => setReviewing(false)} />;

  return (
    <div>
      <div className="saved__head">
        <h3>Words ({words.length})</h3>
        <button className="btn" disabled={words.length === 0} onClick={() => setReviewing(true)}>Review as flashcards</button>
      </div>
      {words.length === 0 ? (
        <p className="status">Save a word from its popup. Tap it here to hide or reveal the meaning.</p>
      ) : (
        <ul className="notebook__list">
          {words.map((it) => (
            <li key={it.id}>
              <button className="notebook__word" onClick={() => toggle(it.id)}>{it.word}</button>
              {revealed.has(it.id) && <p>{it.meaning}</p>}
              <p className="notebook__src">from {it.source}{it.page ? `, page ${it.page}` : ""}</p>
              <button className="link" onClick={() => onRemoveWord(it.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <div className="saved__head"><h3>Passages ({passages.length})</h3></div>
      {passages.length === 0 ? (
        <p className="status">Select a sentence and choose “Save passage” to keep lines worth coming back to.</p>
      ) : (
        <ul className="notebook__list">
          {passages.map((p) => (
            <li key={p.id}>
              <p className="passage">“{p.text.length > 220 ? p.text.slice(0, 220) + "…" : p.text}”</p>
              <p className="notebook__src">{p.source}{p.page ? `, page ${p.page}` : ""}</p>
              {p.page && p.source === docName && (
                <button className="link" onClick={() => onGoTo(p.page!)}>Go to page</button>
              )}{" "}
              <button className="link" onClick={() => onRemovePassage(p.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
