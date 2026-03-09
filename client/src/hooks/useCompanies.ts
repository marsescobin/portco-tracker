import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Company } from '@/lib/types'

async function fetchCompanies(): Promise<Company[]> {
  // Run both queries in parallel
  const [companiesRes, digestsRes] = await Promise.all([
    supabase
      .from('init_companies')
      .select('id, name, website, description, logo_url, is_unicorn, twitter_url, newsroom_url, other_links')
      .order('name', { ascending: true }),

    supabase
      .from('init_news_digests')
      .select('company_name, sentiment, sentiment_reason, run_date')
      .order('run_date', { ascending: false }),
  ])

  if (companiesRes.error) throw companiesRes.error
  if (digestsRes.error) throw digestsRes.error

  // Build a map of company_name → most recent digest
  // Since digests are ordered DESC, the first occurrence per company is the latest
  const latestByCompany = new Map<string, {
    sentiment: string | null
    sentiment_reason: string | null
    run_date: string
  }>()

  for (const digest of digestsRes.data ?? []) {
    if (!latestByCompany.has(digest.company_name)) {
      latestByCompany.set(digest.company_name, {
        sentiment: digest.sentiment,
        sentiment_reason: digest.sentiment_reason,
        run_date: digest.run_date,
      })
    }
  }

  // Merge into company objects
  return (companiesRes.data ?? []).map((c) => {
    const latest = latestByCompany.get(c.name)
    return {
      ...c,
      latest_sentiment: (latest?.sentiment ?? null) as Company['latest_sentiment'],
      latest_sentiment_reason: latest?.sentiment_reason ?? null,
      latest_run_date: latest?.run_date ?? null,
    }
  })
}

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
  })
}
