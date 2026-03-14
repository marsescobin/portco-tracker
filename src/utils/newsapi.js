import companies from '../../companies.json' with { type: 'json' };

const BATCH_SIZE = 10; // companies per request — keeps query string manageable
const PAGE_SIZE = 100; // max results per request on free tier

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
 * @param {string[]} domains - Array of domain strings from init_news_sources (e.g. ['wired.com', 'reuters.com'])
 * @param {{ maxBatches?: number }} [options]
 * @returns {Promise<Array<{ title, description, link, published, source }>>}
 */
export async function fetchFromNewsAPI(apiKey, from, domains = [], options = {}, log) {
	if (!apiKey) return [];
	if (domains.length === 0) {
		if (log) log.warn('fetch', 'NewsAPI skipped — no domains configured');
		return [];
	}

	const domainsStr = domains.join(',');

	const allCompanies = companies.initialized_capital_companies;
	const batches = chunk(allCompanies, BATCH_SIZE).slice(0, options.maxBatches ?? Infinity);
	const allArticles = [];

	for (let i = 0; i < batches.length; i++) {
		const batch = batches[i];
		const query = batch.map((c) => `"${c.name}"`).join(' OR ');

		const params = new URLSearchParams({
			q: query,
			domains: domainsStr,
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
				if (log) log.warn('fetch', `NewsAPI batch ${i + 1} error: ${data.message}`, { batch: i + 1, error: data.message });
				else console.warn(`⚠️ NewsAPI batch ${i + 1} error: ${data.message}`);
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
			if (log) log.warn('fetch', `NewsAPI batch ${i + 1} failed: ${err.message}`, { batch: i + 1, error: err.message });
			else console.warn(`⚠️ NewsAPI batch ${i + 1} failed: ${err.message}`);
		}

		// Respect free tier rate limit (1 req/sec)
		if (i < batches.length - 1) {
			await new Promise((r) => setTimeout(r, 1100));
		}
	}

	return allArticles;
}
