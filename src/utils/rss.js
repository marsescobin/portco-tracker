import { extract } from '@extractus/feed-extractor';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

export async function testFeed(rssUrl) {
	const data = await extract(rssUrl);
	console.log(`Found ${data.entries?.length || 0} articles in RSS feed`);
	data.entries?.slice(0, 10).forEach((article, index) => {
		console.log(`${index + 1}. ${article.title}`);
		console.log(`   Description: ${article.description}`);
		console.log(`   URL: ${article.link}`);
		console.log(`   Published: ${article.published}`);
		console.log('---');
	});
	return data;
}

export async function passToReadability(articleUrl) {
	try {
		const response = await fetch(articleUrl);
		const html = await response.text();
		const { document } = parseHTML(html);
		const reader = new Readability(document);
		const article = reader.parse();
		return article;
	} catch (error) {
		console.log('❌ Mozilla Readability error:', error.message);
		return null;
	}
}
