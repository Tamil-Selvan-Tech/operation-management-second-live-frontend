export function AppHeader({ title, accent }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Project Foundation</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-pill">
        <span />
        {accent}
      </div>
    </header>
  )
}
