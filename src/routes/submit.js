import companies from '../../companies.json' with { type: 'json' };
import { fetchArticleContent } from '../utils/fetchContent.js';
import { summarizeByCompany } from '../utils/summarize.js';
import { saveDigests, fetchTodaysDigests } from '../services/save.js';

/**
 * POST /api/submit-article
 * Body: { url: string, company: string }
 *
 * Manually pushes a single article through the summarize → save pipeline.
 * Merges with any existing digest for the same company+day.
 * Tags all resulting articles with origin: 'manual'.
 */
export async function submitArticle(request, headers, env) {
	// ── Parse & validate ────────────────────────────────────────────────
	let body;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
	}

	const { url, company } = body;

	if (!url || typeof url !== 'string') {
		return new Response(JSON.stringify({ error: 'Missing or invalid "url" field' }), { status: 400, headers });
	}
	if (!company || typeof company !== 'string') {
		return new Response(JSON.stringify({ error: 'Missing or invalid "company" field' }), { status: 400, headers });
	}

	// Look up company in portfolio
	const match = companies.initialized_capital_companies.find(
		(c) => c.name.toLowerCase() === company.toLowerCase()
	);
	if (!match) {
		return new Response(JSON.stringify({ error: `Company "${company}" not found in portfolio` }), { status: 404, headers });
	}

	try {
		// ── Fetch content ───────────────────────────────────────────────
		const article = { title: '', link: url, description: '', content: '' };
		const { content, method } = await fetchArticleContent(article, env.FIRECRAWL_API_KEY);

		if (!content || content.length === 0) {
			return new Response(JSON.stringify({ error: 'Could not extract any content from this URL' }), { status: 422, headers });
		}

		// ── Build candidate (same shape the pipeline produces) ──────────
		const candidates = [
			{
				company: match.name,
				companyDescription: match.description ?? '',
				article: {
					title: article.title || '(manual submission)',
					link: url,
					content,
					_contentMethod: method,
					_origin: 'manual',
				},
			},
		];

		// ── Fetch existing digests so we merge, not overwrite ───────────
		const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
		const existingDigests = await fetchTodaysDigests(todayISO, env);

		// ── Summarize ──────────────────────────────────────────────────
		const results = await summarizeByCompany(candidates, env.OPENAI_API_KEY, existingDigests);

		// ── Save to DB ─────────────────────────────────────────────────
		if (results.length > 0) {
			await saveDigests(results, todayISO, { source: 'manual' }, env);
		}

		const result = results[0];

		return new Response(JSON.stringify({
			message: `Digest saved for ${result.company}`,
			company: result.company,
			summary: result.summary,
			sentiment: result.sentiment,
			sentimentReason: result.sentimentReason,
			articles: result.articles,
			contentMethod: method,
		}), { status: 200, headers });

	} catch (err) {
		return new Response(JSON.stringify({
			error: 'Submit article failed',
			details: String(err),
		}), { status: 500, headers });
	}
}
