const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-5-mini';

/**
 * Groups confirmed candidates by company, then generates one summary per company.
 *
 * @param {Array<{ article, company: string, companyDescription: string }>} confirmed
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Array<{ company: string, summary: string, articles: Array<{ title, link }> }>>}
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

	const prompt = `You are helping a venture capital investor write their weekly portfolio digest — a concise update they send to their LPs about what's happening across their portfolio companies.

You will be given one or more news articles about a specific portfolio company. Your job is to write a 2-3 sentence summary that's scannable enough but still surfaces what matters.
Write like a sharp colleague giving a quick brief — engaging enough to forward to an investor, not dry analyst-speak. Lead with the most important signal. Do not start with the company name.
Only include information that is directly supported by the provided articles. Do not infer, speculate, or add context that isn't explicitly stated in the source material.

Examples of types of signals you can cover:
- Company voice: what the company or its founders are announcing, building, or saying publicly — product launches, blog posts, podcasts, new hires, partnerships
- External coverage: what press, analysts, or the public are reporting or saying about them


## Example 1
Company: Skyline Robotics (makes autonomous window-cleaning robots)
Summary: "The team just shipped their second-generation hardware, cutting cleaning time by 40% and expanding to three new cities. Founder Maya Lin broke it down in a detailed LinkedIn post that's getting strong traction in the facilities management community."
Sentiment: +
SentimentReason: "new hardware shipped"

## Example 2
Company: Bridgepoint Lending (AI-powered mortgage platform)
Articles: (1) ProPublica investigation raises questions about underwriting practices in lower-income zip codes. (2) Bridgepoint announces record origination quarter in press release. (3) TechCrunch covers their new AI underwriting model launch.
Summary: "A record origination quarter and a new AI underwriting model launch are getting attention this week, though a ProPublica investigation into their lending practices in lower-income zip codes is running alongside the good news. The contrast is notable — worth seeing how the company responds publicly."
Sentiment: mixed
SentimentReason: "record quarter, investigation published"

---

Now summarize the following:

Company: ${company}
What they do: ${companyDescription}

Recent news articles:
${articleList}

Respond with a JSON object (no markdown, raw JSON only) with these fields:
- "summary": your 2-3 sentence summary as described above. If the articles don't contain meaningful news, say so briefly.
- "sentiment": one of "+", "-", or "mixed". Use "mixed" only if there are conflicting signals.
- "sentimentReason": 5 words or fewer (e.g. "raised Series B", "layoffs announced", "regulatory fine + new product").`;

	const response = await fetch(OPENAI_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: MODEL,
			temperature: 0.4,
			messages: [{ role: 'user', content: prompt }],
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'company_summary',
					strict: true,
					schema: {
						type: 'object',
						properties: {
							summary: { type: 'string' },
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

	let summary = 'No summary available.';
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
		articles: articles.map((a) => ({ title: a.title, link: a.link })),
	};
}
