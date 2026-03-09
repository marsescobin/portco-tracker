import { X } from 'lucide-react'
import { useDailyDigests } from '@/hooks/useDailyDigests'
import { SentimentTick } from '@/components/SentimentTick'
import { DigestCard } from '@/components/DigestCard'

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

  return (
    <div className="w-fit mx-auto rounded-lg border border-border p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">{formatPanelDate(date)}</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : `${digests?.length ?? 0} compan${digests?.length === 1 ? 'y' : 'ies'} in the news`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

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
            <div key={digest.id} className="pt-5 first:pt-0 space-y-3">
              {/* Company name + sentiment */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{digest.company_name}</span>
                <SentimentTick sentiment={digest.sentiment} size="sm" />
              </div>
              {/* Digest content */}
              <DigestCard digest={digest} />
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
