import { BookOpen } from 'lucide-react'

export function AppLoadingState({
  title = 'Loading workspace',
  description = 'Preparing the app shell and checking the active session.',
  className = '',
}) {
  return (
    <section className={`app-loading-state ${className}`.trim()} aria-busy="true" aria-live="polite">
      <div className="app-loading-hero" aria-hidden="true">
        <span className="app-loading-ring" />
        <span className="app-loading-orb">
          <BookOpen size={84} strokeWidth={2.2} />
        </span>
        <span className="app-loading-dot app-loading-dot-a" />
        <span className="app-loading-dot app-loading-dot-b" />
        <span className="app-loading-dot app-loading-dot-c" />
        <span className="app-loading-dot app-loading-dot-d" />
        <span className="app-loading-dot app-loading-dot-e" />
      </div>

      <div className="app-loading-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="app-loading-bars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </section>
  )
}
