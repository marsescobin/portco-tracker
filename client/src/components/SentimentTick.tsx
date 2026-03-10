import { TrendingUp, TrendingDown, ArrowUpDown, Minus } from 'lucide-react'
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
    showLabel: true,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  '-': {
    icon: TrendingDown,
    label: 'Negative',
    showLabel: true,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  mixed: {
    icon: ArrowUpDown,
    label: 'Mixed',
    showLabel: true,
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  neutral: {
    icon: Minus,
    label: 'Neutral',
    showLabel: true,
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
}

export function SentimentTick({ sentiment, size = 'md', showLabel = true }: SentimentTickProps) {
  if (!sentiment) {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        –
      </span>
    )
  }

  const { icon: Icon, label, showLabel: defaultShowLabel, className } = config[sentiment]
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const textSize = size === 'sm' ? 'text-xs' : 'text-xs font-medium'
  const shouldShowLabel = showLabel && defaultShowLabel

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${textSize} ${className}`}
      title={label}
    >
      <Icon className={iconSize} strokeWidth={2.5} />
      {shouldShowLabel && <span className="hidden sm:inline">{label}</span>}
    </span>
  )
}
