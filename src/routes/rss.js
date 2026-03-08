import { extract } from '@extractus/feed-extractor';
import { matchCompanies } from '../utils/matcher.js';
import { filterCandidates } from '../utils/filter.js';
import { summarizeByCompany } from '../utils/summarize.js';
import { filterUnseenArticles, markArticlesSeen } from '../utils/dedup.js';
import { fetchArticleContent } from '../utils/fetchContent.js';
import { fetchFromNewsAPI } from '../utils/newsapi.js';

const RSS_FEEDS = [
	// Tech News
	{ name: 'VentureBeat', url: 'http://venturebeat.com/feed/' },
	{ name: 'The Verge', url: 'http://www.theverge.com/rss/full.xml' },
	{ name: 'Engadget', url: 'http://www.engadget.com/rss-full.xml' },
	{ name: 'Tech in Asia', url: 'https://feeds2.feedburner.com/PennOlson' },
	{ name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
	{ name: 'Fast Company', url: 'http://feeds.feedburner.com/fastcompany/headlines' },
	{ name: 'CNBC Tech', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
	{ name: 'CNBC Startups', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html' },
	{ name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },
	{ name: 'Wired AI', url: 'https://www.wired.com/feed/tag/tech/latest/rss' },
	{ name: 'CNBC Technology', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910' },
	
	// Products & Ideas
	{ name: 'Product Hunt', url: 'http://www.producthunt.com/feed' },
	{ name: 'Hacker News: Show HN', url: 'http://hnrss.org/show' },
	{ name: 'Hacker News: Launches', url: 'https://hnrss.org/launches' },
	// Business
	{ name: 'Forbes', url: 'https://www.forbes.com/business/feed/' },
	{ name: 'Business Insider', url: 'https://feeds.businessinsider.com/custom/all' },
	{ name: 'Crunchbase News', url: 'https://news.crunchbase.com/feed/' },
	{ name: 'Yahoo Finance', url: 'https://news.yahoo.com/rss/finance' },
	{ name: 'Wired Business', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
	{ name: 'CNBC Finance', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
	{ name: 'CNBC Business', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147' },
	{ name: 'Yahoo Tech', url: 'https://news.yahoo.com/rss/tech' },

	// Crypto
	{ name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
	{ name: 'Decrypt', url: 'https://decrypt.co/feed' },
	{ name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
	// Health / Biotech
	{ name: 'STAT News', url: 'https://www.statnews.com/feed/' },
	{ name: 'Fierce Biotech', url: 'https://www.fiercebiotech.com/rss/xml' },
	{ name: 'MedCity News', url: 'https://medcitynews.com/feed/' },
	// Space / Defense
	{ name: 'Space News', url: 'https://spacenews.com/feed/' },
	{ name: 'TechCrunch Space', url: 'https://techcrunch.com/category/space/feed/' },
	// Fintech
	{ name: 'Finextra', url: 'https://www.finextra.com/rss/headlines.aspx' },
	{ name: 'PYMNTS', url: 'https://www.pymnts.com/feed/' },
];

/**
 * Derives the full pipeline funnel from intermediate arrays.
 * No tracking code lives in the pipeline itself — just pass the arrays in at the end.
 */
function buildFunnel(allArticles, recentArticles, unseenArticles, candidates, confirmed, confirmedWithContent) {
	const bySource = {};

	function get(src) {
		if (!bySource[src]) bySource[src] = {
			extracted: 0,
			dateFiltered: 0,
			deduped: 0,
			matched: 0,
			confirmed: 0,
			content: { rssContent: 0, readability: 0, firecrawl: 0, rssDescription: 0 },
		};
		return bySource[src];
	}

	// Extracted — everything pulled from feeds
	for (const a of allArticles) get(a._source).extracted++;

	// Date filtered — in allArticles but didn't make it into recentArticles
	const recentLinks = new Set(recentArticles.map((a) => a.link));
	for (const a of allArticles) {
		if (a.link && !recentLinks.has(a.link)) get(a._source).dateFiltered++;
	}

	// Deduped — in recentArticles but already seen in DB
	const unseenLinks = new Set(unseenArticles.map((a) => a.link));
	for (const a of recentArticles) {
		if (a.link && !unseenLinks.has(a.link)) get(a._source).deduped++;
	}

	// Matched — unique articles with ≥1 company name match
	const matchedLinks = new Set();
	for (const { article } of candidates) {
		if (!matchedLinks.has(article.link)) {
			matchedLinks.add(article.link);
			get(article._source).matched++;
		}
	}

	// Confirmed — unique articles the LLM said were relevant
	const confirmedLinks = new Set();
	for (const { article } of confirmed) {
		if (!confirmedLinks.has(article.link)) {
			confirmedLinks.add(article.link);
			get(article._source).confirmed++;
		}
	}

	// Content fetch method — tracked via _contentMethod on each article
	for (const { article } of confirmedWithContent) {
		if (article._contentMethod) {
			get(article._source).content[article._contentMethod]++;
		}
	}

	// Roll up totals across all sources
	const totals = Object.values(bySource).reduce(
		(acc, src) => {
			acc.extracted += src.extracted;
			acc.dateFiltered += src.dateFiltered;
			acc.deduped += src.deduped;
			acc.matched += src.matched;
			acc.confirmed += src.confirmed;
			for (const [k, v] of Object.entries(src.content)) {
				acc.content[k] = (acc.content[k] || 0) + v;
			}
			return acc;
		},
		{ extracted: 0, dateFiltered: 0, deduped: 0, matched: 0, confirmed: 0, content: {} }
	);

	return { bySource, totals };
}

export async function fetchNews(headers, env) {
	try {
		// Step 1: Compute today's date in PST (used for date filter + NewsAPI `from` param)
		const todayPST = new Date(
			new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })
		);
		const todayISO = todayPST.toISOString().split('T')[0]; // e.g. "2026-03-08"

		// Step 2: Fetch RSS feeds and NewsAPI in parallel
		const [feedResults, newsApiArticles] = await Promise.all([
			Promise.allSettled(RSS_FEEDS.map((feed) => extract(feed.url))),
			fetchFromNewsAPI(env.NEWS_API_KEY, todayISO),
		]);

		// Tag each RSS article with its source feed name
		const rssArticles = feedResults.flatMap((result, i) => {
			if (result.status !== 'fulfilled') return [];
			return (result.value.entries ?? []).map((entry) => ({
				...entry,
				_source: RSS_FEEDS[i].name,
			}));
		});

		// Tag NewsAPI articles with their publication name
		const taggedNewsApiArticles = newsApiArticles.map((a) => ({
			...a,
			_source: a.source || 'NewsAPI',
		}));

		const allArticles = [...rssArticles, ...taggedNewsApiArticles];
		console.log(`[1] FETCH      RSS: ${rssArticles.length} articles | NewsAPI: ${taggedNewsApiArticles.length} articles | Total: ${allArticles.length}`);

		// Step 3: Filter to articles published today (PST)
		const recentArticles = allArticles.filter((article) => {
			if (!article.published) return true; // no date = pass through
			return new Date(article.published) >= todayPST;
		});

		console.log(`[2] DATE FILTER ${recentArticles.length} passed (${allArticles.length - recentArticles.length} dropped — not today)`);

		// Step 4: Filter out already-seen articles
		const unseenArticles = await filterUnseenArticles(recentArticles, env);

		console.log(`[3] DEDUP      ${unseenArticles.length} unseen (${recentArticles.length - unseenArticles.length} already seen — skipped)`);

		// Step 5: Match portfolio company names against unseen articles
		const candidates = matchCompanies(unseenArticles);

		const uniqueMatchedArticles = new Set(candidates.map((c) => c.article.link)).size;
		console.log(`[4] MATCH      ${uniqueMatchedArticles} unique articles matched (${candidates.length} total company hits across those articles)`);

		if (candidates.length === 0) {
			return new Response(JSON.stringify({
				message: 'No company mentions found in today\'s articles.',
				funnel: buildFunnel(allArticles, recentArticles, unseenArticles, candidates, [], []),
				results: [],
			}), { status: 200, headers });
		}

		// Step 6: LLM relevance filter
		const confirmed = await filterCandidates(candidates, env.OPENAI_API_KEY);

		const uniqueConfirmedArticles = new Set(confirmed.map((c) => c.article.link)).size;
		console.log(`[5] LLM FILTER ${uniqueConfirmedArticles} confirmed relevant (${candidates.length - confirmed.length} rejected)`);

		// Step 7: Mark all unseen articles as seen (regardless of LLM outcome)
		await markArticlesSeen(unseenArticles, env);

		if (confirmed.length === 0) {
			return new Response(JSON.stringify({
				message: 'No relevant company mentions confirmed by LLM.',
				funnel: buildFunnel(allArticles, recentArticles, unseenArticles, candidates, confirmed, []),
				results: [],
			}), { status: 200, headers });
		}

		// Step 8: Fetch full content — attach _contentMethod to each article for funnel tracking
		const confirmedWithContent = await Promise.all(
			confirmed.map(async (candidate) => {
				const { content, method } = await fetchArticleContent(candidate.article, env.FIRECRAWL_API_KEY);
				return {
					...candidate,
					article: { ...candidate.article, content, _contentMethod: method },
				};
			})
		);

		const methodCounts = confirmedWithContent.reduce((acc, { article }) => {
			if (article._contentMethod) acc[article._contentMethod] = (acc[article._contentMethod] || 0) + 1;
			return acc;
		}, {});
		console.log(`[6] CONTENT    ${confirmedWithContent.length} articles fetched — ${JSON.stringify(methodCounts)}`);

		// Step 9: LLM summarize by company
		const results = await summarizeByCompany(confirmedWithContent, env.OPENAI_API_KEY);

		const funnel = buildFunnel(allArticles, recentArticles, unseenArticles, candidates, confirmed, confirmedWithContent);
		console.log(`[7] DONE       ${results.length} companies summarised | Funnel totals: ${JSON.stringify(funnel.totals)}`);

		return new Response(JSON.stringify({
			message: `Found news for ${results.length} portfolio companies.`,
			funnel,
			results,
		}), { status: 200, headers });

	} catch (err) {
		return new Response(JSON.stringify({
			error: 'News fetch failed',
			details: String(err),
		}), { status: 500, headers });
	}
}
