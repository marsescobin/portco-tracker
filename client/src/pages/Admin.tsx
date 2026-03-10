import { Activity, Rss, SlidersHorizontal, Search, Bell, Filter, Mail } from 'lucide-react'

const COMING_SOON = [
  {
    icon: Activity,
    title: 'Pipeline Health',
    description: 'Live status across all pipeline steps, including source health, run times, and error logs.',
  },
  {
    icon: Rss,
    title: 'News Sources',
    description: 'Configure sources per company, including RSS feeds, news APIs, Twitter handles, and official newsroom URLs.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Prompt Editor',
    description: 'Control what gets surfaced and how it reads, without touching code.',
  },
]

const ROADMAP = [
  {
    icon: Search,
    title: 'Smart Search',
    description: 'Search across all past digests using natural language. Ask things like "which companies raised money this quarter" and get real answers.',
  },
  {
    icon: Bell,
    title: 'Digest Delivery',
    description: 'Get the digest sent to your inbox or Slack on your own schedule. Set your areas of interest, preferred tone, and how often you want it delivered.',
  },
  {
    icon: Filter,
    title: 'Sector Filtering',
    description: 'Filter portfolio companies by sector to focus on what matters most to you.',
  },
]

export default function Admin() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground font-medium">
            Coming soon
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Tools for managing the pipeline, coming soon.
        </p>
      </div>

      {/* Admin feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {COMING_SOON.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-lg border border-border bg-muted/30 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-muted p-1.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">{title}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </div>
        ))}
      </div>

      {/* Roadmap section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Also on the roadmap</h2>
          <p className="text-sm text-muted-foreground">Features for the whole team, not just admins.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ROADMAP.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-muted/30 p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-1.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium">{title}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-lg border border-border bg-background px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Want to push something up the list?</p>
          <p className="text-sm text-muted-foreground">
            Reach out and let me know what would be most useful to you and the team.
          </p>
        </div>
        <a
          href="mailto:marsescobin@gmail.com"
          className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          <Mail className="h-4 w-4" />
          Get in touch
        </a>
      </div>

    </div>
  )
}
