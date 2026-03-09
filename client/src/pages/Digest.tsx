import { useState } from 'react'
import { useDailyDigestCounts } from '@/hooks/useDailyDigestCounts'
import { HeatmapCalendar } from '@/components/HeatmapCalendar'
import { DayPanel } from '@/components/DayPanel'

export default function Digest() {
  const year = new Date().getFullYear()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { data: countsByDate = {}, isLoading } = useDailyDigestCounts(year)

  function handleSelectDate(date: string) {
    setSelectedDate((prev) => (prev === date ? null : date))
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6 ">

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">News Coverage</h1>
        <p className="text-sm text-muted-foreground">
          Daily portfolio digest activity. Click a square to see which companies were in the news.
        </p>
      </div>

      {/* Heatmap */}
      <HeatmapCalendar
        year={year}
        countsByDate={countsByDate}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        isLoading={isLoading}
      />

      {/* Day panel — appears below when a date is selected */}
      {selectedDate && (
      
        <DayPanel
            date={selectedDate}
            onClose={() => setSelectedDate(null)}
          />
        
      )}
</div>
  )
}
