import { describe, it } from 'vitest';
import { env } from 'cloudflare:test';
import { summarizeByCompany } from './summarize.js';

const FAKE_CANDIDATES = [
	// Scenario 1: positive — founder-driven product launch
	{
		company: 'Skyline Robotics',
		companyDescription: 'Builds autonomous robots for high-rise window cleaning.',
		article: {
			title: 'Skyline Robotics launches Gen 2 hardware with 40% faster cleaning speeds',
			link: 'https://techcrunch.com/skyline-robotics-gen2',
			content: `Skyline Robotics today announced its second-generation window-cleaning robot, which the company says cuts cleaning time by 40% and supports buildings up to 80 stories. 
			CEO Maya Lin shared a detailed breakdown on LinkedIn, noting the team spent 18 months on the motor redesign alone. The post has over 3,000 engagements so far. 
			The company is also expanding to Chicago, Houston, and Seattle, bringing its total market to 8 US cities. Existing customers will receive upgrades at no cost.`,
		},
	},

	// Scenario 2: mixed — strong growth alongside a negative press story
	{
		company: 'Bridgepoint Lending',
		companyDescription: 'AI-powered mortgage platform for first-time homebuyers.',
		article: {
			title: 'Bridgepoint Lending posts record origination quarter',
			link: 'https://businesswire.com/bridgepoint-q1',
			content: `Bridgepoint Lending announced its strongest quarter on record, with $2.1B in originations — up 34% year-over-year. The company also launched a new AI underwriting model it claims reduces approval time to under 4 hours.`,
		},
	},
	{
		company: 'Bridgepoint Lending',
		companyDescription: 'AI-powered mortgage platform for first-time homebuyers.',
		article: {
			title: 'Investigation: Bridgepoint\'s AI model approves fewer loans in low-income zip codes',
			link: 'https://propublica.org/bridgepoint-lending',
			content: `A ProPublica investigation found that Bridgepoint Lending's AI underwriting model approved significantly fewer mortgage applications in predominantly low-income and minority zip codes compared to similar applicants in wealthier areas. 
			The company declined to comment on the specific findings but said its model is "regularly audited for fairness." Housing advocates are calling for a federal review.`,
		},
	},
];

// Existing digest for Skyline Robotics — simulates what was saved in an earlier run today
const EXISTING_DIGESTS = {
	'Skyline Robotics': {
		company_name: 'Skyline Robotics',
		summary: [
			'Launched Gen 2 hardware cutting cleaning time by 40%, expanding to Chicago, Houston, and Seattle.',
		],
		sentiment: '+',
		sentiment_reason: 'strong product launch',
		articles: [
			{ title: 'Skyline Robotics launches Gen 2 hardware with 40% faster cleaning speeds', link: 'https://techcrunch.com/skyline-robotics-gen2' },
		],
	},
};

// New article for Skyline Robotics — arrived in a later pipeline run same day
const MERGE_CANDIDATES = [
	{
		company: 'Skyline Robotics',
		companyDescription: 'Builds autonomous robots for high-rise window cleaning.',
		article: {
			title: 'Skyline Robotics raises $50M Series C to accelerate international expansion',
			link: 'https://techcrunch.com/skyline-robotics-series-c',
			content: `Skyline Robotics announced a $50M Series C round led by Sequoia Capital, with participation from existing investors. 
			CEO Maya Lin said the funding will go toward expanding into Europe and Southeast Asia, targeting 20 new cities by end of 2027. 
			The round comes just days after the company announced its Gen 2 hardware launch.`,
		},
	},
];

describe('Summarizer — fake data smoke test', () => {
	it('generates summaries with sentiment for fake portfolio companies', async () => {
		const API_KEY = env.OPENAI_API_KEY;
		if (!API_KEY) throw new Error('OPENAI_API_KEY not set in .dev.vars');

		const results = await summarizeByCompany(FAKE_CANDIDATES, API_KEY);

		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
		for (const { company, sentiment, sentimentReason, summary, articles } of results) {
			console.log(`\n🏢 ${company}`);
			console.log(`   Sentiment:  ${sentiment}  (${sentimentReason})`);
			console.log(`   Summary:    ${summary}`);
			console.log(`   Sources:    ${articles.map((a) => a.title).join(' | ')}`);
		}
		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
	}, 30_000);

	it('merges new articles into an existing digest from earlier today', async () => {
		const API_KEY = env.OPENAI_API_KEY;
		if (!API_KEY) throw new Error('OPENAI_API_KEY not set in .dev.vars');

		const results = await summarizeByCompany(MERGE_CANDIDATES, API_KEY, EXISTING_DIGESTS);

		console.log('\n━━━━━━━━━━━━━━━━━━ MERGE TEST ━━━━━━━━━━━━━━━━━━');
		for (const { company, sentiment, sentimentReason, summary, articles } of results) {
			console.log(`\n🏢 ${company}`);
			console.log(`   Sentiment:      ${sentiment}  (${sentimentReason})`);
			console.log(`   Summary bullets:`);
			summary.forEach((s, i) => console.log(`     ${i + 1}. ${s}`));
			console.log(`   Sources (${articles.length} total):`);
			articles.forEach((a) => console.log(`     - ${a.title}`));

			// Basic assertions
			if (articles.length < 2) {
				throw new Error(`Expected merged articles list to contain both old and new articles, got ${articles.length}`);
			}
			if (summary.length === 0) {
				throw new Error('Expected at least one summary bullet');
			}
		}
		console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
	}, 30_000);
});
