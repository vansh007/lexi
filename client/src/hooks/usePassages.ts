import { useCallback, useEffect, useState } from "react";
import type { Passage } from "../types";

const KEY = "lexi.passages.v1";

function load(): Passage[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function usePassages() {
  const [items, setItems] = useState<Passage[]>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((p: Omit<Passage, "id" | "savedAt">) => {
    setItems((prev) => {
      if (prev.some((x) => x.text === p.text && x.source === p.source)) return prev;
      return [{ ...p, id: crypto.randomUUID(), savedAt: Date.now() }, ...prev];
    });
  }, []);

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((p) => p.id !== id)), []);
  const has = useCallback((text: string, source: string) => items.some((p) => p.text === text && p.source === source), [items]);

  return { items, add, remove, has };
}
