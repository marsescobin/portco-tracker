import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface NewsSource {
  id: string
  name: string
  url: string
  type: string        // 'rss', 'newsapi_domain', or any future type
  category: string | null
}

export interface FeedArticle {
  title: string
  link: string
}

export interface DiscoveredFeed {
  feedUrl: string
  name: string
  type: string
  recentArticles?: FeedArticle[]
}

export interface DiscoveryResult {
  found: boolean
  feedUrl?: string
  name?: string
  type?: string
  message?: string
  inputUrl?: string
  /** All discovered feeds — may contain multiple for sites with per-category feeds */
  feeds?: DiscoveredFeed[]
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

/** Calls the Worker's POST /api/sources/discover endpoint */
export function useDiscoverSource() {
  return useMutation({
    mutationFn: async (url: string): Promise<DiscoveryResult> => {
      const res = await fetch('/api/sources/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || 'Discovery failed')
      }
      return res.json()
    },
  })
}

/** Creates a new source via the Worker API */
export function useCreateSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (source: { name: string; url: string; type: string; category?: string }) => {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || 'Failed to create source')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-sources'] })
    },
  })
}

/** Updates a source via the Worker API */
export function useUpdateSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; url?: string; type?: string; category?: string }) => {
      const res = await fetch(`/api/sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || 'Failed to update source')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-sources'] })
    },
  })
}

/** Deletes a source via the Worker API */
export function useDeleteSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sources/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || 'Failed to delete source')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-sources'] })
    },
  })
}
