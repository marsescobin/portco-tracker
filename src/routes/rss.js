import { extract } from '@extractus/feed-extractor';
import { matchCompanies } from '../utils/matcher.js';
import { filterCandidates } from '../utils/filter.js';
import { summarizeByCompany } from '../utils/summarize.js';
import { filterUnseenArticles, markArticlesSeen } from '../utils/dedup.js';
import { fetchArticleContent } from '../utils/fetchContent.js';
import { fetchFromNewsAPI } from '../utils/newsapi.js';
import { saveDigests, saveRun } from '../services/save.js';

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
		if (!bySource[src]) bySource[src] = { extracted: 0, dateFiltered: 0, deduped: 0, matched: 0, confirmed: 0, content: { rssContent: 0, readability: 0, firecrawl: 0, rssDescription: 0 } };
		return bySource[src];
	}

	for (const a of allArticles) get(a._source).extracted++;
	for (const a of recentArticles) get(a._source).dateFiltered++;
	for (const a of unseenArticles) get(a._source).deduped++;
	for (const { article } of candidates) get(article._source).matched++;
	for (const { article } of confirmed) get(article._source).confirmed++;
	for (const { article } of confirmedWithContent) {
		const m = article._contentMethod;
		if (m) get(article._source).content[m]++;
	}

	const totals = {
		extracted: allArticles.length,
		dateFiltered: recentArticles.length,
		deduped: unseenArticles.length,
		matched: new Set(candidates.map(c => c.article.link)).size,
		confirmed: new Set(confirmed.map(c => c.article.link)).size,
		content: confirmedWithContent.reduce((acc, { article }) => {
			const m = article._contentMethod;
			if (m) acc[m] = (acc[m] || 0) + 1;
			return acc;
		}, { rssContent: 0, readability: 0, firecrawl: 0, rssDescription: 0 }),
	};

	return { totals, bySource };
}

/**
 * Core pipeline logic. Fetches, filters, matches, summarises, and saves digests.
 * Returns { funnel, results } — throws on fatal error.
 */
export async function runPipeline(env) {
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
		const { totals, bySource } = buildFunnel(allArticles, recentArticles, unseenArticles, candidates, [], []);
		await saveRun(0, todayISO, totals, bySource, env);
		return { funnel: totals, results: [] };
	}

	// Step 6: LLM relevance filter
	const confirmed = await filterCandidates(candidates, env.OPENAI_API_KEY);

	const uniqueConfirmedArticles = new Set(confirmed.map((c) => c.article.link)).size;
	console.log(`[5] LLM FILTER ${uniqueConfirmedArticles} confirmed relevant (${candidates.length - confirmed.length} rejected)`);

	// Step 7: Mark all unseen articles as seen (regardless of LLM outcome)
	await markArticlesSeen(unseenArticles, env);

	if (confirmed.length === 0) {
		const { totals, bySource } = buildFunnel(allArticles, recentArticles, unseenArticles, candidates, confirmed, []);
		await saveRun(0, todayISO, totals, bySource, env);
		return { funnel: totals, results: [] };
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

	console.log(`[7] SUMMARISE  ${results.length} companies summarised`);

	const funnel = buildFunnel(allArticles, recentArticles, unseenArticles, candidates, confirmed, confirmedWithContent);

	// Step 10: Save digests to DB (upsert — one row per company per day)
	if (results.length > 0) {
		await saveDigests(results, todayISO, funnel.totals, env);
		console.log(`[8] SAVED      ${results.length} digests to init_news_digests`);
	}

	// Always record the run so the UI can show "last checked at"
	await saveRun(results.length, todayISO, funnel.totals, funnel.bySource, env);
	console.log(`[DONE]         Funnel totals: ${JSON.stringify(funnel.totals)}`);

	return { funnel: funnel.totals, results };
}

/**
 * HTTP handler for /api/fetch-news — wraps runPipeline in a Response.
 */
export async function fetchNews(headers, env) {
	try {
		const { funnel, results } = await runPipeline(env);
		return new Response(JSON.stringify({
			message: results.length > 0
				? `Found news for ${results.length} portfolio companies.`
				: 'No relevant company mentions found.',
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
