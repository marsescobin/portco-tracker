import { extract } from '@extractus/feed-extractor';
import { matchCompanies } from '../utils/matcher.js';
import { filterCandidates } from '../utils/filter.js';
import { summarizeByCompany } from '../utils/summarize.js';
import { filterUnseenArticles, markArticlesSeen } from '../utils/dedup.js';
import { fetchArticleContent } from '../utils/fetchContent.js';
import { fetchFromNewsAPI } from '../utils/newsapi.js';
import { saveDigests, saveRun, fetchTodaysDigests, saveSignalChecks } from '../services/save.js';
import { filterBySignal } from '../utils/news-relevance.js';
import { createPipelineLog } from '../utils/pipeline-log.js';
import { fetchNewsSources } from '../services/sources.js';

const FEED_FETCH_OPTIONS = {
	headers: { 'user-agent': 'initialized-portfolio-tracker/1.0 (RSS feed reader)' },
};

/**
 * Derives the full pipeline funnel from intermediate arrays.
 * No tracking code lives in the pipeline itself — just pass the arrays in at the end.
 */
function buildFunnel(allArticles, recentArticles, unseenArticles, candidates, confirmed, confirmedWithContent) {
	const bySource = {};

	function get(src) {
		if (!bySource[src]) bySource[src] = { url: null, extracted: 0, dateFiltered: 0, deduped: 0, matched: 0, confirmed: 0, content: { rssContent: 0, readability: 0, firecrawl: 0, rssDescription: 0 } };
		return bySource[src];
	}

	for (const a of allArticles) {
		const entry = get(a._source);
		entry.extracted++;
		if (a._sourceUrl && !entry.url) entry.url = a._sourceUrl;
	}
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
 * Returns { funnel, results }.
 *
 * Fatal errors are caught, logged to the structured event log, and persisted
 * to init_pipeline_runs with status 'failed' before re-throwing.
 */
export async function runPipeline(env) {
	const log = createPipelineLog();
	const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // e.g. "2026-03-08"

	try {
		// Step 1: Fetch configured sources from DB
		const { rssFeeds, newsApiDomains } = await fetchNewsSources(env);
		log.info('sources', `Loaded ${rssFeeds.length} RSS feeds and ${newsApiDomains.length} NewsAPI domains from DB`);

		// Step 2: Fetch RSS feeds and NewsAPI in parallel
		const [feedResults, newsApiArticles] = await Promise.all([
			Promise.allSettled(rssFeeds.map((feed) => extract(feed.url, {}, FEED_FETCH_OPTIONS))),
			fetchFromNewsAPI(env.NEWS_API_KEY, todayISO, newsApiDomains, {}, log),
		]);

		// Tag each RSS article with its source feed name — log failures
		const rssArticles = feedResults.flatMap((result, i) => {
			if (result.status !== 'fulfilled') {
			log.warn('fetch', `RSS feed failed: ${rssFeeds[i].name}`, {
				source: rssFeeds[i].name,
				url: rssFeeds[i].url,
				error: String(result.reason),
			});
				return [];
			}
			return (result.value.entries ?? []).map((entry) => ({
				...entry,
				_source: rssFeeds[i].name,
				_sourceUrl: rssFeeds[i].url,
			}));
		});

		// Tag NewsAPI articles with their publication name
		const taggedNewsApiArticles = newsApiArticles.map((a) => ({
			...a,
			_source: a.source || 'NewsAPI',
		}));

		const allArticles = [...rssArticles, ...taggedNewsApiArticles];
		log.info('fetch', `${allArticles.length} articles (RSS: ${rssArticles.length}, NewsAPI: ${taggedNewsApiArticles.length})`);

		// Step 3: Filter to articles published today (PST)
		const todayStartUTC = new Date(todayISO + 'T00:00:00-08:00'); // midnight PST, safe on any machine
		const recentArticles = allArticles.filter((article) => {
			if (!article.published) return true; // no date = pass through
			return new Date(article.published) >= todayStartUTC;
		});

		log.info('dateFilter', `${recentArticles.length} passed (${allArticles.length - recentArticles.length} dropped — not today)`);

		// Step 4: Filter out already-seen articles
		const unseenArticles = await filterUnseenArticles(recentArticles, env);

		log.info('dedup', `${unseenArticles.length} unseen (${recentArticles.length - unseenArticles.length} already seen — skipped)`);

		// Step 5: Match portfolio company names against unseen articles
		const candidates = matchCompanies(unseenArticles);

		const uniqueMatchedArticles = new Set(candidates.map((c) => c.article.link)).size;
		log.info('match', `${uniqueMatchedArticles} unique articles matched (${candidates.length} total company hits)`);

		if (candidates.length === 0) {
			const { totals, bySource } = buildFunnel(allArticles, recentArticles, unseenArticles, candidates, [], []);
			const health = log.finalize();
			await saveRun(0, todayISO, totals, bySource, env, health);
			return { funnel: totals, results: [] };
		}

		// Step 6: LLM relevance filter
		const confirmed = await filterCandidates(candidates, env.OPENAI_API_KEY, log);

		const uniqueConfirmedArticles = new Set(confirmed.map((c) => c.article.link)).size;
		log.info('llmFilter', `${uniqueConfirmedArticles} confirmed relevant (${candidates.length - confirmed.length} rejected)`);

		// Step 7: Mark all unseen articles as seen (regardless of LLM outcome)
		await markArticlesSeen(unseenArticles, env);

		if (confirmed.length === 0) {
			const { totals, bySource } = buildFunnel(allArticles, recentArticles, unseenArticles, candidates, confirmed, []);
			const health = log.finalize();
			await saveRun(0, todayISO, totals, bySource, env, health);
			return { funnel: totals, results: [] };
		}

		// Step 8: Fetch full content — attach _contentMethod to each article for funnel tracking
		const confirmedWithContent = await Promise.all(
			confirmed.map(async (candidate) => {
				const { content, method } = await fetchArticleContent(candidate.article, env.FIRECRAWL_API_KEY, log);
				return {
					...candidate,
					article: { ...candidate.article, content, _contentMethod: method, _origin: 'pipeline' },
				};
			})
		);

		const methodCounts = confirmedWithContent.reduce((acc, { article }) => {
			if (article._contentMethod) acc[article._contentMethod] = (acc[article._contentMethod] || 0) + 1;
			return acc;
		}, {});
		log.info('content', `${confirmedWithContent.length} articles fetched — ${JSON.stringify(methodCounts)}`, methodCounts);

		// Step 9: Signal check — observability only, does NOT filter the pipeline
		// ── SIGNAL MONITORING (START) ──────────────────────────────────────────
		const { signalLog } = await filterBySignal(confirmedWithContent, env.OPENAI_API_KEY, log);
		log.info('signal', `check complete — ${signalLog.filter(s => s.signal).length}/${signalLog.length} passed (observability only, not filtering)`);
		await saveSignalChecks(signalLog, todayISO, env);
		// ── SIGNAL MONITORING (END) ────────────────────────────────────────────

		// Step 10: Fetch any existing digests from earlier runs today so we can merge, not overwrite
		const existingDigests = await fetchTodaysDigests(todayISO, env);

		// Step 11: LLM summarize by company (merges with existing if present)
		const results = await summarizeByCompany(confirmedWithContent, env.OPENAI_API_KEY, existingDigests, log);

		const mergeCount = results.filter(r => existingDigests[r.company]).length;
		log.info('summarize', `${results.length} companies summarised (${mergeCount} merged with existing)`);

		const funnel = buildFunnel(allArticles, recentArticles, unseenArticles, candidates, confirmed, confirmedWithContent);

		// Step 12: Save digests to DB (upsert — one row per company per day)
		if (results.length > 0) {
			await saveDigests(results, todayISO, funnel.totals, env);
			log.info('save', `${results.length} digests saved to init_news_digests`);
		}

		// Always record the run so the UI can show "last checked at"
		const health = log.finalize();
		await saveRun(results.length, todayISO, funnel.totals, funnel.bySource, env, health);

		return { funnel: funnel.totals, results };

	} catch (err) {
		// Log the fatal error, then try to persist the run so the dashboard shows it
		log.error('pipeline', `Fatal error: ${err.message ?? String(err)}`, { error: String(err) });
		try {
			const health = log.finalize();
			await saveRun(0, todayISO, null, null, env, health);
		} catch {
			// If even saving the run fails, there's nothing more we can do — console is last resort
			console.error('[PIPELINE] Could not save failed run to DB:', String(err));
		}
		throw err;
	}
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
