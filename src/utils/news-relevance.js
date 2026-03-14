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
export async function filterBySignal(candidates, apiKey, log) {
	if (candidates.length === 0) return { filtered: [], signalLog: [] };

	const allResults = [];

	for (let i = 0; i < candidates.length; i += CANDIDATES_PER_BATCH) {
		const batch = candidates.slice(i, i + CANDIDATES_PER_BATCH);
		const batchResults = await filterSignalBatch(batch, apiKey, log);
		allResults.push(...batchResults);
	}

	return {
		filtered: allResults.filter((r) => r.signal),
		signalLog: allResults,
	};
}

async function filterSignalBatch(batch, apiKey, log) {
	const articleList = batch
		.map((c, idx) => [
			`[${idx + 1}] Company: "${c.company}"`,
			`Article title: ${c.article.title ?? '(no title)'}`,
			`Article content: ${(c.article.content && c.article.content.length > 100 ? c.article.content : c.article.description ?? c.article.content ?? '(no content)').slice(0, 1500)}`,
		].join('\n'))
		.join('\n\n');

	const prompt = `You are a noise filter for a venture capital portfolio news tracker. Your job is to catch junk or white noise articles. When in doubt, pass.

For each article below, decide: does this article say anything specific about the company it's paired with?

Pass it unless you have a clear reason to drop it. 

For example:
- The company name match is wrong (e.g. "Apollo" the Greek god, not Apollo Global Management)
- The company is barely mentioned — a passing reference in a list, a footnote, or generic background
- The article has no real content (e.g. a stub, a redirect, or gibberish)

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
		if (log) log.error('signal', `Failed to parse signal filter response as JSON`, { raw: raw.slice(0, 500) });
		else console.error('⚠️ Failed to parse news relevance filter response as JSON:', raw);
		return [];
	}

	return results
		.map((r) => {
			const candidate = batch[r.index - 1];
			if (!candidate) return null;
			return { ...candidate, signal: r.signal, signalReason: r.reason };
		})
		.filter(Boolean);
}
