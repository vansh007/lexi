import { useCallback, useEffect, useRef, useState } from "react";
import type { DocKind, OpenDoc, OutlineItem, ReadTheme } from "./types";
import FileDrop from "./components/FileDrop";
import PdfViewer, { type PdfHandle } from "./components/PdfViewer";
import DocxViewer from "./components/DocxViewer";
import SelectionPopup from "./components/SelectionPopup";
import SidePanel, { type PanelTab } from "./components/SidePanel";
import RecapPanel from "./components/RecapPanel";
import { useTextSelection } from "./hooks/useTextSelection";
import { useNotebook } from "./hooks/useNotebook";
import { usePassages } from "./hooks/usePassages";
import { useLibrary } from "./hooks/useLibrary";
import { useReadingStats } from "./hooks/useReadingStats";
import { normalizeWord } from "./lib/dictionary";

const THEMES: ReadTheme[] = ["day", "sepia", "night"];
const GOALS = [10, 20, 30, 45, 60];

export default function App() {
  const [doc, setDoc] = useState<OpenDoc | null>(null);
  const [scale, setScale] = useState(1.3);
  const [theme, setTheme] = useState<ReadTheme>(() => (localStorage.getItem("lexi.theme") as ReadTheme) || "day");
  const [tab, setTab] = useState<PanelTab | null>(null);
  const [progress, setProgress] = useState({ page: 1, total: 0 });
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [showRecap, setShowRecap] = useState(false);
  const [jump, setJump] = useState("");
  const [toast, setToast] = useState("");

  const reader = useRef<HTMLElement>(null);
  const pdfRef = useRef<PdfHandle>(null);
  const docIdRef = useRef<string | null>(null);
  const toastTimer = useRef<number>();

  const { selection, clear } = useTextSelection(reader);
  const notebook = useNotebook();
  const passages = usePassages();
  const library = useLibrary();
  const stats = useReadingStats(!!doc);
  const { setProgress: saveProgress } = library;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 4500);
  }, []);

  // Celebrate the daily goal once.
  const goalSeen = useRef(stats.goalHit);
  useEffect(() => {
    if (stats.goalHit && !goalSeen.current) flash(`Daily goal reached: ${stats.goalMin} minutes of reading today.`);
    goalSeen.current = stats.goalHit;
  }, [stats.goalHit, stats.goalMin, flash]);

  useEffect(() => { localStorage.setItem("lexi.theme", theme); }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showRecap) setShowRecap(false);
      else if (selection) clear();
      else if (tab) setTab(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showRecap, selection, tab, clear]);

  function startDoc(d: OpenDoc) {
    docIdRef.current = d.id;
    setOutline([]);
    setProgress({ page: d.startPage || 1, total: d.kind === "docx" ? 100 : 0 });
    setDoc(d);
  }

  async function openFile(file: { name: string; kind: DocKind; data: ArrayBuffer }) {
    const { id, startPage } = await library.register(file.name, file.kind, file.data);
    startDoc({ id, ...file, startPage });
  }

  async function resume(id: string) {
    const d = await library.reopen(id);
    if (d) startDoc(d);
    else flash("That file is no longer stored. Open it again to continue.");
  }

  function closeDoc() {
    docIdRef.current = null;
    setDoc(null);
    setTab(null);
    clear();
  }

  const handlePage = useCallback((page: number, total: number) => {
    setProgress({ page, total });
    if (docIdRef.current) saveProgress(docIdRef.current, page, total);
  }, [saveProgress]);

  const goTo = (n: number) => pdfRef.current?.goToPage(Math.min(Math.max(1, n), progress.total || n));

  async function getRecapText(): Promise<string> {
    if (doc?.kind === "pdf" && pdfRef.current) {
      const from = Math.max(1, progress.page - 2);
      const parts: string[] = [];
      for (let n = from; n <= progress.page; n++) parts.push(await pdfRef.current.getPageText(n));
      return parts.join("\n\n").slice(-9000);
    }
    const full = document.querySelector(".docx")?.textContent ?? "";
    const end = Math.max(1500, Math.round((progress.page / 100) * full.length));
    return full.slice(Math.max(0, end - 7000), end);
  }

  const recapLabel = doc?.kind === "pdf"
    ? progress.page > 2 ? `pages ${progress.page - 2} to ${progress.page}` : `page ${progress.page}`
    : "what you just read";

  const pct = doc?.kind === "pdf" ? (progress.total ? (progress.page / progress.total) * 100 : 0) : progress.page;
  const statsLine = stats.streak > 0
    ? `${stats.streak}-day reading streak. ${stats.todayMin} of ${stats.goalMin} minutes today.`
    : stats.todayMin > 0 ? `${stats.todayMin} of ${stats.goalMin} minutes today.` : "";

  return (
    <div className="app">
      <header className="bar">
        <span className="bar__brand">Lexi</span>
        {doc && <span className="bar__file">{doc.name}</span>}
        <div className="bar__spacer" />

        {doc?.kind === "pdf" && (
          <form
            className="pagejump"
            onSubmit={(e) => { e.preventDefault(); const n = parseInt(jump, 10); if (n) goTo(n); setJump(""); }}
          >
            <input
              value={jump}
              onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
              placeholder={String(progress.page)}
              aria-label="Go to page"
              inputMode="numeric"
            />
            <span>of {progress.total || "…"}</span>
          </form>
        )}
        {doc?.kind === "docx" && <span className="pagejump">{progress.page}% read</span>}

        <label className="goal" title="Daily reading goal. Streaks count days with at least a minute of reading.">
          <span>Today {stats.todayMin}/</span>
          <select value={stats.goalMin} onChange={(e) => stats.setGoal(Number(e.target.value))} aria-label="Daily goal in minutes">
            {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <span>min</span>
          {stats.streak > 0 && <strong className="goal__streak">{stats.streak}-day streak</strong>}
        </label>

        {doc && (
          <button className="btn" onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])} title="Change reading theme">
            {theme === "day" ? "Day" : theme === "sepia" ? "Sepia" : "Night"}
          </button>
        )}
        {doc?.kind === "pdf" && (
          <div className="zoom" aria-label="Zoom">
            <button className="icon-btn" onClick={() => setScale((s) => Math.max(0.8, +(s - 0.2).toFixed(1)))}>−</button>
            <span>{Math.round(scale * 100)}%</span>
            <button className="icon-btn" onClick={() => setScale((s) => Math.min(2.4, +(s + 0.2).toFixed(1)))}>+</button>
          </div>
        )}
        {doc && <button className="btn" onClick={() => setShowRecap(true)}>Recap</button>}
        <button className="btn" onClick={() => setTab(tab ? null : doc ? "contents" : "saved")}>
          {doc ? "Contents and notes" : `Saved words (${notebook.items.length})`}
        </button>
        {doc && <button className="btn" onClick={closeDoc}>Library</button>}
      </header>

      {doc && (
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Reading progress">
          <i style={{ width: `${pct}%` }} />
        </div>
      )}

      <main className="reader" ref={reader}>
        {!doc && (
          <FileDrop
            onOpen={openFile}
            books={library.books}
            onResume={resume}
            onRemoveBook={library.remove}
            statsLine={statsLine}
          />
        )}
        {doc?.kind === "pdf" && (
          <PdfViewer
            key={doc.id}
            ref={pdfRef}
            data={doc.data}
            scale={scale}
            theme={theme}
            startPage={doc.startPage || 1}
            onReady={({ outline }) => setOutline(outline)}
            onPageChange={handlePage}
          />
        )}
        {doc?.kind === "docx" && (
          <DocxViewer key={doc.id} data={doc.data} theme={theme} startPage={doc.startPage} onPageChange={handlePage} />
        )}
      </main>

      {selection && doc && (
        <SelectionPopup
          selection={selection}
          saved={selection.kind === "word" && notebook.has(normalizeWord(selection.text))}
          passageSaved={passages.has(selection.text, doc.name)}
          onClose={clear}
          onSave={(word, meaning) =>
            notebook.add({ word, meaning, sentence: selection.context, source: doc.name, page: selection.page })
          }
          onSavePassage={() => passages.add({ text: selection.text, page: selection.page, source: doc.name })}
        />
      )}

      {tab && (
        <SidePanel
          tab={tab}
          onTab={setTab}
          onClose={() => setTab(null)}
          kind={doc?.kind}
          docName={doc?.name}
          outline={outline}
          onGoTo={goTo}
          onSearch={(q) => pdfRef.current?.search(q) ?? Promise.resolve([])}
          words={notebook.items}
          passages={passages.items}
          onRemoveWord={notebook.remove}
          onRemovePassage={passages.remove}
        />
      )}

      {showRecap && doc && <RecapPanel label={recapLabel} getText={getRecapText} onClose={() => setShowRecap(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
