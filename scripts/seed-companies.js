import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from .dev.vars
const devVars = readFileSync(join(__dirname, '../.dev.vars'), 'utf-8');
const env = Object.fromEntries(
	devVars.split('\n')
		.filter(line => line.includes('='))
		.map(line => line.split('=').map(s => s.trim()))
		.map(([key, ...rest]) => [key, rest.join('=')])
);

const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .dev.vars');
	process.exit(1);
}

const { initialized_capital_companies: companies } = JSON.parse(
	readFileSync(join(__dirname, '../companies.json'), 'utf-8')
);

const rows = companies.map((c) => ({
	name: c.name,
	website: c.website_url,
	description: c.description,
	logo_url: c.logo_url,
	is_unicorn: c.is_unicorn,
}));

console.log(`Seeding ${rows.length} companies...`);

const response = await fetch(`${SUPABASE_URL}/rest/v1/init_companies`, {
	method: 'POST',
	headers: {
		'apikey': SUPABASE_ANON_KEY,
		'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
		'Content-Type': 'application/json',
		'Prefer': 'resolution=merge-duplicates,return=representation',
	},
	body: JSON.stringify(rows),
});

if (!response.ok) {
	const error = await response.text();
	console.error('Seed failed:', error);
	process.exit(1);
}

const saved = await response.json();
console.log(`✅ Done! Seeded ${saved.length} companies.`);
