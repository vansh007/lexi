import { useEffect, useState } from "react";
import type { SelectionInfo } from "../types";
import { explainText, type ExplainMode } from "../lib/api";

interface Props {
  selection: SelectionInfo;
  saved: boolean;
  onSavePassage: () => void;
}

export default function SentenceCard({ selection, saved, onSavePassage }: Props) {
  const [mode, setMode] = useState<ExplainMode>("simple");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    explainText(selection.text, selection.context, mode)
      .then((a) => !cancelled && setAnswer(a))
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setBusy(false));
    return () => { cancelled = true; };
  }, [selection.text, selection.context, mode]);

  return (
    <div>
      <p className="quote">“{selection.text.length > 160 ? selection.text.slice(0, 160) + "…" : selection.text}”</p>
      <div className="seg" role="tablist" aria-label="Explanation style">
        <button role="tab" aria-selected={mode === "simple"} className={mode === "simple" ? "on" : ""} onClick={() => setMode("simple")}>
          Simple English
        </button>
        <button role="tab" aria-selected={mode === "context"} className={mode === "context" ? "on" : ""} onClick={() => setMode("context")}>
          Use the paragraph
        </button>
      </div>
      {busy && <p className="status">Thinking…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!busy && !error && <p className="ai__text">{answer}</p>}
      <div className="card__foot">
        <button className={`btn btn--primary ${saved ? "btn--saved" : ""}`} disabled={saved} onClick={onSavePassage}>
          {saved ? "Passage saved" : "Save passage"}
        </button>
      </div>
    </div>
  );
}
