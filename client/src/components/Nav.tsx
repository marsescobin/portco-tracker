import { NavLink } from 'react-router-dom'

const links = [
  { to: '/companies', label: 'Companies' },
  { to: '/digest', label: 'Coverage' },
  { to: '/admin', label: 'Admin' },
 // {to: '/search', label: 'Search'},
]

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Wordmark */}
        <span className="text-sm font-semibold tracking-tight">
          Initialized <span className="text-muted-foreground font-normal">Portfolio</span>
        </span>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

      </div>
    </header>
  )
}
