import { ExternalLink, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNewsSources } from '@/hooks/useNewsSources'
import type { NewsSource } from '@/hooks/useNewsSources'
import type { PipelineRun } from '@/hooks/usePipelineRuns'

const TYPE_COLORS: Record<string, string> = {
  rss: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  newsapi_domain: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
}

/** Ensure the URL is clickable (add protocol if missing for bare domains) */
function toHref(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  return `https://${url}`
}

interface SourceRow {
  name: string
  type: string
  url: string          // raw URL from init_news_sources
  href: string         // clickable version (protocol added if needed)
  extracted: number
  matched: number
  confirmed: number
}

function buildSourceRows(
  sources: NewsSource[],
  latestRun: PipelineRun | null,
): SourceRow[] {
  const bySource = (latestRun?.by_source ?? {}) as Record<string, Record<string, unknown>>

  return sources.map((src) => {
    const stats = bySource[src.name]
    return {
      name: src.name,
      type: src.type,
      url: src.url,
      href: toHref(src.url),
      extracted: (stats?.extracted as number) ?? 0,
      matched: (stats?.matched as number) ?? 0,
      confirmed: (stats?.confirmed as number) ?? 0,
    }
  }).sort((a, b) => b.extracted - a.extracted)
}

interface SourcesTabProps {
  latestRun: PipelineRun | null
}

export function SourcesTab({ latestRun }: SourcesTabProps) {
  const { data: sources, isLoading } = useNewsSources()
  const rows = buildSourceRows(sources ?? [], latestRun)

  const typeCounts = (sources ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1
    return acc
  }, {})
  const typeBreakdown = Object.entries(typeCounts)
    .map(([t, n]) => `${n} ${t}`)
    .join(', ')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">News Sources</h2>
          <p className="text-sm text-muted-foreground">
            {rows.length} sources configured{typeBreakdown ? ` (${typeBreakdown})` : ''} · stats from last run
          </p>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium opacity-50 cursor-not-allowed"
          title="Coming soon"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Source
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Loading sources…</div>
      ) : rows.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border">
                <th className="py-2 px-3 font-medium">Source</th>
                <th className="py-2 px-3 font-medium">Type</th>
                <th className="py-2 px-3 font-medium text-right">Extracted</th>
                <th className="py-2 px-3 font-medium text-right">Matched</th>
                <th className="py-2 px-3 font-medium text-right">Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3 text-sm">
                    <div>
                      <span className="font-medium">{row.name}</span>
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-muted-foreground hover:underline truncate max-w-xs inline-flex items-center gap-0.5"
                      >
                        {row.url}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                      TYPE_COLORS[row.type] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
                    )}>
                      {row.type}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-sm text-right tabular-nums">{row.extracted}</td>
                  <td className={cn('py-2 px-3 text-sm text-right tabular-nums', row.matched > 0 ? 'font-medium' : 'text-muted-foreground')}>
                    {row.matched}
                  </td>
                  <td className={cn('py-2 px-3 text-sm text-right tabular-nums', row.confirmed > 0 ? 'font-medium text-emerald-600' : 'text-muted-foreground')}>
                    {row.confirmed}
                  </td>
                </tr>
              ))}

              {/* Totals */}
              <tr className="bg-muted/50 border-t border-border font-medium text-sm">
                <td className="py-2 px-3">{rows.length} sources</td>
                <td className="py-2 px-3" />
                <td className="py-2 px-3 text-right tabular-nums">
                  {rows.reduce((s, e) => s + e.extracted, 0)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {rows.reduce((s, e) => s + e.matched, 0)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-emerald-600">
                  {rows.reduce((s, e) => s + e.confirmed, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No sources configured yet.
        </div>
      )}
    </div>
  )
}
