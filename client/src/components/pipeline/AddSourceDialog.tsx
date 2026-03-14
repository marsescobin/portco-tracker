import { useState } from 'react'
import { X, Search, Loader2, CheckCircle2, AlertCircle, Rss, Plus, ExternalLink, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDiscoverSource, useCreateSource, useNewsSources } from '@/hooks/useNewsSources'
import type { DiscoveryResult, DiscoveredFeed } from '@/hooks/useNewsSources'

interface AddSourceDialogProps {
  open: boolean
  onClose: () => void
}

type Step = 'input' | 'discovering' | 'result'

export function AddSourceDialog({ open, onClose }: AddSourceDialogProps) {
  const [url, setUrl] = useState('')
  const [step, setStep] = useState<Step>('input')
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null)
  const [selectedFeed, setSelectedFeed] = useState<DiscoveredFeed | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: existingSources } = useNewsSources()
  const discover = useDiscoverSource()
  const create = useCreateSource()

  const feeds = discovery?.feeds ?? []
  const hasMultipleFeeds = feeds.length > 1

  function reset() {
    setUrl('')
    setStep('input')
    setDiscovery(null)
    setSelectedFeed(null)
    setEditName('')
    setEditCategory('')
    setError(null)
    discover.reset()
    create.reset()
  }

  function handleClose() {
    reset()
    onClose()
  }

  /** Check if a feed URL already exists in the sources list */
  function isDuplicateUrl(feedUrl: string): boolean {
    return (existingSources ?? []).some((s) => s.url === feedUrl)
  }

  /** Check if a name already exists (case-insensitive) */
  function isDuplicateName(name: string): boolean {
    const lower = name.trim().toLowerCase()
    return (existingSources ?? []).some((s) => s.name.toLowerCase() === lower)
  }

  function selectFeed(feed: DiscoveredFeed) {
    setSelectedFeed(feed)
    setEditName(feed.name)
    setError(null)

    if (isDuplicateUrl(feed.feedUrl)) {
      setError('This feed URL is already in your sources.')
    }
  }

  async function handleDiscover() {
    if (!url.trim()) return
    setError(null)
    setStep('discovering')

    try {
      const result = await discover.mutateAsync(url.trim())
      setDiscovery(result)

      const resultFeeds = result.feeds ?? []

      if (result.found && resultFeeds.length > 0) {
        // Auto-select the first feed (user can change if multiple)
        selectFeed(resultFeeds[0])
      }

      setStep('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed')
      setStep('input')
    }
  }

  async function handleSave() {
    if (!selectedFeed) return

    const trimmedName = editName.trim() || selectedFeed.name || 'Unnamed Source'

    // Client-side duplicate checks before hitting the API
    if (isDuplicateUrl(selectedFeed.feedUrl)) {
      setError('This feed URL is already in your sources.')
      return
    }
    if (isDuplicateName(trimmedName)) {
      setError(`A source named "${trimmedName}" already exists (case-insensitive).`)
      return
    }

    try {
      await create.mutateAsync({
        name: trimmedName,
        url: selectedFeed.feedUrl,
        type: selectedFeed.type || 'rss',
        category: editCategory.trim() || undefined,
      })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save source')
    }
  }

  // Is the "Add Source" button disabled?
  const urlAlreadyExists = selectedFeed ? isDuplicateUrl(selectedFeed.feedUrl) : false

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Add News Source</h3>
          </div>
          <button onClick={handleClose} className="rounded-md p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* URL input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Website or feed URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && step === 'input' && handleDiscover()}
                placeholder="e.g. techcrunch.com or https://example.com/feed"
                disabled={step === 'discovering'}
                className={cn(
                  'flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30',
                  'disabled:opacity-50',
                )}
              />
              <button
                onClick={handleDiscover}
                disabled={!url.trim() || step === 'discovering'}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'bg-foreground text-background hover:opacity-90',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {step === 'discovering' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                {step === 'discovering' ? 'Checking…' : 'Discover'}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Paste any URL — we'll try to detect RSS and Atom feeds.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Discovery result */}
          {step === 'result' && discovery && (
            <>
              {discovery.found && selectedFeed ? (
                <div className="space-y-4">
                  {/* Success banner */}
                  <div className={cn(
                    'flex items-start gap-2 rounded-lg border p-3',
                    urlAlreadyExists
                      ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900'
                      : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900',
                  )}>
                    {urlAlreadyExists ? (
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    )}
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className={cn(
                        'text-sm font-medium',
                        urlAlreadyExists
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400',
                      )}>
                        {urlAlreadyExists
                          ? 'Feed already exists'
                          : hasMultipleFeeds
                            ? `${feeds.length} feeds detected`
                            : 'Feed detected'}
                      </p>
                      <p className={cn(
                        'text-xs break-all',
                        urlAlreadyExists
                          ? 'text-amber-600 dark:text-amber-500'
                          : 'text-emerald-600 dark:text-emerald-500',
                      )}>
                        {selectedFeed.feedUrl}
                      </p>
                    </div>
                  </div>

                  {/* Multi-feed selector — only shown when >1 feed discovered */}
                  {hasMultipleFeeds && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Choose a feed ({feeds.length} available)
                      </label>
                      <div className="space-y-1 max-h-36 overflow-y-auto rounded-lg border border-border p-1">
                        {feeds.map((feed, i) => {
                          const isSelected = selectedFeed.feedUrl === feed.feedUrl
                          const isDup = isDuplicateUrl(feed.feedUrl)
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => selectFeed(feed)}
                              className={cn(
                                'w-full text-left rounded-md px-2.5 py-2 text-sm transition-colors',
                                isSelected
                                  ? 'bg-foreground/5 ring-1 ring-foreground/20'
                                  : 'hover:bg-muted',
                                isDup && 'opacity-60',
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium truncate">{feed.name}</span>
                                {isDup && (
                                  <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                    Already added
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {feed.feedUrl}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Only show edit fields if not a duplicate */}
                  {!urlAlreadyExists && (
                    <>
                      {/* Editable name */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Source name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                        />
                      </div>

                      {/* Notes (optional) */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Notes <span className="text-muted-foreground/50">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          placeholder="e.g. tech, finance, paywalled, company-specific"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
                        />
                      </div>

                      {/* Type badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Detected type:</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          <Rss className="h-3 w-3" />
                          {selectedFeed.type}
                        </span>
                      </div>

                      {/* Recent articles preview */}
                      {selectedFeed.recentArticles && selectedFeed.recentArticles.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Latest articles</label>
                          <div className="rounded-lg border border-border divide-y divide-border">
                            {selectedFeed.recentArticles.map((article, i) => (
                              <div key={i} className="px-3 py-2 flex items-start gap-2">
                                <span className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 shrink-0">{i + 1}.</span>
                                <div className="min-w-0 flex-1">
                                  {article.link ? (
                                    <a
                                      href={article.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2 inline-flex items-start gap-1"
                                    >
                                      <span>{article.title}</span>
                                      <ExternalLink className="h-2.5 w-2.5 shrink-0 mt-0.5 opacity-40" />
                                    </a>
                                  ) : (
                                    <p className="text-xs text-foreground line-clamp-2">{article.title}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">No feed found</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      No RSS or Atom feed was detected at this URL. Try a direct feed URL instead.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-4 shrink-0">
          <button
            onClick={step === 'result' ? reset : handleClose}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {step === 'result' ? 'Try another' : 'Cancel'}
          </button>

          {step === 'result' && selectedFeed && !urlAlreadyExists && (
            <button
              onClick={handleSave}
              disabled={create.isPending || !editName.trim()}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                'bg-foreground text-background hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {create.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save Feed
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
