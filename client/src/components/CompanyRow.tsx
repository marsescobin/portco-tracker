import { useState } from 'react'
import { ChevronDown, ChevronUp, Globe, Newspaper, ExternalLink } from 'lucide-react'
import { SentimentTick } from '@/components/SentimentTick'
import { DigestCard } from '@/components/DigestCard'
import { useCompanyDigests } from '@/hooks/useCompanyDigests'
import type { Company, Sentiment } from '@/lib/types'

function sentimentDotClass(sentiment: Sentiment | null): string {
  if (sentiment === '+') return 'border-emerald-400 bg-emerald-100'
  if (sentiment === '-') return 'border-red-400 bg-red-100'
  if (sentiment === 'mixed') return 'border-amber-400 bg-amber-100'
  return 'border-border bg-background'
}

function formatRelativeDate(dateStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

function formatAbsoluteDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

interface CompanyRowProps {
  company: Company
}

export function CompanyRow({ company }: CompanyRowProps) {
  const [isOpen, setIsOpen] = useState(false)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCompanyDigests(company.name, isOpen)

  const digests = data?.pages.flat() ?? []

  return (
    <>
      {/* Main row */}
      <tr
        onClick={() => setIsOpen((v) => !v)}
        className="cursor-pointer border-b border-border hover:bg-muted/40 transition-colors"
      >
        <td className="py-2 px-2 sm:py-3 sm:px-4 text-sm font-medium">
          <div className="flex items-center gap-2">
            {company.name}
            {company.is_unicorn && <span title="Unicorn">🦄</span>}
          </div>
        </td>
        <td className="py-2 px-2 sm:py-3 sm:px-4">
          <SentimentTick sentiment={company.latest_sentiment} size="sm" />
        </td>
        <td className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-muted-foreground">
          {company.latest_sentiment_reason ?? '—'}
        </td>
        <td className="py-2 px-2 sm:py-3 sm:px-4 text-xs text-muted-foreground">
          {company.latest_run_date ? (
            <span title={formatAbsoluteDate(company.latest_run_date)}>
              {formatRelativeDate(company.latest_run_date)}
            </span>
          ) : '—'}
        </td>
        <td className="py-2 px-2 sm:py-3 sm:px-4">
          {isOpen
            ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
          }
        </td>
      </tr>

      {/* Expanded row */}
      {isOpen && (
        <tr>
          <td colSpan={5} className="bg-muted/20 px-6 py-5 border-b border-border">

            {/* Company profile */}
            <div className="mb-5 space-y-2">
              {company.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {company.description}
                </p>
              )}
              <div className="flex flex-wrap gap-4 ">
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Website
                  </a>
                )}
                {company.twitter_url && (
                  <a
                    href={company.twitter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Twitter / X
                  </a>
                )}
                {company.newsroom_url && (
                  <a
                    href={company.newsroom_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Newspaper className="h-3.5 w-3.5" />
                    Newsroom
                  </a>
                )}
                {(company.other_links ?? []).map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {link.label}
                  </a>
                ))}
              </div>
            </div>


            {/* Digests */}
            {isLoading ? (
              <div className="space-y-6 pl-8">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : digests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No news digests yet.</p>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

                <div className="space-y-8">
                  {digests.map((digest) => (
                    <div key={digest.id} className="relative flex gap-5">
                      {/* Sentiment dot */}
                      <div
                        className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 z-10 ${sentimentDotClass(digest.sentiment)}`}
                      />
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <DigestCard digest={digest} />
                      </div>
                    </div>
                  ))}
                </div>

                {hasNextPage && (
                  <button
                    onClick={(e) => { e.stopPropagation(); fetchNextPage() }}
                    disabled={isFetchingNextPage}
                    className="mt-6 pl-8 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {isFetchingNextPage ? 'Loading…' : 'Load more'}
                  </button>
                )}
              </div>
            )}

          </td>
        </tr>
      )}
    </>
  )
}
