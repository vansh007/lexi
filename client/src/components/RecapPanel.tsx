import { useEffect, useState } from "react";
import type { RecapResult } from "../types";
import { recapPages } from "../lib/api";

interface Props {
  label: string;                  // e.g. "pages 12 to 14"
  getText: () => Promise<string>;
  onClose: () => void;
}

/** Recall beats re-reading: a short recap, then questions you answer before peeking. */
export default function RecapPanel({ label, getText, onClose }: Props) {
  const [result, setResult] = useState<RecapResult | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const text = await getText();
        if (text.trim().length < 80) throw new Error("There isn't enough text here to recap yet. Read a little further.");
        const r = await recapPages(text);
        if (!cancelled) setResult(r);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal" role="dialog" aria-label="Recap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__card">
        <header className="modal__head">
          <h2>Recap of {label}</h2>
          <button className="icon-btn" onClick={onClose}>Close</button>
        </header>
        {!result && !error && <p className="status">Reading it back to you…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {result && (
          <>
            <p className="ai__text">{result.recap}</p>
            <h3>Check yourself</h3>
            <ol className="quiz">
              {result.questions.map((qa, i) => (
                <li key={i}>
                  <p>{qa.q}</p>
                  {open.has(i) ? (
                    <p className="ai quiz__a">{qa.a}</p>
                  ) : (
                    <button className="btn" onClick={() => setOpen((s) => new Set(s).add(i))}>Show answer</button>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
