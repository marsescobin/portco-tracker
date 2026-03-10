import { describe, it } from 'vitest';
import { env } from 'cloudflare:test';
import { fetchFromNewsdataIO } from './newsdataio.js';

// Companies with coined/unique names — no English-word ambiguity.
// Good signal test: any article returned is almost certainly about the real company.
const TEST_COMPANIES = ['Algolia', 'Greptile', 'Partiful', 'Mezmo', 'Coperniq', 'Vetcove'];

// March 8 — yesterday. Using archive endpoint with date constraint.
// Free tier has a ~12-hour delay, so today's news isn't fully available yet.
const FROM_DATE = '2026-03-08';
const TO_DATE = '2026-03-08';

describe('Newsdata.io coverage test (no domain filter)', () => {
	it(
		'queries each company individually and prints results',
		async () => {
			let totalArticles = 0;

			for (const company of TEST_COMPANIES) {
				const articles = await fetchFromNewsdataIO(env.NEWSDATA_API_KEY, company, {
					fromDate: FROM_DATE,
					toDate: TO_DATE,
				});

				totalArticles += articles.length;

				if (articles.length === 0) {
					console.log(`\n🔇 ${company}: no results for ${FROM_DATE}`);
					continue;
				}

				console.log(`\n📰 ${company} — ${articles.length} article(s):`);
				for (const a of articles) {
					console.log(`  • ${a.title}`);
					console.log(`    🔗 ${a.link}`);
					console.log(`    📅 ${a.published}  |  🗞️  ${a.source}`);
				}

				// Respect free-tier rate limit: 30 req / 15 min = 1 req every ~2s
				await new Promise((r) => setTimeout(r, 2000));
			}

			console.log(`\n✅ Total articles across all companies: ${totalArticles}`);
		},
		60_000,
	);
});
