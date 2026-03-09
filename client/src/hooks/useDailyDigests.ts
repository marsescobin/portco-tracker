import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Digest } from '@/lib/types'

export function useDailyDigests(date: string | null) {
  return useQuery({
    queryKey: ['daily-digests', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('init_news_digests')
        .select('id, company_name, summary, sentiment, sentiment_reason, articles, run_date, run_at, funnel')
        .eq('run_date', date!)
        .order('company_name', { ascending: true })

      if (error) throw error
      return (data ?? []) as Digest[]
    },
    enabled: !!date,
  })
}
