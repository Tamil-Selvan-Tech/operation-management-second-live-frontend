import { useEffect, useState } from 'react'
import { AlertCircle, CheckCheck, Clock3, Flame, RefreshCw, Users } from 'lucide-react'
import { request } from '../services/apiClient'

const metrics = [
  { key: 'totalNewLeads', label: 'New Leads', icon: Users, accent: 'blue' },
  { key: 'movedToHot', label: 'Moved to HOT', icon: Flame, accent: 'orange' },
  { key: 'completedFollowUps', label: 'Completed Follow-ups', icon: CheckCheck, accent: 'emerald' },
  { key: 'pendingFollowUps', label: 'Pending Follow-ups', icon: Clock3, accent: 'amber' },
  { key: 'overdueFollowUps', label: 'Overdue Follow-ups', icon: AlertCircle, accent: 'red' },
]

const stages = [
  { key: 'COLD', label: 'Cold', accent: 'cold' },
  { key: 'WARM', label: 'Warm', accent: 'warm' },
  { key: 'HOT', label: 'Hot', accent: 'hot' },
  { key: 'CLOSED', label: 'Closed', accent: 'closed' },
]

const readable = (value) => String(value || '—').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())

function ReportSkeleton() {
  return <div className="sales-crm-report-skeleton" aria-label="Loading monthly report" aria-live="polite">
    <div className="sales-crm-report-skeleton-metrics">{metrics.map((metric) => <div className="sales-crm-report-skeleton-card" key={metric.key}><i /><i /><i /></div>)}</div>
    <div className="sales-crm-report-skeleton-section"><i /> <div>{stages.map((stage) => <i key={stage.key} />)}</div></div>
    <div className="sales-crm-report-skeleton-section sales-crm-report-skeleton-table"><i />{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
  </div>
}

export function SalesCrmReportPage() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let active = true
    request('/sales-crm/reports/monthly')
      .then((response) => { if (active) setReport(response?.data || null) })
      .catch((reason) => { if (active) setError(reason?.message || 'Unable to load Sales CRM report') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const period = report?.period || {}
  const monthName = period.month ? new Date(Date.UTC(Number(period.year), Number(period.month) - 1, 1)).toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' }) : ''

  if (loading) return <section className="sales-crm-report-page" aria-busy="true"><header className="sales-crm-report-header"><div><p className="eyebrow">SALES CRM</p><h1>Monthly Lead Report</h1><p>Track lead performance, follow-ups, and conversions.</p></div></header><ReportSkeleton /></section>
  if (error) return <section className="sales-crm-report-page"><header className="sales-crm-report-header"><div><p className="eyebrow">SALES CRM</p><h1>Monthly Lead Report</h1><p>Track lead performance, follow-ups, and conversions.</p></div></header><div className="sales-crm-report-error" role="alert"><AlertCircle size={20} /><span>{error}</span><button type="button" onClick={() => { setError(''); setLoading(true); setReloadKey((value) => value + 1) }}><RefreshCw size={15} /> Retry</button></div></section>

  const summary = report?.summary || {}
  const leadRows = report?.leads || []
  const stageBreakdown = summary.stageBreakdown || {}

  return <section className="sales-crm-report-page">
    <header className="sales-crm-report-header">
      <div><p className="eyebrow">SALES CRM</p><h1>Monthly Lead Report</h1><p>Track lead performance, follow-ups, and conversions.</p></div>
      {monthName ? <div className="sales-crm-report-period"><span>REPORTING PERIOD</span><strong>{monthName} {period.year}</strong></div> : null}
    </header>

    <section className="sales-crm-report-cards" aria-label="Monthly sales metrics">
      {metrics.map(({ key, label, icon: Icon, accent, percent }) => <article className={`sales-crm-report-metric is-${accent}`} key={key}>
        <span className="sales-crm-report-metric-icon"><Icon size={18} strokeWidth={2.1} /></span>
        <span className="sales-crm-report-metric-label">{label}</span>
        <strong>{percent ? `${Number(summary[key] || 0)}%` : Number(summary[key] || 0).toLocaleString('en-IN')}</strong>
      </article>)}
    </section>

    <section className="sales-crm-report-section sales-crm-report-stage-card">
      <div className="sales-crm-report-section-heading"><div><h2>Current Lead Stage Breakdown</h2><p>Leads grouped by their current stage.</p></div></div>
      <div className="sales-crm-report-stage-grid">{stages.map(({ key, label, accent }) => <article className={`sales-crm-report-stage is-${accent}`} key={key}><span className="sales-crm-report-stage-dot" /><span className="sales-crm-report-stage-name">{label}</span><strong>{Number(stageBreakdown[key] || 0).toLocaleString('en-IN')}</strong></article>)}</div>
    </section>

    <section className="sales-crm-report-section sales-crm-report-table-card">
      <div className="sales-crm-report-section-heading"><div><h2>Lead Breakdown</h2><p>{leadRows.length.toLocaleString('en-IN')} lead{leadRows.length === 1 ? '' : 's'} in this report period.</p></div></div>
      {!leadRows.length ? <div className="sales-crm-report-empty"><span><Users size={20} /></span><strong>No monthly lead data</strong><p>There are no leads to display for {monthName ? `${monthName} ${period.year}` : 'this reporting period'}.</p></div> : <div className="sales-crm-report-table-scroll"><table className="sales-crm-report-table"><thead><tr><th>Lead ID</th><th>Student Name</th><th>Assigned To</th><th>Branch</th><th>Stage</th><th>Status</th><th>Follow-ups</th></tr></thead><tbody>{leadRows.map((lead) => <tr key={lead.leadId}><td><strong className="sales-crm-report-lead-id">{lead.leadId}</strong></td><td className="sales-crm-report-student">{lead.studentName || '—'}</td><td>{lead.assignedTo || '—'}</td><td>{lead.branch || '—'}</td><td><span className={`sales-crm-report-badge is-stage-${String(lead.stage || '').toLowerCase()}`}>{readable(lead.stage)}</span></td><td><span className={`sales-crm-report-badge is-status-${String(lead.status || '').toLowerCase().replaceAll('_', '-')}`}>{readable(lead.status)}</span></td><td>{Number(lead.followUpCount || 0).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>}
    </section>
  </section>
}
