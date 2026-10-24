import { useEffect, useState } from 'react'
import { request } from '../services/apiClient'

const labels = [['totalNewLeads', 'New Leads'], ['convertedLeads', 'Converted'], ['movedToHot', 'Moved to HOT'], ['completedFollowUps', 'Completed Follow-ups'], ['pendingFollowUps', 'Pending Follow-ups'], ['overdueFollowUps', 'Overdue Follow-ups'], ['conversionRate', 'Conversion Rate']]

export function SalesCrmReportPage() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { let active = true; request('/sales-crm/reports/monthly').then((response) => { if (active) setReport(response?.data || null) }).catch((reason) => { if (active) setError(reason?.message || 'Unable to load Sales CRM report') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])
  if (loading) return <section className="sales-crm-report-page"><p>Loading report...</p></section>
  if (error) return <section className="sales-crm-report-page"><p className="lead-notice is-error">{error}</p></section>
  const summary = report?.summary || {}
  const period = report?.period || {}
  return <section className="sales-crm-report-page"><header className="sales-crm-report-header"><div><p className="eyebrow">SALES CRM</p><h1>Monthly Lead Report</h1><p>Period: {period.month}/{period.year}</p></div></header><div className="sales-crm-report-cards">{labels.map(([key, label]) => <article className="panel-card" key={key}><span>{label}</span><strong>{key === 'conversionRate' ? `${summary[key] || 0}%` : summary[key] || 0}</strong></article>)}</div><section className="panel-card sales-crm-report-stage-card"><h2>Current Lead Stage Breakdown</h2><div className="sales-crm-report-stage-grid">{Object.entries(summary.stageBreakdown || {}).map(([stage, count]) => <div key={stage}><span>{stage}</span><strong>{count}</strong></div>)}</div></section><section className="panel-card sales-crm-report-table-card"><h2>Lead Breakdown</h2><div className="lead-table-scroll"><table className="lead-table"><thead><tr><th>Lead ID</th><th>Student Name</th><th>Assigned To</th><th>Branch</th><th>Stage</th><th>Status</th><th>Follow-ups</th></tr></thead><tbody>{(report?.leads || []).map((lead) => <tr key={lead.leadId}><td><strong>{lead.leadId}</strong></td><td>{lead.studentName}</td><td>{lead.assignedTo}</td><td>{lead.branch}</td><td>{lead.stage}</td><td>{lead.status}</td><td>{lead.followUpCount}</td></tr>)}{!report?.leads?.length ? <tr><td colSpan="7" className="lead-state-cell">No lead data for this period.</td></tr> : null}</tbody></table></div></section></section>
}
