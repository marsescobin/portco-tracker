/**
 * run-seed.mjs
 *
 * One-time seed run — processes all portfolio companies via Firecrawl /search
 * and saves digests dated 2026-03-08 as a historical baseline.
 *
 * - Skips dedup filter (seed articles haven't been seen before)
 * - Marks all search results as seen after each batch (so future runs skip them)
 * - Saves digests + a pipeline_runs entry on completion
 *
 * Run: node run-seed.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { filterCandidates } from './src/utils/filter.js';
import { fetchArticleContent } from './src/utils/fetchContent.js';
import { summarizeByCompany } from './src/utils/summarize.js';
import { markArticlesSeen } from './src/utils/dedup.js';
import { saveDigests, saveRun } from './src/services/save.js';
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

const SEED_DATE       = '2026-03-08';
const SEARCH_LIMIT    = 5;
const BATCH_SIZE      = 10;
const BATCH_DELAY     = 2000; // ms between batches
const START_FROM_BATCH = 7;   // 1-indexed — set to 1 to run from the beginning

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllCompanies() {
	const res = await fetch(
		`${env.SUPABASE_URL}/rest/v1/init_companies?select=name,description,search_query&search_query=not.is.null&limit=250`,
		{ headers: supabaseHeaders(env) }
	);
	if (!res.ok) throw new Error(`Failed to fetch companies: ${await res.text()}`);
	return res.json();
}

async function searchCompany(company) {
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
			return [];
		}
		const data = await res.json();
		return (data.data ?? []).map(r => ({
			title: r.title,
			link: r.url,
			description: r.description ?? '',
			_source: 'firecrawl',
		}));
	} catch (err) {
		console.warn(`  ⚠️  ${company.name}: ${err.message}`);
		return [];
	}
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n🌱 Seed run — saving as ${SEED_DATE}`);
console.log('='.repeat(60));

// Step 1: Load all companies
console.log('\n[1] COMPANIES  Loading from Supabase...');
const companies = await fetchAllCompanies();
console.log(`           ${companies.length} companies loaded`);

// Totals across all batches
let totalSearched  = 0;
let totalConfirmed = 0;
let totalDigests   = 0;
const contentMethods = {};

// Step 2: Process in batches
const batches = [];
for (let i = 0; i < companies.length; i += BATCH_SIZE) {
	batches.push(companies.slice(i, i + BATCH_SIZE));
}

console.log(`\n[2] PROCESSING ${companies.length} companies in ${batches.length} batches of ${BATCH_SIZE}...\n`);

for (let b = START_FROM_BATCH - 1; b < batches.length; b++) {
	const batch = batches[b];
	const batchLabel = `Batch ${b + 1}/${batches.length}`;
	console.log(`── ${batchLabel} ─────────────────────────────────────`);

	// Search Firecrawl for all companies in the batch in parallel
	const searchResults = await Promise.all(batch.map(c => searchCompany(c)));

	const candidates = [];
	const allArticles = []; // for markArticlesSeen

	for (let i = 0; i < batch.length; i++) {
		const company = batch[i];
		const articles = searchResults[i];
		console.log(`   ${company.name} → ${articles.length} results`);
		allArticles.push(...articles);
		totalSearched += articles.length;
		for (const article of articles) {
			candidates.push({ article, company: company.name, companyDescription: company.description });
		}
	}

	if (candidates.length === 0) {
		console.log('   (no candidates — skipping)\n');
		continue;
	}

	// LLM relevance filter
	const confirmed = await filterCandidates(candidates, env.OPENAI_API_KEY);
	totalConfirmed += confirmed.length;
	console.log(`   LLM filter: ${confirmed.length}/${candidates.length} confirmed`);

	// Mark all searched articles as seen (regardless of LLM outcome)
	await markArticlesSeen(allArticles, env);

	if (confirmed.length === 0) {
		console.log('   (nothing confirmed)\n');
		continue;
	}

	// Fetch full content — no Firecrawl scrape to save credits (Readability only)
	const confirmedWithContent = await Promise.all(
		confirmed.map(async (c) => {
			const { content, method } = await fetchArticleContent(c.article, null);
			contentMethods[method] = (contentMethods[method] || 0) + 1;
			return { ...c, article: { ...c.article, content, _contentMethod: method } };
		})
	);

	// Summarise by company
	const results = await summarizeByCompany(confirmedWithContent, env.OPENAI_API_KEY);
	totalDigests += results.length;
	console.log(`   Digests: ${results.length} companies summarised`);

	// Save digests (run_date = SEED_DATE)
	if (results.length > 0) {
		await saveDigests(results, SEED_DATE, { source: 'firecrawl-seed' }, env);
		console.log(`   Saved ${results.length} digests ✓`);
		for (const r of results) {
			console.log(`     🏢 ${r.company} [${r.sentiment}] ${r.sentimentReason}`);
		}
	}

	console.log('');

	// Pause between batches (skip after last batch)
	if (b < batches.length - 1) {
		await sleep(BATCH_DELAY);
	}
}

// Step 3: Save pipeline run record
console.log('='.repeat(60));
console.log(`\n[3] SAVING RUN RECORD...`);

const funnel = {
	source: 'firecrawl-seed',
	companies: companies.length,
	searched: totalSearched,
	confirmed: totalConfirmed,
	digests: totalDigests,
	contentMethods,
};

await saveRun(totalDigests, SEED_DATE, funnel, { firecrawl: totalSearched }, env);

console.log(`\n✅ Seed complete`);
console.log(`   Companies processed : ${companies.length}`);
console.log(`   Articles searched   : ${totalSearched}`);
console.log(`   LLM confirmed       : ${totalConfirmed}`);
console.log(`   Digests saved       : ${totalDigests}`);
console.log(`   Content methods     : ${JSON.stringify(contentMethods)}`);
