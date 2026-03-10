# Initialized Portfolio — Frontend

React 19 + TypeScript + Vite frontend for the Initialized Portfolio News Tracker.

Reads directly from Supabase. The Cloudflare Worker backend handles all pipeline logic — the frontend is read-only.

## Pages

| Route | Description |
|---|---|
| `/companies` | Sortable table of portfolio companies with latest sentiment and digest history |
| `/daily` | Heatmap calendar of digest activity — click a day to see which companies were in the news |
| `/admin` | Roadmap page |

## Running Locally

```bash
npm install
npm run dev
```

Requires a `client/.env` file:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Building

```bash
npm run build
```

Output goes to `client/dist/`, which is picked up by the Cloudflare Worker's static assets config. Run `npm run deploy` from the repo root to build and deploy together.
