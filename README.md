# Transformation & Talent Readiness

A self-contained web app that researches a company's transformation challenges, maps each to people processes and a Build/Buy/Borrow/Bot sourcing route, scores capability readiness, and exports a branded Word document. Built with Vite and React. Branded for Cornerstone.

## How the connection to Claude works

The browser never holds an API key. Instead:

```
Browser (React app)  ->  /api/messages  (serverless function)  ->  Anthropic API
```

The serverless function reads `ANTHROPIC_API_KEY` from the server environment, adds it to the request, and forwards the call to Claude. Web search is enabled on the research call so challenges are grounded in the company's real public strategy. The key stays server-side and is never shipped to the browser.

Both a Vercel function (`api/messages.js`) and a Netlify function (`netlify/functions/messages.js`) are included; they share one core (`api/_anthropic.js`). The frontend always calls `/api/messages`, and `netlify.toml` redirects that path to the Netlify function when hosted there.

## Deploy to Vercel

1. Push this folder to a Git repository, or run `vercel` from the project root.
2. In the Vercel project settings, add an environment variable:
   - `ANTHROPIC_API_KEY` = your key from https://console.anthropic.com/
3. Deploy. Vercel auto-detects Vite, builds to `dist`, and serves `api/messages.js` as a function. No extra config needed.

## Deploy to Netlify

1. Push this folder to a Git repository and connect it in Netlify, or run `netlify deploy --build`.
2. Add an environment variable in Site settings:
   - `ANTHROPIC_API_KEY` = your key
3. Deploy. `netlify.toml` sets the build command, publish directory, functions directory, and the `/api/messages` redirect.

## Run locally

The static frontend builds with Vite, but the `/api/messages` endpoint needs a function runtime. Use one of the platform CLIs so the function is served alongside the app:

```bash
npm install
cp .env.example .env        # then put your real key in .env

# Option A (Vercel CLI):
npx vercel dev

# Option B (Netlify CLI):
npx netlify dev
```

Plain `npm run dev` serves the UI but the research calls will 404, because there is no function host. Use a platform CLI for full local testing.

## Notes and things you may need to adjust

- Model and tool versions: the app requests `claude-sonnet-4-6` and the `web_search_20250305` tool. If Anthropic returns an error about an unknown model or tool version, update those strings in `src/App.jsx` (model and tool) to the current values from the Anthropic docs.
- Cost: each analysis makes one research call plus one call per challenge (so four challenges is five calls). The research call uses web search, which is billed per search. Monitor usage in the Anthropic console.
- Token budget: each call is capped at 2000 output tokens in `src/App.jsx`. Raise it if you want longer per-challenge detail, within the model's limit.
- The Word export is generated entirely in the browser as a Word-compatible `.doc`. It does not call the server.

## Project structure

```
.
├── api/
│   ├── _anthropic.js        shared forwarding core (not a route)
│   └── messages.js          Vercel function: POST /api/messages
├── netlify/
│   └── functions/
│       └── messages.js      Netlify function (same core)
├── src/
│   ├── App.jsx              the application
│   ├── main.jsx             React entry
│   └── index.css            Tailwind entry
├── index.html
├── netlify.toml
├── vercel.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── .env.example
```
