import express from "express";
import cors from "cors";
import { explain, recap, activeProvider } from "./ai.js";

const app = express();
const PORT = process.env.PORT || 8787;
const MAX_TEXT = 2000;
const MAX_CONTEXT = 4000;
const MAX_RECAP = 12000;

// Allow local dev + any Netlify deploy URL.
// Set the ALLOWED_ORIGIN env var to your production Netlify URL to lock it down,
// e.g. https://lexi-app.netlify.app
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : []),
];
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Render health checks) or matching origins.
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
  })
);
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: activeProvider() });
});

const fail = (res, err) => {
  console.error(err.message);
  res.status(err.status || 502).json({ error: err.message });
};

app.post("/api/explain", async (req, res) => {
  const { text, context = "", mode = "simple" } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }
  if (text.length > MAX_TEXT) {
    return res.status(400).json({ error: `text too long (max ${MAX_TEXT} chars)` });
  }
  try {
    const answer = await explain({
      text: text.trim(),
      context: String(context).slice(0, MAX_CONTEXT),
      mode: mode === "context" ? "context" : "simple",
    });
    res.json({ answer });
  } catch (err) {
    fail(res, err);
  }
});

app.post("/api/recap", async (req, res) => {
  const { text } = req.body ?? {};
  if (typeof text !== "string" || text.trim().length < 80) {
    return res.status(400).json({ error: "Not enough text to recap yet." });
  }
  try {
    res.json(await recap(text.slice(-MAX_RECAP)));
  } catch (err) {
    fail(res, err);
  }
});

app.listen(PORT, () => {
  console.log(`Lexi server on http://localhost:${PORT} (AI provider: ${activeProvider() ?? "none"})`);
});
