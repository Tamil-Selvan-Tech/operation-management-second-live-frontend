export function AppHeader({ dashboard }) {
  const eyebrowLabel = dashboard?.label || dashboard?.title?.replace(/\s*Dashboard$/, '') || 'Operation Manager'

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{eyebrowLabel}</p>
        <h1>{dashboard?.title || 'Operations Dashboard'}</h1>
        {dashboard?.summary ? <p>{dashboard.summary}</p> : null}
      </div>
    </header>
  )
}
