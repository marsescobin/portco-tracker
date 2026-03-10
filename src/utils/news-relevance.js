const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-5-mini';
const CANDIDATES_PER_BATCH = 10; // smaller batches — content is much longer than titles

/**
 * Reads the full article content and filters out articles with no meaningful
 * investor signal (e.g. generic community posts, tutorials, no-news press releases).
 *
 * Runs after fetchArticleContent and before summarizeByCompany.
 *
 * @param {Array<{ article, company: string, companyDescription: string }>} candidates
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Array<{ article, company: string, companyDescription: string }>>}
 */
export async function filterBySignal(candidates, apiKey) {
	if (candidates.length === 0) return [];

	const signalArticles = [];

	for (let i = 0; i < candidates.length; i += CANDIDATES_PER_BATCH) {
		const batch = candidates.slice(i, i + CANDIDATES_PER_BATCH);
		const batchSignal = await filterSignalBatch(batch, apiKey);
		signalArticles.push(...batchSignal);
	}

	return signalArticles;
}

async function filterSignalBatch(batch, apiKey) {
	const articleList = batch
		.map((c, idx) => [
			`[${idx + 1}] Company: "${c.company}"`,
			`Article title: ${c.article.title ?? '(no title)'}`,
			`Article content: ${(c.article.content && c.article.content.length > 100 ? c.article.content : c.article.description ?? c.article.content ?? '(no content)').slice(0, 1500)}`,
		].join('\n'))
		.join('\n\n');

	const prompt = `You are a relevance filter for a portfolio news tracker.

For each article below, ask yourself one question: is this article genuinely about the company it's paired with, or does it just mention them in passing?

Pass it if the article is about the company — their products, people, news, press, opinions, or anything related to them directly.
Drop it only if the company is not actually the subject (e.g. mentioned as a footnote, or a false name match).

Articles to evaluate:

${articleList}`;

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
					name: 'news_relevance',
					strict: true,
					schema: {
						type: 'object',
						properties: {
							articles: {
								type: 'array',
								items: {
									type: 'object',
									properties: {
										index: { type: 'number' },
										signal: { type: 'boolean' },
										reason: { type: 'string' },
									},
									required: ['index', 'signal', 'reason'],
									additionalProperties: false,
								},
							},
						},
						required: ['articles'],
						additionalProperties: false,
					},
				},
			},
		}),
	});

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`OpenAI news relevance filter request failed: ${err}`);
	}

	const data = await response.json();
	const raw = data.choices?.[0]?.message?.content ?? '{}';

	let results;
	try {
		results = JSON.parse(raw).articles ?? [];
	} catch {
		console.error('⚠️ Failed to parse news relevance filter response as JSON:', raw);
		return [];
	}

	return results
		.filter((r) => r.signal === true)
		.map((r) => ({ ...batch[r.index - 1], signalReason: r.reason }))
		.filter(Boolean);
}
