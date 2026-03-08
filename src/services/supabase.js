export function supabaseHeaders(env) {
	return {
		'apikey': env.SUPABASE_ANON_KEY,
		'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
		'Content-Type': 'application/json',
		'Prefer': 'return=representation',
	};
}
