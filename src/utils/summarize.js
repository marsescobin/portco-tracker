const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-5-mini';

/**
 * Groups confirmed candidates by company, then generates one summary per company.
 *
 * @param {Array<{ article, company: string, companyDescription: string }>} confirmed
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Array<{ company: string, summary: string[], sentiment: string, sentimentReason: string, articles: Array<{ title, link }> }>>}
 */
export async function summarizeByCompany(confirmed, apiKey, existingDigests = {}) {
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
			summarizeCompany(company, companyDescription, articles, apiKey, existingDigests[company] ?? null)
		)
	);

	return results;
}

async function summarizeCompany(company, companyDescription, articles, apiKey, existingDigest = null) {
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
		? `You are helping a venture capital investor update their daily portfolio digest.

An earlier run today already produced a digest for this company. New articles have since come in. Your job is to update the digest by merging the new information into the existing bullets.

## Existing digest (from earlier today)
${existingSummary.map((b) => `- ${b}`).join('\n')}

## New articles
${articleList}

Rules:
- Keep existing bullets if they're still accurate and the new articles don't add to them
- Update a bullet if new articles add a small detail to the exact same story (e.g. two sources covering the same announcement).
- Add a new bullet if the new articles cover a meaningfully distinct development (e.g. a fundraise is distinct from a product launch, even for the same company)
- Each bullet covers one distinct story. If it's getting long, split it into sentences rather than cramming everything into one
- Write how a VC would actually talk about this to a fellow investor — not like a journalist citing sources
- Only include information directly supported by the articles. Do not infer or speculate
- Lead with the most newsworthy signal

Company: ${company}
What they do: ${companyDescription}

Respond with a JSON object (no markdown, raw JSON only) with these fields:
- "summary": updated array of bullet strings reflecting the full picture today
- "sentiment": one of "+", "-", "mixed", or "neutral" — reflecting how all the news (existing + new) makes the company look
- "sentimentReason": 5 words or fewer (e.g. "raised Series B", "layoffs announced", "regulatory scrutiny")`

		: `You are helping a venture capital investor write their daily portfolio digest — a concise update they send to their LPs about what's happening across their portfolio companies.

You will be given one or more news articles about a specific portfolio company. Your job is to write bullet points — one per genuinely distinct topic.
Each bullet covers one story and can be multiple sentences if needed — don't sacrifice clarity for brevity, but don't pad either.
Write like a sharp colleague giving a quick brief — engaging enough to forward to an investor, not dry analyst-speak. Lead with the most newsworthy signal first.
Only include information that is directly supported by the provided articles. Do not infer, speculate, or add context that isn't explicitly stated in the source material.
Write how a VC would actually talk about this to a fellow investor — not like a journalist citing sources. 

Types of signals you can cover:
- Company voice: what the company or its founders are announcing, building, or saying publicly — product launches, blog posts, podcasts, new hires, partnerships
- External coverage: what press, analysts, or the public are reporting or saying about them

---

Now summarize the following:

Company: ${company}
What they do: ${companyDescription}

Recent news articles:
${articleList}

Respond with a JSON object (no markdown, raw JSON only) with these fields:
- "summary": array of bullet point strings, one per distinct news topic. Each bullet is 1 sentence. If no meaningful news, return a single bullet saying so.
- "sentiment": one of "+", "-", "mixed", or "neutral". This should reflect how the news makes the *company* look — does it reflect well on them (+), poorly (-), conflicting (mixed), or neither positive nor negative (neutral)?
- "sentimentReason": 5 words or fewer describing what's driving the sentiment for the company (e.g. "raised Series B", "layoffs announced", "regulatory scrutiny", "strong earnings + PR crisis").`;

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
		console.warn(`⚠️ Failed to parse summarize response for ${company}:`, raw);
	}

	// Merge new articles with any existing ones from earlier runs today (dedup by link)
	const existingArticles = existingDigest?.articles ?? [];
	const existingLinks = new Set(existingArticles.map((a) => a.link));
	const newArticles = articles
		.filter((a) => !existingLinks.has(a.link))
		.map((a) => ({ title: a.title, link: a.link, contentMethod: a._contentMethod }));
	const mergedArticles = [...existingArticles, ...newArticles];

	return {
		company,
		summary,
		sentiment,
		sentimentReason,
		articles: mergedArticles,
	};
}
