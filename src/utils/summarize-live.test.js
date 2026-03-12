import { describe, it } from 'vitest';
import { env } from 'cloudflare:test';
import { summarizeByCompany } from './summarize.js';
import { fetchArticleContent } from './fetchContent.js';

/**
 * Live URL test — pass a real article URL and company info to see the summarizer output.
 *
 * Usage:
 *   npx vitest run src/utils/summarize-live.test.js
 *
 * To test a different article, just change the URL / company fields below.
 */

// ── CONFIG: change these to test different articles / companies ─────────────
const TEST_URL = 'https://www.coindesk.com/markets/2026/03/11/crypto-platform-bullish-climbs-past-coinbase-to-become-third-largest-crypto-exchange-by-spot-volume';
const COMPANY = 'Coinbase';
const COMPANY_DESCRIPTION = 'Coinbase is the world\'s leading cryptocurrency exchange platform.';

// Second URL for the merge test — simulates a later pipeline run finding another article
const TEST_URL_2 = 'https://bitcoinmagazine.com/news/coinbase-regulated-bitcoin-futures';
// ────────────────────────────────────────────────────────────────────────────

describe('Summarizer — live URL test', () => {
	it('fetches content from a real URL and summarizes it', async () => {
		const API_KEY = env.OPENAI_API_KEY;
		if (!API_KEY) throw new Error('OPENAI_API_KEY not set in .dev.vars');

		// Step 1: Fetch article content (same fallback chain the pipeline uses)
		const fakeArticle = { title: '', link: TEST_URL, description: '', content: '' };
		const { content, method } = await fetchArticleContent(fakeArticle, env.FIRECRAWL_API_KEY);

		console.log(`\n📄 Content fetched via: ${method} (${content.length} chars)`);
		console.log(`   Preview: ${content.slice(0, 200)}…\n`);

		// Step 2: Build a candidate that looks like the pipeline's confirmed output
		const candidates = [
			{
				company: COMPANY,
				companyDescription: COMPANY_DESCRIPTION,
				article: {
					title: fakeArticle.title || '(title not in RSS)',
					link: TEST_URL,
					content,
					_contentMethod: method,
				},
			},
		];

		// Step 3: Summarize
		const results = await summarizeByCompany(candidates, API_KEY);

		// Step 4: Print
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		for (const { company, sentiment, sentimentReason, summary, articles } of results) {
			console.log(`\n🏢 ${company}`);
			console.log(`   Sentiment:  ${sentiment}  (${sentimentReason})`);
			console.log(`   Summary:`);
			summary.forEach((s, i) => console.log(`     ${i + 1}. ${s}`));
			console.log(`   Sources:    ${articles.map((a) => a.link).join('\n               ')}`);
		}
		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
	}, 60_000);

	it('merges a second URL into an existing digest (tests the update prompt)', async () => {
		const API_KEY = env.OPENAI_API_KEY;
		if (!API_KEY) throw new Error('OPENAI_API_KEY not set in .dev.vars');

		// ── Run 1: first article → produces the initial digest ──────────
		const article1 = { title: '', link: TEST_URL, description: '', content: '' };
		const { content: content1, method: method1 } = await fetchArticleContent(article1, env.FIRECRAWL_API_KEY);

		console.log(`\n📄 [URL 1] Content via: ${method1} (${content1.length} chars)`);

		const firstRun = await summarizeByCompany(
			[{
				company: COMPANY,
				companyDescription: COMPANY_DESCRIPTION,
				article: { title: article1.title || '(title not in RSS)', link: TEST_URL, content: content1, _contentMethod: method1 },
			}],
			API_KEY,
		);

		const initial = firstRun[0];

		console.log('\n━━━━━━━━━━━━━━━━ INITIAL DIGEST ━━━━━━━━━━━━━━━━');
		console.log(`🏢 ${initial.company}`);
		console.log(`   Sentiment:  ${initial.sentiment}  (${initial.sentimentReason})`);
		initial.summary.forEach((s, i) => console.log(`     ${i + 1}. ${s}`));

		// ── Run 2: second article → merge into existing digest ──────────
		const article2 = { title: '', link: TEST_URL_2, description: '', content: '' };
		const { content: content2, method: method2 } = await fetchArticleContent(article2, env.FIRECRAWL_API_KEY);

		console.log(`\n📄 [URL 2] Content via: ${method2} (${content2.length} chars)`);

		const existingDigests = {
			[COMPANY]: {
				company_name: COMPANY,
				summary: initial.summary,
				sentiment: initial.sentiment,
				sentiment_reason: initial.sentimentReason,
				articles: initial.articles,
			},
		};

		const mergedRun = await summarizeByCompany(
			[{
				company: COMPANY,
				companyDescription: COMPANY_DESCRIPTION,
				article: { title: article2.title || '(title not in RSS)', link: TEST_URL_2, content: content2, _contentMethod: method2 },
			}],
			API_KEY,
			existingDigests,
		);

		const merged = mergedRun[0];

		console.log('\n━━━━━━━━━━━━━━━━ MERGED DIGEST ━━━━━━━━━━━━━━━━━');
		console.log(`🏢 ${merged.company}`);
		console.log(`   Sentiment:  ${merged.sentiment}  (${merged.sentimentReason})`);
		console.log(`   Summary:`);
		merged.summary.forEach((s, i) => console.log(`     ${i + 1}. ${s}`));
		console.log(`   Sources (${merged.articles.length} total):`);
		merged.articles.forEach((a) => console.log(`     - ${a.link}`));
		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
	}, 90_000);
});
