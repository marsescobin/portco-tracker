import { describe, it } from 'vitest';
import { extract } from '@extractus/feed-extractor';

const FEEDS = [
	
	// Tech News
	{ name: 'VentureBeat', url: 'http://venturebeat.com/feed/' },
	{ name: 'The Verge', url: 'http://www.theverge.com/rss/full.xml' },
	{ name: 'Engadget', url: 'http://www.engadget.com/rss-full.xml' },
	{ name: 'Tech in Asia', url: 'https://feeds2.feedburner.com/PennOlson' },
	{ name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
	{ name: 'Fast Company', url: 'http://feeds.feedburner.com/fastcompany/headlines' },
	// Products & Ideas
	{ name: 'Product Hunt', url: 'http://www.producthunt.com/feed' },
	{ name: 'Hacker News: Show HN', url: 'http://hnrss.org/show' },
	{ name: 'Hacker News: Launches', url: 'https://hnrss.org/launches' },
	// Others
	{ name: 'TED Talks Daily', url: 'http://feeds.feedburner.com/tedtalks_video' },
	{ name: 'HBR.org', url: 'http://feeds.harvardbusiness.org/harvardbusiness/' },
	// Science
	{ name: 'Quanta Magazine', url: 'http://www.quantamagazine.org/feed/' },
	{ name: 'Nature', url: 'http://www.nature.com/nature/current_issue/rss' },
	{ name: 'MIT News (STS)', url: 'https://news.mit.edu/rss/topic/science-technology-and-society' },
	{ name: 'MIT News (Research)', url: 'https://news.mit.edu/rss/research' },
	{ name: 'ScienceAlert', url: 'https://www.sciencealert.com/rss' },
	{ name: 'Singularity Hub', url: 'https://singularityhub.com/feed/' },
	{ name: 'Lesics (YouTube)', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCqZQJ4600a9wIfMPbYc60OQ' },
//Business
{ name: 'The Hustle', url: 'https://thehustle.co/feed/' },
{ name: 'The Muse', url: 'https://www.themuse.com/advice/feed' },
{ name: 'Harvard Business Review', url: 'https://hbr.org/feed/rss' },
{ name: 'Forbes', url: 'https://www.forbes.com/business/feed/' },
{ name: 'Entrepreneur', url: 'https://www.entrepreneur.com/feed' },
{ name: 'Business Insider', url: 'https://www.businessinsider.com/rss' },
{ name: 'Yahoo Finance', url: 'https://news.yahoo.com/rss/finance' },
];

describe('RSS Feed Audit — all sources', () => {
	it('checks which feeds are active', async () => {
		const results = await Promise.allSettled(
			FEEDS.map(async (feed) => {
				const data = await extract(feed.url);
				return { ...feed, count: data.entries?.length ?? 0 };
			})
		);

		const active = [];
		const dead = [];

		results.forEach((result, i) => {
			const name = FEEDS[i].name;
			const url = FEEDS[i].url;
			if (result.status === 'fulfilled') {
				active.push({ name, url, count: result.value.count });
			} else {
				dead.push({ name, url, reason: result.reason?.message ?? 'Unknown error' });
			}
		});

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log(`✅ ACTIVE (${active.length})`);
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		active.forEach(({ name, count }) => {
			console.log(`  ✅  ${name.padEnd(35)} ${count} articles`);
		});

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log(`❌ DEAD (${dead.length})`);
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		dead.forEach(({ name, reason }) => {
			console.log(`  ❌  ${name.padEnd(35)} ${reason}`);
		});

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log(`📊 ${active.length} active / ${dead.length} dead out of ${FEEDS.length} total`);
		console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
	}, 60_000); // 60s timeout — running all feeds in parallel
});
