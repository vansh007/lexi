import { useState } from "react";
import type { NotebookItem } from "../types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Quick revision: cards you miss go to the back of the deck until you get them. */
export default function Flashcards({ items, onClose }: { items: NotebookItem[]; onClose: () => void }) {
  const [queue, setQueue] = useState(() => shuffle(items));
  const [shown, setShown] = useState(false);
  const card = queue[0];

  const next = (gotIt: boolean) => {
    setShown(false);
    setQueue((q) => (gotIt ? q.slice(1) : [...q.slice(1), q[0]]));
  };

  if (!card) {
    return (
      <div className="flash">
        <p className="flash__done">Deck finished. Every word is yours now.</p>
        <button className="btn btn--primary" onClick={onClose}>Back to saved words</button>
      </div>
    );
  }

  return (
    <div className="flash">
      <p className="status">{queue.length} left in this round</p>
      <p className="flash__word">{card.word}</p>
      {shown ? (
        <>
          <p className="flash__meaning">{card.meaning}</p>
          {card.sentence && <p className="flash__ctx">“{card.sentence.slice(0, 200)}”</p>}
          <div className="card__foot">
            <button className="btn" onClick={() => next(false)}>Again</button>
            <button className="btn btn--primary" onClick={() => next(true)}>Got it</button>
          </div>
        </>
      ) : (
        <button className="btn btn--primary" onClick={() => setShown(true)}>Show meaning</button>
      )}
      <button className="link flash__exit" onClick={onClose}>Stop reviewing</button>
    </div>
  );
}
