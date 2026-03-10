import { describe, it } from 'vitest';
import { env } from 'cloudflare:test';
import { fetchFromNewsdataIO } from './newsdataio.js';

const TEST_COMPANIES = ['Algolia', 'Greptile', 'Partiful', 'Mezmo', 'Coperniq', 'Vetcove'];

// Same trusted domains as NewsAPI setup
const DOMAINS = [
	'wired.com', 'arstechnica.com', 'fortune.com', 'inc.com', 'axios.com',
	'businesswire.com', 'reuters.com', 'bloomberg.com', 'prnewswire.com',
	'globenewswire.com', 'apnews.com', 'wsj.com',
	'venturebeat.com', 'theverge.com', 'forbes.com', 'businessinsider.com',
];

describe('Newsdata.io coverage test (no domain filter)', () => {
	it('queries each company individually and prints results', async () => {
		let totalArticles = 0;

		for (const company of TEST_COMPANIES) {
			const articles = await fetchFromNewsdataIO(env.NEWSDATA_API_KEY, company, { domains: DOMAINS });

			totalArticles += articles.length;

			if (articles.length === 0) {
				console.log(`\n🔇 ${company}: no results`);
				continue;
			}

			console.log(`\n📰 ${company} — ${articles.length} article(s):`);
			for (const a of articles) {
				console.log(`  • ${a.title}`);
				console.log(`    🔗 ${a.link}`);
				console.log(`    📅 ${a.published}  |  🗞️  ${a.source}`);
			}

			await new Promise((r) => setTimeout(r, 2000));
		}

		console.log(`\n✅ Total: ${totalArticles} articles`);
	}, 60_000);
});
