import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ArticleCheck {
  id: string
  run_date: string
  run_at: string
  company: string
  article_url: string | null
  article_title: string | null
  article_source: string | null
  stage: 'keyword_match' | 'llm_filter' | 'signal'
  passed: boolean
  reason: string | null
}

/**
 * Fetches all article checks for a given run date.
 * Returns keyword match, LLM filter, and signal results.
 */
export function useArticleChecks(runDate: string | null) {
  return useQuery({
    queryKey: ['article-checks', runDate],
    queryFn: async (): Promise<ArticleCheck[]> => {
      const { data, error } = await supabase
        .from('init_article_checks')
        .select('*')
        .eq('run_date', runDate!)
        .order('run_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as ArticleCheck[]
    },
    enabled: !!runDate,
  })
}
