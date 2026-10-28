import { useEffect, useMemo, useState } from 'react'
import { getSuperAdminSalesCrmAnalytics } from '../services/superAdminDashboardService'
import '../styles/SuperAdminSalesCrmOverview.css'

function Metric({ label, value, note, tone = 'blue' }) { return <article className={`sa-crm-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article> }

export function SuperAdminSalesCrmOverview({ branches = [], dateRange = null, onSummaryChange = null, showMetrics = true, hideAnalytics = false, chartOnly = false }) {
  const [period, setPeriod] = useState('monthly')
  const [branchId, setBranchId] = useState('')
  const [adminId, setAdminId] = useState('')
  const [adminSearch, setAdminSearch] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true); setError('')
      try { const next = await getSuperAdminSalesCrmAnalytics({ period, branchId, salesAdminId: adminId, salesAdminSearch: adminSearch, startDate: dateRange?.startDate, endDate: dateRange?.endDate }); if (!cancelled) setData(next) }
      catch (err) { if (!cancelled) setError(err?.message || 'Unable to load Sales CRM analytics.') }
      finally { if (!cancelled) setLoading(false) }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [period, branchId, adminId, adminSearch, dateRange?.startDate, dateRange?.endDate])
  const summary = data?.summary || {}
  useEffect(() => { onSummaryChange?.(summary) }, [onSummaryChange, summary])
  const admins = data?.salesAdmins || []
  const rows = data?.chart?.buckets || []
  const max = Math.max(1, ...rows.flatMap((row) => [row.leads, row.admissions, row.hotLeads, row.warmLeads, row.coldLeads].map(Number)))
  useEffect(() => {
    document.querySelectorAll('.sa-crm-series-bars b[title]').forEach((bar) => {
      bar.dataset.tooltip = bar.getAttribute('title') || ''
      bar.removeAttribute('title')
    })
  }, [rows])
  const activeBranches = useMemo(() => branches.filter((branch) => String(branch?.status || '').toLowerCase() === 'active'), [branches])
  return <section className={`sa-crm-overview ${showMetrics ? '' : 'sa-crm-summary-hidden'} ${hideAnalytics ? 'sa-crm-hidden' : ''} ${chartOnly ? 'sa-crm-chart-only' : ''}`} aria-labelledby="sa-crm-overview-title">
    <header className="sa-crm-header"><div><p>SALES CRM ANALYTICS</p><h2 id="sa-crm-overview-title">Lead &amp; Admission Summary</h2><span>Combined performance across every active branch.</span></div><div className="sa-crm-filters"><label><span>Sales Admin</span><input value={adminSearch} onChange={(event) => { setAdminSearch(event.target.value); setAdminId('') }} placeholder="Search ID or name" /></label><label><span>Admin filter</span><select value={adminId} onChange={(event) => setAdminId(event.target.value)}><option value="">All Sales Admins</option>{admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.fullName} ({admin.userCode})</option>)}</select></label><label><span>Branch</span><select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All Branches</option>{activeBranches.map((branch) => <option key={branch.id || branch.branchId} value={branch.branchId || branch.id}>{branch.branchName || branch.branchId}</option>)}</select></label><label><span>Chart</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label></div></header>
    {error ? <div className="sa-crm-error" role="alert">{error}</div> : null}
    {showMetrics ? <div className="sa-crm-metrics"><Metric label="Total Leads" value={loading ? '—' : summary.totalLeads} note="Current authorized scope" tone="slate" /><Metric label="This Month's Leads" value={loading ? '—' : summary.thisMonthLeads} note="Created this month" /><Metric label="Total Admissions" value={loading ? '—' : summary.totalAdmissions} note="CRM-origin admissions" tone="green" /><Metric label="CRM Students" value={loading ? '—' : summary.totalStudentsFromSalesCrm} note="Created from a lead" tone="green" /><Metric label="HOT Leads" value={loading ? '—' : summary.hotLeads} note="Current stage" tone="orange" /><Metric label="WARM Leads" value={loading ? '—' : summary.warmLeads} note="Current stage" tone="amber" /><Metric label="COLD Leads" value={loading ? '—' : summary.coldLeads} note="Current stage" tone="purple" /></div> : null}
    <div className="sa-crm-panel"><div className="sa-crm-panel-title"><div><h3>CRM performance</h3><span>{period === 'daily' ? 'Last 30 days' : period === 'weekly' ? 'Last 12 weeks' : 'Last 12 months'}</span></div><div className="sa-crm-legend"><span><i className="leads" />Leads</span><span><i className="admissions" />Admissions</span><span><i className="hot" />HOT</span><span><i className="warm" />WARM</span><span><i className="cold" />COLD</span></div></div><div className="sa-crm-series">{rows.map((row) => <div className="sa-crm-series-column" key={row.key}><div className="sa-crm-series-bars">{['leads', 'admissions', 'hotLeads', 'warmLeads', 'coldLeads'].map((key) => <b key={key} className={key.replace('Leads', '').toLowerCase()} title={`${key}: ${row[key]}`} style={{ height: `${Math.max(row[key] ? 5 : 0, row[key] / max * 100)}%` }} />)}</div><small>{row.key}</small></div>)}</div></div>
  </section>
}
