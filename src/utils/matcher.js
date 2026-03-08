import companies from '../../companies.json' with { type: 'json' };

/**
 * Extracts the bare domain from a URL, stripping www. prefix.
 * e.g. "https://www.coinbase.com/" → "coinbase.com"
 */
function extractDomain(url) {
	try {
		const host = new URL(url).hostname;
		return host.replace(/^www\./, '');
	} catch {
		return null;
	}
}

/**
 * Given a list of articles, returns candidates where a company name
 * OR website domain was matched in the article's title or description.
 *
 * @param {Array<{ title: string, description: string, link: string, published: string }>} articles
 * @returns {Array<{ article, company: string, companyDescription: string }>}
 */
export function matchCompanies(articles) {
	const candidates = [];

	for (const article of articles) {
		const text = `${article.title ?? ''} ${article.description ?? ''}`;

		for (const company of companies.initialized_capital_companies) {
			// Escape any regex special chars in the company name/domain
			const escapedName = company.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');

			const domain = extractDomain(company.website_url);
			const escapedDomain = domain?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const domainRegex = escapedDomain ? new RegExp(escapedDomain, 'i') : null;

			if (nameRegex.test(text) || domainRegex?.test(text)) {
				candidates.push({
					article,
					company: company.name,
					companyDescription: company.description ?? '',
				});
			}
		}
	}

	return candidates;
}
