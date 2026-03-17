import { useState } from 'react'
import { ExternalLink, CheckCircle2, XCircle, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ArticleCheck } from '@/hooks/useArticleChecks'

type FilterMode = 'all' | 'passed' | 'rejected'

const STAGE_LABELS: Record<string, string> = {
  keyword_match: 'Keyword Match',
  llm_filter: 'LLM Confirmation',
  signal: 'Signal Check',
}

interface ArticleChecksPanelProps {
  /** Which stage to display */
  stage: 'keyword_match' | 'llm_filter' | 'signal'
  /** All checks for this run date — will be filtered to the selected stage */
  checks: ArticleCheck[]
  isLoading: boolean
  onClose: () => void
}

export function ArticleChecksPanel({ stage, checks, isLoading, onClose }: ArticleChecksPanelProps) {
  const [filter, setFilter] = useState<FilterMode>('all')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const stageChecks = checks.filter((c) => c.stage === stage)
  const filtered =
    filter === 'all' ? stageChecks :
    filter === 'passed' ? stageChecks.filter((c) => c.passed) :
    stageChecks.filter((c) => !c.passed)

  const passedCount = stageChecks.filter((c) => c.passed).length
  const rejectedCount = stageChecks.length - passedCount

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading article checks…
      </div>
    )
  }

  if (stageChecks.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{STAGE_LABELS[stage] ?? stage}</span>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Close
          </button>
        </div>
        <p className="text-sm text-muted-foreground">No article checks recorded for this stage yet. Run the pipeline to start capturing data.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{STAGE_LABELS[stage] ?? stage}</span>
          <span className="text-xs text-muted-foreground">
            {passedCount} passed · {rejectedCount} rejected
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter toggles */}
          <div className="flex gap-0.5 rounded-md border border-border bg-background p-0.5">
            {(['all', 'passed', 'rejected'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors capitalize',
                  filter === mode
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2">
            Close
          </button>
        </div>
      </div>

      {/* Article list */}
      <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
        {filtered.map((check, i) => {
          const isExpanded = expandedIdx === i

          return (
            <li key={check.id} className="px-4 py-3">
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full flex items-start gap-2.5 text-left"
              >
                {/* Pass/fail icon */}
                {check.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  {/* Title + company */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {check.article_title ?? '(no title)'}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {check.company}
                    </span>
                  </div>

                  {/* Source tag */}
                  {check.article_source && (
                    <span className="text-[11px] text-muted-foreground">
                      via {check.article_source}
                    </span>
                  )}
                </div>

                <ChevronDown className={cn(
                  'h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 transition-transform',
                  isExpanded && 'rotate-180',
                )} />
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="mt-2 ml-6.5 space-y-1.5 pl-[26px]">
                  {check.reason && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground/70">Reason:</span> {check.reason}
                    </p>
                  )}
                  {check.article_url && (
                    <a
                      href={check.article_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
                    >
                      {check.article_url.replace(/^https?:\/\//, '').slice(0, 70)}
                      {check.article_url.replace(/^https?:\/\//, '').length > 70 ? '…' : ''}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* Footer count */}
      {filtered.length > 0 && (
        <div className="bg-muted/30 px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
          Showing {filtered.length} of {stageChecks.length} articles
        </div>
      )}
    </div>
  )
}
