# Initialized Portfolio News Tracker

A Cloudflare Worker that scrapes the Initialized Capital portfolio, fetches today's news for each company across 30+ sources, filters and summarizes it with GPT-5-mini, and returns per-company summaries with sentiment scoring.

**Live URL:** `<!-- ADD YOUR DEPLOYED URL HERE -->`

---

## How It Works

The pipeline runs in 9 steps when `GET /api/fetch-news` is called:

1. **Fetch** — Pulls articles in parallel from RSS feeds (TechCrunch, VentureBeat, Forbes, Crunchbase News, etc.) and NewsAPI, batched by company name
2. **Date filter** — Keeps only articles published today (PST) *(currently disabled during development)*
3. **Dedup** — Skips articles whose URLs have already been stored in Supabase from a prior run
4. **Match** — Scans headlines and descriptions for portfolio company name or website domain mentions using whole-word regex
5. **LLM relevance filter** — GPT-5-mini confirms each match is genuinely about that company, using the company description to disambiguate
6. **Mark seen** — Stores processed article URLs in Supabase so they won't be re-processed in future runs
7. **Content fetch** — Grabs full article text via a fallback chain: RSS body → Mozilla Readability → Firecrawl → RSS description
8. **Summarize** — GPT-5-mini writes a 2–3 sentence VC-voice summary per company
9. **Sentiment** — Each summary is tagged with a sentiment signal (`+`, `-`, or `mixed`) and a short reason phrase

Each response includes a breakdown of how many articles passed each stage (`articlesScanned`, `unseenArticles`, `candidatesFound`, `confirmed`).

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
RSS feeds give real-time, broad coverage across tech/business/startup verticals. NewsAPI adds targeted coverage — querying company names directly against a curated list of trusted domains (TechCrunch, VentureBeat, Forbes, Business Insider, Crunchbase, etc.) to reduce noise. Running both in parallel maximises coverage while keeping latency flat.

**Whole-word regex matching + domain matching**
Company names are matched using word-boundary regex (`\bCompanyName\b`) so partial matches (e.g. "Front" matching "Frontend") are excluded. On top of that, each company's website domain is also checked against the article text, which catches articles that link to the company but don't spell out its name in full. Both checks are case-insensitive.

**LLM disambiguation via company descriptions**
An early version used a manual `lowConfidence` blocklist for ambiguous names. We dropped that in favour of passing the company's actual description to the LLM relevance filter — letting the model do the disambiguation rather than maintaining a brittle blocklist. This scales better as the portfolio grows.

**Two-stage LLM pipeline**
Articles are first matched by keyword (cheap), then confirmed by GPT-5-mini (more expensive) before any content is fetched. This avoids wasting Firecrawl credits and summarization tokens on false positives. The filter and summarizer are separate calls so each prompt stays focused.

**Content fetch fallback chain**
Full article text produces meaningfully better summaries than titles + descriptions alone. The fallback chain (RSS body → Mozilla Readability → Firecrawl → RSS description) tries free/local methods first and only calls Firecrawl when needed, keeping API costs proportional to actual need.

**Deduplication via Supabase RPC**
Article URLs are stored after each run so the pipeline is safe to call multiple times per day without re-processing or re-summarising the same news. URLs with special characters (query strings, fragments) caused issues with PostgREST's filter syntax, so dedup queries go through a Supabase RPC function that accepts a JSON array of URLs instead.

**Portfolio data is static**
`/api/scrape-companies` pulls the portfolio once. The Initialized website is stable enough that re-running daily isn't necessary — but the endpoint exists to refresh manually when needed.

---

## What I'd Improve With More Time

- **Cron Trigger** — auto-run the pipeline on a schedule (e.g. every few hours) instead of requiring a manual API call
- **Frontend** — a proper UI to surface summaries, sentiment, and pipeline stats per run
- **Twitter / LinkedIn / Newsrooms** — add Apify scrapers for company social pages and newsroom RSS feeds for richer signal
- **Pipeline run logging** — persist per-run stats and errors to Supabase for an admin dashboard
- **Supabase service role key** — use a server-side key for writes instead of the anon key
- **KV cache for portfolio** — avoid hitting Supabase on every news run by caching the company list in Cloudflare KV
