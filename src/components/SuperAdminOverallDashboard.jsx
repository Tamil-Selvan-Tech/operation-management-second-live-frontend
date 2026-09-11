import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, Banknote, CalendarDays, Check, Clock3, GripVertical, IndianRupee, LayoutDashboard, LayoutGrid, RefreshCcw, RotateCcw, Search, Users, Wallet, Building2, X,
} from 'lucide-react'
import { formatOverviewCurrency, getSuperAdminOverview } from '../services/superAdminDashboardService'
import { TrendingCourses } from './TrendingCourses'

const emptyValue = '—'
const DASHBOARD_LAYOUT_STORAGE_KEY = 'cispro:super-admin-dashboard-layout'
const DEFAULT_METRIC_ORDER = ['totalBranches', 'totalStudents', 'thisMonthAdmissions', 'totalPayment', 'thisMonthPayment', 'totalOutstanding', 'thisMonthDue', 'todayDue', 'overdueAmount', 'dueStudents', 'todayCollection']

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
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false)
  const [metricSearchQuery, setMetricSearchQuery] = useState('')
  const [metricLayout, setMetricLayout] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY) || 'null')
      if (!saved || !Array.isArray(saved.order)) return { order: DEFAULT_METRIC_ORDER, hidden: [] }
      return {
        order: [...new Set([...saved.order, ...DEFAULT_METRIC_ORDER])].filter((key) => DEFAULT_METRIC_ORDER.includes(key)),
        hidden: Array.isArray(saved.hidden) ? saved.hidden.filter((key) => DEFAULT_METRIC_ORDER.includes(key)) : [],
      }
    } catch {
      return { order: DEFAULT_METRIC_ORDER, hidden: [] }
    }
  })
  const [draggedMetric, setDraggedMetric] = useState(null)

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
  const metricDefinitions = {
    totalBranches: { label: 'Total branches', description: 'Total number of active branches on the dashboard', icon: Building2, tone: 'blue', node: metric('Total branches', overview?.totalBranches, Building2, 'blue', false) },
    totalStudents: { label: 'Total students', description: 'Total number of registered students on the dashboard', icon: Users, tone: 'purple', node: metric('Total students', overview?.totalStudents, Users, 'purple', false) },
    thisMonthAdmissions: { label: 'This month admissions', description: 'Total admissions in the current month', icon: CalendarDays, tone: 'orange', node: metric('This month admissions', overview?.thisMonthAdmissions, CalendarDays, 'orange', false, '', admissionsComparison) },
    totalPayment: { label: 'Total payment collected', description: 'Total amount collected across branches', icon: Wallet, tone: 'blue', node: metric('Total payment collected', overview?.totalPayment, Wallet, 'blue') },
    thisMonthPayment: { label: 'This month payment', description: 'Total payment received this month', icon: IndianRupee, tone: 'green', node: metric('This month payment', overview?.thisMonthPayment, IndianRupee, 'green', true, '', paymentComparison) },
    totalOutstanding: { label: 'Total outstanding', description: 'Total pending amount from students', icon: Clock3, tone: 'orange', node: metric('Total outstanding', overview?.totalOutstanding, Clock3, 'orange') },
    thisMonthDue: { label: 'This month due', description: 'Total amount due this month', icon: CalendarDays, tone: 'purple', node: metric('This month due', overview?.thisMonthDue, CalendarDays, 'purple') },
    todayDue: { label: "Today's due", description: 'Total amount due today', icon: Clock3, tone: 'orange', node: metric("Today's due", overview?.todayDue, Clock3, 'orange', true, '', todayDueComparison) },
    overdueAmount: { label: 'Overdue amount', description: 'Total overdue amount', icon: AlertCircle, tone: 'red', node: metric('Overdue amount', overview?.overdueAmount, AlertCircle, 'red') },
    dueStudents: { label: 'Due students', description: 'Students with pending payments', icon: Users, tone: 'purple', node: metric('Due students', overview?.dueStudents, Users, 'purple', false) },
    todayCollection: { label: "Today's collection", description: 'Total amount collected today', icon: Banknote, tone: 'green', node: metric("Today's collection", overview?.todayCollection, Banknote, 'green', true, '', todayCollectionComparison) },
  }

  const persistMetricLayout = (nextLayout) => {
    setMetricLayout(nextLayout)
    window.localStorage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(nextLayout))
  }
  const toggleMetric = (key) => persistMetricLayout({ ...metricLayout, hidden: metricLayout.hidden.includes(key) ? metricLayout.hidden.filter((item) => item !== key) : [...metricLayout.hidden, key] })
  const moveMetric = (targetKey) => {
    if (!draggedMetric || draggedMetric === targetKey) return
    const order = [...metricLayout.order]
    const fromIndex = order.indexOf(draggedMetric)
    const toIndex = order.indexOf(targetKey)
    order.splice(fromIndex, 1)
    order.splice(toIndex, 0, draggedMetric)
    persistMetricLayout({ ...metricLayout, order })
    setDraggedMetric(null)
  }
  const resetMetricLayout = () => persistMetricLayout({ order: DEFAULT_METRIC_ORDER, hidden: [] })

  return <div className="sa-overall-dashboard">
    <div className="sa-overall-intro"><div><p className="sa-overall-kicker"><LayoutDashboard size={15} /> Consolidated view</p><h1>Overall Dashboard</h1><p>Combined performance across every active branch.</p></div><div className="sa-overall-actions"><span className="sa-overall-scope"><Building2 size={15} /> All active branches</span><button type="button" className="sa-overall-customize" onClick={() => setIsCustomizeOpen(true)}><LayoutGrid size={17} /> Customize Dashboard</button><button type="button" className="sa-overall-refresh" onClick={() => void load()} disabled={isLoading}><RefreshCcw size={15} className={isLoading ? 'is-spinning' : ''} /> Refresh</button></div></div>
    {error ? <div className="sa-overall-alert"><AlertCircle size={18} /> <span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div> : null}
    <div className="sa-overall-metrics sa-overall-summary-grid" aria-label="Overall dashboard summary">
      {metricLayout.order.filter((key) => !metricLayout.hidden.includes(key)).map((key) => <div key={key}>{metricDefinitions[key].node}</div>)}
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
    <TrendingCourses courses={overview?.trendingCourses || []} month={overview?.trendingMonth} isLoading={isLoading} />
    {isCustomizeOpen ? <div className="sa-customize-backdrop" role="presentation">
      <section className="sa-customize-modal" role="dialog" aria-modal="true" aria-labelledby="sa-customize-title" onClick={(event) => event.stopPropagation()}>
        <div className="sa-customize-header"><div><h2 id="sa-customize-title">Customize Dashboard</h2><p>Choose the cards you want to display and arrange their order.</p></div><button type="button" className="sa-customize-close" onClick={() => setIsCustomizeOpen(false)} aria-label="Close customize dashboard"><X size={19} /></button></div>
        <div className="sa-customize-list">
          <div className="sa-customize-toolbar"><label className="sa-customize-search"><Search size={18} /><input type="search" value={metricSearchQuery} onChange={(event) => setMetricSearchQuery(event.target.value)} placeholder="Search widgets..." aria-label="Search dashboard cards" /></label><label className="sa-customize-select-all-control"><input type="checkbox" checked={metricLayout.hidden.length === 0} onChange={(event) => persistMetricLayout({ ...metricLayout, hidden: event.target.checked ? [] : [...metricLayout.order] })} /> <span>Select all</span></label><span className="sa-customize-selected-count">{metricLayout.order.length - metricLayout.hidden.length} selected</span></div>
          <div className="sa-customize-card-grid">{metricLayout.order.filter((key) => `${metricDefinitions[key].label} ${metricDefinitions[key].description}`.toLowerCase().includes(metricSearchQuery.trim().toLowerCase())).map((key) => { const item = metricDefinitions[key]; const Icon = item.icon; const isHidden = metricLayout.hidden.includes(key); return <label key={key} className={`sa-customize-item ${isHidden ? '' : 'is-selected'}`} draggable onDragStart={() => setDraggedMetric(key)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveMetric(key)}>
            <GripVertical className="sa-customize-drag" size={18} aria-hidden="true" /><span className={`sa-customize-item-icon ${item.tone}`}><Icon size={17} /></span><span className="sa-customize-item-copy"><strong>{item.label}</strong><small>{item.description}</small></span><input type="checkbox" checked={!isHidden} onChange={() => toggleMetric(key)} aria-label={`Show ${item.label}`} /><span className="sa-customize-check" aria-hidden="true">{!isHidden ? <Check size={14} strokeWidth={3} /> : null}</span>
          </label> })}</div>
        </div>
        <div className="sa-customize-footer"><button type="button" className="sa-customize-reset" onClick={resetMetricLayout}><RotateCcw size={15} /> Reset to Default</button><button type="button" className="sa-customize-done" onClick={() => persistMetricLayout(metricLayout)}>Save Changes</button></div>
      </section>
    </div> : null}
  </div>
}
