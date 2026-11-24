import type { RecapResult } from "../types";

export type ExplainMode = "simple" | "context";

// In dev the Vite proxy forwards /api → localhost:8787.
// In production set VITE_API_BASE to your Render backend URL, e.g.:
//   https://lexi-server.onrender.com
// Leave it empty (or unset) to keep using relative /api paths (Vite proxy / same-origin).
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export async function explainText(text: string, context: string, mode: ExplainMode): Promise<string> {
  return (await post<{ answer: string }>("/api/explain", { text, context, mode })).answer;
}

export function recapPages(text: string): Promise<RecapResult> {
  return post<RecapResult>("/api/recap", { text });
}
