import { describe, it } from 'vitest';
import { env } from 'cloudflare:test';
import { filterBySignal } from './news-relevance.js';

const CANDIDATES = [
	// Should PASS — clear investor signal (product launch)
	{
		company: 'Skyline Robotics',
		companyDescription: 'Builds autonomous robots for high-rise window cleaning.',
		article: {
			title: 'Skyline Robotics raises $50M Series C to expand internationally',
			link: 'https://techcrunch.com/skyline-series-c',
			content: `Skyline Robotics announced a $50M Series C round led by Sequoia Capital. The funding will be used to expand into Europe and Southeast Asia, targeting 20 new cities by end of 2027. The company currently operates in 8 US cities and has seen 3x revenue growth year-over-year.`,
		},
	},

	// Should PASS — negative signal (controversy)
	{
		company: 'Bridgepoint Lending',
		companyDescription: 'AI-powered mortgage platform for first-time homebuyers.',
		article: {
			title: 'Investigation: Bridgepoint\'s AI model approves fewer loans in low-income zip codes',
			link: 'https://propublica.org/bridgepoint-lending',
			content: `A ProPublica investigation found that Bridgepoint Lending's AI underwriting model approved significantly fewer mortgage applications in predominantly low-income and minority zip codes. Housing advocates are calling for a federal review. The company declined to comment.`,
		},
	},

	// Should FAIL — generic community post that mentions the company in passing (fake content)
	{
		company: 'Patreon',
		companyDescription: 'Membership platform for creators to earn recurring revenue from fans.',
		article: {
			title: 'Show HN: Hotwire Club – A Learning Community for Hotwire (Turbo/Stimulus/Rails)',
			link: 'https://news.ycombinator.com/hotwire-club',
			content: `Hotwire Club is a new community for Rails developers learning Hotwire. We have forums, weekly office hours, and a resource library. Some members fund their learning through Patreon. Join us at hotwireclub.com.`,
		},
	},

	// Should FAIL — real world: Hotwire Club is a Rails tutorial site, Patreon is just their payment method
	{
		company: 'Patreon',
		companyDescription: 'Membership platform for creators to earn recurring revenue from fans.',
		article: {
			title: 'Show HN: Hotwire Club – A Learning Community for Hotwire (Turbo/Stimulus/Rails)',
			link: 'https://hotwire.club/',
			content: `Welcome to The Hotwire Club! Learn Turbo and Stimulus together with fellow enthusiasts. Subscribe on Patreon to access all solutions. Features tutorials on Turbo Frames, Turbo Streams, Stimulus, and Turbo Drive. Latest posts include "Turbo Frames - Using External Forms", "Turbo Frames - Loading Spinner", and "Stimulus - Web Share API". Built by Julian Rubisch.`,
		},
	},

	// Should PASS — paywalled content but title + description are investor-relevant
	{
		company: 'Skyline Robotics',
		companyDescription: 'Builds autonomous robots for high-rise window cleaning.',
		article: {
			title: 'Skyline Robotics CEO on the future of autonomous buildings',
			link: 'https://wsj.com/skyline-robotics-paywall',
			content: `Subscribe to read this article. Already a subscriber? Sign in.`,
		},
	},
];

describe('News relevance filter', () => {
	it('passes signal articles and drops no-signal articles', async () => {
		const API_KEY = env.OPENAI_API_KEY;
		if (!API_KEY) throw new Error('OPENAI_API_KEY not set in .dev.vars');

		const results = await filterBySignal(CANDIDATES, API_KEY);

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		console.log(`Passed: ${results.length} / ${CANDIDATES.length}`);
		for (const { company, article, signalReason } of results) {
			console.log(`\n  ✅ ${company} — "${article.title}"`);
			console.log(`     Reason: ${signalReason}`);
		}

		const dropped = CANDIDATES.filter((c) => !results.find((r) => r.article.link === c.article.link));
		for (const { company, article } of dropped) {
			console.log(`\n  ❌ ${company} — "${article.title}" (dropped)`);
		}
		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

		// Expect 3 signal articles to pass (Series C, ProPublica, CEO interview)
		if (results.length !== 3) {
			throw new Error(`Expected 3 articles to pass, got ${results.length}`);
		}

		const passingLinks = results.map((r) => r.article.link);
		if (!passingLinks.includes('https://techcrunch.com/skyline-series-c')) {
			throw new Error('Expected Series C article to pass');
		}
		if (!passingLinks.includes('https://propublica.org/bridgepoint-lending')) {
			throw new Error('Expected ProPublica investigation to pass');
		}
		if (!passingLinks.includes('https://wsj.com/skyline-robotics-paywall')) {
			throw new Error('Expected CEO interview to pass (based on description)');
		}
	}, 30_000);
});
