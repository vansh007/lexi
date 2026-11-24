import { useEffect, useState, useCallback } from "react";
import type { NotebookItem } from "../types";

const KEY = "lexi.notebook.v1";

function load(): NotebookItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useNotebook() {
  const [items, setItems] = useState<NotebookItem[]>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((item: Omit<NotebookItem, "id" | "savedAt">) => {
    setItems((prev) => {
      if (prev.some((p) => p.word.toLowerCase() === item.word.toLowerCase())) return prev;
      return [{ ...item, id: crypto.randomUUID(), savedAt: Date.now() }, ...prev];
    });
  }, []);

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((p) => p.id !== id)), []);
  const has = useCallback(
    (word: string) => items.some((p) => p.word.toLowerCase() === word.toLowerCase()),
    [items]
  );

  return { items, add, remove, has };
}
