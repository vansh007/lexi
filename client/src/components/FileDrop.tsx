import { useRef, useState } from "react";
import type { BookMeta, DocKind } from "../types";

interface Props {
  onOpen: (file: { name: string; kind: DocKind; data: ArrayBuffer }) => void;
  books: BookMeta[];
  onResume: (id: string) => void;
  onRemoveBook: (id: string) => void;
  statsLine: string;
}

function progressOf(b: BookMeta) {
  if (b.kind === "docx") return { pct: b.page, label: `${b.page}% read` };
  return { pct: b.total ? (b.page / b.total) * 100 : 0, label: b.total ? `Page ${b.page} of ${b.total}` : "Not started" };
}

export default function FileDrop({ onOpen, books, onResume, onRemoveBook, statsLine }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");

  async function handle(file?: File) {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const kind = lower.endsWith(".pdf") ? "pdf" : lower.endsWith(".docx") ? "docx" : null;
    if (!kind) {
      setError("Lexi opens .pdf and .docx files. Old .doc files need to be saved as .docx first.");
      return;
    }
    setError("");
    onOpen({ name: file.name, kind, data: await file.arrayBuffer() });
  }

  const sorted = [...books].sort((a, b) => b.lastOpened - a.lastOpened);

  return (
    <div
      className={`hero ${over ? "hero--over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]); }}
    >
      <div className="hero__copy">
        <h1 className="hero__title">Read anything. Stop for nothing.</h1>
        <p className="hero__sub">
          Open a PDF or Word file, then select any word or sentence. Lexi explains it right where you are.
        </p>
        <button className="btn btn--primary btn--big" onClick={() => input.current?.click()}>
          Open a book
        </button>
        <p className="hero__hint">PDF or DOCX. You can also drop a file anywhere on this page.</p>
        {statsLine && <p className="hero__stats">{statsLine}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <input ref={input} type="file" accept=".pdf,.docx" hidden onChange={(e) => handle(e.target.files?.[0])} />
      </div>

      {/* Static preview of what selecting a word does. */}
      <div className="hero__demo" aria-hidden="true">
        <p className="demo__line">
          The beauty of a sunset is <span className="demo__sel">ephemeral</span>, gone before you finish looking.
        </p>
        <div className="demo__card">
          <div className="demo__head">
            <span className="demo__word">ephemeral</span>
            <span className="demo__listen">Listen</span>
          </div>
          <p className="demo__ph">/ɪˈfem.ər.əl/</p>
          <p className="demo__pos">adjective</p>
          <p>Lasting for a very short time.</p>
          <div className="demo__ai">
            <span>In this passage</span>
            The sunset is beautiful because it doesn't last.
          </div>
        </div>
      </div>

      {sorted.length > 0 && (
        <section className="shelf" aria-label="Continue reading">
          <h2 className="shelf__title">Continue reading</h2>
          <ul className="shelf__list">
            {sorted.map((b) => {
              const { pct, label } = progressOf(b);
              return (
                <li key={b.id} className="book">
                  <button className="book__open" onClick={() => onResume(b.id)}>
                    <span className="book__name">{b.name.replace(/\.(pdf|docx)$/i, "")}</span>
                    <span className="book__meta">{label}</span>
                    <span className="book__bar"><i style={{ width: `${pct}%` }} /></span>
                  </button>
                  <button className="link" onClick={() => onRemoveBook(b.id)}>Remove</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
