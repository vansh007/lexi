import { useState } from "react";
import type { DocKind, NotebookItem, OutlineItem, Passage } from "../types";
import type { SearchHit } from "./PdfViewer";
import Notebook from "./Notebook";

export type PanelTab = "contents" | "search" | "saved";

interface Props {
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  onClose: () => void;
  kind?: DocKind;
  docName?: string;
  outline: OutlineItem[];
  onGoTo: (page: number) => void;
  onSearch: (q: string) => Promise<SearchHit[]>;
  words: NotebookItem[];
  passages: Passage[];
  onRemoveWord: (id: string) => void;
  onRemovePassage: (id: string) => void;
}

function SearchTab({ kind, onGoTo, onSearch }: Pick<Props, "kind" | "onGoTo" | "onSearch">) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);

  if (kind !== "pdf") return <p className="status">Search works in PDFs. Use your browser's find (Ctrl+F) in Word files.</p>;

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setHits(await onSearch(q));
    setBusy(false);
  }

  return (
    <div>
      <form onSubmit={run} className="search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this book" aria-label="Search this book" autoFocus />
        <button className="btn btn--primary" disabled={busy || q.trim().length < 2}>Search</button>
      </form>
      {busy && <p className="status">Searching every page…</p>}
      {hits && !busy && hits.length === 0 && <p className="status">No matches for “{q}”.</p>}
      <ul className="hits">
        {hits?.map((h, i) => (
          <li key={i}>
            <button onClick={() => onGoTo(h.page)}>
              <span className="hits__page">Page {h.page}</span>
              <span className="hits__snip">{h.snippet}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SidePanel(p: Props) {
  const tabs: { id: PanelTab; label: string }[] = [
    { id: "contents", label: "Contents" },
    { id: "search", label: "Search" },
    { id: "saved", label: "Saved" },
  ];
  return (
    <aside className="sidepanel" aria-label="Book tools">
      <header className="sidepanel__head">
        <div className="seg" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={p.tab === t.id} className={p.tab === t.id ? "on" : ""} onClick={() => p.onTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={p.onClose}>Close</button>
      </header>

      <div className="sidepanel__body">
        {p.tab === "contents" && (
          p.kind !== "pdf" ? <p className="status">Contents are available for PDFs.</p>
          : p.outline.length === 0 ? <p className="status">This PDF has no table of contents. Use Search or the page box to move around.</p>
          : (
            <ul className="toc">
              {p.outline.map((o, i) => (
                <li key={i} style={{ paddingLeft: o.depth * 16 }}>
                  <button onClick={() => p.onGoTo(o.page)}>
                    <span>{o.title}</span><span className="toc__page">{o.page}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
        {p.tab === "search" && <SearchTab kind={p.kind} onGoTo={p.onGoTo} onSearch={p.onSearch} />}
        {p.tab === "saved" && (
          <Notebook
            words={p.words}
            passages={p.passages}
            docName={p.docName}
            onGoTo={p.onGoTo}
            onRemoveWord={p.onRemoveWord}
            onRemovePassage={p.onRemovePassage}
          />
        )}
      </div>
    </aside>
  );
}
