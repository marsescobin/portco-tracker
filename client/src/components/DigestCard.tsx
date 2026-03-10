import { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { SentimentTick } from '@/components/SentimentTick'
import type { Digest } from '@/lib/types'

interface DigestCardProps {
  digest: Digest
  showDate?: boolean
  showDivider?: boolean
  showSentiment?: boolean
  showSentimentLabel?: boolean
  showSentimentReason?: boolean
}

function normalizeSummary(raw: string | string[] | null): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  // Legacy: stored as JSON string
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch { /* not JSON */ }
  return [raw]
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function DigestCard({ digest, showDate = true, showDivider = true, showSentiment = true, showSentimentLabel = true, showSentimentReason = true }: DigestCardProps) {
  const [showSources, setShowSources] = useState(false)
  const hasArticles = digest.articles && digest.articles.length > 0

  return (
    <div className="space-y-2">
      {/* Header: date, then sentiment + reason below */}
      <div className="space-y-1">
        {showDate && (
          <span className="text-sm font-medium text-foreground">
            {formatDate(digest.run_date)}
          </span>
        )}
        {(showSentiment || showSentimentReason) && (
          <div className="flex items-center gap-2">
            {showSentiment && <SentimentTick sentiment={digest.sentiment} size="sm" showLabel={showSentimentLabel} />}
            {showSentimentReason && digest.sentiment_reason && (
              <span className="text-xs text-muted-foreground">
                {digest.sentiment_reason}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      {digest.summary && (
        <ul className="space-y-1 py-2">
          {normalizeSummary(digest.summary).map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
              {bullet}
            </li>
          ))}
        </ul>
      )}

      {/* Articles */}
      {hasArticles && (
        <div className={`${showDivider ? 'border-t border-border' : ''} pt-2 space-y-2`}>
          <button
            onClick={() => setShowSources((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showSources ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showSources ? 'Hide sources' : `Show sources (${digest.articles!.length})`}
          </button>

          {showSources && (
            <ul className="space-y-1">
              {digest.articles!.map((article, i) => (
                <li key={i}>
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-start gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-60 group-hover:opacity-100" />
                    {article.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
