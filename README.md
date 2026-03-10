# Initialized Portfolio News Tracker

A full-stack portfolio intelligence tool for Initialized Capital. A Cloudflare Worker runs a multi-stage news pipeline — scraping RSS feeds and NewsAPI, filtering and confirming matches with GPT-5-mini, fetching full article content, and generating VC-voice summaries with sentiment scoring. Results are stored in Supabase and surfaced in a React frontend.

**Live URL:** `https://initialized-portcos.marsescobin.workers.dev/`

---

## How It Works

The pipeline runs in 10 steps when `GET /api/fetch-news` is called (or on the hourly cron trigger):

1. **Fetch** — Pulls articles in parallel from 30+ RSS feeds (TechCrunch, VentureBeat, Forbes, Crunchbase News, etc.) and NewsAPI, batched by company name
2. **Date filter** — Keeps only articles published today (PST)
3. **Dedup** — Skips articles whose URLs have already been stored in Supabase from a prior run
4. **Match** — Scans headlines and descriptions for portfolio company name or website domain mentions using whole-word regex
5. **LLM relevance filter** — GPT-5-mini confirms each match is genuinely about that company, using the company description to disambiguate
6. **Mark seen** — Stores processed article URLs in Supabase so they won't be re-processed in future runs
7. **Content fetch** — Grabs full article text via a fallback chain: RSS body → Mozilla Readability → Firecrawl → RSS description
8. **Signal filter** — GPT-5-mini drops articles with no meaningful investor signal (e.g. generic listicles that mention the company in passing)
9. **Summarize** — GPT-5-mini writes a VC-voice digest per company, merging with any digest already produced earlier today
10. **Save** — Upserts digests to `init_news_digests` and records pipeline run stats in `init_pipeline_runs`

Each response includes a funnel breakdown showing how many articles passed each stage.

---

## Frontend

Three pages served at the live URL:

| Page | Description |
|---|---|
| `/companies` | Sortable table of all portfolio companies. Click any row to expand and see the company's full digest history — summaries, sentiment, and source articles |
| `/daily` | Heatmap calendar showing digest activity across the year. Click any square to see which companies were in the news that day |
| `/admin` | Roadmap of upcoming features |

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/fetch-news` | Runs the full news pipeline and saves results to Supabase |
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
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Data fetching | TanStack Query v5, Supabase JS client |
| UI | shadcn/ui, Lucide icons |
| Deploy | Wrangler CLI |

---

## Running Locally

**1. Clone and install**

```bash
git clone <your-repo-url>
cd crimson-term-faa5
npm install
```

**2. Set up Worker secrets**

Create a `.dev.vars` file in the project root (gitignored):

```
OPENAI_API_KEY=...
NEWS_API_KEY=...
FIRECRAWL_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

**3. Set up frontend env vars**

Create a `.env` file inside the `client/` folder (gitignored):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**4. Start the Worker**

```bash
npm run dev
```

The Worker runs at `http://localhost:8787`.

**5. Start the frontend**

```bash
cd client
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

**6. Trigger the pipeline locally**

With the Worker running, hit the fetch-news endpoint to run the full pipeline (RSS + NewsAPI):

```bash
curl http://localhost:8787/api/fetch-news
```

NewsAPI is active in local development. In production, RSS feeds only (NewsAPI free tier blocks non-localhost requests).

**7. Run tests**

```bash
npm test
```

---

## Seeding Initial Data

The database is pre-populated. To replicate from scratch:

**1. Seed portfolio companies**

Companies were scraped from the Initialized Capital website using a Firecrawl agent, saved to `companies.json`, and loaded into Supabase:

```bash
node scripts/seed-companies.js
```

**2. Seed initial digests**

The RSS pipeline only surfaces articles published today. To bootstrap historical digest data, `run-seed.mjs` uses the Firecrawl `/search` API to find recent articles per company, then runs them through the same LLM pipeline (relevance filter → signal filter → summarize → save):

```bash
node run-seed.mjs
```

**3. Manual digest override**

For companies where automated search returns poor results, `run-manual.mjs` lets you provide article URLs directly. It skips the search and relevance filter steps and goes straight to content fetch → signal filter → summarize → save:

```bash
node run-manual.mjs
```

---

## Deploying

`npm run deploy` builds the frontend and deploys the Worker (with static assets) in one step:

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

Cursor (primary) — used throughout for code generation, refactoring, and debugging.

---

## Decisions & Trade-offs

**Dual news source strategy**
RSS feeds give real-time, broad coverage across tech/business/startup verticals. NewsAPI adds targeted coverage — querying company names directly against a curated list of trusted domains (TechCrunch, VentureBeat, Forbes, Business Insider, Crunchbase, etc.) to reduce noise. Running both in parallel maximises coverage while keeping latency flat. We also evaluated newsdata.io and Newsmesh but found the signal-to-noise ratio and free tier limits less suited to the use case. Note: NewsAPI's free tier blocks non-localhost requests, so in production the pipeline runs on RSS feeds only; NewsAPI is active in local development.

**Whole-word regex matching + domain matching**
Company names are matched using word-boundary regex (`\bCompanyName\b`) so partial matches (e.g. "Front" matching "Frontend") are excluded. On top of that, each company's website domain is also checked against the article text, which catches articles that link to the company but don't spell out its name in full. Both checks are case-insensitive.

**LLM disambiguation via company descriptions**
An early version used a manual `lowConfidence` blocklist for ambiguous names. We dropped that in favour of passing the company's actual description to the LLM relevance filter — letting the model do the disambiguation rather than maintaining a brittle blocklist. This scales better as the portfolio grows.

**Three-stage LLM pipeline**
Articles are first matched by keyword (cheap), then confirmed by GPT-5-mini (more expensive), then filtered for investor signal before any summarization happens. This avoids wasting Firecrawl credits and summarization tokens on false positives. Each prompt stays focused on one task. The signal filter was added after watching production data — early runs showed articles making it through the relevance filter that were technically about the company but had nothing useful to contribute (e.g. passing mentions in roundups). Adding a dedicated signal stage before summarization cut this noise significantly.

**Summarizer merge logic**
The pipeline is designed to run multiple times per day. Rather than overwriting a company's digest on repeat runs, the summarizer receives any digest already produced earlier that day and merges new articles into it — updating bullets if the same story has more detail, or adding new ones for distinct developments. This means running the pipeline more frequently accumulates coverage rather than losing earlier findings.

**Content fetch fallback chain**
Full article text produces meaningfully better summaries than titles + descriptions alone. The fallback chain (RSS body → Mozilla Readability → Firecrawl → RSS description) tries free/local methods first and only calls Firecrawl when needed, keeping API costs proportional to actual need.

**Deduplication via Supabase RPC**
Article URLs are stored after each run so the pipeline is safe to call multiple times per day without re-processing or re-summarising the same news. URLs with special characters (query strings, fragments) caused issues with PostgREST's filter syntax, so dedup queries go through a Supabase RPC function that accepts a JSON array of URLs instead.

**Portfolio data is static**
The Initialized portfolio was scraped once and seeded into Supabase. The website is stable enough that re-running daily isn't necessary — the data can be refreshed manually by re-running the seed script when needed.

---

## What I'd Improve With More Time

- **Twitter / Newsrooms** — did early evaluation and the Apify approach for Twitter looks feasible; would add meaningful signal that pure news coverage misses. Newsrooms are straightforward to fetch (most have RSS or a `/press` page) but require change monitoring — tracking page hashes or seen article URLs — to avoid re-processing the same content on every run. LinkedIn is a harder target due to aggressive scraper blocking. Didn't have time to build any of this out
- **Pipeline run dashboard** — surface per-run funnel stats, source health, and error logs in the Admin page
- **Content storage + embeddings** — this is the one I most wanted to build but didn't have time for. Currently the full article content is fetched, used for summarization, and discarded. The next step would be to persist it, chunk it, and embed it into a vector store (e.g. Supabase pgvector) to enable RAG
- **Smart search** — once embeddings are in place, natural language search across all past digests and articles becomes straightforward ("which companies raised money this quarter", "what's happening in fintech this week")
- **Digest delivery** — push the daily digest to Slack or email on a schedule
- **KV cache for portfolio** — avoid hitting Supabase on every news run by caching the company list in Cloudflare KV
