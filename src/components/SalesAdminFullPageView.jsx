import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Download, Edit3, FileSpreadsheet, Headphones, Mail, Phone, ShieldCheck, UserRound, GitBranch, Clock3, LogIn, LogOut, Timer, RefreshCw, UsersRound, GraduationCap, Flame, Snowflake, Thermometer, ListTodo, BellRing } from 'lucide-react'
import { API_BASE_URL, request } from '../services/apiClient'
import { loadSession } from '../lib/session'
import { downloadSalesCrmReportSubmission, listSalesCrmReportSubmissions } from '../services/salesCrmReportSubmissionService'
import '../styles/SalesAdminFullPageView.css'

const todayKey = () => new Date().toISOString().slice(0, 10)
const monthStartKey = () => { const date = new Date(); date.setDate(1); return date.toISOString().slice(0, 10) }
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-'
const formatDateTime = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
const formatFollowUpTime = (value) => { if (!value) return ''; const [hours, minutes] = String(value).split(':').map(Number); if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value; const date = new Date(); date.setHours(hours, minutes, 0, 0); return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) }
const formatDuration = (seconds) => { const total = Math.max(0, Number(seconds || 0)); const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); return hours ? `${hours}h ${minutes}m` : `${minutes}m` }
const workStatusLabel = (value) => ({ LOGGED_IN: 'Logged In', WORK_CLOCK_COMPLETED: 'Logged Out', AUTO_CLOSED: 'Logged Out', WEBSITE_LOGGED_OUT_WORK_CLOCK_ACTIVE: 'Logged Out' }[String(value || '').toUpperCase()] || 'Logged Out')
const workStatusTone = (value) => String(value || '').toUpperCase() === 'LOGGED_IN' ? 'logged-in' : 'logged-out'
const tabFor = (value) => value === 'call-recordings' || value === 'reports' ? 'call-records' : value === 'lead-details' ? 'lead-details-table' : ['lead-details-table', 'excel-upload', 'call-records', 'deleted-leads'].includes(value) ? value : 'overview'

function AudioPlayer({ recording }) {
  const [source, setSource] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    const session = loadSession()
    fetch(`${API_BASE_URL}${recording.playbackUrl}`, { credentials: 'include', headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {} })
      .then((response) => { if (!response.ok) throw new Error('Audio unavailable'); return response.blob() })
      .then((blob) => { if (active) { objectUrl = URL.createObjectURL(blob); setSource(objectUrl) } })
      .catch((reason) => { if (active) setError(reason?.message || 'Audio unavailable') })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [recording.playbackUrl])
  return error ? <span className="sales-admin-view-muted">{error}</span> : source ? <div className="sales-admin-audio-player"><audio controls preload="none" src={source} /></div> : <span className="sales-admin-view-muted">Loading…</span>
}

function RecordingDownloadButton({ recording }) {
  const [downloading, setDownloading] = useState(false)
  const download = async () => {
    setDownloading(true)
    try {
      const session = loadSession()
      const response = await fetch(`${API_BASE_URL}${recording.playbackUrl}`, { credentials: 'include', headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {} })
      if (!response.ok) throw new Error('Recording download failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = recording.recordingName || `call-recording-${recording.recordingId || recording.id}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }
  return <button type="button" className="sales-admin-lead-view-action" onClick={download} disabled={downloading}><Download size={14} /> {downloading ? 'Downloading...' : 'Download'}</button>
}

function DateFilter({ range, onChange }) {
  return <div className="sales-admin-view-date-filter" style={{ background: 'transparent', border: '0', padding: 0, marginTop: '6px' }}><CalendarDays size={16} /><label>From <input type="date" value={range.from} onChange={(event) => onChange({ ...range, from: event.target.value })} /></label><label>To <input type="date" min={range.from} value={range.to} onChange={(event) => onChange({ ...range, to: event.target.value })} /></label></div>
}

function EmptyState({ text }) { return <div className="sales-admin-view-empty">{text}</div> }

function leadStageLabel(lead) { return lead.status === 'CONVERTED' ? 'Admission' : String(lead.stage || '—').replaceAll('_', ' ') }
function LeadDetailsSection({ leadDetails, branches = [] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [selectedLead, setSelectedLead] = useState(null)
  const leads = useMemo(() => leadDetails?.allLeads || [], [leadDetails?.allLeads])
  const filtered = useMemo(() => leads.filter((lead) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [lead.leadId, lead.leadName, lead.phoneNumber, lead.course].some((value) => String(value || '').toLowerCase().includes(query))
    const matchesStatus = statusFilter === 'ALL' || (['HOT', 'WARM', 'COLD', 'CLOSED'].includes(statusFilter) ? String(lead.stage || '').toUpperCase() === statusFilter || String(lead.status || '').toUpperCase() === statusFilter : false)
    const matchesSource = sourceFilter === 'ALL' || lead.source === sourceFilter
    const matchesBranch = branchFilter === 'ALL' || lead.branch === branchFilter
    return matchesSearch && matchesStatus && matchesSource && matchesBranch
  }), [leads, search, statusFilter, sourceFilter, branchFilter])
  const summary = useMemo(() => ({ totalLeads: filtered.length, admissions: filtered.filter((lead) => lead.status === 'CONVERTED').length, closedLeads: filtered.filter((lead) => lead.status === 'CLOSED' || lead.stage === 'CLOSED').length, hotLeads: filtered.filter((lead) => lead.status !== 'CONVERTED' && lead.stage === 'HOT').length, coldLeads: filtered.filter((lead) => lead.status !== 'CONVERTED' && lead.stage === 'COLD').length, warmLeads: filtered.filter((lead) => lead.status !== 'CONVERTED' && lead.stage === 'WARM').length, pendingFollowUps: filtered.filter((lead) => lead.status !== 'CONVERTED' && lead.followUpDate).length, followUpsDue: filtered.filter((lead) => lead.status !== 'CONVERTED' && lead.followUpDate && new Date(lead.followUpDate) <= new Date()).length }), [filtered])
  const pageCount = Math.max(1, Math.ceil(filtered.length / 5))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * 5, safePage * 5)
  const cards = [['Total Leads', summary.totalLeads, 'total', UsersRound], ['Admissions', summary.admissions, 'admission', GraduationCap], ['Hot Leads', summary.hotLeads, 'hot', Flame], ['Cold Leads', summary.coldLeads, 'cold', Snowflake], ['Warm Leads', summary.warmLeads, 'warm', Thermometer], ['Closed Leads', summary.closedLeads, 'closed', ShieldCheck], ['Pending Follow-ups', summary.pendingFollowUps, 'pending', ListTodo], ['Follow-ups Due', summary.followUpsDue, 'due', BellRing]]
  const branchOptions = branches.filter((branch) => branch?.branchName).map((branch) => ({ id: branch.id, name: branch.branchName }))
  return <section className="sales-admin-view-section sales-admin-lead-details-section"><div className="sales-admin-lead-summary-grid">{cards.map(([label, value, tone, Icon]) => <div className={`sales-admin-lead-summary-card ${tone}`} key={label}><div className="sales-admin-lead-summary-icon"><Icon size={18} strokeWidth={2.2} /></div><div><span>{label}</span><strong>{value}</strong></div></div>)}</div><div className="sales-admin-view-card"><div className="sales-admin-lead-table-toolbar"><div><h2>All Leads</h2><p>Excel-uploaded and manually added leads combined.</p></div><div className="sales-admin-lead-filters"><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search lead, name or phone" aria-label="Search leads" /><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option value="ALL">All Status</option><option value="HOT">Hot</option><option value="WARM">Warm</option><option value="COLD">Cold</option><option value="CLOSED">Closed</option></select><select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1) }}><option value="ALL">All Sources</option><option value="EXCEL">Excel Upload</option><option value="MANUAL">Manual Entry</option></select><select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setPage(1) }}><option value="ALL">All Branches</option>{branchOptions.map((branch) => <option value={branch.name} key={branch.id}>{branch.name}</option>)}</select></div></div>{visible.length ? <div className="sales-admin-view-table-wrap"><table className="sales-admin-unified-lead-table"><thead><tr><th>Lead ID</th><th>Lead Name</th><th>Phone Number</th><th>Course</th><th>Lead Stage</th><th>Lead Status</th><th>Added Date</th><th>Follow-up Date</th><th>Branch</th><th>Source</th><th>Actions</th></tr></thead><tbody>{visible.map((lead) => <tr key={lead.id}><td><strong>{lead.leadId || '—'}</strong></td><td>{lead.leadName || '—'}</td><td>{lead.phoneNumber || '—'}</td><td>{lead.course || '—'}</td><td><span className={`sales-admin-lead-badge ${String(lead.stage || '').toLowerCase()}`}>{leadStageLabel(lead)}</span></td><td>{String(lead.status || '—').replaceAll('_', ' ')}</td><td>{formatDate(lead.addedDate)}</td><td>{lead.followUpDate ? `${formatDate(lead.followUpDate)}${lead.followUpTime ? ` · ${formatFollowUpTime(lead.followUpTime)}` : ''}` : '—'}</td><td>{lead.branch || '—'}</td><td><span className={`sales-admin-source-badge ${lead.source.toLowerCase()}`}>{lead.source === 'EXCEL' ? 'Excel Upload' : 'Manual Entry'}</span></td><td><button type="button" className="sales-admin-lead-view-action" onClick={() => setSelectedLead(lead)}>View</button></td></tr>)}</tbody></table></div> : <EmptyState text="No leads match the selected filters." />}{filtered.length > 5 ? <div className="sales-admin-view-pagination"><span>Showing {(safePage - 1) * 5 + 1}-{Math.min(safePage * 5, filtered.length)} of {filtered.length} leads</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((value) => <button type="button" key={value} className={value === safePage ? 'active' : ''} onClick={() => setPage(value)}>{value}</button>)}<button type="button" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button></div></div> : null}</div>{selectedLead ? <div className="sales-admin-lead-detail-popover"><div><strong>{selectedLead.leadName}</strong><button type="button" onClick={() => setSelectedLead(null)} aria-label="Close lead details">×</button></div><p>{selectedLead.leadId} · {selectedLead.phoneNumber}</p><span>{selectedLead.course}</span><span>{leadStageLabel(selectedLead)} · {String(selectedLead.status || '—').replaceAll('_', ' ')}</span></div> : null}</section>
}

function ExcelUploadSection({ uploads, branches = [], onView }) {
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const filtered = uploads.filter((upload) => (!search.trim() || String(upload.fileName || '').toLowerCase().includes(search.trim().toLowerCase())) && (branchFilter === 'ALL' || upload.branchName === branchFilter))
  const branchOptions = branches.filter((branch) => branch?.branchName).map((branch) => ({ id: branch.id, name: branch.branchName }))
  return <section className="sales-admin-view-section"><div className="sales-admin-view-card"><div className="sales-admin-lead-table-toolbar"><div><h2>Excel Upload History</h2><p>Every Excel upload is shown as a separate record.</p></div><div className="sales-admin-lead-filters"><input className="sales-admin-upload-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search file name" aria-label="Search Excel file name" /><select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} aria-label="Filter Excel uploads by branch"><option value="ALL">All Branches</option>{branchOptions.map((branch) => <option value={branch.name} key={branch.id}>{branch.name}</option>)}</select></div></div>{filtered.length ? <div className="sales-admin-view-table-wrap"><table><thead><tr><th>Upload Date &amp; Time</th><th>Excel File Name</th><th>Uploaded By</th><th>Assigned To</th><th>Total Leads Uploaded</th><th>Upload Status</th><th>Action</th></tr></thead><tbody>{filtered.map((upload) => <tr key={upload.id}><td>{formatDateTime(upload.uploadDate)}</td><td>{upload.fileName || '—'}</td><td>{upload.uploadedBy || '—'}</td><td>{upload.assignedTo || '—'}</td><td>{upload.totalLeadsUploaded || 0}</td><td><span className="sales-admin-upload-status">{upload.status === 'COMPLETED' ? 'Completed' : upload.status || '—'}</span></td><td><button type="button" className="sales-admin-lead-view-action" onClick={() => onView(upload)}>View</button></td></tr>)}</tbody></table></div> : <EmptyState text="No Excel uploads match the selected filters." />}</div></section>
}

function ExcelUploadPerformanceReport({ batchId, onBack }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [selectedLead, setSelectedLead] = useState(null)
  useEffect(() => { let active = true; request(`/sales-admins/uploads/${encodeURIComponent(batchId)}/performance`).then((result) => { if (active) setData(result?.data || null) }).catch((reason) => { if (active) setError(reason?.message || 'Unable to load upload performance report.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [batchId])
  if (loading) return <main className="sales-admin-view-page"><div className="sales-admin-view-loading"><RefreshCw className="spin" /> Loading upload performance…</div></main>
  if (error) return <main className="sales-admin-view-page"><button className="sales-admin-view-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Back to Excel Upload History</button><div className="sales-admin-view-error" role="alert">{error}</div></main>
  const upload = data?.upload || {}
  const summary = data?.summary || {}
  const rows = data?.rows || []
  const pageCount = Math.max(1, Math.ceil(rows.length / 5))
  const totalPages = pageCount
  const safePage = Math.min(page, pageCount)
  const visible = rows.slice((safePage - 1) * 5, safePage * 5)
  const cards = [['Total Leads', summary.totalLeads, 'total', UsersRound], ['Followed Leads', summary.followedLeads, 'followed', ListTodo], ['Not Followed Leads', summary.notFollowedLeads, 'not-followed', BellRing], ['Hot Leads', summary.hotLeads, 'hot', Flame], ['Warm Leads', summary.warmLeads, 'warm', Thermometer], ['Cold Leads', summary.coldLeads, 'cold', Snowflake], ['Admissions', summary.admissions, 'admission', GraduationCap]]
  return <main className="sales-admin-view-page sales-admin-upload-report-page"><header className="sales-admin-view-header"><button className="sales-admin-view-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Back to Excel Upload History</button><div className="sales-admin-view-title"><div><p className="eyebrow">LEAD PERFORMANCE REPORT</p><h1>{upload.fileName || 'Excel Upload'}</h1><p>{formatDateTime(upload.uploadDate)} · Uploaded by {upload.uploadedBy || '—'}</p></div><span className="sales-admin-upload-status">{upload.status === 'COMPLETED' ? 'Completed' : upload.status || '—'}</span></div></header><section className="sales-admin-upload-report-info"><div><span>Assigned Sales Admin</span><strong>{upload.assignedTo || '—'}</strong></div><div><span>Total Leads Uploaded</span><strong>{upload.totalLeadsUploaded || 0}</strong></div><div><span>Branch</span><strong>{upload.branchName || '—'}</strong></div></section><section className="sales-admin-view-section"><div className="sales-admin-upload-summary-grid">{cards.map(([label, value, tone]) => <div className={`sales-admin-upload-summary-card ${tone}`} key={label}><span>{label}</span><strong>{value || 0}</strong></div>)}</div><div className="sales-admin-view-card"><div className="sales-admin-lead-table-toolbar"><div><h2>Individual Lead Report</h2><p>Only leads belonging to this Excel upload are shown.</p></div></div>{visible.length ? <div className="sales-admin-view-table-wrap"><table className="sales-admin-upload-report-table"><thead><tr><th>Lead ID</th><th>Lead Name</th><th>Phone Number</th><th>Course</th><th>Follow-up Status</th><th>Lead Status</th><th>Lead Stage</th><th>Follow-up Date</th><th>Admission Status</th><th>Action</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><strong>{row.leadId}</strong></td><td>{row.leadName}</td><td>{row.phoneNumber}</td><td>{row.course}</td><td><span className={`sales-admin-upload-followup ${row.followUpStatus.toLowerCase()}`}>{row.followUpStatus === 'FOLLOWED' ? 'Followed' : 'Not Followed'}</span></td><td>{String(row.leadStatus || '—').replaceAll('_', ' ')}</td><td>{String(row.leadStage || '—').replaceAll('_', ' ')}</td><td>{row.followUpDate ? `${formatDate(row.followUpDate)}${row.followUpTime ? ` · ${formatFollowUpTime(row.followUpTime)}` : ''}` : '—'}</td><td>{String(row.admissionStatus || '—').replaceAll('_', ' ')}</td><td><button type="button" className="sales-admin-lead-view-action" onClick={() => setSelectedLead(row)}>View</button></td></tr>)}</tbody></table></div> : <EmptyState text="No leads are associated with this Excel upload." />}{rows.length > 5 ? <div className="sales-admin-view-pagination"><span>Showing {(safePage - 1) * 5 + 1}-{Math.min(safePage * 5, rows.length)} of {rows.length} leads</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((value) => <button type="button" key={value} className={value === safePage ? 'active' : ''} onClick={() => setPage(value)}>{value}</button>)}<button type="button" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button></div></div> : null}</div></section>{selectedLead ? <div className="sales-admin-lead-detail-popover"><div><strong>{selectedLead.leadName}</strong><button type="button" onClick={() => setSelectedLead(null)} aria-label="Close lead details">×</button></div><p>{selectedLead.leadId} · {selectedLead.phoneNumber}</p><span>{selectedLead.course}</span><span>{selectedLead.followUpStatus === 'FOLLOWED' ? 'Followed' : 'Not Followed'} · {selectedLead.followUps?.length || 0} follow-up records</span>{selectedLead.activities?.length ? <span>{selectedLead.activities.length} CRM activity records</span> : null}</div> : null}</main>
}

export default function SalesAdminFullPageView({ admin, initialTab = 'overview', onBack, onEdit }) {
  const [tab, setTab] = useState(tabFor(initialTab))
  const [range, setRange] = useState({ from: monthStartKey(), to: todayKey() })
  const [data, setData] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUpload, setSelectedUpload] = useState(null)
  const [selectedUploadReport, setSelectedUploadReport] = useState(null)
  const [callPage, setCallPage] = useState(1)
  const [deletedPage, setDeletedPage] = useState(1)
  const [reportsPage, setReportsPage] = useState(1)
  const [downloadingReportId, setDownloadingReportId] = useState('')
  const [reportSearch, setReportSearch] = useState('')
  const [reportBranchFilter, setReportBranchFilter] = useState('ALL')
  const load = useCallback(() => {
    setLoading(true); setError('')
    const params = new URLSearchParams({ from: range.from, to: range.to })
    Promise.all([request(`/sales-admins/${encodeURIComponent(admin.id)}/view?${params}`), listSalesCrmReportSubmissions(admin.id)])
      .then(([result, reportResult]) => { setData(result?.data || null); setReports(reportResult?.data || []) })
      .catch((reason) => setError(reason?.message || 'Unable to load Sales Admin details.'))
      .finally(() => setLoading(false))
  }, [admin.id, range.from, range.to])
  const downloadSubmittedReport = async (report) => {
    setDownloadingReportId(report.id)
    try {
      const response = await downloadSalesCrmReportSubmission(report.id)
      if (!response?.blob) throw new Error('Unable to download the submitted report.')
      const url = URL.createObjectURL(response.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = response.fileName || report.fileName || 'sales-crm-report.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) {
      setError(reason?.message || 'Unable to download the submitted report.')
    } finally {
      setDownloadingReportId('')
    }
  }
  // The fetch synchronizes this page with the selected Sales Admin and date range.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  const profile = data?.profile || admin || {}
  const excelUploads = data?.leadDetails?.excelUploads || []
  const manualLeads = data?.leadDetails?.manuallyAddedLeads || []
  const callRecords = useMemo(() => data?.callRecords || [], [data?.callRecords])
  const deletedLeads = data?.deletedLeads || []
  const branches = useMemo(() => profile.branches || [], [profile.branches])
  const tabs = [['overview', 'Overview'], ['lead-details-table', 'Lead Details'], ['excel-upload', 'Excel Upload'], ['call-records', 'Call Records & Reports'], ['deleted-leads', 'Deleted Leads']]
  const uploadLeads = useMemo(() => selectedUpload?.leads || [], [selectedUpload])
  const workLog = data?.workLog || {}
  const branchNameById = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.branchName])), [branches])
  const reportMatches = useCallback((item) => { const query = reportSearch.trim().toLowerCase(); const branchName = item.branchName || branchNameById.get(item.branchId) || ''; return (!query || [item.leadName, item.phoneNumber, item.leadId, item.recordedBy, item.fileName, item.reportName, item.submittedBy].some((value) => String(value || '').toLowerCase().includes(query))) && (reportBranchFilter === 'ALL' || branchName === reportBranchFilter) }, [reportSearch, reportBranchFilter, branchNameById])
  const filteredCallRecords = useMemo(() => callRecords.filter(reportMatches), [callRecords, reportMatches])
  const filteredReports = useMemo(() => reports.filter((report) => { const value = report.createdAt || report.submittedAt; if (value) { const key = new Date(value).toISOString().slice(0, 10); if (key < range.from || key > range.to) return false } return reportMatches(report) }), [reports, range.from, range.to, reportMatches])
  const reportBranchOptions = branches.filter((branch) => branch?.branchName).map((branch) => ({ id: branch.id, name: branch.branchName }))
  const reportFilterControls = <div className="sales-admin-lead-filters sales-admin-report-filters"><input type="search" value={reportSearch} onChange={(event) => { setReportSearch(event.target.value); setCallPage(1); setReportsPage(1) }} placeholder="Search call records or reports" aria-label="Search call records and submitted reports" /><select value={reportBranchFilter} onChange={(event) => { setReportBranchFilter(event.target.value); setCallPage(1); setReportsPage(1) }} aria-label="Filter call records and reports by branch"><option value="ALL">All Branches</option>{reportBranchOptions.map((branch) => <option value={branch.name} key={branch.id}>{branch.name}</option>)}</select></div>
  const pageSize = 5
  const callPageCount = Math.max(1, Math.ceil(filteredCallRecords.length / pageSize))
  const deletedPageCount = Math.max(1, Math.ceil(deletedLeads.length / pageSize))
  const reportsPageCount = Math.max(1, Math.ceil(filteredReports.length / pageSize))
  const visibleCallRecords = filteredCallRecords.slice((Math.min(callPage, callPageCount) - 1) * pageSize, Math.min(callPage, callPageCount) * pageSize)
  const visibleDeletedLeads = deletedLeads.slice((Math.min(deletedPage, deletedPageCount) - 1) * pageSize, Math.min(deletedPage, deletedPageCount) * pageSize)
  const visibleReports = filteredReports.slice((Math.min(reportsPage, reportsPageCount) - 1) * pageSize, Math.min(reportsPage, reportsPageCount) * pageSize)
  if (loading) return <main className="sales-admin-view-page"><div className="sales-admin-view-loading"><RefreshCw className="spin" /> Loading Sales Admin details…</div></main>
  if (selectedUploadReport) return <ExcelUploadPerformanceReport batchId={selectedUploadReport.id} onBack={() => setSelectedUploadReport(null)} />
  return <main className="sales-admin-view-page">
    <header className="sales-admin-view-header"><button className="sales-admin-view-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Back to Sales Admins</button><div className="sales-admin-view-title"><div><p className="eyebrow">SALES ADMIN VIEW</p><h1>{profile.fullName || profile.name || '-'}</h1></div><div className="sales-admin-view-header-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}><div className="sales-admin-view-header-action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span className={`sales-admin-view-status ${profile.active === false ? 'inactive' : ''}`}>{profile.active === false ? 'Inactive' : 'Active'}</span><button type="button" onClick={() => onEdit?.(profile)}><Edit3 size={16} /> Edit</button></div>{tab !== 'overview' ? <DateFilter range={range} onChange={setRange} /> : null}</div></div></header>
    <nav className="sales-admin-view-tabs" aria-label="Sales Admin details tabs">{tabs.map(([key, label]) => <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {error ? <div className="sales-admin-view-error" role="alert">{error}<button type="button" onClick={load}>Retry</button></div> : null}
    {tab === 'lead-details-table' ? <LeadDetailsSection leadDetails={data?.leadDetails} branches={branches} /> : null}
    {tab === 'excel-upload' ? <ExcelUploadSection uploads={excelUploads} branches={branches} onView={setSelectedUploadReport} /> : null}
    {tab === 'overview' ? <section className="sales-admin-view-section"><div className="sales-admin-view-grid"><article className="sales-admin-view-card sales-admin-account-card"><div className="sales-admin-view-card-heading"><div><p className="sales-admin-view-section-kicker">ACCOUNT PROFILE</p><h2>Account Information</h2></div><ShieldCheck size={22} /></div><div className="sales-admin-account-fields"><div><span><UserRound size={16} />Sales Admin Name</span><strong>{profile.fullName || profile.name || '—'}</strong></div><div><span><ShieldCheck size={16} />Sales Admin ID</span><strong>{profile.userCode || profile.id || '—'}</strong></div><div><span><Mail size={16} />Email Address</span><strong>{profile.email || '—'}</strong></div><div><span><Phone size={16} />Phone Number</span><strong>{profile.phone || '—'}</strong></div><div><span><GitBranch size={16} />Assigned Branches</span><strong className="sales-admin-branch-values">{branches.length ? branches.map((branch) => <em key={branch.id}>{branch.branchName}</em>) : '—'}</strong></div><div><span><ShieldCheck size={16} />Account Status</span><strong><b className={`sales-admin-inline-status ${profile.active === false ? 'inactive' : ''}`}>{profile.active === false ? 'Inactive' : 'Active'}</b></strong></div></div></article><article className="sales-admin-view-card sales-admin-work-card"><div className="sales-admin-view-card-heading"><div><p className="sales-admin-view-section-kicker">TODAY</p><h2>Today's Work Log</h2></div><Clock3 size={22} /></div><div className="sales-admin-view-work-grid"><div><span><ShieldCheck size={15} />Attendance Status</span><strong className={`sales-admin-work-status ${workStatusTone(workLog.status)}`}>{workStatusLabel(workLog.status || (workLog.isLoggedIn ? 'LOGGED_IN' : 'LOGGED_OUT'))}</strong></div><div><span><LogIn size={15} />Login Time</span><strong>{workLog.loginTime || workLog.firstLoginAt ? formatDateTime(workLog.loginTime || workLog.firstLoginAt) : '—'}</strong></div><div><span><LogOut size={15} />Logout Time</span><strong>{workLog.logoutTime || workLog.finalLogoutAt ? formatDateTime(workLog.logoutTime || workLog.finalLogoutAt) : '—'}</strong></div><div><span><Timer size={15} />Working Duration</span><strong>{formatDuration(workLog.workingSeconds || workLog.totalWorkingSeconds || workLog.durationSeconds) || '—'}</strong></div></div></article></div></section> : null}
    {tab === 'lead-details' ? <section className="sales-admin-view-section"><div className="sales-admin-view-summary"><div><strong>{data?.leadDetails?.counts?.excelUploads || 0}</strong><span>Excel leads</span></div><div><strong>{data?.leadDetails?.counts?.manual || 0}</strong><span>Manual leads</span></div><div><strong>{excelUploads.length}</strong><span>Excel uploads</span></div></div><div className="sales-admin-view-card"><div className="sales-admin-view-card-heading"><div><h2>Excel Uploaded Leads</h2><p>Each upload is kept as a separate record.</p></div><FileSpreadsheet size={22} /></div>{excelUploads.length ? <div className="sales-admin-view-table-wrap"><table><thead><tr><th>Upload Date</th><th>File Name</th><th>Total Leads</th><th>Uploaded By</th><th>Assigned To</th><th>Status</th></tr></thead><tbody>{excelUploads.map((upload) => <tr key={upload.id} className="clickable" onClick={() => setSelectedUpload(upload)}><td>{formatDateTime(upload.uploadDate)}</td><td>{upload.fileName}</td><td>{upload.totalLeadsUploaded}</td><td>{upload.uploadedBy}</td><td>{upload.assignedTo || '—'}</td><td>{upload.status === 'COMPLETED' ? 'Excel Completed' : upload.status || '—'}</td></tr>)}</tbody></table></div> : <EmptyState text="No Excel uploads found for this date range." />}{selectedUpload ? <div className="sales-admin-view-upload-detail"><h3>{selectedUpload.fileName} · {selectedUpload.totalLeadsUploaded} leads</h3>{uploadLeads.length ? <div className="sales-admin-view-table-wrap"><table><thead><tr><th>Lead ID</th><th>Name</th><th>Phone</th><th>Course</th><th>Status</th></tr></thead><tbody>{uploadLeads.map((lead) => <tr key={lead.id}><td>{lead.leadId}</td><td>{lead.studentName}</td><td>{lead.phoneNumber}</td><td>{lead.course}</td><td>{lead.status || lead.stage || '-'}</td></tr>)}</tbody></table></div> : <EmptyState text="No active lead rows are available for this upload." />}</div> : null}</div><div className="sales-admin-view-card"><div className="sales-admin-view-card-heading"><div><h2>Manually Added Leads</h2><p>Leads created through Add Lead, separate from Excel uploads.</p></div></div>{manualLeads.length ? <div className="sales-admin-view-table-wrap"><table><thead><tr><th>Lead Name</th><th>Phone Number</th><th>Course</th><th>Status</th><th>Added Date</th><th>Added By</th></tr></thead><tbody>{manualLeads.map((lead) => <tr key={lead.id}><td>{lead.leadName}</td><td>{lead.phoneNumber}</td><td>{lead.course}</td><td>{lead.status || lead.stage || '-'}</td><td>{formatDate(lead.addedDate)}</td><td>{lead.addedBy}</td></tr>)}</tbody></table></div> : <EmptyState text="No manually added leads found for this date range." />}</div></section> : null}
    {tab === 'call-records' ? <section className="sales-admin-view-section">{reportFilterControls}<div className="sales-admin-view-card"><div className="sales-admin-view-card-heading"><div><h2>Call Records</h2><p>Call recordings associated with this Sales Admin.</p></div><Headphones size={22} /></div><div className="sales-admin-view-table-wrap"><table><thead><tr><th>Lead Name</th><th>Lead ID</th><th>Contact Number</th><th>Call Date</th><th>Recorded By</th><th>Recording</th><th>Action</th></tr></thead><tbody>{visibleCallRecords.length ? visibleCallRecords.map((record) => <tr key={record.id}><td>{record.leadName}</td><td>{record.leadId || '-'}</td><td>{record.phoneNumber}</td><td>{formatDateTime(record.callDate)}</td><td>{record.recordedBy}</td><td><AudioPlayer recording={record} /></td><td><RecordingDownloadButton recording={record} /></td></tr>) : <tr><td colSpan="7" className="sales-admin-table-empty-cell">No call records found for this date range.</td></tr>}</tbody></table></div>{filteredCallRecords.length > 5 && callPageCount > 1 ? <div className="sales-admin-view-pagination"><span>Showing {(Math.min(callPage, callPageCount) - 1) * pageSize + 1}-{Math.min(callPage * pageSize, filteredCallRecords.length)} of {filteredCallRecords.length} records</span><div><button type="button" disabled={callPage === 1} onClick={() => setCallPage((page) => Math.max(1, page - 1))}>Previous</button>{Array.from({ length: callPageCount }, (_, index) => index + 1).map((page) => <button type="button" key={page} className={page === callPage ? 'active' : ''} onClick={() => setCallPage(page)}>{page}</button>)}<button type="button" disabled={callPage === callPageCount} onClick={() => setCallPage((page) => Math.min(callPageCount, page + 1))}>Next</button></div></div> : null}</div><div className="sales-admin-view-card"><h2>Submitted Reports</h2><div className="sales-admin-view-table-wrap"><table><thead><tr><th>Report</th><th>Submitted By</th><th>Submitted Date</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleReports.length ? visibleReports.map((report) => <tr key={report.id}><td>{report.fileName || report.reportName || 'Sales CRM report'}</td><td>{report.submittedBy || report.createdByName || '-'}</td><td>{formatDateTime(report.createdAt || report.submittedAt)}</td><td>{report.status || 'Submitted'}</td><td><button type="button" className="sales-admin-lead-view-action" onClick={() => downloadSubmittedReport(report)} disabled={downloadingReportId === report.id}>{downloadingReportId === report.id ? 'Downloading...' : 'Download'}</button></td></tr>) : <tr><td colSpan="5" className="sales-admin-table-empty-cell">No submitted reports found for this date range.</td></tr>}</tbody></table></div>{reportsPageCount > 1 ? <div className="sales-admin-view-pagination"><span>Showing {(Math.min(reportsPage, reportsPageCount) - 1) * pageSize + 1}-{Math.min(reportsPage * pageSize, filteredReports.length)} of {filteredReports.length} reports</span><div><button type="button" disabled={reportsPage === 1} onClick={() => setReportsPage((value) => Math.max(1, value - 1))}>Previous</button>{Array.from({ length: reportsPageCount }, (_, index) => index + 1).map((value) => <button type="button" key={value} className={value === reportsPage ? 'active' : ''} onClick={() => setReportsPage((value) => Math.min(reportsPageCount, value + 1))}>Next</button>)}</div></div> : null}</div></section> : null}
    {tab === 'deleted-leads' ? <section className="sales-admin-view-section"><div className="sales-admin-view-card"><div className="sales-admin-view-card-heading"><div><h2>Deleted Leads</h2><p>Deletion history preserved for this Sales Admin.</p></div></div><div className="sales-admin-view-table-wrap"><table><thead><tr><th>Lead Name</th><th>Phone Number</th><th>Course</th><th>Previous Status</th><th>Deleted Date</th><th>Deleted By</th><th>Details</th></tr></thead><tbody>{visibleDeletedLeads.length ? visibleDeletedLeads.map((lead) => <tr key={lead.id}><td>{lead.studentName}</td><td>{lead.phoneNumber}</td><td>{lead.course?.name || lead.otherCourse || '-'}</td><td>{lead.status || lead.stage || '-'}</td><td>{formatDateTime(lead.deletedAt)}</td><td>{lead.deletedByName || '-'}</td><td>{lead.deletedByRole || '-'}</td></tr>) : <tr><td colSpan="7" className="sales-admin-table-empty-cell">No deleted leads found for this date range.</td></tr>}</tbody></table></div>{deletedPageCount > 1 ? <div className="sales-admin-view-pagination"><span>Showing {(Math.min(deletedPage, deletedPageCount) - 1) * pageSize + 1}-{Math.min(deletedPage * pageSize, deletedLeads.length)} of {deletedLeads.length} leads</span><div><button type="button" disabled={deletedPage === 1} onClick={() => setDeletedPage((page) => Math.max(1, page - 1))}>Previous</button>{Array.from({ length: deletedPageCount }, (_, index) => index + 1).map((page) => <button type="button" key={page} className={page === deletedPage ? 'active' : ''} onClick={() => setDeletedPage(page)}>{page}</button>)}<button type="button" disabled={deletedPage === deletedPageCount} onClick={() => setDeletedPage((page) => Math.min(deletedPageCount, page + 1))}>Next</button></div></div> : null}</div></section> : null}
  </main>
}
