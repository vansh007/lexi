export type SelectionKind = "word" | "sentence";

export interface SelectionInfo {
  text: string;        // exactly what the user selected (trimmed)
  kind: SelectionKind; // single word vs phrase/sentence
  context: string;     // surrounding paragraph text (for context-aware AI)
  page?: number;       // PDF page the selection starts on
  rect: { top: number; left: number; bottom: number; right: number }; // viewport coords
}

export interface DictEntry {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: { partOfSpeech: string; definition: string; example?: string; synonyms: string[] }[];
}

export interface NotebookItem {
  id: string;
  word: string;
  meaning: string;
  sentence: string; // the context where it was found
  source: string;   // file name
  page?: number;
  savedAt: number;
}

export interface Passage {
  id: string;
  text: string;
  page?: number;
  source: string; // file name
  savedAt: number;
}

export type DocKind = "pdf" | "docx";

/** A document that is currently open in the reader. */
export interface OpenDoc {
  id: string;
  name: string;
  kind: DocKind;
  data: ArrayBuffer;
  startPage: number; // PDF: page number. DOCX: percent scrolled (0-100).
}

/** A book remembered in the library (the file itself lives in IndexedDB). */
export interface BookMeta {
  id: string;
  name: string;
  kind: DocKind;
  page: number;  // PDF: last page. DOCX: percent.
  total: number; // PDF: page count. DOCX: 100.
  addedAt: number;
  lastOpened: number;
}

export interface OutlineItem {
  title: string;
  page: number;
  depth: number;
}

export type ReadTheme = "day" | "sepia" | "night";

export interface RecapResult {
  recap: string;
  questions: { q: string; a: string }[];
}
