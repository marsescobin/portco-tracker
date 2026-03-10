/**
 * Fetches news articles from Newsdata.io for a single company.
 * Uses the /latest endpoint (free tier).
 *
 * Free tier notes:
 *  - 200 credits/day, 30 credits per 15 min
 *  - 10 articles per credit (page)
 *  - q param capped at 100 characters
 *  - Articles cover the past 48 hours
 *  - /archive endpoint (date filtering) requires paid plan
 *
 * @param {string} apiKey - Newsdata.io API key
 * @param {string} companyName - The company name to search for
 * @param {{ timeframe?: string, domains?: string[] }} [options]
 *   timeframe: e.g. '24' (hours) or '1440' (minutes). Max 48h on free tier.
 *   domains: list of domains to restrict results to (e.g. ['reuters.com', 'bloomberg.com'])
 * @returns {Promise<Array<{ title, description, link, published, source }>>}
 */
export async function fetchFromNewsdataIO(apiKey, companyName, options = {}) {
	if (!apiKey) return [];

	const { timeframe, domains } = options;

	const params = new URLSearchParams({
		apikey: apiKey,
		q: `"${companyName}"`,
		language: 'en',
	});

	if (timeframe) params.set('timeframe', timeframe);
	if (domains?.length) params.set('domainurl', domains.join(','));

	const url = `https://newsdata.io/api/1/latest?${params.toString()}`;

	try {
		const res = await fetch(url);
		const data = await res.json();

		if (data.status !== 'success') {
			console.warn(`⚠️  Newsdata.io error for "${companyName}": ${JSON.stringify(data)}`);
			return [];
		}

		return (data.results ?? []).map((a) => ({
			title: a.title,
			description: a.description,
			link: a.link,
			published: a.pubDate,
			source: a.source_name,
		}));
	} catch (err) {
		console.warn(`⚠️  Newsdata.io fetch failed for "${companyName}": ${err.message}`);
		return [];
	}
}
