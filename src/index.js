import { fetchNews, runPipeline } from './routes/pipeline.js';

const headers = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Content-Type': 'application/json',
};

export default {
	// Cron trigger — runs the pipeline on schedule and saves results to DB
	async scheduled(event, env, ctx) {
		console.log(`[CRON] Pipeline triggered at ${new Date().toISOString()}`);
		ctx.waitUntil(
			runPipeline(env).catch((err) => {
				console.error('[CRON] Pipeline failed:', String(err));
			})
		);
	},

	async fetch(request, env, ctx) {
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers,
			});
		}

		const url = new URL(request.url);
		const path = url.pathname;

		// Route: /api/fetch-news
		if (path === '/api/fetch-news') {
			return fetchNews(headers, env);
		}

		// Route: /api/test-firecrawl?url=<encoded-url>
		// Debug endpoint — returns the raw Firecrawl response for a given URL
		if (path === '/api/test-firecrawl') {
			const articleUrl = url.searchParams.get('url');
			if (!articleUrl) {
				return new Response(JSON.stringify({ error: 'Missing ?url= param' }), { status: 400, headers });
			}
			const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`,
				},
				body: JSON.stringify({ url: articleUrl, formats: ['summary', 'markdown'] }),
			});
			const data = await response.json();
			return new Response(JSON.stringify(data, null, 2), { status: response.status, headers });
		}

		return new Response(JSON.stringify({ error: 'Not found' }), {
			status: 404,
			headers,
		});
	}
}
