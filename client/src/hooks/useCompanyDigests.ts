import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Digest } from '@/lib/types'

const PAGE_SIZE = 10

async function fetchDigests({
  companyName,
  pageParam,
}: {
  companyName: string
  pageParam: number
}): Promise<Digest[]> {
  const from = pageParam * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error } = await supabase
    .from('init_news_digests')
    .select('id, company_name, summary, sentiment, sentiment_reason, articles, run_date, run_at, funnel')
    .eq('company_name', companyName)
    .order('run_date', { ascending: false })
    .range(from, to)

  if (error) throw error
  return (data ?? []) as Digest[]
}

export function useCompanyDigests(companyName: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['digests', companyName],
    queryFn: ({ pageParam }) => fetchDigests({ companyName, pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // If the last page returned a full page, there may be more
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined
    },
    enabled: enabled && !!companyName,
  })
}
