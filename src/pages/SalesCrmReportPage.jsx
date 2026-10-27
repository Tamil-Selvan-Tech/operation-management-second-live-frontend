import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowUpRight, BarChart3, CheckCheck, ChevronDown, CircleDot, Clock3, FileSpreadsheet, Flame, RefreshCw, Search, TrendingUp, Users, X } from 'lucide-react'
import { request, requestBlob } from '../services/apiClient'

const REPORT_TIMEZONE = 'Asia/Kolkata'
const currentReportParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
const STAGES = [['COLD', 'Cold', 'cold'], ['WARM', 'Warm', 'warm'], ['HOT', 'Hot', 'hot'], ['CLOSED', 'Closed', 'closed'], ['OTHER', 'Other', 'other']]
const STATUSES = [['', 'All statuses'], ['DRAFT', 'Draft'], ['ACTIVE', 'Active'], ['FOLLOW_UP', 'Follow up'], ['NOT_ANSWERING', 'Not answering'], ['CONTACTED', 'Contacted'], ['INTERESTED', 'Interested'], ['DEMO_SCHEDULED', 'Demo scheduled'], ['DEMO_ATTENDED', 'Demo attended'], ['ADMISSION_CONFIRMED', 'Admission confirmed'], ['ENROLLED', 'Enrolled'], ['LOST_LEAD', 'Lost lead'], ['SWITCHED_OFF', 'Switched off'], ['OUT_OF_SERVICE', 'Out of service'], ['INCOMING_CALL_BLOCK', 'Incoming call block'], ['DND', 'Do not disturb'], ['NOT_REACHABLE', 'Not reachable'], ['CALL_WAITING', 'Call waiting'], ['CALL_LATER', 'Call later'], ['UNAVAILABLE_COURSE', 'Unavailable course'], ['NOT_INTERESTED', 'Not interested'], ['WRONG_NO', 'Wrong number'], ['CURRENTLY_NO_IDEA', 'Currently no idea'], ['FORWARD_TO_HR_TEAM', 'Forward to HR team'], ['MAY_BE_IN_FUTURE', 'May be in future'], ['JOINED_IN_ANOTHER_INSTITUTION', 'Joined another institution'], ['CONVERTED', 'Converted'], ['CLOSED', 'Closed'], ['OTHER', 'Other']]
const defaultFilters = {
  scope: 'all',
  period: 'month',
  month: currentReportParts.month,
  year: currentReportParts.year,
  fromDate: `${currentReportParts.year}-${currentReportParts.month}-01`,
  toDate: `${currentReportParts.year}-${currentReportParts.month}-${String(new Date(Date.UTC(Number(currentReportParts.year), Number(currentReportParts.month), 0)).getUTCDate()).padStart(2, '0')}`,
  branchId: '',
  assignedToId: '',
  stage: '',
  status: '',
}

const readable = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  return String(value).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const formatDateOnly = (value) => {
  if (!value) return '—'
  const raw = String(value).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '—'
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${raw}T00:00:00.000Z`))
}

const formatDateTime = (value) => value ? new Intl.DateTimeFormat('en-IN', { timeZone: REPORT_TIMEZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value)) : '—'

const buildQuery = (filters, extra = {}) => {
  const params = new URLSearchParams({ scope: filters.scope, period: filters.period, ...extra })
  if (filters.period === 'month') {
    params.set('month', filters.month)
    params.set('year', filters.year)
  } else if (filters.period === 'year') {
    params.set('year', filters.year)
  } else {
    params.set('fromDate', filters.fromDate)
    params.set('toDate', filters.toDate)
  }
  if (filters.branchId) params.set('branchId', filters.branchId)
  if (filters.assignedToId) params.set('assignedToId', filters.assignedToId)
  if (filters.stage) params.set('stage', filters.stage)
  if (filters.status) params.set('status', filters.status)
  return params
}

const scopeLabel = (scope) => scope === 'admissions' ? 'Admission Students' : 'All Leads'
const reportMonthOptions = Array.from({ length: 12 }, (_, index) => [String(index + 1).padStart(2, '0'), new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, index, 1)))])
const reportYearOptions = Array.from({ length: 9 }, (_, index) => String(new Date().getFullYear() - 4 + index))
const monthDateRange = (month, year) => {
  const normalizedMonth = String(month).padStart(2, '0')
  const normalizedYear = String(year)
  const lastDay = new Date(Date.UTC(Number(normalizedYear), Number(normalizedMonth), 0)).getUTCDate()
  return {
    fromDate: `${normalizedYear}-${normalizedMonth}-01`,
    toDate: `${normalizedYear}-${normalizedMonth}-${String(lastDay).padStart(2, '0')}`,
  }
}
const monthYearLabel = (month, year) => {
  const monthOption = reportMonthOptions.find(([value]) => value === String(month).padStart(2, '0'))
  return `${monthOption?.[1] || 'Selected month'} ${year}`
}
const reportDateLabel = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(String(value) + 'T00:00:00.000Z')) : '—'
const defaultExportFilters = { scope: 'all', period: 'month', month: defaultFilters.month, year: defaultFilters.year, fromDate: defaultFilters.fromDate, toDate: defaultFilters.toDate }

function ReportDownloadSelect({ value, options, onChange, ariaLabel }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const selectedOption = options.find((option) => String(option.value) === String(value)) || options[0]
  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnOutsideClick = (event) => { if (!containerRef.current?.contains(event.target)) setIsOpen(false) }
    const closeOnEscape = (event) => { if (event.key === 'Escape') setIsOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape) }
  }, [isOpen])
  return <div ref={containerRef} className={'sales-crm-report-select ' + (isOpen ? 'is-open' : '')}><button type="button" className="sales-crm-report-select-trigger" aria-label={ariaLabel} aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}><span>{selectedOption?.label || 'Select'}</span><ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" /></button>{isOpen ? <div className="sales-crm-report-select-menu" role="listbox" aria-label={ariaLabel}>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={String(option.value) === String(value)} className={'sales-crm-report-select-option ' + (String(option.value) === String(value) ? 'is-selected' : '')} onClick={() => { onChange(option.value); setIsOpen(false) }}>{option.label}</button>)}</div> : null}</div>
}

function ReportSkeleton() {
  return <div className="sales-crm-report-skeleton" aria-label="Loading report" aria-live="polite">
    <div className="sales-crm-report-skeleton-metrics">{Array.from({ length: 8 }, (_, index) => <div className="sales-crm-report-skeleton-card" key={index}><i /><i /><i /></div>)}</div>
    <div className="sales-crm-report-skeleton-section"><i /><div>{STAGES.map(([key]) => <i key={key} />)}</div></div>
    <div className="sales-crm-report-skeleton-section sales-crm-report-skeleton-table"><i />{Array.from({ length: 5 }, (_, index) => <i key={index} />)}</div>
  </div>
}

function MetricCard({ icon: Icon, label, value, helper, accent, percent = false, onClick, active = false }) {
  return <button type="button" className={`sales-crm-report-metric is-${accent} ${onClick ? 'is-clickable' : ''} ${active ? 'is-selected' : ''}`} onClick={onClick} aria-pressed={active} title={`View ${label} records`}>
    <span className="sales-crm-report-metric-icon"><Icon size={18} strokeWidth={2.1} /></span>
    <span className="sales-crm-report-metric-label">{label}</span>
    <strong>{percent ? `${Number(value || 0)}%` : Number(value || 0).toLocaleString('en-IN')}</strong>
    <small>{helper}</small>
    <span className="sales-crm-report-metric-link">View details <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden="true" /></span>
  </button>
}
export function SalesCrmReportPage() {
  const [report, setReport] = useState(null)
  const [draftFilters, setDraftFilters] = useState(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters)
  const [error, setError] = useState('')
  const [filterError, setFilterError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [downloadNotice, setDownloadNotice] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [reportDownloadFilters, setReportDownloadFilters] = useState({ ...defaultExportFilters })
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false)
  const [periodDraft, setPeriodDraft] = useState({ month: defaultFilters.month, year: defaultFilters.year })
  const periodPickerRef = useRef(null)
  const [search, setSearch] = useState('')
  const [selectedMetric, setSelectedMetric] = useState('')
  const [tablePage, setTablePage] = useState(1)

  const reportQuery = buildQuery(appliedFilters).toString()

  useEffect(() => {
    let active = true
    request(`/sales-crm/reports/monthly?${reportQuery}`)
      .then((response) => { if (active) { setReport(response?.data || null); setError('') } })
      .catch((reason) => { if (active) setError(reason?.message || 'Unable to load Sales CRM report') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reportQuery, reloadKey])

  const updateDraft = (key, value) => {
    setDraftFilters((current) => ({ ...current, [key]: value }))
    setFilterError('')
  }

  useEffect(() => {
    if (!periodPickerOpen) return undefined
    const closeOnOutsideClick = (event) => { if (!periodPickerRef.current?.contains(event.target)) setPeriodPickerOpen(false) }
    const closeOnEscape = (event) => { if (event.key === 'Escape') setPeriodPickerOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape) }
  }, [periodPickerOpen])

  const openPeriodPicker = () => {
    if (periodPickerOpen) {
      setPeriodPickerOpen(false)
      return
    }
    setPeriodDraft({ month: appliedFilters.month, year: appliedFilters.year })
    setPeriodPickerOpen(true)
  }

  const applyReportPeriod = () => {
    const nextPeriod = { period: 'month', month: periodDraft.month, year: periodDraft.year, ...monthDateRange(periodDraft.month, periodDraft.year) }
    setDraftFilters((current) => ({ ...current, ...nextPeriod }))
    setAppliedFilters((current) => ({ ...current, ...nextPeriod }))
    setPeriodPickerOpen(false)
    setError('')
    setDownloadError('')
    setDownloadNotice('')
    setSearch('')
    setSelectedMetric('')
    setTablePage(1)
    setLoading(true)
    setReloadKey((value) => value + 1)
  }
  const applyFilters = () => {
    if (draftFilters.period === 'custom' && (!draftFilters.fromDate || !draftFilters.toDate)) {
      setFilterError('Select both From Date and To Date.')
      return
    }
    if (draftFilters.period === 'custom' && draftFilters.fromDate > draftFilters.toDate) {
      setFilterError('From Date must not be later than To Date.')
      return
    }
    setFilterError('')
    setDownloadError('')
    setDownloadNotice('')
    setError('')
    setSearch('')
    setSelectedMetric('')
    setTablePage(1)
    setLoading(true)
    setAppliedFilters({ ...draftFilters })
  }

  const resetFilters = () => {
    setDraftFilters({ ...defaultFilters })
    setAppliedFilters({ ...defaultFilters })
    setFilterError('')
    setDownloadError('')
    setDownloadNotice('')
    setSearch('')
    setSelectedMetric('')
    setTablePage(1)
    setPeriodPickerOpen(false)
    setLoading(true)
  }

  const refreshReport = () => {
    setError('')
    setDownloadError('')
    setDownloadNotice('')
    setLoading(true)
    setReloadKey((value) => value + 1)
  }
  const openDownloadReport = () => {
    setDownloadError('')
    setDownloadNotice('')
    setDownloadOpen(true)
  }

  const closeDownloadReport = () => {
    if (!downloading) {
      setDownloadOpen(false)
      setDownloadError('')
    }
  }

  const exportPeriodLabel = () => {
    const filters = reportDownloadFilters
    if (filters.period === 'month') {
      const monthStart = String(filters.year) + '-' + String(filters.month) + '-01'
      const monthEnd = new Date(Date.UTC(Number(filters.year), Number(filters.month), 0)).toISOString().slice(0, 10)
      return reportDateLabel(monthStart) + ' to ' + reportDateLabel(monthEnd)
    }
    if (filters.period === 'year') return reportDateLabel(String(filters.year) + '-01-01') + ' to ' + reportDateLabel(String(filters.year) + '-12-31')
    return reportDateLabel(filters.fromDate) + ' to ' + reportDateLabel(filters.toDate)
  }

  const downloadReport = async (event) => {
    event.preventDefault()
    const filters = reportDownloadFilters
    if (filters.period === 'custom' && (!filters.fromDate || !filters.toDate)) {
      setDownloadError('Select both From Date and To Date.')
      return
    }
    if (filters.period === 'custom' && filters.fromDate > filters.toDate) {
      setDownloadError('From Date must not be later than To Date.')
      return
    }
    setDownloading(true)
    setDownloadError('')
    try {
      const result = await requestBlob('/leads/report/export?' + buildQuery(filters).toString())
      if (!result?.blob) throw new Error('The report file could not be created.')
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.fileName || scopeLabel(filters.scope).replace(/\s+/g, '_') + '_' + filters.period + '.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setDownloadNotice(scopeLabel(filters.scope) + ' report downloaded for ' + exportPeriodLabel() + '.')
      setDownloadOpen(false)
    } catch (reason) {
      setDownloadError(reason?.body?.message || reason?.body?.error || reason?.message || 'Unable to download the report.')
    } finally {
      setDownloading(false)
    }
  }

  const period = report?.period || {}
  const reportPeriodLabel = appliedFilters.period === 'month'
    ? monthYearLabel(appliedFilters.month, appliedFilters.year)
    : period.label || 'Loading report'
  const summary = report?.summary || {}
  const stageBreakdown = summary.stageBreakdown || {}
  const leadRows = Array.isArray(report?.leads) ? report.leads : []
  const metricRows = (() => {
    if (selectedMetric === 'convertedLeads' || selectedMetric === 'conversionRate') return leadRows.filter((lead) => lead.converted)
    if (selectedMetric === 'activeLeads') return leadRows.filter((lead) => !['CLOSED', 'CONVERTED', 'LOST_LEAD'].includes(String(lead.status || '').toUpperCase()) && String(lead.stage || '').toUpperCase() !== 'CLOSED')
    if (selectedMetric === 'movedToHot') return leadRows.filter((lead) => lead.movedToHot)
    if (selectedMetric === 'followUpsLogged') return leadRows.filter((lead) => Number(lead.periodFollowUpCount || 0) > 0)
    if (selectedMetric === 'pendingFollowUps') return leadRows.filter((lead) => lead.pendingFollowUp)
    if (selectedMetric === 'overdueFollowUps') return leadRows.filter((lead) => lead.overdueFollowUp)
    return leadRows
  })()
  const normalizedSearch = search.trim().toLowerCase()
  const filteredRows = metricRows.filter((lead) => {
    if (!normalizedSearch) return true
    return [lead.leadId, lead.studentName, lead.assignedTo, lead.branch, lead.stage, lead.status].some((value) => String(value || '').toLowerCase().includes(normalizedSearch))
  })
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(tablePage, totalPages)
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const totalStageLeads = STAGES.reduce((total, [key]) => total + Number(stageBreakdown[key] || 0), 0)
  const metrics = [
    { key: 'totalRecords', label: appliedFilters.scope === 'admissions' ? 'Admission Students' : 'Report Leads', icon: Users, accent: 'blue', helper: 'Matching selected period' },
    { key: 'convertedLeads', label: 'Admissions', icon: CheckCheck, accent: 'emerald', helper: 'Converted in this report' },
    { key: 'conversionRate', label: 'Conversion Rate', icon: TrendingUp, accent: 'green', helper: 'Admissions as % of report leads', percent: true },
    { key: 'activeLeads', label: 'Open Leads', icon: CircleDot, accent: 'purple', helper: 'Still in sales pipeline' },
    { key: 'movedToHot', label: 'Moved to HOT', icon: Flame, accent: 'orange', helper: 'Stage changes in period' },
    { key: 'followUpsLogged', label: 'Follow-ups Logged', icon: BarChart3, accent: 'purple', helper: 'Activity recorded in period' },
    { key: 'pendingFollowUps', label: 'Pending Follow-ups', icon: Clock3, accent: 'amber', helper: 'Open after period end' },
    { key: 'overdueFollowUps', label: 'Overdue Follow-ups', icon: AlertCircle, accent: 'red', helper: 'Overdue at period end' },
  ]

  const selectedMetricLabel = metrics.find((metric) => metric.key === selectedMetric)?.label || ''
  const selectMetric = (key) => {
    setSelectedMetric(key === 'totalRecords' ? '' : key)
    setSearch('')
    setTablePage(1)
    window.requestAnimationFrame(() => document.getElementById('sales-crm-report-lead-breakdown')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return <section className="sales-crm-report-page">
    <header className="sales-crm-report-header">
      <div className="sales-crm-report-title">
        <p className="eyebrow">SALES CRM INSIGHTS</p>
        <h1>Monthly Reports</h1>
        <p>Review lead movement, follow-up activity, and admission conversion for the selected period.</p>
      </div>
      <div className="sales-crm-report-header-actions">
        <div ref={periodPickerRef} className={'sales-crm-report-period-picker ' + (periodPickerOpen ? 'is-open' : '')}>
  <button type="button" className="sales-crm-report-period" onClick={openPeriodPicker} aria-haspopup="dialog" aria-expanded={periodPickerOpen} aria-label="Choose reporting month and year">
    <span>REPORTING PERIOD</span>
    <strong>{reportPeriodLabel}</strong>
    <ChevronDown className="sales-crm-report-period-chevron" size={16} strokeWidth={2.2} aria-hidden="true" />
  </button>
  {periodPickerOpen ? <div className="sales-crm-report-period-popover" role="dialog" aria-label="Choose reporting period">
    <div className="sales-crm-report-period-popover-heading"><strong>Select reporting period</strong><span>Only records from this month will be shown.</span></div>
    <label className="sales-crm-report-period-field">Month<ReportDownloadSelect value={periodDraft.month} ariaLabel="Report month" options={reportMonthOptions.map(([value, name]) => ({ value, label: name }))} onChange={(value) => setPeriodDraft((current) => ({ ...current, month: value }))} /></label>
    <label className="sales-crm-report-period-field">Year<ReportDownloadSelect value={periodDraft.year} ariaLabel="Report year" options={reportYearOptions.map((year) => ({ value: year, label: year }))} onChange={(value) => setPeriodDraft((current) => ({ ...current, year: value }))} /></label>
    <div className="sales-crm-report-period-actions"><button type="button" className="sales-crm-report-period-cancel" onClick={() => setPeriodPickerOpen(false)}>Cancel</button><button type="button" className="sales-crm-report-period-apply" onClick={applyReportPeriod}>Apply period</button></div>
  </div> : null}
</div>
        <button type="button" className="sales-crm-report-download-button" onClick={openDownloadReport} disabled={downloading} aria-label="Open download report"><FileSpreadsheet size={16} />Download Report</button>
        <button type="button" className="sales-crm-report-icon-button" onClick={refreshReport} disabled={loading || downloading} aria-label="Refresh report" title="Refresh report"><RefreshCw size={17} className={loading ? 'is-spinning' : ''} /></button>
      </div>
    </header>

    {downloadOpen ? <div className="sales-crm-report-download-backdrop" role="presentation"><form className="sales-crm-report-download-modal" role="dialog" aria-modal="true" aria-labelledby="sales-crm-report-download-title" onSubmit={downloadReport} noValidate><header className="sales-crm-report-download-modal-header"><div><p className="eyebrow">SALES CRM EXPORT</p><h2 id="sales-crm-report-download-title">Download Lead Report</h2><p>Select the report type and exact date period for the Excel file.</p></div><button type="button" className="sales-crm-report-download-close" onClick={closeDownloadReport} aria-label="Close report dialog" disabled={downloading}><X size={18} /></button></header><div className="sales-crm-report-download-form"><div className="sales-crm-report-download-controls"><label className="sales-crm-report-download-field">Report Type<ReportDownloadSelect value={reportDownloadFilters.scope} ariaLabel="Report Type" options={[{ value: 'all', label: 'ALL LEADS' }, { value: 'admissions', label: 'ADMISSION STUDENTS' }]} onChange={(value) => { setDownloadError(''); setReportDownloadFilters((current) => ({ ...current, scope: value })) }} /></label><label className="sales-crm-report-download-field">Period Type<ReportDownloadSelect value={reportDownloadFilters.period} ariaLabel="Period Type" options={[{ value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'custom', label: 'Custom Date Range' }]} onChange={(value) => { setDownloadError(''); setReportDownloadFilters((current) => ({ ...current, period: value })) }} /></label></div>{reportDownloadFilters.period === 'month' ? <div className="sales-crm-report-download-period-card"><label className="sales-crm-report-download-field">Month<ReportDownloadSelect value={reportDownloadFilters.month} ariaLabel="Month" options={reportMonthOptions.map(([value, name]) => ({ value, label: name }))} onChange={(value) => setReportDownloadFilters((current) => ({ ...current, month: value }))} /></label><label className="sales-crm-report-download-field">Year<ReportDownloadSelect value={reportDownloadFilters.year} ariaLabel="Year" options={reportYearOptions.map((year) => ({ value: year, label: year }))} onChange={(value) => setReportDownloadFilters((current) => ({ ...current, year: value }))} /></label></div> : null}{reportDownloadFilters.period === 'year' ? <div className="sales-crm-report-download-period-card sales-crm-report-download-year-card"><label className="sales-crm-report-download-field">Year<ReportDownloadSelect value={reportDownloadFilters.year} ariaLabel="Year" options={reportYearOptions.map((year) => ({ value: year, label: year }))} onChange={(value) => setReportDownloadFilters((current) => ({ ...current, year: value }))} /></label></div> : null}{reportDownloadFilters.period === 'custom' ? <div className="sales-crm-report-download-period-card"><label>From Date<input type="date" value={reportDownloadFilters.fromDate} onChange={(event) => { setDownloadError(''); setReportDownloadFilters((current) => ({ ...current, fromDate: event.target.value })) }} /></label><label>To Date<input type="date" value={reportDownloadFilters.toDate} onChange={(event) => { setDownloadError(''); setReportDownloadFilters((current) => ({ ...current, toDate: event.target.value })) }} /></label></div> : null}<div className="sales-crm-report-download-summary"><span>Excel report period</span><strong>{exportPeriodLabel()}</strong><small>{reportDownloadFilters.period === 'custom' ? 'The workbook will include From Date, To Date, Downloaded On, and Total Records.' : 'The workbook will include the selected period, Downloaded On, and Total Records.'}</small></div>{downloadError ? <div className="sales-crm-report-download-inline-error" role="alert"><AlertCircle size={15} /><span>{downloadError}</span></div> : null}</div><footer className="sales-crm-report-download-actions"><button type="button" className="sales-crm-report-download-cancel" onClick={closeDownloadReport} disabled={downloading}>Cancel</button><button type="submit" className="sales-crm-report-download-submit" disabled={downloading}>{downloading ? 'Preparing report...' : <><FileSpreadsheet size={17} aria-hidden="true" />Download Report</>}</button></footer></form></div> : null}

    <section className="sales-crm-report-filter-card" aria-label="Report filters">
      <div className="sales-crm-report-filter-heading"><div><span className="sales-crm-report-filter-icon"><FileSpreadsheet size={18} /></span><div><h2>Report filters</h2><p>Choose the report scope and optional stage or status filters.</p></div></div><span className="sales-crm-report-scope-pill">{scopeLabel(appliedFilters.scope)}</span></div>
            <div className="sales-crm-report-filter-grid sales-crm-report-compact-filters">
        <label>Report Type<ReportDownloadSelect value={draftFilters.scope} ariaLabel="Report Type" options={[{ value: 'all', label: 'ALL LEADS' }, { value: 'admissions', label: 'ADMISSION STUDENTS' }]} onChange={(value) => updateDraft('scope', value)} /></label>
        <label>Stage<ReportDownloadSelect value={draftFilters.stage} ariaLabel="Stage" options={[{ value: '', label: 'All stages' }, ...STAGES.map(([key, label]) => ({ value: key, label }))]} onChange={(value) => updateDraft('stage', value)} /></label>
        <label>Status<ReportDownloadSelect value={draftFilters.status} ariaLabel="Status" options={STATUSES.map(([value, label]) => ({ value, label }))} onChange={(value) => updateDraft('status', value)} /></label>
        <div className="sales-crm-report-filter-actions"><button type="button" className="sales-crm-report-reset-button" onClick={resetFilters}>Reset</button><button type="button" className="sales-crm-report-apply-button" onClick={applyFilters}>Apply filters</button></div>
      </div>

      {filterError ? <p className="sales-crm-report-inline-error" role="alert">{filterError}</p> : null}
    </section>

    {downloadNotice ? <div className="sales-crm-report-download-success" role="status"><CheckCheck size={16} /><span>{downloadNotice}</span><button type="button" onClick={() => setDownloadNotice('')} aria-label="Dismiss download success"><X size={15} /></button></div> : null}

    {loading ? <ReportSkeleton /> : error ? <div className="sales-crm-report-error" role="alert"><AlertCircle size={20} /><span>{error}</span><button type="button" onClick={refreshReport}><RefreshCw size={15} /> Retry</button></div> : report ? <>

      <div className="sales-crm-report-context-line"><span><strong>{scopeLabel(appliedFilters.scope)}</strong></span><span>Generated {formatDateTime(report.meta?.generatedAt)} · {Number(report.meta?.recordCount || 0).toLocaleString('en-IN')} records</span></div>
      <section className="sales-crm-report-cards" aria-label="Sales report metrics">{metrics.map((metric) => <MetricCard key={metric.key} {...metric} value={summary[metric.key]} onClick={() => selectMetric(metric.key)} active={metric.key === (selectedMetric || 'totalRecords')} />)}</section>
      <section className="sales-crm-report-section sales-crm-report-stage-card"><div className="sales-crm-report-section-heading"><div><h2>Lead stage snapshot</h2><p>Current stage of records matching the selected period and filters.</p></div><span className="sales-crm-report-section-count">{totalStageLeads.toLocaleString('en-IN')} total</span></div><div className="sales-crm-report-stage-grid">{STAGES.map(([key, label, accent]) => { const count = Number(stageBreakdown[key] || 0); const width = totalStageLeads ? Math.max((count / totalStageLeads) * 100, count ? 4 : 0) : 0; return <article className={`sales-crm-report-stage is-${accent}`} key={key}><div className="sales-crm-report-stage-top"><span className="sales-crm-report-stage-name">{label}</span><strong>{count.toLocaleString('en-IN')}</strong></div><div className="sales-crm-report-stage-track"><span style={{ width: `${width}%` }} /></div><small>{totalStageLeads ? `${Math.round((count / totalStageLeads) * 100)}% of records` : 'No records'}</small></article> })}</div></section>
      <section id="sales-crm-report-lead-breakdown" className="sales-crm-report-section sales-crm-report-table-card"><div className="sales-crm-report-section-heading"><div><h2>Lead breakdown</h2><p>{filteredRows.length.toLocaleString('en-IN')} {selectedMetric ? selectedMetricLabel + ' ' : ''}matching record{filteredRows.length === 1 ? '' : 's'} in this report.</p></div><label className="sales-crm-report-table-search"><Search size={16} /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setTablePage(1) }} placeholder="Search lead, student, branch, or owner" aria-label="Search report records" />{search ? <button type="button" onClick={() => { setSearch(''); setTablePage(1) }} aria-label="Clear search"><X size={14} /></button> : null}</label></div>{!filteredRows.length ? <div className="sales-crm-report-empty"><span><Users size={20} /></span><strong>{search ? 'No matching records' : 'No report data'}</strong><p>{search ? 'Try a different search term.' : `There are no records for ${period.label || 'the selected period'}.`}</p></div> : <><div className="sales-crm-report-table-scroll"><table className="sales-crm-report-table"><thead><tr><th>Lead ID</th><th>Student</th><th>Lead Date</th><th>Branch</th><th>Assigned To</th><th>Stage</th><th>Status</th><th>Next Follow-up</th><th>Follow-ups</th></tr></thead><tbody>{visibleRows.map((lead) => <tr key={lead.leadId}><td><strong className="sales-crm-report-lead-id">{lead.leadId}</strong>{lead.studentId ? <small className="sales-crm-report-sub-cell">{lead.studentId}</small> : null}</td><td className="sales-crm-report-student">{lead.studentName || '—'}</td><td>{formatDateOnly(lead.leadDate)}</td><td>{lead.branch || '—'}</td><td>{lead.assignedTo || '—'}</td><td><span className={`sales-crm-report-badge is-stage-${String(lead.stage || '').toLowerCase()}`}>{readable(lead.stage)}</span></td><td><span className={`sales-crm-report-badge is-status-${String(lead.status || '').toLowerCase().replaceAll('_', '-')}`}>{readable(lead.status)}</span></td><td>{lead.nextFollowUpDate ? `${formatDateOnly(lead.nextFollowUpDate)}${lead.nextFollowUpTime ? ` · ${lead.nextFollowUpTime}` : ''}` : '—'}</td><td>{Number(lead.periodFollowUpCount || 0).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div><div className="sales-crm-report-pagination"><span>Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length}</span><div><button type="button" disabled={currentPage <= 1} onClick={() => setTablePage((page) => Math.max(1, page - 1))}>Previous</button><strong>Page {currentPage} of {totalPages}</strong><button type="button" disabled={currentPage >= totalPages} onClick={() => setTablePage((page) => Math.min(totalPages, page + 1))}>Next</button></div></div></>}</section>
    </> : null}
  </section>
}