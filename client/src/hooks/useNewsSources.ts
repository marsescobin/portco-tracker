import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface NewsSource {
  id: string
  name: string
  url: string
  type: string        // 'rss', 'newsapi_domain', or any future type
  category: string | null
}

export function useNewsSources() {
  return useQuery({
    queryKey: ['news-sources'],
    queryFn: async (): Promise<NewsSource[]> => {
      const { data, error } = await supabase
        .from('init_news_sources')
        .select('id, name, url, type, category')
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as NewsSource[]
    },
  })
}
