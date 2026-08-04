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
    <header className="topbar !flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <button
        type="button"
        className="mobile-menu-button !inline-flex !h-10 !w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm md:!hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
      >
        <MenuIcon />
      </button>
      <div className="app-header-mobile-brand !flex items-center gap-3 md:!hidden" aria-hidden="true">
        <img
          className="app-header-mobile-brand-logo !h-12 !w-12 rounded-xl object-contain bg-white p-1 shadow-sm"
          src="/logo.png"
          alt=""
        />
        <div className="app-header-mobile-brand-copy min-w-0">
          <strong className="block text-base font-extrabold tracking-[-0.02em] text-sky-700">Cispro Ops</strong>
        </div>
      </div>

      <div className="app-header-copy !min-w-0 !flex-1">
        <p className="eyebrow text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-sky-600">{eyebrowLabel}</p>
        <h1 className="mt-1 text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.02em] text-slate-900 sm:text-[1.6rem]">
          {dashboard?.title || 'Operations Dashboard'}
        </h1>
        {dashboard?.summary ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 sm:text-[0.95rem]">{dashboard.summary}</p>
        ) : null}
      </div>
    </header>
  )
}
