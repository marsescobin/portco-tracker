import { describe, it } from 'vitest';
import { env } from 'cloudflare:test';
import { extract } from '@extractus/feed-extractor';
import { matchCompanies } from './matcher.js';
import { filterCandidates } from './filter.js';

const FEEDS = [
	{ name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
	{ name: 'VentureBeat', url: 'http://venturebeat.com/feed/' },
	{ name: 'Hacker News', url: 'http://news.ycombinator.com/rss' },
	{ name: 'The Verge', url: 'http://www.theverge.com/rss/full.xml' },
	{ name: 'Crunchbase News', url: 'https://news.crunchbase.com/feed/' },
];

describe('LLM Filter — confirm candidates from real RSS articles', () => {
	it('filters matcher candidates through OpenAI relevance check', async () => {
		const API_KEY = env.OPENAI_API_KEY;
		if (!API_KEY) throw new Error('OPENAI_API_KEY not set in .dev.vars');

		// Step 1: Fetch feeds
		const results = await Promise.allSettled(FEEDS.map((f) => extract(f.url)));
		const allArticles = results.flatMap((r, i) => {
			if (r.status !== 'fulfilled') {
				console.log(`⚠️  Skipped ${FEEDS[i].name}`);
				return [];
			}
			return r.value.entries ?? [];
		});
		console.log(`\n📰 Articles fetched: ${allArticles.length}`);

		// Step 2: Run matcher
		const candidates = matchCompanies(allArticles);
		console.log(`🔍 Matcher candidates: ${candidates.length}\n`);
		for (const { article, company } of candidates) {
			console.log(`   • ${company} → "${article.title}"`);
		}
		console.log('');

		if (candidates.length === 0) {
			console.log('No candidates to filter today.');
			return;
		}

		// Step 3: LLM filter
		console.log('🤖 Sending to LLM for relevance check...\n');
		const confirmed = await filterCandidates(candidates, API_KEY);

		console.log(`✅ Confirmed relevant: ${confirmed.length} / ${candidates.length}\n`);

		// Show all candidates with LLM verdict
		console.log('📋 All candidates:\n');
		for (const { article, company, companyDescription, _verdict } of candidates) {
			const verdict = confirmed.some((c) => c.article.link === article.link && c.company === company)
				? '✅ CONFIRMED'
				: '❌ REJECTED';
			console.log(`  ${verdict} — ${company}`);
			console.log(`     🏢 What they do: ${companyDescription}`);
			console.log(`     📰 ${article.title}`);
			console.log(`     🔗 ${article.link}`);
			console.log('');
		}
	}, 60_000);
});
