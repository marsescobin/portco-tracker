import { useState } from 'react'
import { Activity, Rss, SlidersHorizontal, Search, Bell, Filter, Mail, Loader2, Clock, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePipelineRuns } from '@/hooks/usePipelineRuns'
import type { PipelineRun } from '@/hooks/usePipelineRuns'
import { PipelineHealthBar } from '@/components/pipeline/PipelineHealthBar'
import { PipelineIssues } from '@/components/pipeline/PipelineIssues'
import { ArticleChecksPanel } from '@/components/pipeline/ArticleChecksPanel'
import { SourcesTab } from '@/components/pipeline/SourcesTab'
import { useNewsSources } from '@/hooks/useNewsSources'
import { useArticleChecks } from '@/hooks/useArticleChecks'

type Tab = 'health' | 'sources'

const COMING_SOON = [
 
  {
    icon: SlidersHorizontal,
    title: 'Monitor company newsrooms',
    description: 'Monitor company newsrooms to get the latest releases and announcements.',
  },
   {
    icon: SlidersHorizontal,
    title: 'Monitor company Twitter/X accounts',
    description: 'Monitor company Twitter/X accounts to get the latest announcements.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Edit the summarizer prompt',
    description: 'Easily edit instructions for the summarizer.',
  },
]

const ROADMAP = [
  {
    icon: Search,
    title: 'Smart Search',
    description: 'Search across all past digests using natural language. Ask things like "which companies raised money this quarter" and get real answers.',
  },
  {
    icon: Bell,
    title: 'Digest Delivery',
    description: 'Get the digest sent to your inbox or Slack on your own schedule. Set your areas of interest, preferred tone, and how often you want it delivered.',
  },
  {
    icon: Filter,
    title: 'Sector Filtering',
    description: 'Filter portfolio companies by sector to focus on what matters most to you.',
  },
]

function formatDuration(ms: number | null) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(0)}s`
}

function formatRunTime(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}`
}

function statusLabel(status: string) {
  if (status === 'success') return 'Healthy'
  if (status === 'partial') return 'Partial'
  return 'Failed'
}

type FunnelStage = 'keyword_match' | 'llm_filter' | 'signal' | null

export default function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>('health')
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [activeStage, setActiveStage] = useState<FunnelStage>(null)
  const { data: runs, isLoading, error } = usePipelineRuns(100)
  const { data: sources } = useNewsSources()

  const selectedRun = runs?.find((r) => r.id === selectedRunId) ?? runs?.[0] ?? null
  const { data: articleChecks, isLoading: checksLoading } = useArticleChecks(selectedRun?.run_date ?? null)
  const latestRun = runs?.[0] ?? null

  const successCount = runs?.filter((r) => r.status === 'success').length ?? 0
  const totalRuns = runs?.length ?? 0
  const healthPct = totalRuns > 0 ? (successCount / totalRuns) * 100 : 100
  const sourcesMonitored = sources?.length ?? 0
  const totalDigests = runs?.reduce((sum, r) => sum + r.result_count, 0) ?? 0
  const durations = runs?.filter((r) => r.duration_ms != null).map((r) => r.duration_ms!) ?? []
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Monitor pipeline health and manage news sources.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <TabButton active={activeTab === 'health'} onClick={() => setActiveTab('health')}>
          Pipeline Health
        </TabButton>
        <TabButton active={activeTab === 'sources'} onClick={() => setActiveTab('sources')}>
          <Rss className="h-3.5 w-3.5" />
          News Sources
        </TabButton>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading pipeline data…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-4 text-sm text-red-700 dark:text-red-400">
          Failed to load pipeline data: {String(error)}
        </div>
      )}

      {/* ─── Pipeline Health Tab ─── */}
      {activeTab === 'health' && runs && runs.length > 0 && (
        <>
          {/* Hero stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Clean runs" value={`${healthPct.toFixed(0)}%`} sub={`last ${totalRuns} runs`} />
            <StatCard label="Sources" value={String(sourcesMonitored)} sub="RSS feeds & NewsAPI" />
            <StatCard label="Digests Created" value={String(totalDigests)} sub={`last ${totalRuns} runs`} />
            <StatCard label="Avg Duration" value={formatDuration(avgDuration)} sub="per run" />
          </div>

          {/* Health bar */}
          <PipelineHealthBar
            runs={runs}
            selectedRunId={selectedRun?.id ?? null}
            onSelectRun={setSelectedRunId}
          />

          {/* Selected run detail */}
          {selectedRun && (
            <div className="space-y-4">
              <RunHeader run={selectedRun} />
              <FunnelSummary run={selectedRun} activeStage={activeStage} onStageClick={setActiveStage} />
              {activeStage && (
                <ArticleChecksPanel
                  stage={activeStage}
                  checks={articleChecks ?? []}
                  isLoading={checksLoading}
                  onClose={() => setActiveStage(null)}
                />
              )}
              <PipelineIssues run={selectedRun} />
            </div>
          )}
        </>
      )}

      {activeTab === 'health' && runs && runs.length === 0 && (
        <div className="text-center py-16 text-sm text-muted-foreground">
          No pipeline runs recorded yet. The pipeline runs every hour via cron.
        </div>
      )}

      {/* ─── News Sources Tab ─── */}
      {activeTab === 'sources' && !isLoading && !error && (
        <SourcesTab latestRun={latestRun} />
      )}

      {/* Coming Soon */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Coming soon</h2>
          <p className="text-sm text-muted-foreground">More admin tools on the way.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COMING_SOON.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-lg border border-border bg-muted/30 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-1.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium">{title}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Also on the roadmap</h2>
          <p className="text-sm text-muted-foreground">Features for the whole team, not just admins.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ROADMAP.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-lg border border-border bg-muted/30 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-1.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium">{title}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-lg border border-border bg-background px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Want to push something up the list?</p>
          <p className="text-sm text-muted-foreground">
            Reach out and let me know what would be most useful to you and the team.
          </p>
        </div>
        <a
          href="mailto:marsescobin@gmail.com"
          className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          <Mail className="h-4 w-4" />
          Get in touch
        </a>
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
        active
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
      )}
    >
      {children}
    </button>
  )
}

/** One-line run header above the issues list */
function RunHeader({ run }: { run: PipelineRun }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-sm font-medium">{formatRunTime(run.run_at)}</span>
      <span className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        run.status === 'success' ? 'text-emerald-600' :
        run.status === 'partial' ? 'text-amber-600' : 'text-red-600',
      )}>
        <span className={cn(
          'inline-block h-2 w-2 rounded-full',
          run.status === 'success' ? 'bg-emerald-500' :
          run.status === 'partial' ? 'bg-amber-400' : 'bg-red-500',
        )} />
        {statusLabel(run.status)}
      </span>
      <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" />
        {formatDuration(run.duration_ms)}
      </span>
      <span className="text-sm text-muted-foreground">
        {run.result_count} digest{run.result_count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

const CONTENT_METHOD_LABELS: Record<string, string> = {
  rssContent: 'Article body',
  readability: 'Readability',
  firecrawl: 'Firecrawl',
  rssDescription: 'Description only',
}

/** Compact funnel summary — one row of numbers with arrows. Matched / Confirmed are clickable. */
function FunnelSummary({ run, activeStage, onStageClick }: {
  run: PipelineRun
  activeStage: FunnelStage
  onStageClick: (stage: FunnelStage) => void
}) {
  const f = run.funnel as Record<string, unknown> | null
  if (!f) return null

  const steps: { label: string; value: number; stage?: 'keyword_match' | 'llm_filter' | 'signal' }[] = [
    { label: 'Extracted', value: (f.extracted as number) ?? 0 },
    { label: 'Today', value: (f.dateFiltered as number) ?? 0 },
    { label: 'Deduped', value: (f.deduped as number) ?? 0 },
    { label: 'Matched', value: (f.matched as number) ?? 0, stage: 'keyword_match' },
    { label: 'Confirmed', value: (f.confirmed as number) ?? 0, stage: 'llm_filter' },
  ]

  const content = f.content as Record<string, number> | undefined
  const contentEntries = content
    ? Object.entries(content).filter(([, v]) => v > 0)
    : []

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {steps.map((step, i) => {
          const isClickable = !!step.stage
          const isActive = step.stage === activeStage

          const inner = (
            <>
              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/50" />}
              <span className="tabular-nums font-medium">{step.value}</span>
              <span className="text-muted-foreground text-xs">{step.label}</span>
            </>
          )

          if (isClickable) {
            return (
              <button
                key={step.label}
                onClick={() => onStageClick(isActive ? null : step.stage!)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-1.5 py-0.5 -mx-1.5 rounded transition-colors',
                  isActive
                    ? 'bg-foreground/10 ring-1 ring-foreground/20'
                    : 'hover:bg-muted cursor-pointer',
                )}
              >
                {inner}
              </button>
            )
          }

          return (
            <span key={step.label} className="inline-flex items-center gap-1.5">
              {inner}
            </span>
          )
        })}
      </div>

      {/* Content method breakdown */}
      {contentEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/60">Content:</span>
          {contentEntries.map(([method, count], i) => (
            <span key={method}>
              {i > 0 && <span className="mx-0.5">·</span>}
              {count} {CONTENT_METHOD_LABELS[method] ?? method}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  )
}
