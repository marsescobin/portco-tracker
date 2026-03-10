import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useCompanies } from '@/hooks/useCompanies'
import { CompanyRow } from '@/components/CompanyRow'
import type { Company } from '@/lib/types'

type SortKey = 'name' | 'latest_run_date' | 'latest_sentiment'
type SortDir = 'asc' | 'desc'

const SENTIMENT_RANK: Record<string, number> = { '+': 0, 'mixed': 1, '-': 2 }

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="inline h-3 w-3 ml-1 opacity-40" />
  return sortDir === 'asc'
    ? <ChevronUp className="inline h-3 w-3 ml-1" />
    : <ChevronDown className="inline h-3 w-3 ml-1" />
}

function sortCompanies(companies: Company[], key: SortKey, dir: SortDir): Company[] {
  return companies.slice().sort((a, b) => {
    let result = 0

    if (key === 'name') {
      result = a.name.localeCompare(b.name)
    } else if (key === 'latest_run_date') {
      const aTime = a.latest_run_date ? new Date(a.latest_run_date).getTime() : -Infinity
      const bTime = b.latest_run_date ? new Date(b.latest_run_date).getTime() : -Infinity
      result = aTime - bTime
    } else if (key === 'latest_sentiment') {
      const aRank = a.latest_sentiment != null ? (SENTIMENT_RANK[a.latest_sentiment] ?? 3) : 3
      const bRank = b.latest_sentiment != null ? (SENTIMENT_RANK[b.latest_sentiment] ?? 3) : 3
      result = aRank - bRank
    }

    return dir === 'asc' ? result : -result
  })
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          <td className="py-3 px-4"><div className="h-4 w-32 rounded bg-muted animate-pulse" /></td>
          <td className="py-3 px-4"><div className="h-5 w-16 rounded-full bg-muted animate-pulse" /></td>
          <td className="py-3 px-4"><div className="h-4 w-12 rounded bg-muted animate-pulse" /></td>
          <td className="py-3 px-4"><div className="h-4 w-40 rounded bg-muted animate-pulse" /></td>
          <td className="py-3 px-4" />
        </tr>
      ))}
    </>
  )
}

export default function Companies() {
  const { data: companies, isLoading, isError } = useCompanies()
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = companies ? sortCompanies(companies, sortKey, sortDir) : companies

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio Companies</h1>
          {companies && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground font-medium">
              {companies.length}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Latest news digests and sentiment across the Initialized portfolio.
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted text-left text-xs text-muted-foreground uppercase tracking-wide border-b border-border">
              <th className="py-2.5 px-4 font-medium cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('name')}>
                Company<SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="py-2.5 px-4 font-medium cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('latest_sentiment')}>
                Sentiment<SortIcon col="latest_sentiment" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="py-2.5 px-4 font-medium">Reason</th>
              <th className="py-2.5 px-4 font-medium cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('latest_run_date')}>
                Last digest<SortIcon col="latest_run_date" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="py-2.5 px-4" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonRows />}

            {isError && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  Failed to load companies. Please try again.
                </td>
              </tr>
            )}

            {!isLoading && !isError && companies?.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  No companies found.
                </td>
              </tr>
            )}

            {sorted?.map((company) => (
              <CompanyRow key={company.id} company={company} />
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
