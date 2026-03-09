const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

/**
 * Groups confirmed candidates by company, then generates one summary per company.
 *
 * @param {Array<{ article, company: string, companyDescription: string }>} confirmed
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Array<{ company: string, summary: string[], sentiment: string, sentimentReason: string, articles: Array<{ title, link }> }>>}
 */
export async function summarizeByCompany(confirmed, apiKey) {
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
			summarizeCompany(company, companyDescription, articles, apiKey)
		)
	);

	return results;
}

async function summarizeCompany(company, companyDescription, articles, apiKey) {
	const articleList = articles
		.map((a, i) => [
			`[${i + 1}] ${a.title ?? '(no title)'}`,
			a.content
				? `Content: ${a.content.slice(0, 1000)}` // cap to avoid token overflow
				: a.description
					? `Summary: ${a.description}`
					: '',
		].filter(Boolean).join('\n'))
		.join('\n\n');

	const prompt = `You are helping a venture capital investor write their daily portfolio digest — a concise update they send to their LPs about what's happening across their portfolio companies.

You will be given one or more news articles about a specific portfolio company. Your job is to write bullet points — one per genuinely distinct topic, each exactly 1 sentence.
If multiple articles cover the same story, combine them into a single bullet, unless there's details that is worth surfacing in multiple bullets. 
Write like a sharp colleague giving a quick brief — engaging enough to forward to an investor, not dry analyst-speak. Lead with the most newsworthy signal first.
Only include information that is directly supported by the provided articles. Do not infer, speculate, or add context that isn't explicitly stated in the source material.

Types of signals you can cover:
- Company voice: what the company or its founders are announcing, building, or saying publicly — product launches, blog posts, podcasts, new hires, partnerships
- External coverage: what press, analysts, or the public are reporting or saying about them

## Example 1
Company: Skyline Robotics (makes autonomous window-cleaning robots)
Articles: Founder Maya Lin announced second-gen hardware, cutting cleaning time by 40% and launching in Seattle, Austin, and Miami. Her LinkedIn post on the launch is getting strong traction.
Bullets:
- Shipped second-gen hardware cutting cleaning time by 40%, expanding to three new cities — and the founder's LinkedIn post is getting strong pickup in the facilities management community.
Sentiment: +
SentimentReason: "strong product launch"

## Example 2
Company: Bridgepoint Lending (AI-powered mortgage platform)
Articles: (1) ProPublica investigation raises questions about underwriting practices. (2) Record origination quarter announced. (3) New AI underwriting model launched.
Bullets:
- Posted a record origination quarter and launched a new AI underwriting model.
- A ProPublica investigation into their lending practices in lower-income zip codes is running alongside the good news.
Sentiment: mixed
SentimentReason: "growth + regulatory scrutiny"

---

Now summarize the following:

Company: ${company}
What they do: ${companyDescription}

Recent news articles:
${articleList}

Respond with a JSON object (no markdown, raw JSON only) with these fields:
- "summary": array of bullet point strings, one per distinct news topic. Each bullet is 1 sentence. If no meaningful news, return a single bullet saying so.
- "sentiment": one of "+", "-", or "mixed". This should reflect how the news makes the *company* look — does it reflect well on them (+), poorly (-), or is it conflicting (mixed)?
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
							sentiment: { type: 'string', enum: ['+', '-', 'mixed'] },
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

	return {
		company,
		summary,
		sentiment,
		sentimentReason,
		articles: articles.map((a) => ({ title: a.title, link: a.link, contentMethod: a._contentMethod })),
	};
}
