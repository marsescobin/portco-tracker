export type Sentiment = '+' | '-' | 'mixed'

export interface DigestArticle {
  link: string
  title: string
}

export interface Company {
  id: string
  name: string
  website: string | null
  description: string | null
  logo_url: string | null
  is_unicorn: boolean | null
  twitter_url: string | null
  newsroom_url: string | null
  other_links: { label: string; url: string }[] | null
  // joined from init_news_digests
  latest_sentiment: Sentiment | null
  latest_sentiment_reason: string | null
  latest_run_date: string | null
}

export interface Digest {
  id: string
  company_name: string
  summary: string[] | null
  sentiment: Sentiment | null
  sentiment_reason: string | null
  articles: DigestArticle[] | null
  run_date: string
  run_at: string | null
  funnel: Record<string, number> | null
  // joined from init_companies via FK
  company?: {
    description: string | null
    website: string | null
    is_unicorn: boolean | null
  }
}
