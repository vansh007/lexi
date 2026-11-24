import type { DictEntry } from "../types";

const cache = new Map<string, DictEntry | null>();

/** Strip punctuation and lowercase: "Ephemeral," -> "ephemeral" */
export function normalizeWord(raw: string): string {
  return raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").toLowerCase();
}

async function fetchJson(url: string, timeoutMs = 7000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Source 1: dictionaryapi.dev (has phonetics + audio, but is a free service that is often slow or down). */
async function fromDictionaryApi(word: string): Promise<DictEntry | null> {
  const res = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`dictionaryapi.dev returned ${res.status}`);

  const data = await res.json();
  const first = data[0];
  const phonetics: any[] = first.phonetics ?? [];
  return {
    word: first.word,
    phonetic: first.phonetic ?? phonetics.find((p) => p.text)?.text,
    audioUrl: phonetics.find((p) => p.audio)?.audio || undefined,
    meanings: (first.meanings ?? []).slice(0, 3).map((m: any) => {
      const d = m.definitions?.[0] ?? {};
      return {
        partOfSpeech: m.partOfSpeech,
        definition: d.definition,
        example: d.example,
        synonyms: (m.synonyms ?? []).slice(0, 4),
      };
    }),
  };
}

function stripHtml(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";
}

/** Source 2 (fallback): Wiktionary. Reliable, no phonetics or audio. */
async function fromWiktionary(word: string): Promise<DictEntry | null> {
  const res = await fetchJson(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`wiktionary returned ${res.status}`);

  const data = await res.json();
  const sections: any[] = data.en ?? [];
  if (sections.length === 0) return null;

  return {
    word,
    meanings: sections.slice(0, 3).map((s) => {
      const d = s.definitions?.[0] ?? {};
      return {
        partOfSpeech: String(s.partOfSpeech ?? "").toLowerCase(),
        definition: stripHtml(d.definition ?? ""),
        example: d.examples?.[0] ? stripHtml(d.examples[0]) : d.parsedExamples?.[0]?.example ? stripHtml(d.parsedExamples[0].example) : undefined,
        synonyms: [],
      };
    }),
  };
}

export async function lookupWord(raw: string): Promise<DictEntry | null> {
  const word = normalizeWord(raw);
  if (!word) return null;
  if (cache.has(word)) return cache.get(word)!;

  const errors: string[] = [];
  let entry: DictEntry | null = null;

  for (const source of [fromDictionaryApi, fromWiktionary]) {
    try {
      entry = await source(word);
      if (entry && entry.meanings.length) break;
      entry = null;
    } catch (e) {
      const msg = (e as Error).name === "AbortError" ? "timed out" : (e as Error).message;
      console.warn(`[lexi] ${source.name} failed:`, e);
      errors.push(`${source.name}: ${msg}`);
    }
  }

  // Every source errored (as opposed to "word not found"): report it instead of caching a miss.
  if (!entry && errors.length === 2) throw new Error(errors.join(" | "));

  cache.set(word, entry);
  return entry;
}
