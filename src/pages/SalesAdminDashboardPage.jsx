import { useEffect, useState } from 'react'
import { request } from '../services/apiClient'
import { useAuth } from '../auth/useAuth'

export function SalesAdminDashboardPage() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    request('/sales-admins/dashboard')
      .then((response) => { if (active) setDashboard(response?.data || null) })
      .catch((reason) => { if (active) setError(reason?.message || 'Unable to load dashboard') })
    return () => { active = false }
  }, [])

  const cards = dashboard?.cards || {}
  return (
    <main className="page-shell" style={{ padding: '32px' }}>
      <p className="eyebrow">SALES ADMIN</p>
      <h1>Welcome, {user?.name || 'Sales Admin'}</h1>
      <p>Dashboard data is scoped to your assigned branches.</p>
      {error ? <p role="alert">{error}</p> : null}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginTop: '24px' }}>
        {[["New leads", cards.newLeads], ["Total leads", cards.totalLeads], ["HOT leads", cards.hotLeads], ["WARM leads", cards.warmLeads], ["COLD leads", cards.coldLeads], ["Admissions", cards.admissionsCompleted]].map(([label, value]) => <article className="panel-card" key={label} style={{ padding: '20px' }}><span>{label}</span><strong style={{ display: 'block', fontSize: '28px', marginTop: '8px' }}>{value == null ? 'Unavailable' : value}</strong></article>)}
      </section>
      <section className="panel-card" style={{ marginTop: '24px', padding: '20px' }}><h2>Lead Management</h2><p>Lead management workspace is ready for the next implementation phase.</p></section>
    </main>
  )
}
