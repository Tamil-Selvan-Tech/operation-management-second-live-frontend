import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, Banknote, CalendarDays, Clock3, IndianRupee, LayoutDashboard, RefreshCcw, Users, Wallet, Building2,
} from 'lucide-react'
import { formatOverviewCurrency, getSuperAdminOverview } from '../services/superAdminDashboardService'

const emptyValue = '—'

function MetricCard({ label, value, icon: Icon, tone = '', variant = '', comparison = null }) {
  return <article className={`sa-overall-metric ${tone} ${variant}`.trim()}>
    <div className="sa-overall-metric-top"><span className="sa-overall-metric-icon"><Icon size={18} strokeWidth={2.1} /></span><span className="sa-overall-metric-label">{label}</span></div>
    <strong className="sa-overall-metric-value">{value}</strong>
    <div className="sa-overall-metric-divider" />
    <div className="sa-overall-metric-bottom">{comparison ? <><span className={`sa-overall-change ${comparison.direction}`}>{comparison.value}</span><small>{comparison.label}</small></> : <small>All active branches</small>}</div>
  </article>
}

function AdmissionDonut({ data, isLoading }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0)
  let offset = 0
  const colors = ['#2f80ed', '#8b5cf6', '#10a978', '#f59e0b', '#ef6c78', '#4f9cf9']
  const gradient = data.length
    ? `conic-gradient(${data.map((item, index) => {
        const start = offset
        offset += (Number(item.value || 0) / Math.max(total, 1)) * 100
        return `${colors[index % colors.length]} ${start}% ${offset}%`
      }).join(', ')})`
    : '#eaf0f7'

  return <div className="sa-admission-donut-wrap">
    <div className={`sa-admission-donut ${isLoading ? 'is-loading' : ''}`} style={{ background: gradient }} aria-label={`Total ${total} admissions`}>
      <div className="sa-admission-donut-hole"><span>Total</span><strong>{isLoading ? '—' : total}</strong><span>Admissions</span></div>
    </div>
  </div>
}

function BarChart({ title, data, formatter, emptyMessage }) {
  const [hovered, setHovered] = useState(null)
  const max = Math.max(...data.flatMap((item) => [Number(item.expected) || 0, Number(item.actual) || 0]), 1)
  if (!data.length || data.every((item) => !Number(item.expected) && !Number(item.actual))) return <div className="sa-overall-chart-empty">{emptyMessage}</div>
  return <div className="sa-overall-chart" aria-label={title}>
    <div className="sa-overall-chart-y-label">Payment amount</div>
    <div className="sa-overall-bars">
      {data.map((item, index) => <div className="sa-overall-bar-group" key={`${item.label}-${index}`} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
        {hovered === index ? <div className="sa-overall-tooltip"><strong>{item.fullLabel || item.label}</strong><span>Expected: {formatter(item.expected)}</span><span>Actual: {formatter(item.actual)}</span><span>Difference: {formatter(Number(item.expected || 0) - Number(item.actual || 0))}</span></div> : null}
        <div className="sa-overall-bar-value">{Number(item.actual) ? formatter(item.actual) : ''}</div>
        <div className="sa-overall-bar-track sa-overall-grouped-track"><div className="sa-overall-bar sa-overall-bar-expected" style={{ height: `${Math.max(4, (Number(item.expected) / max) * 100)}%` }} /><div className="sa-overall-bar sa-overall-bar-actual" style={{ height: `${Math.max(4, (Number(item.actual) / max) * 100)}%` }} /></div>
        <span className="sa-overall-bar-label">{item.label}</span>
      </div>)}
    </div>
  </div>
}

export function SuperAdminOverallDashboard({ branches }) {
  const [overview, setOverview] = useState(null)
  const [period, setPeriod] = useState('daily')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try { setOverview(await getSuperAdminOverview(branches)) } catch (loadError) { setError(loadError?.message || 'Unable to load the overall dashboard.') } finally { setIsLoading(false) }
  }, [branches])

  useEffect(() => {
    const timerId = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timerId)
  }, [load])

  useEffect(() => {
    const handlePaymentHistoryChange = () => { void load() }
    window.addEventListener('cispro:branch-payment-history-changed', handlePaymentHistoryChange)
    return () => window.removeEventListener('cispro:branch-payment-history-changed', handlePaymentHistoryChange)
  }, [load])

  const chartData = useMemo(() => {
    if (!overview) return []
    if (period === 'weekly') return overview.weeklyPaymentData || []
    if (period === 'monthly') return overview.monthlyPaymentChartData || overview.monthlyPaymentData || []
    return overview.dailyPaymentData || []
  }, [overview, period])

  const getMonthComparison = (items = []) => {
    if (isLoading || !Array.isArray(items) || items.length < 2) return null
    const previous = Number(items[items.length - 2]?.value || 0)
    const current = Number(items[items.length - 1]?.value || 0)
    if (!previous) return null
    const percentage = ((current - previous) / previous) * 100
    return {
      value: `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1).replace('.0', '')}%`,
      label: 'vs last month',
      direction: percentage > 0 ? 'positive' : percentage < 0 ? 'negative' : 'neutral',
    }
  }

  const admissionsComparison = getMonthComparison(overview?.admissionsByMonth)
  const paymentComparison = getMonthComparison((overview?.monthlyPaymentData || []).map((item) => ({ ...item, value: item.actual ?? item.value })))
  const getDayComparison = (current, previous) => {
    if (isLoading || previous === undefined || previous === null) return null
    if (!Number(previous)) {
      return Number(current || 0) > 0
        ? { value: '+100%', label: 'vs yesterday', direction: 'positive' }
        : { value: '0%', label: 'vs yesterday', direction: 'neutral' }
    }
    const percentage = ((Number(current || 0) - Number(previous)) / Number(previous)) * 100
    return {
      value: `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1).replace('.0', '')}%`,
      label: 'vs yesterday',
      direction: percentage > 0 ? 'positive' : percentage < 0 ? 'negative' : 'neutral',
    }
  }
  const todayDueComparison = getDayComparison(overview?.todayDue, overview?.yesterdayDue)
  const todayCollectionComparison = getDayComparison(overview?.todayCollection, overview?.yesterdayCollection)
  const metric = (label, value, icon, tone, currency = true, variant = '', comparison = null) => <MetricCard label={label} value={isLoading ? emptyValue : currency ? formatOverviewCurrency(value) : (value ?? 0)} icon={icon} tone={tone} variant={variant} comparison={comparison} />

  return <div className="sa-overall-dashboard">
    <div className="sa-overall-intro"><div><p className="sa-overall-kicker"><LayoutDashboard size={15} /> Consolidated view</p><h1>Overall Dashboard</h1><p>Combined performance across every active branch.</p></div><div className="sa-overall-actions"><span className="sa-overall-scope"><Building2 size={15} /> All active branches</span><button type="button" className="sa-overall-refresh" onClick={() => void load()} disabled={isLoading}><RefreshCcw size={15} className={isLoading ? 'is-spinning' : ''} /> Refresh</button></div></div>
    {error ? <div className="sa-overall-alert"><AlertCircle size={18} /> <span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div> : null}
    <div className="sa-overall-metrics sa-overall-summary-grid" aria-label="Overall dashboard summary">
      {metric('Total branches', overview?.totalBranches, Building2, 'blue', false)}
      {metric('Total students', overview?.totalStudents, Users, 'purple', false)}
      {metric('This month admissions', overview?.thisMonthAdmissions, CalendarDays, 'orange', false, '', admissionsComparison)}
      {metric('Total payment collected', overview?.totalPayment, Wallet, 'blue')}
      {metric('This month payment', overview?.thisMonthPayment, IndianRupee, 'green', true, '', paymentComparison)}
      {metric('Total outstanding', overview?.totalOutstanding, Clock3, 'orange')}
      {metric('This month due', overview?.thisMonthDue, CalendarDays, 'purple')}
      {metric("Today's due", overview?.todayDue, Clock3, 'orange', true, '', todayDueComparison)}
      {metric('Overdue amount', overview?.overdueAmount, AlertCircle, 'red')}
      {metric('Due students', overview?.dueStudents, Users, 'purple', false)}
      {metric("Today's collection", overview?.todayCollection, Banknote, 'green', true, '', todayCollectionComparison)}
    </div>
    <div className="sa-overall-grid">
      <section className="sa-overall-panel sa-overall-admissions">
        <div className="sa-overall-panel-heading">
          <div><h2>Admission Overview</h2><p>Monthly admissions across all active branches</p></div>
          <span className="sa-overall-panel-icon"><Users size={18} /></span>
        </div>
        <div className="sa-admission-overview-content">
          <AdmissionDonut data={overview?.admissionsByMonth || []} isLoading={isLoading} />
          <div className="sa-admission-breakdown" aria-label="Monthly admission breakdown">
            {(overview?.admissionsByMonth || []).map((item, index, items) => <div className={`sa-admission-breakdown-row ${index === items.length - 1 ? 'is-current' : ''}`} key={item.key}><span className="sa-admission-dot" style={{ background: ['#2f80ed', '#8b5cf6', '#10a978', '#f59e0b', '#ef6c78', '#4f9cf9'][index % 6] }} /><span>{item.label}</span><strong>{isLoading ? '—' : item.value}</strong></div>)}
            {!isLoading && !(overview?.admissionsByMonth || []).length ? <span className="sa-admission-empty">No admission data available.</span> : null}
          </div>
          <div className="sa-admission-current-summary"><span>This Month</span><strong>{isLoading ? '—' : overview?.admissionsByMonth?.at(-1)?.value || 0}</strong><b>Admissions</b>{admissionsComparison ? <div><em className={admissionsComparison.direction}>{admissionsComparison.value}</em><small>{admissionsComparison.label}</small></div> : <small>All active branches</small>}</div>
        </div>
      </section>
      <section className="sa-overall-panel sa-overall-payments"><div className="sa-overall-panel-heading"><div><h2>Payment overview</h2><p>Expected vs actual collection across all active branches</p></div><div className="sa-payment-heading-actions"><div className="sa-overall-tabs" role="tablist">{['daily', 'weekly', 'monthly'].map((item) => <button key={item} type="button" className={period === item ? 'is-active' : ''} onClick={() => setPeriod(item)} role="tab" aria-selected={period === item}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div><span className="sa-overall-panel-icon"><IndianRupee size={18} /></span></div></div><div className="sa-payment-legend"><span><i className="is-expected" />Expected</span><span><i className="is-actual" />Actual</span></div>{isLoading ? <div className="sa-overall-skeleton sa-overall-chart-skeleton" /> : <BarChart title={`${period} payment overview`} data={chartData} formatter={formatOverviewCurrency} emptyMessage="No payment collection recorded for this period." />}</section>
    </div>
  </div>
}
