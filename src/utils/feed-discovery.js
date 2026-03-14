import { parseHTML } from 'linkedom';
import { extract } from '@extractus/feed-extractor';

const COMMON_FEED_PATHS = [
	'/feed',
	'/rss',
	'/rss.xml',
	'/feed.xml',
	'/atom.xml',
	'/blog/feed',
	'/news/feed',
	'/feed/rss',
	'/feed/atom',
];

const FEED_CONTENT_TYPES = [
	'application/rss+xml',
	'application/atom+xml',
	'application/xml',
	'text/xml',
];

/**
 * Discovers RSS/Atom feeds for a given URL.
 *
 * Strategy:
 * 1. Check if the URL itself is a feed (parseable XML)
 * 2. Parse the page HTML for <link rel="alternate"> feed tags (returns ALL matches)
 * 3. Try common feed paths (/feed, /rss, /rss.xml, etc.)
 *
 * Returns an array of discovered feeds. Sites like TechCrunch or The Verge
 * may offer multiple feeds (main feed, per-category, etc.) — we return all
 * of them so the user can pick which one(s) to add.
 *
 * @param {string} inputUrl - The URL to discover feeds for
 * @returns {Promise<{ feedUrl: string, name: string, type: 'rss', recentArticles: { title: string, link: string }[] }[]>}
 */
export async function discoverFeed(inputUrl) {
	// Normalize — add protocol if missing
	let url = inputUrl.trim();
	if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

	// Step 1: Check if the URL itself is already a feed
	const directResult = await checkIfFeed(url);
	if (directResult) return [directResult];

	/** @type {{ feedUrl: string, name: string, type: 'rss' }[]} */
	const found = [];
	const seenUrls = new Set();
	let pageTitle = '';

	// Step 2: Fetch the page and look for <link rel="alternate"> tags
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'initialized-portfolio-tracker/1.0' },
			redirect: 'follow',
		});
		if (!res.ok) return [];

		const contentType = res.headers.get('content-type') || '';
		if (!contentType.includes('text/html')) return [];

		const html = await res.text();
		const { document } = parseHTML(html);
		pageTitle = document.querySelector('title')?.textContent?.trim() || '';

		// Look for <link rel="alternate" type="application/rss+xml"> or atom+xml
		const linkTags = document.querySelectorAll(
			'link[rel="alternate"][type="application/rss+xml"], link[rel="alternate"][type="application/atom+xml"]'
		);

		// Verify all candidates in parallel (bounded to prevent abuse)
		const candidates = [];
		for (const link of linkTags) {
			const href = link.getAttribute('href');
			if (!href) continue;
			const feedUrl = new URL(href, url).href;
			if (seenUrls.has(feedUrl)) continue;
			seenUrls.add(feedUrl);
			candidates.push({ feedUrl, title: link.getAttribute('title') || '' });
		}

		const verifications = await Promise.all(
			candidates.map(async (c) => {
				const verified = await verifyFeed(c.feedUrl);
				return verified ? { ...c, verified } : null;
			})
		);

		for (const v of verifications) {
			if (!v) continue;
			found.push({
				feedUrl: v.feedUrl,
				name: cleanName(v.title || v.verified.title || pageTitle || new URL(url).hostname),
				type: 'rss',
				recentArticles: extractRecentArticles(v.verified),
			});
		}

		if (found.length > 0) return found;
	} catch {
		// Page fetch failed — still try common paths below
	}

	// Step 3: Try common feed paths
	const origin = new URL(url).origin;
	for (const path of COMMON_FEED_PATHS) {
		const candidateUrl = origin + path;
		if (seenUrls.has(candidateUrl)) continue;
		const verified = await verifyFeed(candidateUrl);
		if (verified) {
			return [{
				feedUrl: candidateUrl,
				name: cleanName(pageTitle || verified.title || new URL(url).hostname),
				type: 'rss',
				recentArticles: extractRecentArticles(verified),
			}];
		}
	}

	return [];
}

/**
 * Checks if a URL is itself a feed (by parseability — Content-Type is unreliable).
 *
 * Some servers serve valid RSS/Atom with Content-Type: text/html or other
 * non-standard types. So we ALWAYS attempt to parse with extract() as the
 * ultimate source of truth — if it parses into a valid feed with entries,
 * it IS a feed regardless of what the server claims in Content-Type.
 *
 * This is only called once per discovery request, so the extra parse attempt
 * on non-feed URLs is negligible.
 */
async function checkIfFeed(url) {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'initialized-portfolio-tracker/1.0' },
			redirect: 'follow',
		});
		if (!res.ok) return null;

		// Always try parsing — Content-Type is just a hint, not a guarantee
		const verified = await verifyFeed(url);
		if (verified) {
			return {
				feedUrl: url,
				name: cleanName(verified.title || new URL(url).hostname),
				type: 'rss',
				recentArticles: extractRecentArticles(verified),
			};
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Tries to parse a URL as an RSS/Atom feed. Returns the parsed feed or null.
 */
async function verifyFeed(url) {
	try {
		const feed = await extract(url);
		// A valid feed should have entries
		if (feed && (feed.entries?.length > 0 || feed.title)) {
			return feed;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Extracts the latest 3 articles (title + link) from a parsed feed.
 * Gives the user a quick preview to confirm it's the right feed.
 */
function extractRecentArticles(parsedFeed, count = 3) {
	if (!parsedFeed?.entries?.length) return [];
	return parsedFeed.entries.slice(0, count).map((entry) => ({
		title: entry.title || 'Untitled',
		link: entry.link || '',
	}));
}

/**
 * Cleans up a feed/page title for use as a source name.
 * Strips common suffixes like " - RSS Feed", " | Blog", etc.
 */
function cleanName(raw) {
	return raw
		.replace(/\s*[-–|·]\s*(RSS|Atom|Feed|Blog|News).*$/i, '')
		.replace(/\s*RSS\s*$/i, '')
		.trim()
		|| raw.trim();
}
