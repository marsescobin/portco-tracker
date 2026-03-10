import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface PipelineRunStats {
  articlesScanned: number
  sourcesMonitored: number
}

export function usePipelineRunStats(date: string | null) {
  return useQuery({
    queryKey: ['pipeline-run-stats', date],
    queryFn: async (): Promise<PipelineRunStats> => {
      const { data, error } = await supabase
        .from('init_pipeline_runs')
        .select('funnel, by_source')
        .eq('run_date', date!)
        .order('run_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error

      return {
        articlesScanned: data.funnel?.extracted ?? 0,
        sourcesMonitored: Object.keys(data.by_source ?? {}).length,
      }
    },
    enabled: !!date,
  })
}
