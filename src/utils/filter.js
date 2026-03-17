const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-5-mini';
const CANDIDATES_PER_BATCH = 20; // keep prompts manageable

/**
 * Calls OpenAI to confirm which candidates are genuinely about the matched company.
 *
 * Returns { confirmed, allResults } where:
 *   - confirmed: only the candidates the LLM accepted (backwards-compatible)
 *   - allResults: every candidate with { relevant, reason } attached (for observability)
 *
 * @param {Array<{ article, company: string, companyDescription: string }>} candidates
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{ confirmed: Array, allResults: Array }>}
 */
export async function filterCandidates(candidates, apiKey, log) {
	if (candidates.length === 0) return { confirmed: [], allResults: [] };

	const confirmed = [];
	const allResults = [];

	// Process in batches to avoid token limits
	for (let i = 0; i < candidates.length; i += CANDIDATES_PER_BATCH) {
		const batch = candidates.slice(i, i + CANDIDATES_PER_BATCH);
		const { accepted, all } = await filterBatch(batch, apiKey, log);
		confirmed.push(...accepted);
		allResults.push(...all);
	}

	return { confirmed, allResults };
}

async function filterBatch(batch, apiKey, log) {
	const articleList = batch
		.map((c, idx) => [
			`[${idx + 1}] Company: "${c.company}"`,
			`Company description: ${c.companyDescription}`,
			`Article title: ${c.article.title ?? '(no title)'}`,
			`Article description: ${c.article.description ?? '(no description)'}`,
		].join('\n'))
		.join('\n\n');

	const prompt = `You are a relevance filter for a VC portfolio news tracker.

You will be given a list of news articles, each paired with a portfolio company name and a short description of what that company does. The company name was found in the article via keyword matching, but keyword matching is imprecise — company names can be common English words or abbreviations.

Your job: determine whether each article is **genuinely about that specific company**, not a false match due to an ambiguous name.

Use the company description to disambiguate. For example, if "Front" is matched but the article is about a front-end developer tool, and Front is actually a customer communications hub — that's not a match.

Respond with a JSON array (no markdown, just raw JSON) with one object per article:
[{ "index": 1, "relevant": true, "reason": "..." }, ...]

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
		}),
	});

	if (!response.ok) {
		const err = await response.text();
		throw new Error(`OpenAI request failed: ${err}`);
	}

	const data = await response.json();
	const content = data.choices?.[0]?.message?.content ?? '[]';

	let results;
	try {
		results = JSON.parse(content);
	} catch {
		if (log) log.error('llmFilter', `Failed to parse LLM response as JSON`, { raw: content.slice(0, 500) });
		else console.error('⚠️ Failed to parse LLM response as JSON:', content);
		return { accepted: [], all: [] };
	}

	// Build the full list with relevant/reason attached to every candidate
	const all = results
		.map((r) => {
			const candidate = batch[r.index - 1];
			if (!candidate) return null;
			return { ...candidate, relevant: r.relevant, reason: r.reason };
		})
		.filter(Boolean);

	const accepted = all.filter((r) => r.relevant === true);

	return { accepted, all };
}
