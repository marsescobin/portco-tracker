const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-5-mini';

/**
 * Groups confirmed candidates by company, then generates one summary per company.
 *
 * @param {Array<{ article, company: string, companyDescription: string }>} confirmed
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Array<{ company: string, summary: string[], sentiment: string, sentimentReason: string, articles: Array<{ title, link }> }>>}
 */
export async function summarizeByCompany(confirmed, apiKey, existingDigests = {}, log) {
	if (confirmed.length === 0) return [];

	// Group articles by company
	const grouped = {};
	for (const { article, company, companyDescription } of confirmed) {
		if (!grouped[company]) {
			grouped[company] = { companyDescription, articles: [] };
		}
		grouped[company].articles.push(article);
	}

	// Generate one summary per company in parallel
	const results = await Promise.all(
		Object.entries(grouped).map(([company, { companyDescription, articles }]) =>
			summarizeCompany(company, companyDescription, articles, apiKey, existingDigests[company] ?? null, log)
		)
	);

	return results;
}

async function summarizeCompany(company, companyDescription, articles, apiKey, existingDigest = null, log) {
	const articleList = articles
		.map((a, i) => [
			`[${i + 1}] ${a.title ?? '(no title)'}`,
			a.description ? `Description: ${a.description}` : '',
			a.content ? `Content: ${a.content.slice(0, 1000)}` : '',
		].filter(Boolean).join('\n'))
		.join('\n\n');

	const existingSummary = Array.isArray(existingDigest?.summary)
		? existingDigest.summary
		: (typeof existingDigest?.summary === 'string' ? JSON.parse(existingDigest.summary) : []);
	const hasExisting = existingSummary.length > 0;

	const prompt = hasExisting
		? `You are a portfolio analyst at a venture capital firm. You cover ${company} (${companyDescription}).

An earlier run today produced a digest. New articles have come in — merge the new info into the existing bullets.

## Existing digest
${existingSummary.map((b) => `- ${b}`).join('\n')}

## New articles
${articleList}

Rules:
- Keep existing bullets if still accurate and new articles don't add to them
- Update a bullet if new articles add detail to the same story
- Add a new bullet only for a meaningfully distinct development
- The company is the implied subject — don't restate their name. Describe other entities in relation to them
- Only include what the articles explicitly say; don't infer or speculate

Respond with a JSON object (no markdown, raw JSON only):
- "summary": updated array of bullet strings reflecting the full picture today
- "sentiment": "+", "-", "mixed", or "neutral" — how all of today's news reflects on the company
- "sentimentReason": 5 words or fewer (e.g. "raised Series B", "lost market share")`

		: `You are a portfolio analyst at a venture capital firm. You cover ${company} (${companyDescription}).

You're scanning today's news and writing a quick brief for the investment team. The company is the implied subject — don't restate their name. Other players should be described in relation to them (e.g. "its competitor," "a potential acquirer," "their customer").

Write one bullet per distinct story — 1 to 2 sentences each. Be direct and specific, the way you'd actually brief a partner at the firm. Only include what the articles explicitly say; don't infer or speculate.

Recent articles:
${articleList}

Respond with a JSON object (no markdown, raw JSON only):
- "summary": array of bullet strings, one per distinct story. If nothing meaningful, return a single bullet saying so.
- "sentiment": "+", "-", "mixed", or "neutral" — how this news reflects on the company
- "sentimentReason": 5 words or fewer (e.g. "raised Series B", "lost market share")`;

	const response = await fetch(OPENAI_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: MODEL,
			messages: [{ role: 'user', content: prompt }],
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'company_summary',
					strict: true,
					schema: {
						type: 'object',
						properties: {
							summary: {
								type: 'array',
								items: { type: 'string' },
							},
							sentiment: { type: 'string', enum: ['+', '-', 'mixed', 'neutral'] },
							sentimentReason: { type: 'string' },
						},
						required: ['summary', 'sentiment', 'sentimentReason'],
						additionalProperties: false,
					},
				},
			},
		}),
	});

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`OpenAI summarize failed for ${company}: ${err}`);
	}

	const data = await response.json();
	const raw = data.choices?.[0]?.message?.content?.trim() ?? '{}';

	let summary = [];
	let sentiment = '+';
	let sentimentReason = '';

	try {
		const parsed = JSON.parse(raw);
		summary = parsed.summary ?? summary;
		sentiment = parsed.sentiment ?? sentiment;
		sentimentReason = parsed.sentimentReason ?? sentimentReason;
	} catch {
		if (log) log.warn('summarize', `Failed to parse summarize response for ${company}`, { company, raw: raw.slice(0, 500) });
		else console.warn(`⚠️ Failed to parse summarize response for ${company}:`, raw);
	}

	// Merge new articles with any existing ones from earlier runs today (dedup by link)
	const existingArticles = existingDigest?.articles ?? [];
	const existingLinks = new Set(existingArticles.map((a) => a.link));
	const newArticles = articles
		.filter((a) => !existingLinks.has(a.link))
		.map((a) => ({ title: a.title, link: a.link, contentMethod: a._contentMethod, origin: a._origin ?? 'pipeline' }));
	const mergedArticles = [...existingArticles, ...newArticles];

	return {
		company,
		summary,
		sentiment,
		sentimentReason,
		articles: mergedArticles,
	};
}
