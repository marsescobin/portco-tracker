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
