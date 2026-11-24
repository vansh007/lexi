// Provider-agnostic AI helper. Uses plain fetch (Node 20+), no SDKs.

const EXPLAIN_SYSTEM = `You are a reading assistant embedded in a document reader.
The reader selects text from a book or article and wants to understand it.
Rules:
- Use simple, plain English. Short sentences. No jargon unless you explain it.
- Never invent what the author "really means" beyond what the text supports.
- Keep answers under 120 words unless asked otherwise.
- Format: first a one-line plain-English rewrite, then (if useful) a short
  breakdown of hard words or phrases as "term: meaning" lines, then at most one example.`;

const RECAP_SYSTEM = `You help a reader remember what they just read.
Given an excerpt from a book, reply with ONLY a JSON object, no markdown fences, in exactly this shape:
{"recap": "2-3 plain sentences covering the key ideas", "questions": [{"q": "question", "a": "short answer"}]}
Write exactly 3 questions that test understanding of ideas, not trivia like names or numbers.
Answer only from the excerpt. If the excerpt is mostly front matter, tables of contents or page numbers, say so in "recap" and return an empty questions array.`;

async function viaAnthropic({ system, prompt, maxTokens }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

async function viaOpenAI({ system, prompt, maxTokens }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function viaGemini({ system, prompt, maxTokens }) {
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: system
        ? {
            parts: [{ text: system }],
          }
        : undefined,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text).join("") ?? "";
  return text;
}

export function activeProvider() {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

async function generate({ system, prompt, maxTokens = 500 }) {
  const provider = activeProvider();
  if (!provider) {
    const err = new Error("No AI key configured. Add GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY to server/.env");
    err.status = 503;
    throw err;
  }
  const args = { system, prompt, maxTokens };
  if (provider === "gemini") return viaGemini(args);
  return provider === "anthropic" ? viaAnthropic(args) : viaOpenAI(args);
}

export function explain({ text, context, mode }) {
  const prompt =
    mode === "context" && context
      ? `Surrounding paragraph:\n"""${context}"""\n\nSelected text:\n"""${text}"""\n\nExplain what the selected text means *in this context*.`
      : `Selected text:\n"""${text}"""\n\nExplain this in simple English.`;
  return generate({ system: EXPLAIN_SYSTEM, prompt });
}

export async function recap(text) {
  const raw = await generate({
    system: RECAP_SYSTEM,
    prompt: `Excerpt:\n"""${text}"""`,
    maxTokens: 900,
  });
  // Models sometimes wrap JSON in fences or add a sentence around it; pull out the object.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The AI reply wasn't in the expected format. Try again.");
  const parsed = JSON.parse(raw.slice(start, end + 1));
  return {
    recap: String(parsed.recap ?? ""),
    questions: Array.isArray(parsed.questions)
      ? parsed.questions.slice(0, 3).map((x) => ({ q: String(x.q ?? ""), a: String(x.a ?? "") }))
      : [],
  };
}
