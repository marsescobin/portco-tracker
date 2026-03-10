/**
 * Fetches news articles from Newsdata.io for a single company.
 * Uses the archive endpoint so we can filter by date.
 *
 * Free tier notes:
 *  - 200 credits/day, 30 credits per 15 min
 *  - 10 articles per credit (page)
 *  - q param capped at 100 characters
 *  - Articles are delayed ~12 hours
 *
 * @param {string} apiKey - Newsdata.io API key
 * @param {string} companyName - The company name to search for
 * @param {{ fromDate?: string, toDate?: string }} [options]
 *   fromDate / toDate: ISO date strings (YYYY-MM-DD)
 * @returns {Promise<Array<{ title, description, link, published, source }>>}
 */
export async function fetchFromNewsdataIO(apiKey, companyName, options = {}) {
	if (!apiKey) return [];

	const { fromDate, toDate } = options;

	const params = new URLSearchParams({
		apikey: apiKey,
		q: `"${companyName}"`,
		language: 'en',
	});

	if (fromDate) params.set('from_date', fromDate);
	if (toDate) params.set('to_date', toDate);

	const url = `https://newsdata.io/api/1/archive?${params.toString()}`;

	try {
		const res = await fetch(url);
		const data = await res.json();

		if (data.status !== 'success') {
			console.warn(`⚠️  Newsdata.io error for "${companyName}": ${data.message ?? JSON.stringify(data)}`);
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
