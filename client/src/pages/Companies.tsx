import { useCompanies } from '@/hooks/useCompanies'
import { CompanyRow } from '@/components/CompanyRow'

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
              <th className="py-2.5 px-4 font-medium">Company</th>
              <th className="py-2.5 px-4 font-medium">Sentiment</th>
              <th className="py-2.5 px-4 font-medium">Last digest</th>
              <th className="py-2.5 px-4 font-medium">Reason</th>
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

            {companies?.map((company) => (
              <CompanyRow key={company.id} company={company} />
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
