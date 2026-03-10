import { describe, it } from 'vitest';
import { env } from 'cloudflare:test';
import { fetchFromNewsAPI } from './newsapi.js';
import { matchCompanies } from './matcher.js';

describe('NewsAPI coverage test', () => {
	it('fetches articles for all portfolio companies and runs matcher', async () => {
		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		const allArticles = await fetchFromNewsAPI(env.NEWS_API_KEY, today, { maxBatches: 1 });

		console.log(`\n📰 Total articles fetched: ${allArticles.length}`);

		const candidates = matchCompanies(allArticles);

		if (candidates.length === 0) {
			console.log('🔍 No matches found.');
			return;
		}

		// Group by article
		const byArticle = {};
		for (const { article, company } of candidates) {
			const key = article.link;
			if (!byArticle[key]) byArticle[key] = { article, matches: [] };
			byArticle[key].matches.push(company);
		}

		const uniqueCompanies = new Set(candidates.map((c) => c.company));
		console.log(`\n✅ ${candidates.length} match(es) across ${Object.keys(byArticle).length} article(s), touching ${uniqueCompanies.size} companies:\n`);

		for (const { article, matches } of Object.values(byArticle)) {
			console.log(`  📰 ${article.title}`);
			console.log(`     🔗 ${article.link}`);
			console.log(`     🏢 ${matches.join(', ')}`);
			console.log('');
		}
	}, 120_000);
});
