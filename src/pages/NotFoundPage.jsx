import { ArrowLeft, Home, SearchX } from 'lucide-react'

export function NotFoundPage({ onGoLogin, onGoDashboard }) {
  return (
    <section className="panel panel-center public-error-page">
      <div className="public-error-shell">
        <header className="public-error-header">
          <img src="/logo1.JPG" alt="CISPRO" className="public-error-logo" />
        </header>

        <main className="public-error-content">
          <div className="public-error-copy">
            <span className="public-error-kicker">Error 404</span>
            <h1>This page is not available.</h1>
            <p className="public-error-lead">The page you are looking for may have moved, been removed, or is temporarily unavailable.</p>
            <p className="public-error-helper">Use one of the options below to continue working in your dashboard.</p>
            <div className="public-error-actions">
              {onGoDashboard ? (
                <button type="button" className="public-error-primary" onClick={onGoDashboard}>
                  <Home size={17} aria-hidden="true" />
                  Go to dashboard
                </button>
              ) : null}
              <button type="button" className="public-error-secondary" onClick={onGoLogin}>
                <ArrowLeft size={17} aria-hidden="true" />
                Back to login
              </button>
            </div>
          </div>

          <div className="public-error-art" aria-hidden="true">
            <div className="public-error-art-glow" />
            <SearchX className="public-error-art-icon" size={32} strokeWidth={1.8} />
            <strong>404</strong>
            <span>Page not found</span>
            <div className="public-error-art-line public-error-art-line-one" />
            <div className="public-error-art-line public-error-art-line-two" />
          </div>
        </main>

        <footer className="public-error-footer">CISPRO Training and Placement Services</footer>
      </div>
    </section>
  )
}
