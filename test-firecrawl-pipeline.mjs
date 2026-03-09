/**
 * test-firecrawl-pipeline.mjs
 *
 * End-to-end test of the Firecrawl search pipeline for 10 companies.
 * Skips dedup so we always get fresh results regardless of seen history.
 *
 * Run: node test-firecrawl-pipeline.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { filterCandidates } from './src/utils/filter.js';
import { fetchArticleContent } from './src/utils/fetchContent.js';
import { summarizeByCompany } from './src/utils/summarize.js';
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

const SEARCH_LIMIT = 5;   // Firecrawl results per company
const COMPANY_LIMIT = 10; // Companies to test

const todayISO = new Date().toISOString().split('T')[0];
console.log(`\n🚀 Firecrawl pipeline test — ${todayISO}`);
console.log('='.repeat(60));

// ─── Step 1: Load 10 companies from DB ───────────────────────────────────────
console.log('\n[1] COMPANIES  Loading from Supabase...');

const companyRes = await fetch(
	`${env.SUPABASE_URL}/rest/v1/init_companies?select=name,description,search_query&search_query=not.is.null&limit=${COMPANY_LIMIT}`,
	{ headers: supabaseHeaders(env) }
);

if (!companyRes.ok) {
	console.error('Failed to fetch companies:', await companyRes.text());
	process.exit(1);
}

const companies = await companyRes.json();
console.log(`           ${companies.length} companies loaded:`);
companies.forEach(c => console.log(`           - ${c.name}: ${c.search_query}`));

// ─── Step 2: Firecrawl /search per company ───────────────────────────────────
console.log('\n[2] SEARCH     Querying Firecrawl...');

const candidates = [];

for (const company of companies) {
	try {
		const res = await fetch('https://api.firecrawl.dev/v1/search', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`,
			},
			body: JSON.stringify({ query: `Latest news on ${company.search_query}`, limit: SEARCH_LIMIT }),
		});

		if (!res.ok) {
			console.warn(`  ⚠️  ${company.name}: search failed (${res.status})`);
			continue;
		}

		const data = await res.json();
		const results = data.data ?? [];

		console.log(`           ${company.name} → ${results.length} results`);

		for (const r of results) {
			candidates.push({
				article: {
					title: r.title,
					link: r.url,
					description: r.description ?? '',
					_source: 'firecrawl',
				},
				company: company.name,
				companyDescription: company.description,
			});
		}
	} catch (err) {
		console.warn(`  ⚠️  ${company.name}: ${err.message}`);
	}
}

console.log(`\n           Total candidates: ${candidates.length}`);

if (candidates.length === 0) {
	console.log('\n❌ No candidates. Exiting.');
	process.exit(0);
}

// ─── Step 3: LLM relevance filter ────────────────────────────────────────────
console.log('\n[3] LLM FILTER Checking relevance...');
const confirmed = await filterCandidates(candidates, env.OPENAI_API_KEY);
console.log(`           ${confirmed.length}/${candidates.length} confirmed relevant`);

if (confirmed.length === 0) {
	console.log('\n❌ Nothing confirmed relevant. Exiting.');
	process.exit(0);
}

// ─── Step 4: Fetch full article content ──────────────────────────────────────
console.log('\n[4] CONTENT    Fetching article content...');

const confirmedWithContent = await Promise.all(
	confirmed.map(async (c) => {
		const { content, method } = await fetchArticleContent(c.article, env.FIRECRAWL_API_KEY);
		return { ...c, article: { ...c.article, content, _contentMethod: method } };
	})
);

const methodCounts = confirmedWithContent.reduce((acc, { article }) => {
	acc[article._contentMethod] = (acc[article._contentMethod] || 0) + 1;
	return acc;
}, {});
console.log(`           Methods: ${JSON.stringify(methodCounts)}`);

// ─── Step 5: Summarise by company ────────────────────────────────────────────
console.log('\n[5] SUMMARISE  Generating digests...');
const results = await summarizeByCompany(confirmedWithContent, env.OPENAI_API_KEY);

// ─── Output ───────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`✅  ${results.length} company digest(s) generated`);
console.log('='.repeat(60));

for (const r of results) {
	console.log(`\n🏢  ${r.company}  [${r.sentiment}]  ${r.sentimentReason}`);
	for (const bullet of r.summary) {
		console.log(`    • ${bullet}`);
	}
	console.log(`    Sources (${r.articles.length}):`);
	for (const a of r.articles) {
		console.log(`      - ${a.title ?? a.link}`);
	}
}
