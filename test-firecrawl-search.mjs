import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const devVars = readFileSync(join(__dirname, '.dev.vars'), 'utf-8');
const env = Object.fromEntries(
	devVars.split('\n')
		.filter(line => line.includes('='))
		.map(line => line.split('=').map(s => s.trim()))
		.map(([key, ...rest]) => [key, rest.join('=')])
);
const { FIRECRAWL_API_KEY } = env;

const COMPANIES = [
  { name: 'Algolia',   query: '"Algolia" news' },
  { name: 'Ro Health', query: '"Ro Health" OR "ro.co" telehealth news' },
  { name: 'Benchling', query: '"Benchling" news' },
];

for (const { name, query } of COMPANIES) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Company: ${name}`);
  console.log(`Query:   ${query}`);
  console.log('='.repeat(60));

  const res = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({ query, limit: 10 }),
  });

  const data = await res.json();
  const results = data.data ?? [];

  console.log(`Results returned: ${results.length}`);

  for (const [i, r] of results.entries()) {
    console.log(`\n  [${i + 1}] ${r.title ?? '(no title)'}`);
    console.log(`       URL:           ${r.url}`);
    console.log(`       publishedTime: ${r.metadata?.publishedTime ?? '— not available'}`);
    console.log(`       ogDate:        ${r.metadata?.['og:article:published_time'] ?? '— not available'}`);
    console.log(`       description:   ${(r.description ?? '').slice(0, 120)}`);
  }
}
