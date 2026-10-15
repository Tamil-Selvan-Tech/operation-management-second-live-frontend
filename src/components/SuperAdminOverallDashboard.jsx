import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, ArrowUpRight, Banknote, CalendarDays, Check, ChevronDown, Clock3, GripVertical, IndianRupee, LayoutDashboard, LayoutGrid, Pin, RefreshCcw, RotateCcw, Search, Users, Wallet, Building2, X,
} from 'lucide-react'
import { formatOverviewCurrency, getSuperAdminOverview } from '../services/superAdminDashboardService'
import { request } from '../services/apiClient'
import { TrendingCourses } from './TrendingCourses'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatSuperAdminDateRange, getSuperAdminDateRange, SUPER_ADMIN_DATE_PRESETS } from '../lib/superAdminDateRange'

const emptyValue = '—'
const DASHBOARD_LAYOUT_STORAGE_KEY = 'cispro:super-admin-dashboard-layout'
const DEFAULT_METRIC_ORDER = ['totalBranches', 'totalStudents', 'thisMonthAdmissions', 'totalPayment', 'thisMonthPayment', 'totalOutstanding', 'thisMonthDue', 'todayDue', 'overdueAmount', 'dueStudents', 'todayCollection']

function MetricCard({ label, value, icon: Icon, tone = '', variant = '', comparison = null, scopeLabel, isLoading = false, onClick = null, href = '' }) {
  const isClickable = typeof onClick === 'function'
  const handleKeyDown = (event) => {
    if (!isClickable || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onClick()
  }

  return <article className={`sa-overall-metric ${tone} ${variant} ${isLoading ? 'is-loading' : ''} ${isClickable ? 'is-clickable' : ''}`.trim()} role={isClickable ? 'link' : undefined} tabIndex={isClickable ? 0 : undefined} onClick={isClickable ? onClick : undefined} onKeyDown={isClickable ? handleKeyDown : undefined} aria-label={isClickable ? `Open ${label}` : undefined}>
    <div className="sa-overall-metric-top"><span className="sa-overall-metric-icon"><Icon size={18} strokeWidth={2.1} /></span><span className="sa-overall-metric-label">{label}</span>{isClickable ? <span className="sa-overall-metric-link-icon" aria-hidden="true"><ArrowUpRight size={18} strokeWidth={2.3} /></span> : null}</div>
    <strong className="sa-overall-metric-value">{isLoading ? <span className="sa-metric-skeleton-value" /> : value}</strong>
    <div className="sa-overall-metric-divider" />
    <div className="sa-overall-metric-bottom">{isLoading ? <span className="sa-metric-skeleton-meta" /> : comparison ? <><span className={`sa-overall-change ${comparison.direction}`}>{comparison.value}</span><small>{comparison.label}</small></> : <small>{scopeLabel}</small>}</div>
  </article>
}

function AdmissionBarChart({ data, isLoading }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0)
  const colors = ['#2f80ed', '#8b5cf6', '#10a978', '#f59e0b', '#ef6c78', '#4f9cf9']
  const max = Math.max(...data.map((item) => Number(item.value) || 0), 1)

  if (isLoading) {
    return <div className="sa-admission-bar-wrap sa-section-skeleton" aria-label="Loading admissions overview"><div className="sa-admission-bars-skeleton">{[1, 2, 3, 4, 5, 6].map((item) => <span key={item} />)}</div></div>
  }

  return <div className="sa-admission-bar-wrap">
    <div className={`sa-admission-bars ${isLoading ? 'is-loading' : ''}`} aria-label={`Total ${total} admissions`}>
      {data.map((item, index) => (
        <div className="sa-admission-bar-column" key={item.key || `${item.label}-${index}`}>
          <strong>{isLoading ? 'â€”' : item.value}</strong>
          <div className="sa-admission-bar-track"><span style={{ height: `${Math.max(4, ((Number(item.value) || 0) / max) * 100)}%`, background: colors[index % colors.length] }} /></div>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  </div>

  /* Legacy donut markup retained below for styling compatibility. */
  /*
  return <div className="sa-admission-donut-wrap">
    <div className={`sa-admission-donut ${isLoading ? 'is-loading' : ''}`} style={{ background: '#eaf0f7' }} aria-label={`Total ${total} admissions`}>
      <div className="sa-admission-donut-hole"><span>Total</span><strong>{isLoading ? '—' : total}</strong><span>Admissions</span></div>
    </div>
  </div>
  */
}

function BarChart({ title, data, formatter, emptyMessage }) {
  const [hovered, setHovered] = useState(null)
  const max = Math.max(...data.flatMap((item) => [Number(item.expected) || 0, Number(item.actual) || 0]), 1)
  if (!data.length || data.every((item) => !Number(item.expected) && !Number(item.actual))) return <div className="sa-overall-chart-empty">{emptyMessage}</div>
  return <div className="sa-overall-chart" aria-label={title}>
    <div className="sa-overall-chart-y-label">Payment amount</div>
    <div className="sa-overall-bars">
      {data.map((item, index) => <div className="sa-overall-bar-group" key={`${item.label}-${index}`} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
        {hovered === index ? <div className="sa-overall-tooltip"><strong>{item.fullLabel || item.label}</strong><span>Expected: {formatter(item.expected)}</span><span>Actual: {formatter(item.actual)}</span></div> : null}
        <div className="sa-overall-bar-value">{Number(item.actual) ? formatter(item.actual) : ''}</div>
        <div className="sa-overall-bar-track sa-overall-grouped-track"><div className="sa-overall-bar sa-overall-bar-expected" style={{ height: `${Math.max(4, (Number(item.expected) / max) * 100)}%` }} /><div className="sa-overall-bar sa-overall-bar-actual" style={{ height: `${Math.max(4, (Number(item.actual) / max) * 100)}%` }} /></div>
        <span className="sa-overall-bar-label">{item.label}</span>
      </div>)}
    </div>
  </div>
}

function BranchPerformanceSkeletonRows() {
  return <>{[1, 2, 3, 4].map((row) => <tr className="sa-branch-performance-skeleton-row" key={row}>{[1, 2, 3, 4, 5, 6, 7].map((cell) => <td key={cell}><span /></td>)}</tr>)}</>
}

export function SuperAdminOverallDashboard({ branches, userKey = 'super-admin', onOpenStudent360 }) {
  const location = useLocation()
  const navigate = useNavigate()
  const branchIdFromUrl = new URLSearchParams(location.search).get('branchId') || ''
  const activeBranches = useMemo(() => (Array.isArray(branches) ? branches : []).filter((branch) => String(branch?.status || '').toLowerCase() === 'active'), [branches])
  const selectedBranch = useMemo(() => activeBranches.find((branch) => String(branch.branchId || branch.id) === branchIdFromUrl) || null, [activeBranches, branchIdFromUrl])
  const [branchQuery, setBranchQuery] = useState('')
  const [isBranchSearchOpen, setIsBranchSearchOpen] = useState(false)
  const [allStudents, setAllStudents] = useState([])
  const [overview, setOverview] = useState(null)
  const [branchPerformance, setBranchPerformance] = useState([])
  const [branchPerformanceHasData, setBranchPerformanceHasData] = useState(true)
  const [period, setPeriod] = useState('daily')
  const [isLoading, setIsLoading] = useState(true)
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false)
  const [branchPerformanceSort, setBranchPerformanceSort] = useState('branchName')
  const [branchPerformancePeriod, setBranchPerformancePeriod] = useState('thisMonth')
  const [branchPerformanceStartDate, setBranchPerformanceStartDate] = useState('')
  const [branchPerformanceEndDate, setBranchPerformanceEndDate] = useState('')
  const [isMetricSaving, setIsMetricSaving] = useState(false)
  const [metricSearchQuery, setMetricSearchQuery] = useState('')
  const layoutStorageKey = `${DASHBOARD_LAYOUT_STORAGE_KEY}:${String(userKey || 'super-admin')}`
  const [metricLayout, setMetricLayout] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(layoutStorageKey) || window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY) || 'null')
      if (!saved || !Array.isArray(saved.order)) return { order: DEFAULT_METRIC_ORDER, hidden: [] }
      return {
        order: [...new Set([...saved.order, ...DEFAULT_METRIC_ORDER])].filter((key) => DEFAULT_METRIC_ORDER.includes(key)),
        hidden: Array.isArray(saved.hidden) ? saved.hidden.filter((key) => DEFAULT_METRIC_ORDER.includes(key)) : [],
        pinned: Array.isArray(saved.pinned) ? saved.pinned.filter((key) => DEFAULT_METRIC_ORDER.includes(key)) : [],
      }
    } catch {
      return { order: DEFAULT_METRIC_ORDER, hidden: [], pinned: [] }
    }
  })
  const savedMetricLayoutRef = useRef(metricLayout)
  const [draggedMetric, setDraggedMetric] = useState(null)
  const [datePreset, setDatePreset] = useState('thisMonth')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [appliedDateRange, setAppliedDateRange] = useState(null)
  const [dateFilterError, setDateFilterError] = useState('')
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)
  const [draftStartDate, setDraftStartDate] = useState('')
  const [draftEndDate, setDraftEndDate] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    setOverview(null)
    try {
      const nextOverview = await getSuperAdminOverview(selectedBranch?.branchId || branchIdFromUrl || null, appliedDateRange ? {
        period: appliedDateRange.preset === 'custom' ? 'customrange' : appliedDateRange.preset,
        startDate: appliedDateRange.startDate,
        endDate: appliedDateRange.endDate,
      } : {})
      setOverview(nextOverview)
    } catch (loadError) {
      setError(loadError?.status === 404 ? 'No matching branch found.' : 'Unable to load branch dashboard data.')
    } finally {
      setIsLoading(false)
    }
  }, [appliedDateRange, branchIdFromUrl, selectedBranch?.branchId])

  const loadBranchPerformance = useCallback(async () => {
    if (branchPerformancePeriod === 'customRange' && (!branchPerformanceStartDate || !branchPerformanceEndDate || branchPerformanceStartDate > branchPerformanceEndDate)) return
    setIsPerformanceLoading(true)
    try {
      const nextOverview = await getSuperAdminOverview(selectedBranch?.branchId || branchIdFromUrl || null, {
        period: branchPerformancePeriod,
        startDate: branchPerformanceStartDate,
        endDate: branchPerformanceEndDate,
      })
      setBranchPerformance(nextOverview?.branchPerformance || [])
      setBranchPerformanceHasData(nextOverview?.branchPerformanceHasData !== false)
    } catch (loadError) {
      setBranchPerformance([])
      setBranchPerformanceHasData(false)
      setError(loadError?.status === 404 ? 'No matching branch found.' : 'Unable to load branch performance.')
    } finally {
      setIsPerformanceLoading(false)
    }
  }, [branchIdFromUrl, branchPerformanceEndDate, branchPerformancePeriod, branchPerformanceStartDate, selectedBranch?.branchId])

  useEffect(() => {
    const timerId = window.setTimeout(() => { void load() }, 0)
    const handleDiscontinuationApproved = () => { void load() }
    window.addEventListener('cispro:discontinuation-approved', handleDiscontinuationApproved)
    return () => {
      window.clearTimeout(timerId)
      window.removeEventListener('cispro:discontinuation-approved', handleDiscontinuationApproved)
    }
  }, [load])

  useEffect(() => {
    const timerId = window.setTimeout(() => { void loadBranchPerformance() }, 0)
    return () => window.clearTimeout(timerId)
  }, [loadBranchPerformance])

  useEffect(() => {
    if (!Array.isArray(branches) || !branches.length) {
      setAllStudents([])
      return undefined
    }

    let cancelled = false
    const loadStudents = async () => {
      const results = await Promise.all(branches.map(async (branch) => {
        const branchId = branch?.id || branch?.branchId
        if (!branchId) return []

        try {
          const response = await request(`/branch-students?page=1&limit=100&sortBy=createdAt&sortOrder=desc&branchId=${encodeURIComponent(branchId)}`, {
            impersonateBranchId: branchId,
          })
          const payload = response?.data ?? response
          const rows = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload?.items)
                ? payload.items
                : Array.isArray(payload?.records)
                  ? payload.records
                  : []
          return rows.map((student) => ({
            ...student,
            branchId: student.branchId || student.branchCode || branchId,
            branchRecord: branch,
          }))
        } catch {
          return []
        }
      }))

      if (!cancelled) setAllStudents(results.flat())
    }

    void loadStudents()
    return () => {
      cancelled = true
    }
  }, [branches])

  useEffect(() => {
    const handlePaymentHistoryChange = () => { void load() }
    window.addEventListener('cispro:branch-payment-history-changed', handlePaymentHistoryChange)
    return () => window.removeEventListener('cispro:branch-payment-history-changed', handlePaymentHistoryChange)
  }, [load])

  const chartData = useMemo(() => {
    if (!overview) return []
    if (period === 'weekly') return overview.paymentOverview?.weekly || overview.weeklyPaymentData || []
    if (period === 'monthly') return overview.paymentOverview?.monthly || overview.monthlyPaymentChartData || overview.monthlyPaymentData || []
    return overview.paymentOverview?.daily || overview.dailyPaymentData || []
  }, [overview, period])

  const getMonthComparison = (items = []) => {
    if (isLoading || !Array.isArray(items) || items.length < 2) return null
    const previous = Number(items[items.length - 2]?.value || 0)
    const current = Number(items[items.length - 1]?.value || 0)
    if (!previous) return null
    const percentage = Math.min(100, ((current - previous) / previous) * 100)
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
    const percentage = Math.min(100, ((Number(current || 0) - Number(previous)) / Number(previous)) * 100)
    return {
      value: `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1).replace('.0', '')}%`,
      label: 'vs yesterday',
      direction: percentage > 0 ? 'positive' : percentage < 0 ? 'negative' : 'neutral',
    }
  }
  const todayDueComparison = getDayComparison(overview?.todayDue, overview?.yesterdayDue)
  const todayCollectionComparison = getDayComparison(overview?.todayCollection, overview?.yesterdayCollection)
  const scopeLabel = selectedBranch ? `${selectedBranch.branchName} Branch` : ''
  const metricPeriodLabel = appliedDateRange ? 'Selected period' : 'This month'
  const metricLinks = {
    'Total branches': '/dashboard/super-admin?section=branches',
    'Total students': '/dashboard/super-admin?section=students',
    'Selected period admissions': '/dashboard/super-admin?section=metric-admissions',
    'This month admissions': '/dashboard/super-admin?section=metric-admissions',
    'Selected period payment': '/dashboard/super-admin?section=metric-month-payment',
    'This month payment': '/dashboard/super-admin?section=metric-month-payment',
    'Total outstanding': '/dashboard/super-admin?section=metric-outstanding',
    'Selected period due': '/dashboard/super-admin?section=metric-month-due',
    'This month due': '/dashboard/super-admin?section=metric-month-due',
    'Due at period end': '/dashboard/super-admin?section=metric-today-due',
    "Today's due": '/dashboard/super-admin?section=metric-today-due',
    'Overdue amount': '/dashboard/super-admin?section=metric-overdue',
    'Period collection': '/dashboard/super-admin?section=metric-today-collection',
    "Today's collection": '/dashboard/super-admin?section=metric-today-collection',
  }
  const metric = (label, value, icon, tone, currency = true, variant = '', comparison = null) => {
    const baseHref = metricLinks[label]
    const href = baseHref && appliedDateRange
      ? `${baseHref}&startDate=${encodeURIComponent(appliedDateRange.startDate || '')}&endDate=${encodeURIComponent(appliedDateRange.endDate || '')}`
      : baseHref
    return <MetricCard label={selectedBranch && label === 'Total branches' ? 'Selected branch' : label} value={isLoading ? emptyValue : selectedBranch && label === 'Total branches' ? `${selectedBranch.branchName}` : currency ? formatOverviewCurrency(value) : (value ?? 0)} icon={icon} tone={tone} variant={variant} comparison={comparison} scopeLabel={scopeLabel} isLoading={isLoading} href={href} onClick={href ? () => navigate(href) : null} />
  }
  const metricDefinitions = {
    totalBranches: { label: 'Total branches', description: 'Total number of active branches on the dashboard', icon: Building2, tone: 'blue', node: metric('Total branches', overview?.totalBranches, Building2, 'blue', false) },
    totalStudents: { label: 'Total students', description: 'Total number of registered students on the dashboard', icon: Users, tone: 'purple', node: metric('Total students', overview?.totalStudents, Users, 'purple', false) },
    thisMonthAdmissions: { label: `${metricPeriodLabel} admissions`, description: 'Admissions recorded in the selected period', icon: CalendarDays, tone: 'orange', node: metric(`${metricPeriodLabel} admissions`, overview?.thisMonthAdmissions, CalendarDays, 'orange', false, '', admissionsComparison) },
    totalPayment: { label: 'Total payment collected', description: 'Total amount collected across branches', icon: Wallet, tone: 'blue', node: metric('Total payment collected', overview?.totalPayment, Wallet, 'blue') },
    thisMonthPayment: { label: `${metricPeriodLabel} payment`, description: 'Total payment received in the selected period', icon: IndianRupee, tone: 'green', node: metric(`${metricPeriodLabel} payment`, overview?.thisMonthPayment, IndianRupee, 'green', true, '', paymentComparison) },
    totalOutstanding: { label: 'Total outstanding', description: 'Total pending amount from students', icon: Clock3, tone: 'orange', node: metric('Total outstanding', overview?.totalOutstanding, Clock3, 'orange') },
    thisMonthDue: { label: `${metricPeriodLabel} due`, description: 'Total amount due in the selected period', icon: CalendarDays, tone: 'purple', node: metric(`${metricPeriodLabel} due`, overview?.thisMonthDue, CalendarDays, 'purple') },
    todayDue: { label: appliedDateRange ? 'Due at period end' : "Today's due", description: 'Total amount due at the selected period end', icon: Clock3, tone: 'orange', node: metric(appliedDateRange ? 'Due at period end' : "Today's due", overview?.todayDue, Clock3, 'orange', true, '', todayDueComparison) },
    overdueAmount: { label: 'Overdue amount', description: 'Total overdue amount', icon: AlertCircle, tone: 'red', node: metric('Overdue amount', overview?.overdueAmount, AlertCircle, 'red') },
    dueStudents: { label: 'Due students', description: 'Students with pending payments', icon: Users, tone: 'purple', node: metric('Due students', overview?.dueStudents, Users, 'purple', false) },
    todayCollection: { label: appliedDateRange ? 'Period collection' : "Today's collection", description: 'Total amount collected in the selected period', icon: Banknote, tone: 'green', node: metric(appliedDateRange ? 'Period collection' : "Today's collection", overview?.todayCollection, Banknote, 'green', true, '', todayCollectionComparison) },
  }

  const persistMetricLayout = (nextLayout) => {
    savedMetricLayoutRef.current = nextLayout
    setMetricLayout(nextLayout)
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(nextLayout))
  }
  const toggleMetric = (key) => setMetricLayout({ ...metricLayout, hidden: metricLayout.hidden.includes(key) ? metricLayout.hidden.filter((item) => item !== key) : [...metricLayout.hidden, key] })
  const moveMetric = (targetKey) => {
    if (!draggedMetric || draggedMetric === targetKey) return
    const order = [...metricLayout.order]
    const fromIndex = order.indexOf(draggedMetric)
    const toIndex = order.indexOf(targetKey)
    order.splice(fromIndex, 1)
    order.splice(toIndex, 0, draggedMetric)
    setMetricLayout({ ...metricLayout, order })
    setDraggedMetric(null)
  }
  const toggleMetricPin = (key) => {
    setMetricLayout({ ...metricLayout, pinned: metricLayout.pinned?.includes(key) ? metricLayout.pinned.filter((item) => item !== key) : [...(metricLayout.pinned || []), key] })
  }
  const resetMetricLayout = () => {
    persistMetricLayout({ order: DEFAULT_METRIC_ORDER, hidden: [], pinned: [] })
  }
  const saveMetricLayout = () => {
    setIsMetricSaving(true)
    persistMetricLayout(metricLayout)
    window.setTimeout(() => {
      setIsMetricSaving(false)
      setIsCustomizeOpen(false)
    }, 450)
  }
  const orderedMetricKeys = [...metricLayout.order].sort((left, right) => Number(metricLayout.pinned?.includes(right)) - Number(metricLayout.pinned?.includes(left)))

  const matchingStudents = useMemo(() => {
    const query = branchQuery.trim().toLowerCase()
    if (!query || selectedBranch) return []

    return allStudents.filter((student) => {
      const studentId = String(student.studentId || student.studentCode || student.id || '').trim().toLowerCase()
      const studentName = String(student.studentName || student.name || '').trim().toLowerCase()
      return studentId.includes(query) || studentName.includes(query)
    }).slice(0, 8)
  }, [allStudents, branchQuery, selectedBranch])
  const matchingBranches = useMemo(() => {
    const query = branchQuery.trim().toLowerCase()
    const branchMatches = activeBranches.filter((branch) => `${branch.branchId} ${branch.branchName} ${branch.branchCity || branch.branchDistrict || ''}`.toLowerCase().includes(query))
    const studentMatches = matchingStudents.map((student) => ({
      id: `student-${student.id || student.studentId || student.studentCode}`,
      branchId: student.studentId || student.studentCode || student.id,
      branchName: student.studentName || student.name || 'Student',
      branchCity: `${student.branchRecord?.branchName || 'Branch'} · Student 360`,
      __student: student,
    }))
    return [...studentMatches, ...branchMatches].slice(0, 8)
  }, [activeBranches, branchQuery, matchingStudents])
  const selectBranch = (branch) => {
    if (branch.__student) {
      selectStudent(branch.__student)
      return
    }
    setBranchQuery('')
    setIsBranchSearchOpen(false)
    navigate(`${location.pathname}?branchId=${encodeURIComponent(branch.branchId)}`)
  }
  const selectStudent = (student) => {
    setBranchQuery('')
    setIsBranchSearchOpen(false)
    onOpenStudent360?.({
      student,
      branch: student.branchRecord,
    })
  }
  const clearBranch = () => { setBranchQuery(''); setIsBranchSearchOpen(false); navigate(location.pathname) }
  const resetDateFilter = () => { setDatePreset('thisMonth'); setCustomStartDate(''); setCustomEndDate(''); setDateFilterError(''); setAppliedDateRange(null); setIsDatePopoverOpen(false) }
  const selectDatePreset = (preset) => { setDatePreset(preset); setDateFilterError(''); if (preset !== 'custom') setAppliedDateRange(getSuperAdminDateRange(preset, customStartDate, customEndDate)); setIsDatePopoverOpen(false) }
  const openDatePopover = () => { setDatePreset('custom'); setDateFilterError(''); setDraftStartDate(customStartDate || appliedDateRange?.startDate || ''); setDraftEndDate(customEndDate || appliedDateRange?.endDate || ''); setIsDatePopoverOpen(true) }
  const applyCustomDateFilter = () => { const nextRange = getSuperAdminDateRange('custom', draftStartDate, draftEndDate); if (!nextRange) { setDateFilterError('Please select a valid date range. The end date must not be earlier than the start date.'); return } setCustomStartDate(draftStartDate); setCustomEndDate(draftEndDate); setDateFilterError(''); setAppliedDateRange(nextRange); setIsDatePopoverOpen(false) }
  const cancelDatePopover = () => { setDatePreset(appliedDateRange?.preset || 'thisMonth'); setDateFilterError(''); setIsDatePopoverOpen(false) }
  const branchPerformanceRows = useMemo(() => {
    const rows = branchPerformance
    return [...rows].sort((left, right) => {
      if (branchPerformanceSort === 'branchName') return left.branchName.localeCompare(right.branchName)
      const value = branchPerformanceSort === 'admissions' ? 'thisMonthAdmissions' : branchPerformanceSort === 'collection' ? 'collection' : branchPerformanceSort
      return Number(right[value] ?? -1) - Number(left[value] ?? -1)
    })
  }, [branchPerformance, branchPerformanceSort])

  const activeDateLabel = appliedDateRange ? formatSuperAdminDateRange(appliedDateRange) : 'Default dashboard view'
  return <div className="sa-overall-dashboard">
    <div className="sa-overall-intro"><div><p className="sa-overall-kicker"><LayoutDashboard size={15} /> {selectedBranch ? 'Branch view' : 'Consolidated view'}</p><h1>Overall Dashboard</h1><p>{selectedBranch ? `Showing complete performance data for ${selectedBranch.branchName} Branch.` : 'Combined performance across every active branch.'}</p></div><div className="sa-overall-actions"><div className="sa-branch-search-wrap"><label className="sa-branch-search"><span className="sa-branch-search-icon" aria-hidden="true"><Search size={16} /></span><input value={selectedBranch ? `${selectedBranch.branchName} Branch • ${selectedBranch.branchId}` : branchQuery} onChange={(event) => { setBranchQuery(event.target.value); setIsBranchSearchOpen(true) }} onFocus={() => setIsBranchSearchOpen(true)} placeholder="Search branch by ID or branch name..." aria-label="Search branch by ID or branch name" />{selectedBranch ? <button type="button" onClick={clearBranch} aria-label="Clear selected branch"><X size={16} /></button> : null}</label>{isBranchSearchOpen && !selectedBranch && branchQuery.trim() ? <div className="sa-branch-search-results">{matchingBranches.length ? matchingBranches.map((branch) => <button type="button" key={branch.id || branch.branchId} onMouseDown={() => selectBranch(branch)}><strong>{branch.branchName} Branch</strong><span>{branch.branchId} · {branch.branchCity || branch.branchDistrict || 'Location unavailable'} · Active</span></button>) : <p>No matching branch found.</p>}</div> : null}</div><span className="sa-overall-scope"><Building2 size={15} /> {selectedBranch ? `${selectedBranch.branchName} Branch` : 'All active branches'}</span><button type="button" className="sa-overall-customize" onClick={() => { setMetricLayout(savedMetricLayoutRef.current); setIsCustomizeOpen(true) }}><LayoutGrid size={17} /> Customize Dashboard</button><button type="button" className="sa-overall-refresh" onClick={() => void load()} disabled={isLoading}><RefreshCcw size={15} className={isLoading ? 'is-spinning' : ''} /> Refresh</button></div></div>
    <section className="sa-date-filter" aria-label="Dashboard date range filter">
      <div className="sa-date-filter-heading"><div><strong>Date range</strong><span>Applied: {activeDateLabel}</span></div>{isLoading ? <span className="sa-date-filter-loading">Updating dashboard…</span> : null}</div>
      <div className="sa-date-filter-toolbar"><div className="sa-branch-search-wrap sa-date-filter-branch-search"><label className="sa-branch-search"><span className="sa-branch-search-icon" aria-hidden="true"><Search size={16} /></span><input value={selectedBranch ? `${selectedBranch.branchName} Branch • ${selectedBranch.branchId}` : branchQuery} onChange={(event) => { setBranchQuery(event.target.value); setIsBranchSearchOpen(true) }} onFocus={() => setIsBranchSearchOpen(true)} placeholder="Search branch by ID or branch name..." aria-label="Search branch by ID or branch name" />{selectedBranch ? <button type="button" onClick={clearBranch} aria-label="Clear selected branch"><X size={16} /></button> : null}</label>{isBranchSearchOpen && !selectedBranch && branchQuery.trim() ? <div className="sa-branch-search-results">{matchingBranches.length ? matchingBranches.map((branch) => <button type="button" key={branch.id || branch.branchId} onMouseDown={() => selectBranch(branch)}><strong>{branch.branchName} Branch</strong><span>{branch.branchId} · {branch.branchCity || branch.branchDistrict || 'Location unavailable'} · Active</span></button>) : <p>No matching branch found.</p>}</div> : null}</div><label className="sa-date-filter-preset-select"><span>Preset</span><select value={datePreset} onChange={(event) => event.target.value === 'custom' ? openDatePopover() : selectDatePreset(event.target.value)} aria-label="Date range preset">{SUPER_ADMIN_DATE_PRESETS.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label><div className="sa-date-filter-range-wrap"><button type="button" className={`sa-date-filter-range-field ${datePreset === 'custom' ? 'is-custom' : ''}`} onClick={openDatePopover} aria-expanded={isDatePopoverOpen} aria-haspopup="dialog"><CalendarDays size={16} /><span>{appliedDateRange ? formatSuperAdminDateRange(appliedDateRange) : 'Select date range'}</span><ChevronDown size={15} /></button>{isDatePopoverOpen ? <div className="sa-date-filter-popover" role="dialog" aria-label="Choose custom date range"><div className="sa-date-filter-popover-header"><strong>Custom date range</strong><button type="button" onClick={cancelDatePopover} aria-label="Close date range picker"><X size={15} /></button></div><div className="sa-date-filter-custom"><label>From date<input type="date" value={draftStartDate} onChange={(event) => { setDraftStartDate(event.target.value); setDateFilterError('') }} /></label><span className="sa-date-filter-to">to</span><label>To date<input type="date" min={draftStartDate || undefined} value={draftEndDate} onChange={(event) => { setDraftEndDate(event.target.value); setDateFilterError('') }} /></label></div><div className="sa-date-filter-selection">{draftStartDate && draftEndDate ? formatSuperAdminDateRange({ startDate: draftStartDate, endDate: draftEndDate }) : 'Choose a start and end date'}</div>{dateFilterError ? <p className="sa-date-filter-error" role="alert">{dateFilterError}</p> : null}<div className="sa-date-filter-actions"><button type="button" className="sa-date-filter-cancel" onClick={cancelDatePopover}>Cancel</button><button type="button" className="sa-date-filter-apply" onClick={applyCustomDateFilter} disabled={isLoading}>Apply</button></div></div> : null}</div><button type="button" className="sa-date-filter-reset" onClick={resetDateFilter} disabled={isLoading && !appliedDateRange}>Reset</button></div>{dateFilterError && !isDatePopoverOpen ? <p className="sa-date-filter-error" role="alert">{dateFilterError}</p> : null}
    </section>
    {error ? <div className="sa-overall-alert"><AlertCircle size={18} /> <span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div> : null}
    <div className="sa-overall-metrics sa-overall-summary-grid" aria-label="Overall dashboard summary">
      {orderedMetricKeys.filter((key) => !metricLayout.hidden.includes(key)).map((key) => <div key={key}>{metricDefinitions[key].node}</div>)}
    </div>
    <div className="sa-overall-grid">
      <section className="sa-overall-panel sa-overall-admissions">
        <div className="sa-overall-panel-heading">
          <div><h2>Admission Overview</h2><p>Monthly admissions · {scopeLabel}</p></div>
          <span className="sa-overall-panel-icon"><Users size={18} /></span>
        </div>
        <div className="sa-admission-overview-content">
          <AdmissionBarChart data={overview?.admissionsByMonth || []} isLoading={isLoading} />
          <div className="sa-admission-breakdown" aria-label="Monthly admission breakdown">
            {(overview?.admissionsByMonth || []).map((item, index, items) => <div className={`sa-admission-breakdown-row ${index === items.length - 1 ? 'is-current' : ''}`} key={item.key}><span className="sa-admission-dot" style={{ background: ['#2f80ed', '#8b5cf6', '#10a978', '#f59e0b', '#ef6c78', '#4f9cf9'][index % 6] }} /><span>{item.label}</span><strong>{isLoading ? '—' : item.value}</strong></div>)}
            {!isLoading && !(overview?.admissionsByMonth || []).length ? <span className="sa-admission-empty">No admission data available.</span> : null}
          </div>
          <div className="sa-admission-current-summary"><span>This Month</span><strong>{isLoading ? '—' : overview?.admissionsByMonth?.at(-1)?.value || 0}</strong><b>Admissions</b>{admissionsComparison ? <div><em className={admissionsComparison.direction}>{admissionsComparison.value}</em><small>{admissionsComparison.label}</small></div> : <small>All active branches</small>}</div>
        </div>
      </section>
      <section className="sa-overall-panel sa-overall-payments"><div className="sa-overall-panel-heading"><div><h2>Payment overview</h2><p>Expected vs actual collection · {scopeLabel}</p></div><div className="sa-payment-heading-actions"><select className="sa-payment-period-select" value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Payment overview period"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select><span className="sa-overall-panel-icon"><IndianRupee size={18} /></span></div></div><div className="sa-payment-legend"><span><i className="is-expected" />Expected</span><span><i className="is-actual" />Actual</span></div>{isLoading ? <div className="sa-overall-skeleton sa-overall-chart-skeleton" /> : <BarChart title={`${period} payment overview`} data={chartData} formatter={formatOverviewCurrency} emptyMessage="No payment data available for this period." />}</section>
    </div>
    <TrendingCourses courses={overview?.trendingCourses || []} month={overview?.trendingMonth} isLoading={isLoading} />
    <section className="sa-branch-performance" aria-labelledby="branch-performance-title">
      <div className="sa-branch-performance-header"><div><h2 id="branch-performance-title">Branch Performance</h2><p>Detailed performance across all active branches</p></div><div className="sa-branch-performance-controls"><label><span>Period:</span><select aria-label="Branch performance period" value={branchPerformancePeriod} onChange={(event) => setBranchPerformancePeriod(event.target.value)}><option value="thisMonth">This Month</option><option value="previousMonth">Previous Month</option><option value="last3Months">Last 3 Months</option><option value="last6Months">Last 6 Months</option><option value="thisYear">This Year</option><option value="customRange">Custom Range</option></select></label><label><span>Sort:</span><select aria-label="Sort branch performance" value={branchPerformanceSort} onChange={(event) => setBranchPerformanceSort(event.target.value)}><option value="branchName">Branch Name</option><option value="totalStudents">Total Students</option><option value="admissions">This Month Admissions</option><option value="collection">Revenue / Collection</option><option value="due">Due</option><option value="outstanding">Outstanding</option><option value="attendance">Attendance</option></select></label>{branchPerformancePeriod === 'customRange' ? <div className="sa-branch-performance-date-range"><input type="date" aria-label="Performance start date" value={branchPerformanceStartDate} onChange={(event) => setBranchPerformanceStartDate(event.target.value)} /><span>to</span><input type="date" aria-label="Performance end date" value={branchPerformanceEndDate} onChange={(event) => setBranchPerformanceEndDate(event.target.value)} /></div> : null}</div></div>
      <div className="sa-branch-performance-table-wrap"><table className="sa-branch-performance-table"><colgroup><col className="sa-branch-col" /><col /><col /><col /><col /><col /><col /></colgroup><thead><tr><th>Branch</th><th>Total Students</th><th>This Month Admissions</th><th>Revenue</th><th>Due</th><th>Outstanding</th><th>Attendance</th></tr></thead><tbody>{isPerformanceLoading ? <BranchPerformanceSkeletonRows /> : branchPerformanceHasData === false ? <tr><td colSpan="7" className="sa-branch-performance-empty"><strong>No Data Available</strong><small>No performance data found for this period.</small></td></tr> : branchPerformanceRows.length ? branchPerformanceRows.map((branch) => <tr key={branch.branchId}><th scope="row" title={branch.branchName}><span className="sa-branch-name-line"><i className="sa-branch-status-dot" /> <strong>{branch.branchName}</strong></span><small>{branch.branchId}</small></th><td>{branch.totalStudents}</td><td>{branch.thisMonthAdmissions}</td><td className="sa-branch-performance-money">{formatOverviewCurrency(branch.collection)}</td><td className="sa-branch-performance-money"><span className="sa-performance-value">{formatOverviewCurrency(branch.due)}</span></td><td className="sa-branch-performance-money"><span className="sa-performance-value">{formatOverviewCurrency(branch.outstanding)}</span></td><td><span className={`sa-branch-attendance-badge ${branch.attendance == null ? 'is-empty' : branch.attendance >= 90 ? 'is-good' : branch.attendance >= 75 ? 'is-neutral' : 'is-warning'}`}>{branch.attendance == null ? '—' : `${branch.attendance}%`}</span></td></tr>) : <tr><td colSpan="7" className="sa-branch-performance-empty">No active branches available</td></tr>}</tbody></table></div>{branchPerformanceHasData !== false ? <div className="sa-branch-performance-footer">Showing {branchPerformanceRows.length} active {branchPerformanceRows.length === 1 ? 'branch' : 'branches'}</div> : null}
    </section>
    {isCustomizeOpen ? <div className="sa-customize-backdrop" role="presentation">
      <section className="sa-customize-modal" role="dialog" aria-modal="true" aria-labelledby="sa-customize-title" onClick={(event) => event.stopPropagation()}>
        <div className="sa-customize-header"><div><h2 id="sa-customize-title">Customize Dashboard</h2><p>Choose the cards you want to display and arrange their order.</p></div><button type="button" className="sa-customize-close" onClick={() => { setMetricLayout(savedMetricLayoutRef.current); setIsCustomizeOpen(false) }} aria-label="Close customize dashboard"><X size={19} /></button></div>
        <div className="sa-customize-list">
          <div className="sa-customize-toolbar"><label className="sa-customize-search"><Search size={18} /><input type="search" value={metricSearchQuery} onChange={(event) => setMetricSearchQuery(event.target.value)} placeholder="Search widgets..." aria-label="Search dashboard cards" /></label><label className="sa-customize-select-all-control"><input type="checkbox" checked={metricLayout.hidden.length === 0} onChange={(event) => setMetricLayout({ ...metricLayout, hidden: event.target.checked ? [] : [...metricLayout.order] })} /> <span>Select all</span></label><span className="sa-customize-selected-count">{metricLayout.order.length - metricLayout.hidden.length} selected</span></div>
          <div className="sa-customize-card-grid">{metricLayout.order.filter((key) => `${metricDefinitions[key].label} ${metricDefinitions[key].description}`.toLowerCase().includes(metricSearchQuery.trim().toLowerCase())).map((key) => { const item = metricDefinitions[key]; const Icon = item.icon; const isHidden = metricLayout.hidden.includes(key); const isPinned = metricLayout.pinned?.includes(key); return <label key={key} className={`sa-customize-item ${isHidden ? '' : 'is-selected'}`} draggable onDragStart={() => setDraggedMetric(key)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveMetric(key)}>
            <GripVertical className="sa-customize-drag" size={18} aria-hidden="true" /><span className={`sa-customize-item-icon ${item.tone}`}><Icon size={17} /></span><span className="sa-customize-item-copy"><strong>{item.label}</strong><small>{item.description}</small></span><button type="button" className={`sa-customize-pin ${isPinned ? 'is-pinned' : ''}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleMetricPin(key) }} aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${item.label}`} title={isPinned ? 'Unpin from top' : 'Pin to top'}><Pin size={15} /></button><input type="checkbox" checked={!isHidden} onChange={() => toggleMetric(key)} aria-label={`Show ${item.label}`} /><span className="sa-customize-check" aria-hidden="true">{!isHidden ? <Check size={14} strokeWidth={3} /> : null}</span>
          </label> })}</div>
        </div>
        <div className="sa-customize-footer"><button type="button" className="sa-customize-reset" onClick={resetMetricLayout}><RotateCcw size={15} /> Reset to Default</button><button type="button" className="sa-customize-done" disabled={isMetricSaving} onClick={saveMetricLayout}>{isMetricSaving ? 'Saving...' : 'Save Changes'}</button></div>
      </section>
    </div> : null}
  </div>
}
