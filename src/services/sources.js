import { supabaseHeaders } from './supabase.js';

/**
 * Fetches all news sources from init_news_sources.
 * Returns { rssFeeds, newsApiDomains } split by type.
 *
 * @param {object} env - Worker env with SUPABASE_URL and SUPABASE_ANON_KEY
 * @returns {Promise<{ rssFeeds: Array<{ name: string, url: string }>, newsApiDomains: string[] }>}
 */
export async function fetchNewsSources(env) {
	const response = await fetch(
		`${env.SUPABASE_URL}/rest/v1/init_news_sources?select=name,url,type&order=name.asc`,
		{ headers: supabaseHeaders(env) }
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch news sources: ${error}`);
	}

	const sources = await response.json();

	const rssFeeds = sources
		.filter((s) => s.type === 'rss')
		.map((s) => ({ name: s.name, url: s.url }));

	const newsApiDomains = sources
		.filter((s) => s.type === 'newsapi_domain')
		.map((s) => s.url);

	return { rssFeeds, newsApiDomains };
}
