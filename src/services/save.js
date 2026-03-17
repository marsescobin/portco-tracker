import { supabaseHeaders } from './supabase.js';

// Upserts pipeline results into init_news_digests.
// One row per company per day — overwrites on repeat runs.
export async function saveDigests(results, runDate, funnel, env) {
	const rows = results.map((r) => ({
		company_name: r.company,
		summary: r.summary,
		sentiment: r.sentiment,
		sentiment_reason: r.sentimentReason,
		articles: r.articles,
		run_date: runDate,
		run_at: new Date().toISOString(),
		funnel,
	}));

	const response = await fetch(
		`${env.SUPABASE_URL}/rest/v1/init_news_digests?on_conflict=company_name,run_date`,
		{
			method: 'POST',
			headers: {
				...supabaseHeaders(env),
				'Prefer': 'resolution=merge-duplicates,return=representation',
			},
			body: JSON.stringify(rows),
		}
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Supabase saveDigests failed: ${error}`);
	}

	return response.json();
}

// Fetches all existing digests for today — used to merge with new articles on repeat runs.
export async function fetchTodaysDigests(runDate, env) {
	const response = await fetch(
		`${env.SUPABASE_URL}/rest/v1/init_news_digests?select=company_name,summary,articles&run_date=eq.${runDate}`,
		{ headers: supabaseHeaders(env) }
	);

	if (!response.ok) return {};

	const rows = await response.json();
	return Object.fromEntries(rows.map((r) => [r.company_name, r]));
}

// Records every pipeline run — even if no results — so the UI can show "last checked at".
// Accepts an optional `health` object with { status, events, duration_ms } from the pipeline logger.
export async function saveRun(resultCount, runDate, funnel, bySource, env, health = {}) {
	const response = await fetch(
		`${env.SUPABASE_URL}/rest/v1/init_pipeline_runs`,
		{
			method: 'POST',
			headers: supabaseHeaders(env),
			body: JSON.stringify({
				run_date: runDate,
				run_at: new Date().toISOString(),
				result_count: resultCount,
				funnel,
				by_source: bySource,
				status: health.status ?? 'success',
				events: health.events ?? [],
				duration_ms: health.duration_ms ?? null,
			}),
		}
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Supabase saveRun failed: ${error}`);
	}

	return response.json();
}

// ── ARTICLE CHECKS ────────────────────────────────────────────────────────
// Saves per-article pass/fail decisions across pipeline stages so the
// Admin page can drill into exactly what matched, what the LLM confirmed,
// and what passed the signal filter — with reasons.
//
// stage: 'keyword_match' | 'llm_filter' | 'signal'
export async function saveArticleChecks(checks, runDate, env) {
	if (checks.length === 0) return;

	const rows = checks.map((c) => ({
		run_date: runDate,
		run_at: new Date().toISOString(),
		company: c.company,
		article_url: c.article_url,
		article_title: c.article_title,
		article_source: c.article_source ?? null,
		stage: c.stage,
		passed: c.passed,
		reason: c.reason ?? null,
	}));

	const response = await fetch(
		`${env.SUPABASE_URL}/rest/v1/init_article_checks`,
		{
			method: 'POST',
			headers: supabaseHeaders(env),
			body: JSON.stringify(rows),
		}
	);

	if (!response.ok) {
		const error = await response.text();
		console.warn(`[ARTICLE CHECKS] saveArticleChecks failed (non-fatal): ${error}`);
	}
}
// ── ARTICLE CHECKS (END) ─────────────────────────────────────────────────

// Seeds companies from the local companies.json file.
// Uses upsert (merge-duplicates) so it's safe to call multiple times.
export async function seedCompanies(companies, env) {
	const response = await fetch(
		`${env.SUPABASE_URL}/rest/v1/init_companies`,
		{
			method: 'POST',
			headers: {
				...supabaseHeaders(env),
				'Prefer': 'resolution=merge-duplicates,return=representation',
			},
			body: JSON.stringify(
				companies.map((c) => ({
					name: c.name,
					website: c.website_url,
					description: c.description,
					logo_url: c.logo_url,
					is_unicorn: c.is_unicorn,
				}))
			),
		}
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Supabase seed failed: ${error}`);
	}

	return response.json();
}
