import { useEffect, useState } from "react";
import type { DictEntry, SelectionInfo } from "../types";
import { lookupWord, normalizeWord } from "../lib/dictionary";
import { speak } from "../lib/speech";
import { explainText } from "../lib/api";

interface Props {
  selection: SelectionInfo;
  saved: boolean;
  onSave: (word: string, meaning: string) => void;
}

export default function WordCard({ selection, saved, onSave }: Props) {
  const word = normalizeWord(selection.text);
  const [entry, setEntry] = useState<DictEntry | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [ctxAnswer, setCtxAnswer] = useState("");
  const [ctxBusy, setCtxBusy] = useState(false);
  const [ctxError, setCtxError] = useState("");
  const [lookupError, setLookupError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setCtxAnswer("");
    lookupWord(word)
      .then((e) => {
        if (cancelled) return;
        setEntry(e);
        setState(e ? "ready" : "missing");
      })
      .catch((e) => {
        if (cancelled) return;
        setLookupError((e as Error).message);
        setState("error");
      });
    return () => { cancelled = true; };
  }, [word]);

  async function explainInContext() {
    setCtxBusy(true);
    setCtxError("");
    try {
      setCtxAnswer(await explainText(selection.text, selection.context, "context"));
    } catch (e) {
      setCtxError((e as Error).message);
    } finally {
      setCtxBusy(false);
    }
  }

  const firstMeaning = entry?.meanings[0]?.definition ?? ctxAnswer;

  return (
    <div>
      <div className="card__head">
        <h2 className="card__word">{entry?.word ?? word}</h2>
        <div className="card__actions">
          <button className="icon-btn" onClick={() => speak(word, entry?.audioUrl)} aria-label="Play pronunciation">
            Listen
          </button>
          <button className="icon-btn" onClick={() => speak(word, undefined, true)} aria-label="Play slowly">
            Slow
          </button>
        </div>
      </div>
      {entry?.phonetic && <p className="card__phonetic">{entry.phonetic}</p>}

      {state === "loading" && <p className="status">Looking it up…</p>}
      {state === "missing" && (
        <p className="status">No dictionary entry for “{word}”. Try “Explain in context”.</p>
      )}
      {state === "error" && (
        <p className="error">Couldn't reach the dictionary ({lookupError}). Select the word again, or use “Explain in context”.</p>
      )}

      {entry?.meanings.map((m, i) => (
        <div key={i} className="meaning">
          <p className="meaning__pos">{m.partOfSpeech}</p>
          <p>{m.definition}</p>
          {m.example && <p className="meaning__ex">“{m.example}”</p>}
          {m.synonyms.length > 0 && <p className="meaning__syn">Similar: {m.synonyms.join(", ")}</p>}
        </div>
      ))}

      {ctxAnswer && (
        <div className="ai">
          <p className="ai__label">In this passage</p>
          <p className="ai__text">{ctxAnswer}</p>
        </div>
      )}
      {ctxError && <p className="error">{ctxError}</p>}

      <div className="card__foot">
        <button className="btn" onClick={explainInContext} disabled={ctxBusy}>
          {ctxBusy ? "Thinking…" : "Explain in context"}
        </button>
        <button
          className={`btn btn--primary ${saved ? "btn--saved" : ""}`}
          disabled={saved || !firstMeaning}
          onClick={() => onSave(entry?.word ?? word, firstMeaning)}
        >
          {saved ? "Saved" : "Save word"}
        </button>
      </div>
    </div>
  );
}
