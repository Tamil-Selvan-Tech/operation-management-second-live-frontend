function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function AppHeader({ dashboard, onOpenMenu }) {
  const eyebrowLabel = dashboard?.label || dashboard?.title?.replace(/\s*Dashboard$/, '') || 'Operation Manager'

  return (
    <header className="topbar">
      <button
        type="button"
        className="mobile-menu-button"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
      >
        <MenuIcon />
      </button>
      <div className="app-header-mobile-brand" aria-hidden="true">
        <img className="app-header-mobile-brand-logo" src="/logo.png" alt="" />
        <div className="app-header-mobile-brand-copy">
          <strong>Cispro Ops</strong>
          <p>Role-aware workspace</p>
        </div>
      </div>

      <div className="app-header-copy">
        <p className="eyebrow">{eyebrowLabel}</p>
        <h1>{dashboard?.title || 'Operations Dashboard'}</h1>
        {dashboard?.summary ? <p>{dashboard.summary}</p> : null}
      </div>
    </header>
  )
}
