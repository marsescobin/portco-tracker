import { discoverFeed } from '../utils/feed-discovery.js';
import { supabaseHeaders } from '../services/supabase.js';

/**
 * POST /api/sources/discover
 * Body: { url: string }
 *
 * Tries to auto-discover an RSS/Atom feed for the given URL.
 * Returns the discovered feed info or a "not found" result.
 */
export async function discoverSource(request, headers, env) {
	let body;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
	}

	const { url } = body;
	if (!url || typeof url !== 'string') {
		return new Response(JSON.stringify({ error: 'Missing or invalid "url" field' }), { status: 400, headers });
	}

	try {
		const feeds = await discoverFeed(url);

		if (feeds.length > 0) {
			return new Response(JSON.stringify({
				found: true,
				// For backwards compat, keep feedUrl/name/type from the first result
				feedUrl: feeds[0].feedUrl,
				name: feeds[0].name,
				type: feeds[0].type,
				// Full list for multi-feed UI
				feeds,
			}), { status: 200, headers });
		}

		// No feed found — return the URL as-is so the user knows
		return new Response(JSON.stringify({
			found: false,
			feeds: [],
			message: 'No RSS or Atom feed detected at this URL.',
			inputUrl: url,
		}), { status: 200, headers });
	} catch (err) {
		return new Response(JSON.stringify({
			error: 'Discovery failed',
			details: String(err),
		}), { status: 500, headers });
	}
}

/**
 * POST /api/sources
 * Body: { name: string, url: string, type: string, category?: string }
 *
 * Creates a new news source in init_news_sources.
 */
export async function createSource(request, headers, env) {
	let body;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
	}

	const { name, url, type, category } = body;

	if (!name || typeof name !== 'string') {
		return new Response(JSON.stringify({ error: 'Missing or invalid "name"' }), { status: 400, headers });
	}
	if (!url || typeof url !== 'string') {
		return new Response(JSON.stringify({ error: 'Missing or invalid "url"' }), { status: 400, headers });
	}
	if (!type || typeof type !== 'string') {
		return new Response(JSON.stringify({ error: 'Missing or invalid "type"' }), { status: 400, headers });
	}

	const response = await fetch(`${env.SUPABASE_URL}/rest/v1/init_news_sources`, {
		method: 'POST',
		headers: supabaseHeaders(env),
		body: JSON.stringify({ name, url, type, category: category || null }),
	});

	if (!response.ok) {
		const error = await response.text();
		return new Response(JSON.stringify({ error: 'Failed to create source', details: error }), { status: response.status, headers });
	}

	const [created] = await response.json();
	return new Response(JSON.stringify(created), { status: 201, headers });
}

/**
 * PUT /api/sources/:id
 * Body: { name?: string, url?: string, type?: string, category?: string }
 *
 * Updates an existing news source.
 */
export async function updateSource(request, headers, env, id) {
	let body;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
	}

	// Only include fields that were actually provided
	const updates = {};
	if (body.name !== undefined) updates.name = body.name;
	if (body.url !== undefined) updates.url = body.url;
	if (body.type !== undefined) updates.type = body.type;
	if (body.category !== undefined) updates.category = body.category;

	if (Object.keys(updates).length === 0) {
		return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400, headers });
	}

	const response = await fetch(
		`${env.SUPABASE_URL}/rest/v1/init_news_sources?id=eq.${id}`,
		{
			method: 'PATCH',
			headers: supabaseHeaders(env),
			body: JSON.stringify(updates),
		}
	);

	if (!response.ok) {
		const error = await response.text();
		return new Response(JSON.stringify({ error: 'Failed to update source', details: error }), { status: response.status, headers });
	}

	const result = await response.json();
	if (result.length === 0) {
		return new Response(JSON.stringify({ error: 'Source not found' }), { status: 404, headers });
	}

	return new Response(JSON.stringify(result[0]), { status: 200, headers });
}

/**
 * DELETE /api/sources/:id
 *
 * Deletes a news source by ID.
 */
export async function deleteSource(request, headers, env, id) {
	const response = await fetch(
		`${env.SUPABASE_URL}/rest/v1/init_news_sources?id=eq.${id}`,
		{
			method: 'DELETE',
			headers: supabaseHeaders(env),
		}
	);

	if (!response.ok) {
		const error = await response.text();
		return new Response(JSON.stringify({ error: 'Failed to delete source', details: error }), { status: response.status, headers });
	}

	const result = await response.json();
	if (result.length === 0) {
		return new Response(JSON.stringify({ error: 'Source not found' }), { status: 404, headers });
	}

	return new Response(JSON.stringify({ deleted: true, id }), { status: 200, headers });
}
