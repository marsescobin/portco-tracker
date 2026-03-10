import { X } from 'lucide-react'
import { useDailyDigests } from '@/hooks/useDailyDigests'
import { usePipelineRunStats } from '@/hooks/usePipelineRunStats'
import { SentimentTick } from '@/components/SentimentTick'
import { DigestCard } from '@/components/DigestCard'

const SEED_DATE = '2026-03-08'

interface DayPanelProps {
  date: string
  onClose: () => void
}

function formatPanelDate(dateStr: string): string {
  // Use T00:00:00 to avoid UTC offset shifting the date
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function DayPanel({ date, onClose }: DayPanelProps) {
  const { data: digests, isLoading } = useDailyDigests(date)
  const { data: stats } = usePipelineRunStats(date)

  return (
    <div className="w-full max-w-4xl mx-auto rounded-lg border border-border p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">{formatPanelDate(date)}</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : stats ? (
            <p className="text-sm text-muted-foreground">
              Scanned {stats.articlesScanned.toLocaleString()} articles across {stats.sourcesMonitored} sources covering {digests?.length ?? 0} {digests?.length === 1 ? 'company' : 'companies'}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {digests?.length ?? 0} compan{digests?.length === 1 ? 'y' : 'ies'} in the news
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Experimental data banner */}
      {date === SEED_DATE && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <span className="font-semibold"> Articles for March 8, 2026 were collected during a seed run and may include articles published before this date.
          </span>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : digests?.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No digests found for this date.
        </p>
      ) : (
        <div className="space-y-6 divide-y divide-border">
          {digests?.map((digest) => (
            <div key={digest.id} className="pb-5 first:pt-0 space-y-3">
              {/* Company header — name + description grouped tightly */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <SentimentTick sentiment={digest.sentiment} size="sm" showLabel={false} />
                  {digest.company?.website ? (
                    <a
                      href={digest.company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm font-semibold hover:underline"
                    >
                      {digest.company_name}
                    </a>
                  ) : (
                    <span className="text-sm font-semibold">{digest.company_name}</span>
                  )}
                  {digest.company?.is_unicorn && <span title="Unicorn">🦄</span>}
                </div>
                {digest.company?.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{digest.company.description}</p>
                )}
              </div>
              {/* Digest content */}
              <DigestCard digest={digest} showDate={false} showDivider={false} showSentiment={false} showSentimentReason={false} showSeedBanner={false} />
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
