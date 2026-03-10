/**
 * run-manual.mjs
 *
 * Manual digest runner — for companies where automated search fails.
 * Provide URLs directly; skips Firecrawl search and the LLM relevance filter.
 *
 * Pipeline: URLs → fetchArticleContent → filterBySignal → summarizeByCompany → saveDigests
 *
 * Run: node run-manual.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { filterBySignal } from './src/utils/news-relevance.js';
import { fetchArticleContent } from './src/utils/fetchContent.js';
import { summarizeByCompany } from './src/utils/summarize.js';
import { saveDigests, fetchTodaysDigests } from './src/services/save.js';
import { supabaseHeaders } from './src/services/supabase.js';

// ─── Keys (loaded from .dev.vars) ────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const devVars = readFileSync(join(__dirname, '.dev.vars'), 'utf-8');
const env = Object.fromEntries(
	devVars.split('\n')
		.filter(line => line.includes('='))
		.map(line => line.split('=').map(s => s.trim()))
		.map(([key, ...rest]) => [key, rest.join('=')])
);
// ─────────────────────────────────────────────────────────────────────────────

const RUN_DATE = '2026-03-08';

// ─── Add companies + URLs here ────────────────────────────────────────────────
const MANUAL_ARTICLES = {
	'Garage': [
		'https://www.ycombinator.com/companies/garage-2',
		'https://www.prnewswire.com/news-releases/garage-raises-13-5m-series-a-to-build-modern-marketplace-for-americas-essential-equipment-302534666.html',
		'https://techcrunch.com/2025/08/20/yc-backed-garage-raises-13-5m-to-help-firefighters-buy-equipment/',
	],
};
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n🔧 Manual digest run — saving as ${RUN_DATE}`);
console.log('='.repeat(60));

// Step 1: Fetch company descriptions from Supabase
const companyNames = Object.keys(MANUAL_ARTICLES);
console.log(`\n[1] COMPANIES  ${companyNames.join(', ')}`);

const namesFilter = companyNames.map(n => `"${n}"`).join(',');
const companyRes = await fetch(
	`${env.SUPABASE_URL}/rest/v1/init_companies?select=name,description&name=in.(${namesFilter})`,
	{ headers: supabaseHeaders(env) }
);
if (!companyRes.ok) throw new Error(`Failed to fetch companies: ${await companyRes.text()}`);
const companyRows = await companyRes.json();
const descriptionMap = Object.fromEntries(companyRows.map(c => [c.name, c.description]));

for (const name of companyNames) {
	if (!descriptionMap[name]) console.warn(`   ⚠️  No description found for "${name}" — check the name matches exactly`);
}

// Step 2: Fetch existing digests (for merge support)
const existingDigests = await fetchTodaysDigests(RUN_DATE, env);

// Step 3: Fetch article content
console.log(`\n[2] FETCHING CONTENT`);
const candidates = [];

for (const [company, urls] of Object.entries(MANUAL_ARTICLES)) {
	const description = descriptionMap[company] ?? '';
	for (const url of urls) {
		const article = { title: url, link: url, description: '' };
		const { content, method } = await fetchArticleContent(article, null);
		console.log(`   📄 [${company}] ${method.padEnd(16)} ${url}`);
		candidates.push({
			article: { ...article, content, _contentMethod: method },
			company,
			companyDescription: description,
		});
	}
}

if (candidates.length === 0) {
	console.log('\nNo candidates — exiting.');
	process.exit(0);
}

// Step 4: Signal filter
console.log(`\n[3] SIGNAL FILTER`);
const withSignal = await filterBySignal(candidates, env.OPENAI_API_KEY);
console.log(`   ${withSignal.length}/${candidates.length} passed`);
for (const { article, company } of candidates) {
	const kept = withSignal.some(c => c.article.link === article.link);
	console.log(`   ${kept ? '✅' : '❌'} [${company}] ${article.link}`);
}

if (withSignal.length === 0) {
	console.log('\nNothing passed signal filter — exiting.');
	process.exit(0);
}

// Step 5: Summarise
console.log(`\n[4] SUMMARISING`);
const results = await summarizeByCompany(withSignal, env.OPENAI_API_KEY, existingDigests);
console.log(`   ${results.length} companies summarised`);
for (const r of results) {
	console.log(`   🏢 ${r.company} [${r.sentiment}] ${r.sentimentReason}`);
}

// Step 6: Save digests
console.log(`\n[5] SAVING`);
await saveDigests(results, RUN_DATE, { source: 'manual' }, env);
console.log(`   Saved ${results.length} digests ✓`);

console.log(`\n✅ Done`);
