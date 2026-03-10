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
export async function saveRun(resultCount, runDate, funnel, bySource, env) {
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
			}),
		}
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Supabase saveRun failed: ${error}`);
	}

	return response.json();
}

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
