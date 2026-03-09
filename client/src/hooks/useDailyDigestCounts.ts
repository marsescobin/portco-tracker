import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useDailyDigestCounts(year: number) {
  return useQuery({
    queryKey: ['daily-digest-counts', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('init_news_digests')
        .select('run_date')
        .gte('run_date', `${year}-01-01`)
        .lte('run_date', `${year}-12-31`)

      if (error) throw error

      // Group by run_date → count of digests (= companies in the news that day)
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        counts[row.run_date] = (counts[row.run_date] || 0) + 1
      }
      return counts
    },
  })
}
