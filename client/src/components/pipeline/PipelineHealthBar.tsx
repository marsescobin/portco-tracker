import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { PipelineRun } from '@/hooks/usePipelineRuns'

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-emerald-500',
  partial: 'bg-amber-400',
  failed: 'bg-red-500',
}

function formatTooltip(run: PipelineRun) {
  const d = new Date(run.run_at)
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const status = run.status === 'success' ? 'Healthy' : run.status === 'partial' ? 'Partial' : 'Failed'
  const duration = run.duration_ms != null ? ` · ${(run.duration_ms / 1000).toFixed(0)}s` : ''
  return `${date}, ${time} · ${status} · ${run.result_count} digests${duration}`
}

interface Tooltip {
  text: string
  x: number
  y: number
}

interface PipelineHealthBarProps {
  runs: PipelineRun[]
  selectedRunId: number | null
  onSelectRun: (id: number | null) => void
}

export function PipelineHealthBar({ runs, selectedRunId, onSelectRun }: PipelineHealthBarProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  const successCount = runs.filter((r) => r.status === 'success').length
  const healthPct = runs.length > 0 ? (successCount / runs.length) * 100 : 100

  // Show oldest → newest (left to right), but runs are fetched newest first
  const chronological = [...runs].reverse()

  return (
    <>
      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2.5 py-1.5 text-xs text-white bg-gray-900 rounded-md shadow-lg pointer-events-none -translate-x-1/2 whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}

      <div className="rounded-lg border border-border p-5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Pipeline Health</span>
            <span className={cn(
              'text-sm font-semibold tabular-nums',
              healthPct >= 90 ? 'text-emerald-600' : healthPct >= 70 ? 'text-amber-600' : 'text-red-600'
            )}>
              {healthPct.toFixed(0)}% healthy
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Last {runs.length} runs
          </span>
        </div>

        {/* Bar — one cell per run, oldest on the left */}
        <div className="flex gap-[2px] h-9">
          {chronological.map((run) => {
            const isSelected = run.id === selectedRunId
            const color = STATUS_COLORS[run.status] ?? 'bg-muted'

            return (
              <button
                key={run.id}
                onClick={() => onSelectRun(run.id === selectedRunId ? null : run.id)}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setTooltip({ text: formatTooltip(run), x: rect.left + rect.width / 2, y: rect.top - 36 })
                }}
                onMouseLeave={() => setTooltip(null)}
                className={cn(
                  'flex-1 rounded-sm transition-all cursor-pointer min-w-[4px]',
                  color,
                  isSelected
                    ? 'ring-2 ring-foreground ring-offset-1 ring-offset-background'
                    : 'hover:opacity-75',
                )}
              />
            )
          })}
        </div>

        {/* Footer legend */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Older</span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Healthy
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> Partial
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> Failed
            </span>
          </div>
          <span>Recent</span>
        </div>
      </div>
    </>
  )
}
