import { useState } from 'react'

// Tailwind shade scale — edit these 5 classes to tune visual intensity
const SHADES = [
  'bg-muted',          // 0 — no data
  'bg-emerald-100',    // 1 — low
  'bg-emerald-300',    // 2 — medium-low
  'bg-emerald-500',    // 3 — medium-high
  'bg-emerald-700',    // 4 — peak
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

// Pixel constants matching Tailwind w-4 (16px) and gap-1 (4px)
const CELL_PX = 16
const GAP_PX = 4
const WEEK_PX = CELL_PX + GAP_PX // 20px per week column

interface HeatmapCalendarProps {
  year: number
  countsByDate: Record<string, number>
  selectedDate: string | null
  onSelectDate: (date: string) => void
  isLoading?: boolean
}

interface Tooltip {
  text: string
  x: number
  y: number
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildWeeks(year: number): Date[][] {
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)

  // Pad back to the Sunday before Jan 1
  const start = new Date(jan1)
  start.setDate(jan1.getDate() - jan1.getDay())

  const weeks: Date[][] = []
  const cur = new Date(start)

  while (cur <= dec31) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  return weeks
}

// Computes start/end week index for each month, only counting in-year dates
function calculateMonthLabels(
  weeks: Date[][],
  year: number
): { month: string; startWeek: number; endWeek: number }[] {
  const labels: { month: string; startWeek: number; endWeek: number }[] = []
  let currentMonth = -1
  let startWeek = 0

  weeks.forEach((week, weekIndex) => {
    // Only consider dates that are actually in the target year
    const yearDates = week.filter((d) => d.getFullYear() === year)
    if (yearDates.length === 0) return

    // Prefer the 1st of the month if it appears in this week; otherwise use first in-year date
    const monthForWeek = yearDates.find((d) => d.getDate() === 1)?.getMonth() ?? yearDates[0].getMonth()

    if (monthForWeek !== currentMonth) {
      if (currentMonth !== -1) {
        labels.push({ month: MONTHS[currentMonth], startWeek, endWeek: weekIndex - 1 })
      }
      currentMonth = monthForWeek
      startWeek = weekIndex
    }
  })

  if (currentMonth !== -1) {
    labels.push({ month: MONTHS[currentMonth], startWeek, endWeek: weeks.length - 1 })
  }

  return labels
}

function getShadeIndex(count: number, max: number): number {
  if (count === 0 || max === 0) return 0
  const ratio = count / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

export function HeatmapCalendar({
  year,
  countsByDate,
  selectedDate,
  onSelectDate,
  isLoading,
}: HeatmapCalendarProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  const today = formatDateKey(new Date())
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const weeks = buildWeeks(year)
  const max = Math.max(...Object.values(countsByDate), 1)
  const monthLabels = calculateMonthLabels(weeks, year)

  const totalDigests = Object.values(countsByDate).reduce((a, b) => a + b, 0)

  // Total pixel width of the grid (subtract trailing gap so it's flush)
  const totalWidth = weeks.length * WEEK_PX - GAP_PX

  return (
    <>
      {/* Custom tooltip — rendered outside the card so it's never clipped */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg pointer-events-none -translate-x-1/2"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}

      <div className="w-fit mx-auto rounded-lg border border-border p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {totalDigests} digest{totalDigests !== 1 ? 's' : ''} in {year}
          </span>
        </div>

        {/* Calendar grid */}
        <div className="overflow-x-auto">
          <div className="inline-flex gap-2">

            {/* Day labels */}
            <div className="flex flex-col gap-1 pt-5">
              {DAY_LABELS.map((label, i) => (
                <div key={i} className="h-4 w-6 flex items-center justify-end">
                  <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            {/* Weeks + month labels */}
            <div className="space-y-1">

              {/* Month labels — each label gets an exact pixel width spanning its columns */}
              <div className="relative h-4" style={{ width: `${totalWidth}px` }}>
                {monthLabels.map((label, index) => {
                  const spanWeeks = label.endWeek - label.startWeek + 1
                  const width = spanWeeks * WEEK_PX - GAP_PX
                  const left = label.startWeek * WEEK_PX
                  return (
                    <span
                      key={`${label.month}-${index}`}
                      className="absolute text-[10px] font-bold text-muted-foreground text-center"
                      style={{ left: `${left}px`, width: `${width}px` }}
                    >
                      {label.month}
                    </span>
                  )
                })}
              </div>

              {/* Grid cells */}
              <div className="flex gap-1" style={{ width: `${totalWidth}px` }}>
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-1">
                    {week.map((day, di) => {
                      const key = formatDateKey(day)
                      const isInYear = day >= jan1 && day <= dec31
                      const isFuture = day > new Date()
                      const isToday = key === today
                      const isSelected = key === selectedDate
                      const count = countsByDate[key] ?? 0
                      const shadeIdx = getShadeIndex(count, max)

                      if (!isInYear) {
                        return <div key={di} className="h-4 w-4" />
                      }

                      const month = day.toLocaleDateString('en-US', { month: 'long' })
                      const tooltipText = count === 0
                        ? `No digests on ${month} ${day.getDate()}, ${year}`
                        : `${count} digest${count !== 1 ? 's' : ''} on ${month} ${day.getDate()}, ${year}`

                      return (
                        <button
                          key={di}
                          disabled={isFuture && count === 0}
                          onClick={() => count > 0 && onSelectDate(key)}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setTooltip({ text: tooltipText, x: rect.left + rect.width / 2, y: rect.top - 30 })
                          }}
                          onMouseLeave={() => setTooltip(null)}
                          className={[
                            'h-4 w-4 rounded-sm transition-all',
                            isFuture && count === 0
                              ? 'bg-muted opacity-40 cursor-default'
                              : count > 0
                              ? `${SHADES[shadeIdx]} cursor-pointer hover:opacity-80`
                              : 'bg-muted cursor-default',
                            isToday && !isSelected ? 'ring-1 ring-offset-1 ring-border' : '',
                            isSelected ? 'ring-2 ring-offset-1 ring-foreground' : '',
                          ].join(' ')}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-[11px] text-muted-foreground">Companies in the news per day</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Less</span>
            {SHADES.map((shade, i) => (
              <div key={i} className={`h-4 w-4 rounded-sm ${shade}`} />
            ))}
            <span className="text-[11px] text-muted-foreground">More</span>
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0 rounded-lg bg-background/60 animate-pulse" />
        )}
      </div>
    </>
  )
}
