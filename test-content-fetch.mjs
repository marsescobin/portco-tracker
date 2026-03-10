import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const devVars = readFileSync(join(__dirname, '.dev.vars'), 'utf-8');
const env = Object.fromEntries(
	devVars.split('\n')
		.filter(line => line.includes('='))
		.map(line => line.split('=').map(s => s.trim()))
		.map(([key, ...rest]) => [key, rest.join('=')])
);

const MIN_CONTENT_LENGTH = 300;

async function passToReadability(articleUrl) {
	try {
		const response = await fetch(articleUrl);
		const html = await response.text();
		const { document } = parseHTML(html);
		const reader = new Readability(document);
		const article = reader.parse();
		return article;
	} catch (error) {
		console.log('❌ Readability error:', error.message);
		return null;
	}
}

async function fetchArticleContent(url, firecrawlApiKey) {
	// Step 1: Try Readability
	try {
		const result = await passToReadability(url);
		if (result?.textContent && result.textContent.length > MIN_CONTENT_LENGTH) {
			return { content: result.textContent, method: 'readability' };
		}
	} catch {
		// continue
	}

	// Step 2: Try Firecrawl summary
	if (firecrawlApiKey) {
		try {
			const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${firecrawlApiKey}`,
				},
				body: JSON.stringify({ url, formats: ['summary'] }),
			});
			const data = await response.json();
			const summary = data.data?.summary;
			if (summary && summary.length > MIN_CONTENT_LENGTH) {
				return { content: summary, method: 'firecrawl' };
			}
		} catch {
			// continue
		}
	}

	return { content: null, method: 'failed' };
}

// URLs from the search test
const urls = [
	'https://www.businesswire.com/news/home/20260305328849/en/Algolia-Introduces-New-Intelligent-Auto-Parts-Solution',
	'https://www.algolia.com/about/news/ai-search-and-retrieval-leader-algolia-releases-six-bold-bets-for-2026',
	'https://martech-pulse.com/news/forrester-study-finds-algolia-ai-search-delivers-213-percent-roi/',
];

const { FIRECRAWL_API_KEY } = env;

const output = [];

for (const url of urls) {
	console.log(`\n🔗 ${url}`);
	const { content, method } = await fetchArticleContent(url, FIRECRAWL_API_KEY);
	console.log(`   Method: ${method}`);
	output.push(`\n${'='.repeat(80)}\nURL: ${url}\nMethod: ${method}\n\n${content ?? '(none)'}`);
}

writeFileSync('test-content-output.txt', output.join('\n'));
console.log('\n✅ Full content written to test-content-output.txt');
