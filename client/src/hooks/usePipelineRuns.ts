import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface PipelineEvent {
  step: string
  level: 'info' | 'warn' | 'error'
  message: string
  meta?: Record<string, unknown>
  at: string
}

export interface PipelineRun {
  id: number
  run_at: string
  run_date: string
  result_count: number
  status: 'success' | 'partial' | 'failed'
  events: PipelineEvent[]
  duration_ms: number | null
  funnel: Record<string, unknown> | null
  by_source: Record<string, unknown> | null
}

export function usePipelineRuns(limit = 20) {
  return useQuery({
    queryKey: ['pipeline-runs', limit],
    queryFn: async (): Promise<PipelineRun[]> => {
      const { data, error } = await supabase
        .from('init_pipeline_runs')
        .select('id, run_at, run_date, result_count, status, events, duration_ms, funnel, by_source')
        .order('run_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return (data ?? []) as PipelineRun[]
    },
  })
}
