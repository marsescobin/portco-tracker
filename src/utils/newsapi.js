import companies from '../../companies.json' with { type: 'json' };

const BATCH_SIZE = 10; // companies per request — keeps query string manageable
const PAGE_SIZE = 100; // max results per request on free tier

// Restrict to trusted tech/startup publications to reduce noise
// Note: venturebeat, theverge, forbes, businessinsider, crunchbase are already covered by RSS feeds
const DOMAINS = [
	'wired.com',
	'arstechnica.com',
	'fortune.com',
	'inc.com',
	'axios.com',
	'businesswire.com',
	'reuters.com',
	'bloomberg.com',
	'prnewswire.com',
	'globenewswire.com',
	'apnews.com',
	'wsj.com',
].join(',');

function chunk(arr, n) {
	const chunks = [];
	for (let i = 0; i < arr.length; i += n) {
		chunks.push(arr.slice(i, i + n));
	}
	return chunks;
}

/**
 * Fetches recent articles from NewsAPI for all portfolio companies.
 * Batches company names into OR queries to stay within URL length limits.
 *
 * @param {string} apiKey - NewsAPI key
 * @param {string} [from] - Optional ISO date string to filter articles (e.g. today's date)
 * @param {{ maxBatches?: number }} [options]
 * @returns {Promise<Array<{ title, description, link, published, source }>>}
 */
export async function fetchFromNewsAPI(apiKey, from, options = {}) {
	if (!apiKey) return [];

	const allCompanies = companies.initialized_capital_companies;
	const batches = chunk(allCompanies, BATCH_SIZE).slice(0, options.maxBatches ?? Infinity);
	const allArticles = [];

	for (let i = 0; i < batches.length; i++) {
		const batch = batches[i];
		const query = batch.map((c) => `"${c.name}"`).join(' OR ');

		const params = new URLSearchParams({
			q: query,
			domains: DOMAINS,
			pageSize: PAGE_SIZE,
			sortBy: 'publishedAt',
			apiKey,
		});
		if (from) params.set('from', from);

		const url = `https://newsapi.org/v2/everything?${params.toString()}`;

		try {
			const res = await fetch(url, {
				headers: { 'User-Agent': 'crimson-term-portfolio-tracker/1.0' },
			});
			const data = await res.json();

			if (data.status !== 'ok') {
				console.warn(`⚠️ NewsAPI batch ${i + 1} error: ${data.message}`);
				continue;
			}

			const articles = (data.articles ?? []).map((a) => ({
				title: a.title,
				description: a.description,
				link: a.url,
				published: a.publishedAt,
				source: a.source?.name,
			}));

			allArticles.push(...articles);
		} catch (err) {
			console.warn(`⚠️ NewsAPI batch ${i + 1} failed: ${err.message}`);
		}

		// Respect free tier rate limit (1 req/sec)
		if (i < batches.length - 1) {
			await new Promise((r) => setTimeout(r, 1100));
		}
	}

	return allArticles;
}
