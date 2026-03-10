import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Sentiment } from '@/lib/types'

interface SentimentTickProps {
  sentiment: Sentiment | null
  size?: 'sm' | 'md'
  showLabel?: boolean
}

const config = {
  '+': {
    icon: TrendingUp,
    label: 'Positive',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  '-': {
    icon: TrendingDown,
    label: 'Negative',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  mixed: {
    icon: Minus,
    label: 'Mixed',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
}

export function SentimentTick({ sentiment, size = 'md', showLabel = true }: SentimentTickProps) {
  if (!sentiment) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        No data
      </span>
    )
  }

  const { icon: Icon, label, className } = config[sentiment]
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const textSize = size === 'sm' ? 'text-xs' : 'text-xs font-medium'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${textSize} ${className}`}
      title={label}
    >
      <Icon className={iconSize} strokeWidth={2.5} />
      {showLabel && label}
    </span>
  )
}
