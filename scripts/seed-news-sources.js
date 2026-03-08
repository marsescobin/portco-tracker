import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .dev.vars
const devVars = readFileSync(join(__dirname, '../.dev.vars'), 'utf-8');
const env = Object.fromEntries(
	devVars.split('\n')
		.filter(line => line.includes('='))
		.map(line => line.split('=').map(s => s.trim()))
		.map(([key, ...rest]) => [key, rest.join('=')])
);

const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .dev.vars');
	process.exit(1);
}

const sources = [
	// --- RSS Feeds ---
	// Tech
	{ name: 'VentureBeat',        url: 'http://venturebeat.com/feed/',                                                                            type: 'rss', category: 'tech' },
	{ name: 'The Verge',          url: 'http://www.theverge.com/rss/full.xml',                                                                    type: 'rss', category: 'tech' },
	{ name: 'Engadget',           url: 'http://www.engadget.com/rss-full.xml',                                                                    type: 'rss', category: 'tech' },
	{ name: 'Tech in Asia',       url: 'https://feeds2.feedburner.com/PennOlson',                                                                  type: 'rss', category: 'tech' },
	{ name: 'TechCrunch',         url: 'https://techcrunch.com/feed/',                                                                            type: 'rss', category: 'tech' },
	{ name: 'Fast Company',       url: 'http://feeds.feedburner.com/fastcompany/headlines',                                                        type: 'rss', category: 'tech' },
	{ name: 'CNBC Tech',          url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',                                                   type: 'rss', category: 'tech' },
	{ name: 'CNBC Startups',      url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html',                                                    type: 'rss', category: 'tech' },
	{ name: 'CNBC Technology',    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910',                     type: 'rss', category: 'tech' },
	{ name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/',                                                               type: 'rss', category: 'tech' },
	{ name: 'Wired AI',           url: 'https://www.wired.com/feed/tag/tech/latest/rss',                                                          type: 'rss', category: 'tech' },

	// Products
	{ name: 'Product Hunt',       url: 'http://www.producthunt.com/feed',                                                                         type: 'rss', category: 'products' },
	{ name: 'Hacker News: Show HN', url: 'http://hnrss.org/show',                                                                                type: 'rss', category: 'products' },
	{ name: 'Hacker News: Launches', url: 'https://hnrss.org/launches',                                                                          type: 'rss', category: 'products' },

	// Business
	{ name: 'Forbes',             url: 'https://www.forbes.com/business/feed/',                                                                   type: 'rss', category: 'business' },
	{ name: 'Business Insider',   url: 'https://feeds.businessinsider.com/custom/all',                                                            type: 'rss', category: 'business' },
	{ name: 'Crunchbase News',    url: 'https://news.crunchbase.com/feed/',                                                                       type: 'rss', category: 'business' },
	{ name: 'Yahoo Finance',      url: 'https://news.yahoo.com/rss/finance',                                                                      type: 'rss', category: 'business' },
	{ name: 'Wired Business',     url: 'https://www.wired.com/feed/tag/ai/latest/rss',                                                            type: 'rss', category: 'business' },
	{ name: 'CNBC Finance',       url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',                     type: 'rss', category: 'business' },
	{ name: 'CNBC Business',      url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147',                     type: 'rss', category: 'business' },
	{ name: 'Yahoo Tech',         url: 'https://news.yahoo.com/rss/tech',                                                                         type: 'rss', category: 'business' },

	// Crypto
	{ name: 'CoinDesk',           url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',                                                         type: 'rss', category: 'crypto' },
	{ name: 'Decrypt',            url: 'https://decrypt.co/feed',                                                                                 type: 'rss', category: 'crypto' },
	{ name: 'The Block',          url: 'https://www.theblock.co/rss.xml',                                                                         type: 'rss', category: 'crypto' },

	// Health / Biotech
	{ name: 'STAT News',          url: 'https://www.statnews.com/feed/',                                                                          type: 'rss', category: 'health' },
	{ name: 'Fierce Biotech',     url: 'https://www.fiercebiotech.com/rss/xml',                                                                   type: 'rss', category: 'health' },
	{ name: 'MedCity News',       url: 'https://medcitynews.com/feed/',                                                                           type: 'rss', category: 'health' },

	// Space / Defense
	{ name: 'Space News',         url: 'https://spacenews.com/feed/',                                                                             type: 'rss', category: 'space' },
	{ name: 'TechCrunch Space',   url: 'https://techcrunch.com/category/space/feed/',                                                             type: 'rss', category: 'space' },

	// Fintech
	{ name: 'Finextra',           url: 'https://www.finextra.com/rss/headlines.aspx',                                                             type: 'rss', category: 'fintech' },
	{ name: 'PYMNTS',             url: 'https://www.pymnts.com/feed/',                                                                            type: 'rss', category: 'fintech' },

	// --- NewsAPI Domains ---
	{ name: 'Wired',              url: 'wired.com',          type: 'newsapi_domain', category: 'tech' },
	{ name: 'Ars Technica',       url: 'arstechnica.com',    type: 'newsapi_domain', category: 'tech' },
	{ name: 'Fortune',            url: 'fortune.com',        type: 'newsapi_domain', category: 'business' },
	{ name: 'Inc.',               url: 'inc.com',            type: 'newsapi_domain', category: 'business' },
	{ name: 'Axios',              url: 'axios.com',          type: 'newsapi_domain', category: 'general' },
	{ name: 'Business Wire',      url: 'businesswire.com',   type: 'newsapi_domain', category: 'general' },
	{ name: 'Reuters',            url: 'reuters.com',        type: 'newsapi_domain', category: 'general' },
	{ name: 'Bloomberg',          url: 'bloomberg.com',      type: 'newsapi_domain', category: 'business' },
	{ name: 'PR Newswire',        url: 'prnewswire.com',     type: 'newsapi_domain', category: 'general' },
	{ name: 'Globe Newswire',     url: 'globenewswire.com',  type: 'newsapi_domain', category: 'general' },
	{ name: 'AP News',            url: 'apnews.com',         type: 'newsapi_domain', category: 'general' },
	{ name: 'Wall Street Journal', url: 'wsj.com',           type: 'newsapi_domain', category: 'business' },
];

console.log(`Seeding ${sources.length} news sources...`);

const response = await fetch(`${SUPABASE_URL}/rest/v1/init_news_sources`, {
	method: 'POST',
	headers: {
		'apikey': SUPABASE_ANON_KEY,
		'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
		'Content-Type': 'application/json',
		'Prefer': 'resolution=merge-duplicates,return=representation',
	},
	body: JSON.stringify(sources),
});

if (!response.ok) {
	const error = await response.text();
	console.error('Seed failed:', error);
	process.exit(1);
}

const saved = await response.json();
console.log(`✅ Done! Seeded ${saved.length} news sources.`);

const byType = saved.reduce((acc, s) => {
	acc[s.type] = (acc[s.type] ?? 0) + 1;
	return acc;
}, {});
console.log('Breakdown:', byType);
