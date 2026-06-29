# Transformation & Talent Readiness

A self-contained web app that researches a company's transformation challenges, maps each to people processes and a Build/Buy/Borrow/Bot sourcing route, scores capability readiness, presents the findings as an interactive Cornerstone-branded slide deck, exports them to PowerPoint, and saves every analysis to a cloud library. Built with Vite and React.

## What it does

1. **Intake** — enter customer name, industry, geography, theme, number of challenges and horizon.
2. **Research** — a serverless proxy calls Claude with web search to ground the challenges in the company's real public strategy.
3. **Present** — results stream into an interactive slide deck (cover, executive summary, portfolio, and two slides per challenge) navigable with on-screen controls, arrow keys, and fullscreen.
4. **Export** — download the deck as a branded `.pptx` PowerPoint file.
5. **Library** — every completed analysis is saved and can be reopened. With cloud storage configured, the library syncs across browsers and devices.

## How the connections work

The browser never holds any secret. Two serverless endpoints sit in front:

```
Browser  ->  /api/messages   ->  Anthropic API      (research, with web search)
Browser  ->  /api/records    ->  Upstash Redis       (saved analyses)
```

`ANTHROPIC_API_KEY` and the Upstash credentials live only in the server environment. Both Vercel functions (`api/*.js`) and Netlify functions (`netlify/functions/*.js`) are included and share the same cores; the frontend always calls `/api/messages` and `/api/records`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | Claude research calls. Create at https://console.anthropic.com/ |
| `UPSTASH_REDIS_REST_URL` | For cloud sync | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | For cloud sync | Upstash Redis REST token |

If the Upstash variables are absent, the app still works: records fall back to per-browser local storage (no cross-device sync). The intake screen shows which mode is active.

### Setting up cloud storage (free)

1. Create a database at https://upstash.com/ (free tier is fine).
2. Open the database, find the **REST API** section, and copy the REST URL and token.
3. Add both as environment variables in your hosting provider, then redeploy.

## Deploy to Vercel (recommended)

1. Import the Git repository at https://vercel.com/. Vercel auto-detects Vite.
2. Add the environment variables above in Project Settings.
3. Deploy. `vercel.json` raises the research function timeout to 60 seconds so web-search calls complete.

> Note: Vercel's free Hobby tier is for non-commercial use. For work use, deploy on a paid plan.

## Deploy to Netlify

1. Connect the repository in Netlify.
2. Add the environment variables in Site settings.
3. Deploy. `netlify.toml` configures the build, functions, and `/api/*` redirects.

> Note: Netlify's free synchronous function timeout is 10 seconds, which is often too short for a web-search research call. Use Vercel, or Netlify Pro (26 seconds), for reliable results.

## Run locally

```bash
npm install
cp .env.example .env      # add your real keys

npx vercel dev            # or: npx netlify dev
```

Use a platform CLI (`vercel dev` / `netlify dev`) so the `/api/*` functions are served. Plain `npm run dev` serves only the UI; the API calls will 404.

## Notes

- Model/tool versions: the app uses `claude-sonnet-4-6` and the `web_search_20250305` tool. If Anthropic returns an unknown-model or unknown-tool error, update those strings in `src/App.jsx`.
- The PowerPoint export runs entirely in the browser (pptxgenjs, lazy-loaded on first export). It does not call the server.
- Cost: each analysis is one research call (with web search) plus one call per challenge.

## Project structure

```
.
├── api/
│   ├── _anthropic.js     research forwarding core
│   ├── _store.js         records store core (Upstash)
│   ├── messages.js       Vercel: POST /api/messages
│   └── records.js        Vercel: /api/records
├── netlify/functions/
│   ├── messages.js       Netlify research function
│   └── records.js        Netlify records function
├── src/
│   ├── App.jsx           the application (intake, deck, export, library)
│   ├── main.jsx
│   └── index.css
├── index.html
├── netlify.toml
├── vercel.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── .env.example
```
