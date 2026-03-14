import { passToReadability } from './rss.js';

const MIN_CONTENT_LENGTH = 200;

/**
 * Fetches the best available content for an article using a fallback chain:
 * 1. Use RSS content if it's substantial (> 200 chars)
 * 2. Try passToReadability to extract content from the URL
 * 3. Fall back to Firecrawl /scrape with summary format
 * 4. Last resort: return the RSS description as-is
 *
 * @param {{ link: string, description?: string, content?: string }} article
 * @param {string} [firecrawlApiKey] - Optional Firecrawl API key
 * @returns {Promise<{ content: string, method: 'rssContent' | 'readability' | 'firecrawl' | 'fallback' }>}
 */
export async function fetchArticleContent(article, firecrawlApiKey, log) {
	const { link, description, content } = article;

	// Step 1: RSS content is already substantial
	if (content && content.length > MIN_CONTENT_LENGTH) {
		return { content, method: 'rssContent' };
	}

	// Step 2: Try passToReadability
	try {
		const result = await passToReadability(link, log);
		if (result?.textContent && result.textContent.length > MIN_CONTENT_LENGTH) {
			return { content: result.textContent, method: 'readability' };
		}
	} catch (err) {
		if (log) log.warn('content', `Readability threw for ${link}: ${err.message}`, { url: link, error: err.message });
	}

	// Step 3: Try Firecrawl summary if API key is available
	if (firecrawlApiKey) {
		try {
			const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${firecrawlApiKey}`,
				},
			body: JSON.stringify({
				url: link,
				formats: ['summary'],
			}),
		});

		if (response.ok) {
			const data = await response.json();
			const summary = data.data?.summary;
			if (summary && summary.length > MIN_CONTENT_LENGTH) {
				return { content: summary, method: 'firecrawl' };
			}
			}
		} catch (err) {
			if (log) log.warn('content', `Firecrawl failed for ${link}: ${err.message}`, { url: link, error: err.message });
		}
	}

	// Step 4: Last resort — use RSS description
	if (log) log.warn('content', `All methods failed, fell back to RSS description: ${article.title ?? link}`, { url: link });
	return { content: description ?? '', method: 'rssDescription' };
}
