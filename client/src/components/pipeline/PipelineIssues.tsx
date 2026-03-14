import { ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { PipelineRun } from '@/hooks/usePipelineRuns'

interface Issue {
  source: string
  message: string
  url: string | null
  step: string
}

/**
 * Extracts all warn/error events from a run and presents them as a flat list.
 * Covers RSS feed failures, NewsAPI errors, content extraction issues, LLM errors, etc.
 */
function extractIssues(run: PipelineRun): Issue[] {
  const issues: Issue[] = []

  for (const event of run.events ?? []) {
    if (event.level !== 'warn' && event.level !== 'error') continue

    const meta = event.meta as Record<string, unknown> | undefined
    const source = (meta?.source as string)
      ?? (event.step === 'newsapi' || event.message.toLowerCase().includes('newsapi') ? 'NewsAPI' : null)
      ?? (event.step === 'content' ? (meta?.url as string)?.replace(/^https?:\/\//, '').split('/')[0] ?? 'Content Extraction' : null)
      ?? event.step

    issues.push({
      source,
      message: (meta?.error as string) ?? event.message,
      url: (meta?.url as string) ?? null,
      step: event.step,
    })
  }

  return issues
}

interface PipelineIssuesProps {
  run: PipelineRun
}

export function PipelineIssues({ run }: PipelineIssuesProps) {
  const issues = extractIssues(run)

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600 py-2">
        <CheckCircle2 className="h-4 w-4" />
        <span>No issues — all sources healthy</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="bg-muted px-3 py-2 border-b border-border">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          {issues.length} issue{issues.length !== 1 ? 's' : ''} detected
        </span>
      </div>
      <ul className="divide-y divide-border">
        {issues.map((issue, i) => (
          <li key={i} className="px-3 py-2.5 flex items-start gap-2.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{issue.source}</span>
                {issue.url && (
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-0.5"
                  >
                    {issue.url.replace(/^https?:\/\//, '').slice(0, 50)}
                    {issue.url.replace(/^https?:\/\//, '').length > 50 ? '…' : ''}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground break-all">{issue.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
