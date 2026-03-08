import { describe, it } from 'vitest';
import { extract } from '@extractus/feed-extractor';
import { matchCompanies } from './matcher.js';

const FEEDS = [
	{ name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
	{ name: 'VentureBeat', url: 'http://venturebeat.com/feed/' },
	{ name: 'Hacker News', url: 'http://news.ycombinator.com/rss' },
	{ name: 'The Verge', url: 'http://www.theverge.com/rss/full.xml' },
	{ name: 'Engadget', url: 'http://www.engadget.com/rss-full.xml' },
];

describe('Company Matcher — real RSS articles', () => {
	it('finds portfolio company matches across feeds', async () => {
		// Fetch all feeds in parallel
		const results = await Promise.allSettled(
			FEEDS.map((feed) => extract(feed.url))
		);

		// Flatten all articles into one list
		const allArticles = results.flatMap((result, i) => {
			if (result.status !== 'fulfilled') {
				console.log(`⚠️  Skipped ${FEEDS[i].name}: ${result.reason?.message}`);
				return [];
			}
			return result.value.entries ?? [];
		});

		console.log(`\n📰 Total articles fetched: ${allArticles.length}`);

		// Run the matcher
		const candidates = matchCompanies(allArticles);

		if (candidates.length === 0) {
			console.log('\n🔍 No portfolio companies matched in today\'s articles.');
			return;
		}

		// Group by article so we can see all matched companies per article
		const byArticle = {};
		for (const { article, company } of candidates) {
			const key = article.link;
			if (!byArticle[key]) byArticle[key] = { article, matches: [] };
			byArticle[key].matches.push({ company });
		}

		const uniqueCompanies = new Set(candidates.map((c) => c.company));
		console.log(`\n✅ ${candidates.length} match(es) across ${Object.keys(byArticle).length} article(s), touching ${uniqueCompanies.size} company/companies:\n`);

		for (const { article, matches } of Object.values(byArticle)) {
			const companyTags = matches
				.map(({ company }) => company)
				.join(', ');
			console.log(`  📰 ${article.title}`);
			console.log(`     🔗 ${article.link}`);
			console.log(`     🏢 ${companyTags}`);
			console.log('');
		}
	}, 30_000);
});
