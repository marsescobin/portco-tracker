import { supabaseHeaders } from '../services/supabase.js';

const TABLE = 'init_seen_articles';

/**
 * Given a list of articles, returns only those whose URL hasn't been seen before.
 *
 * @param {Array<{ link: string }>} articles
 * @param {object} env - Cloudflare Worker env (needs SUPABASE_URL, SUPABASE_ANON_KEY)
 * @returns {Promise<Array>} unseen articles
 */
export async function filterUnseenArticles(articles, env) {
	const urls = articles.map((a) => a.link).filter(Boolean);
	if (urls.length === 0) return [];

	// Query Supabase via RPC to safely handle URLs with special characters
	const response = await fetch(
		`${env.SUPABASE_URL}/rest/v1/rpc/get_seen_urls`,
		{
			method: 'POST',
			headers: supabaseHeaders(env),
			body: JSON.stringify({ urls }),
		}
	);

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`Dedup check failed: ${err}`);
	}

	const seenRows = await response.json();
	const seenUrls = new Set(seenRows.map((r) => r.url));

	return articles.filter((a) => a.link && !seenUrls.has(a.link));
}

/**
 * Marks a list of articles as seen by inserting their URLs into the DB.
 * Uses upsert to safely handle any duplicates.
 *
 * @param {Array<{ link: string }>} articles
 * @param {object} env - Cloudflare Worker env (needs SUPABASE_URL, SUPABASE_ANON_KEY)
 */
export async function markArticlesSeen(articles, env) {
	const rows = articles
		.filter((a) => a.link)
		.map((a) => ({ url: a.link }));

	if (rows.length === 0) return;

	const response = await fetch(
		`${env.SUPABASE_URL}/rest/v1/${TABLE}`,
		{
			method: 'POST',
			headers: {
				...supabaseHeaders(env),
				'Prefer': 'resolution=ignore-duplicates',
			},
			body: JSON.stringify(rows),
		}
	);

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`Dedup mark failed: ${err}`);
	}
}
