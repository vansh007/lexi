import { useCallback, useEffect, useRef, useState } from "react";
import type { BookMeta, DocKind, OpenDoc } from "../types";
import { deleteFile, getFile, putFile } from "../lib/library";

const KEY = "lexi.library.v1";

function load(): BookMeta[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useLibrary() {
  const [books, setBooks] = useState<BookMeta[]>(load);
  const ref = useRef(books);
  ref.current = books;

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(books));
  }, [books]);

  /** Remember a file the user just opened. Returns its id and where they left off last time. */
  const register = useCallback(async (name: string, kind: DocKind, data: ArrayBuffer) => {
    const id = `${name}:${data.byteLength}`;
    const existing = ref.current.find((b) => b.id === id);
    try {
      await putFile(id, data);
    } catch (e) {
      console.warn("[lexi] could not store file for later", e);
    }
    const now = Date.now();
    const meta: BookMeta = existing
      ? { ...existing, lastOpened: now }
      : { id, name, kind, page: kind === "pdf" ? 1 : 0, total: 0, addedAt: now, lastOpened: now };
    setBooks((prev) => [meta, ...prev.filter((b) => b.id !== id)]);
    return { id, startPage: meta.page };
  }, []);

  const setProgress = useCallback((id: string, page: number, total: number) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, page, total } : b)));
  }, []);

  /** Reopen a remembered book from IndexedDB. */
  const reopen = useCallback(async (id: string): Promise<OpenDoc | null> => {
    const meta = ref.current.find((b) => b.id === id);
    if (!meta) return null;
    const data = await getFile(id).catch(() => undefined);
    if (!data) {
      setBooks((prev) => prev.filter((b) => b.id !== id)); // file is gone; drop the stale entry
      return null;
    }
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, lastOpened: Date.now() } : b)));
    return { id, name: meta.name, kind: meta.kind, data, startPage: meta.page };
  }, []);

  const remove = useCallback((id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
    deleteFile(id).catch(() => {});
  }, []);

  return { books, register, setProgress, reopen, remove };
}
