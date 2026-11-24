# Lexi — AI Reading Assistant

An in-browser reading assistant that explains selected text and generates reading recaps, powered by your choice of Gemini, Claude, or OpenAI.

## Project Structure

```
lexi/
├── client/      # React + Vite + TypeScript SPA
└── server/      # Express.js API (AI proxy)
```

## Local Development

```bash
# 1. Install all dependencies
npm run install:all

# 2. Create server env file
cp .env.example server/.env
# → Edit server/.env and add ONE API key (Gemini / Anthropic / OpenAI)

# 3. Start both client and server
npm run dev
# Client → http://localhost:5173
# Server → http://localhost:8787
```

## Deployment (Free Tier)

The recommended setup is **Render** (backend) + **Netlify** (frontend).

### 1 — Deploy the backend to Render

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo (`vansh007/lexi`)
3. Settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Node version**: 20
4. Under **Environment → Environment Variables**, add **one** of:
   | Variable | Value |
   |---|---|
   | `GEMINI_API_KEY` | your Gemini key |
   | `ANTHROPIC_API_KEY` | your Anthropic key |
   | `OPENAI_API_KEY` | your OpenAI key |
5. Also add `ALLOWED_ORIGIN` = your Netlify URL (after step 2, come back and set this)
6. Click **Deploy** — note the URL, e.g. `https://lexi-server.onrender.com`

### 2 — Deploy the frontend to Netlify

1. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
2. Connect your GitHub repo (`vansh007/lexi`)
3. Netlify auto-detects the `client/netlify.toml` config — no manual settings needed
4. Under **Site configuration → Environment variables**, add:
   | Variable | Value |
   |---|---|
   | `VITE_API_BASE` | your Render URL (e.g. `https://lexi-server.onrender.com`) |
5. **Trigger a redeploy** after adding the env var
6. Copy your Netlify URL (e.g. `https://lexi-app.netlify.app`) and set it as `ALLOWED_ORIGIN` in Render

> **Note on Render free tier**: The server sleeps after 15 minutes of inactivity and takes ~30 seconds to wake up on the first request. Upgrade to a paid plan to avoid cold starts.

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `GEMINI_API_KEY` | Render | Google Gemini API key |
| `ANTHROPIC_API_KEY` | Render | Anthropic Claude API key |
| `OPENAI_API_KEY` | Render | OpenAI API key |
| `ALLOWED_ORIGIN` | Render | Your Netlify URL (for CORS) |
| `VITE_API_BASE` | Netlify | Your Render backend URL |
| `PORT` | Render | Auto-set to 10000 by Render |
