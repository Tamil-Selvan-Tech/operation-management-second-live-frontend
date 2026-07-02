import { roleDashboards, roleLabels } from '../data/authData'

export function DashboardPage({ role }) {
  const dashboard = roleDashboards[role]

  return (
    <section className="dashboard-grid">
      <article className="hero-card">
        <div>
          <p className="eyebrow">{dashboard.accent} lane</p>
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
        </div>
        <div className="metric" style={{ '--metric-color': dashboard.color }}>
          <span>Access</span>
          <strong>{roleLabels[role]}</strong>
        </div>
      </article>

      {dashboard.cards.map((card) => (
        <article key={card} className="info-card">
          <span className="dot" style={{ backgroundColor: dashboard.color }} />
          <h3>{card}</h3>
          <p>Placeholder card for role-specific work and permissions validation.</p>
        </article>
      ))}
    </section>
  )
}
