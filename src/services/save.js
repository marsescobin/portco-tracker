import { supabaseHeaders } from './supabase.js';

export async function saveCompanies(companies, env) {
	const response = await fetch(
		`${env.SUPABASE_URL}/rest/v1/init_companies`,
		{
			method: 'POST',
			headers: supabaseHeaders(env),
			body: JSON.stringify(
				companies.map((c) => ({
					name: c.name,
					website: c.website,
					description: c.description,
					logo_url: c.imageLink,
					is_unicorn: c.isUnicorn,
				}))
			),
		}
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Supabase insert failed: ${error}`);
	}

	return response.json();
}

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
		`${env.SUPABASE_URL}/rest/v1/init_news_digests`,
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
