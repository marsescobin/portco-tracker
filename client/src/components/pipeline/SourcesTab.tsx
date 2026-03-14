import React, { useState, useMemo } from 'react'
import { ExternalLink, Plus, Pencil, Trash2, Check, X, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNewsSources, useUpdateSource, useDeleteSource } from '@/hooks/useNewsSources'
import type { NewsSource } from '@/hooks/useNewsSources'
import type { PipelineRun } from '@/hooks/usePipelineRuns'
import { AddSourceDialog } from './AddSourceDialog'

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
  id: string
  name: string
  type: string
  url: string
  href: string
  notes: string
  extracted: number
  matched: number
  confirmed: number
}

type SortKey = 'name' | 'type' | 'notes' | 'extracted' | 'matched' | 'confirmed'
type SortDir = 'asc' | 'desc'

function buildSourceRows(
  sources: NewsSource[],
  latestRun: PipelineRun | null,
): SourceRow[] {
  const bySource = (latestRun?.by_source ?? {}) as Record<string, Record<string, unknown>>

  return sources.map((src) => {
    const stats = bySource[src.name]
    return {
      id: src.id,
      name: src.name,
      type: src.type,
      url: src.url,
      href: toHref(src.url),
      notes: src.category ?? '',
      extracted: (stats?.extracted as number) ?? 0,
      matched: (stats?.matched as number) ?? 0,
      confirmed: (stats?.confirmed as number) ?? 0,
    }
  })
}

function sortRows(rows: SourceRow[], key: SortKey, dir: SortDir): SourceRow[] {
  return [...rows].sort((a, b) => {
    let cmp: number
    if (key === 'name' || key === 'type' || key === 'notes') {
      cmp = a[key].localeCompare(b[key])
    } else {
      cmp = a[key] - b[key]
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

interface SourcesTabProps {
  latestRun: PipelineRun | null
}

/** Sortable column header */
function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = currentKey === sortKey
  const Icon = active ? (currentDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <th
      className={cn(
        'py-2 px-3 font-medium cursor-pointer select-none hover:text-foreground transition-colors',
        align === 'right' && 'text-right',
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {align === 'right' && <Icon className={cn('h-3 w-3', active ? 'text-foreground' : 'text-muted-foreground/40')} />}
        {label}
        {align === 'left' && <Icon className={cn('h-3 w-3', active ? 'text-foreground' : 'text-muted-foreground/40')} />}
      </span>
    </th>
  )
}

/** Slide-down edit panel — expands below the source row */
function EditPanel({
  row,
  onCancel,
  onSaved,
  colSpan,
}: {
  row: SourceRow
  onCancel: () => void
  onSaved: () => void
  colSpan: number
}) {
  const [name, setName] = useState(row.name)
  const [url, setUrl] = useState(row.url)
  const [notes, setNotes] = useState(row.notes)
  const update = useUpdateSource()

  async function handleSave() {
    if (!name.trim() || !url.trim()) return
    try {
      await update.mutateAsync({
        id: row.id,
        name: name.trim(),
        url: url.trim(),
        category: notes.trim() || undefined,
      })
      onSaved()
    } catch {
      // error is shown via mutation state
    }
  }

  return (
    <tr className="border-b border-border">
      <td colSpan={colSpan} className="p-0">
        <div className="bg-muted/30 border-t border-dashed border-border px-4 py-3">
          <div className="grid grid-cols-[1fr_1fr] gap-3 max-w-2xl">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                placeholder="Source name"
              />
            </div>

            {/* Feed URL */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Feed URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                placeholder="Feed URL"
              />
            </div>

            {/* Notes — full width */}
            <div className="space-y-1 col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                placeholder="Add notes…"
              />
            </div>
          </div>

          {/* Error */}
          {update.isError && (
            <p className="text-xs text-red-500 mt-2">
              {update.error instanceof Error ? update.error.message : 'Failed to update'}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleSave}
              disabled={update.isPending || !name.trim() || !url.trim()}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                'bg-foreground text-background hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save Changes
            </button>
            <button
              onClick={onCancel}
              disabled={update.isPending}
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

export function SourcesTab({ latestRun }: SourcesTabProps) {
  const { data: sources, isLoading } = useNewsSources()
  const deleteSource = useDeleteSource()
  const unsortedRows = buildSourceRows(sources ?? [], latestRun)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('extracted')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const rows = useMemo(() => sortRows(unsortedRows, sortKey, sortDir), [unsortedRows, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Default to descending for numeric columns, ascending for text
      setSortDir(key === 'name' || key === 'type' || key === 'notes' ? 'asc' : 'desc')
    }
  }

  const typeCounts = (sources ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1
    return acc
  }, {})
  const typeBreakdown = Object.entries(typeCounts)
    .map(([t, n]) => `${n} ${t}`)
    .join(', ')

  async function handleDelete(id: string) {
    try {
      await deleteSource.mutateAsync(id)
      setConfirmDeleteId(null)
    } catch {
      // error handled by mutation
    }
  }

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
          onClick={() => setAddDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
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
                <SortHeader label="Source" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Type" sortKey="type" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Notes" sortKey="notes" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Extracted" sortKey="extracted" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                <SortHeader label="Matched" sortKey="matched" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                <SortHeader label="Confirmed" sortKey="confirmed" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEditing = editingId === row.id
                return (
                  <React.Fragment key={row.id}>
                    {/* Normal data row — always visible */}
                    <tr className={cn(
                      'hover:bg-muted/30 transition-colors group',
                      isEditing ? 'bg-muted/20' : 'border-b border-border last:border-0',
                    )}>
                      <td className="py-2 px-3 text-sm max-w-[200px]">
                        <a
                          href={row.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={row.url}
                          className="inline-flex items-center gap-1 font-medium hover:underline max-w-full"
                        >
                          <span className="truncate">{row.name}</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                        </a>
                      </td>
                      <td className="py-2 px-3">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                          TYPE_COLORS[row.type] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
                        )}>
                          {row.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground max-w-[160px]">
                        <span className="truncate block">{row.notes || '—'}</span>
                      </td>
                      <td className="py-2 px-3 text-sm text-right tabular-nums">{row.extracted}</td>
                      <td className={cn('py-2 px-3 text-sm text-right tabular-nums', row.matched > 0 ? 'font-medium' : 'text-muted-foreground')}>
                        {row.matched}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Confirmed count */}
                          <span className={cn(
                            'text-sm tabular-nums mr-2',
                            row.confirmed > 0 ? 'font-medium text-emerald-600' : 'text-muted-foreground',
                          )}>
                            {row.confirmed}
                          </span>

                          {/* Delete confirmation */}
                          {confirmDeleteId === row.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(row.id)}
                                disabled={deleteSource.isPending}
                                className="rounded-md px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 transition-colors disabled:opacity-50"
                              >
                                {deleteSource.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            /* Edit + Delete buttons (visible on hover) */
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingId(isEditing ? null : row.id)}
                                className={cn(
                                  'rounded-md p-1.5 transition-colors',
                                  isEditing
                                    ? 'text-foreground bg-muted'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                                )}
                                title={isEditing ? 'Close editor' : 'Edit source'}
                              >
                                {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                              </button>
                              {!isEditing && (
                                <button
                                  onClick={() => setConfirmDeleteId(row.id)}
                                  className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                  title="Delete source"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Slide-down edit panel */}
                    {isEditing && (
                      <EditPanel
                        row={row}
                        onCancel={() => setEditingId(null)}
                        onSaved={() => setEditingId(null)}
                        colSpan={6}
                      />
                    )}
                  </React.Fragment>
                )
              })}

              {/* Totals */}
              <tr className="bg-muted/50 border-t border-border font-medium text-sm">
                <td className="py-2 px-3">{rows.length} sources</td>
                <td className="py-2 px-3" />
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

      {/* Add Source Dialog */}
      <AddSourceDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} />
    </div>
  )
}
