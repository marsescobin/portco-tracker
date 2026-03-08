# Initialized Portfolio News Tracker

A Cloudflare Worker that scrapes the Initialized Capital portfolio, fetches today's news for each company across 30+ sources, filters and summarizes it with GPT-5-mini, and returns structured results with per-company sentiment.

**Live URL:** `<!-- ADD YOUR DEPLOYED URL HERE -->`

---

## How It Works

The pipeline runs in 7 steps when `GET /api/fetch-news` is called:

1. **Fetch** — Pulls articles in parallel from 30+ RSS feeds (TechCrunch, VentureBeat, Forbes, CoinDesk, STAT News, etc.) and NewsAPI, batched by company name
2. **Date filter** — Keeps only articles published today (PST)
3. **Dedup** — Skips articles already stored in Supabase from prior runs
4. **Match** — Scans headlines and descriptions for portfolio company name mentions
5. **LLM relevance filter** — GPT-5-mini confirms each match is actually about the company (not just a name collision)
6. **Content fetch** — Grabs full article text via a fallback chain: RSS body → Mozilla Readability → Firecrawl → RSS description
7. **Summarize** — GPT-5-mini writes a 2–3 sentence VC-voice summary per company with sentiment (`+`, `-`, `mixed`)

Each response also includes a `funnel` object that breaks down how many articles passed each stage, per source.

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/scrape-companies` | Scrapes the Initialized portfolio and upserts companies into Supabase |
| `GET /api/fetch-news` | Runs the full news pipeline and returns summaries |
| `GET /api/test-firecrawl?url=<url>` | Debug: returns raw Firecrawl response for a given URL |

---

## Tech Stack

| Layer | Tool |
|---|---|
| Runtime | Cloudflare Workers |
| Database | Supabase (PostgreSQL) |
| News sources | 30+ RSS feeds + NewsAPI |
| Content extraction | Mozilla Readability, Firecrawl |
| AI | OpenAI GPT-5-mini |
| Deploy | Wrangler CLI |

---

## Running Locally

**1. Clone and install**

```bash
git clone <your-repo-url>
cd crimson-term-faa5
npm install
```

**2. Set up secrets**

Create a `.dev.vars` file in the project root (this file is gitignored):

```
OPENAI_API_KEY=...
NEWS_API_KEY=...
FIRECRAWL_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

**3. Start the dev server**

```bash
npm run dev
```

The worker runs at `http://localhost:8787`.

**4. Run tests**

```bash
npm test
```

---

## Deploying

```bash
npm run deploy
```

Set production secrets via Wrangler:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put NEWS_API_KEY
npx wrangler secret put FIRECRAWL_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
```

---

## AI Tools Used

`<!-- List the AI tools you used here, e.g.: Cursor, ChatGPT, Claude, Copilot -->`

---

## Decisions & Trade-offs

**Dual news source strategy**
RSS feeds give real-time, broad coverage across tech/business/crypto/biotech verticals. NewsAPI adds targeted coverage — querying company names directly against trusted domains (Reuters, Bloomberg, WSJ, etc.). Together they reduce blind spots either source would have alone.

**Two-stage LLM filtering**
Articles are first matched by keyword, then confirmed by GPT-5-mini before content is fetched. This avoids wasting Firecrawl credits and summarization tokens on false positives (e.g. "Coinbase" appearing in an unrelated crypto article).

**Content fetch fallback chain**
Full article text improves summary quality significantly. The chain (RSS body → Readability → Firecrawl → description) tries free/local methods first and only calls Firecrawl when needed, keeping API costs low.

**Deduplication via Supabase**
Article URLs are stored after each run so re-fetching the same feeds doesn't re-process or re-summarize the same news. This makes the endpoint safe to call multiple times per day.

**Portfolio data is static**
`/api/scrape-companies` pulls the portfolio once and stores it. The Initialized website data is stable enough that re-running it daily isn't necessary — but the endpoint exists to refresh it manually when needed.

**What I'd improve with more time**
- Add a scheduled Cron Trigger to auto-run the pipeline daily instead of requiring a manual API call
- Build a proper frontend UI instead of returning raw JSON
- Add a `service_role` key for server-side Supabase writes instead of the anon key
- Cache the portfolio list in KV to avoid the DB call on every news run
# portco-tracker
