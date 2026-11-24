import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CalendarDays, ChevronDown, Download, Edit3, Eye, FileSpreadsheet, Headphones, Mail, Phone, ShieldCheck, UserRound, GitBranch, Clock3, LogIn, LogOut, Timer, RefreshCw, UsersRound, GraduationCap, Flame, Snowflake, Thermometer, ListTodo, BellRing, X } from 'lucide-react'
import { API_BASE_URL, request } from '../services/apiClient'
import { loadSession } from '../lib/session'
import { downloadSalesCrmReportSubmission, listSalesCrmReportSubmissions } from '../services/salesCrmReportSubmissionService'
import { getLeadImportTargets, reassignLeadImport } from '../services/leadImportService'
import '../styles/SalesAdminFullPageView.css'

const todayKey = () => new Date().toISOString().slice(0, 10)
const monthStartKey = () => { const date = new Date(); date.setDate(1); return date.toISOString().slice(0, 10) }
const formatDate = (value) => {
  const dateKey = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '-'
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(year, month - 1, day))
}
const formatDateTime = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
const formatFollowUpTime = (value) => { if (!value) return ''; const [hours, minutes] = String(value).split(':').map(Number); if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value; const date = new Date(); date.setHours(hours, minutes, 0, 0); return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) }
const formatDuration = (seconds) => { const total = Math.max(0, Number(seconds || 0)); const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); return hours ? `${hours}h ${minutes}m` : `${minutes}m` }
const workStatusLabel = (value) => ({ LOGGED_IN: 'Logged In', WORK_CLOCK_COMPLETED: 'Logged Out', AUTO_CLOSED: 'Logged Out', WEBSITE_LOGGED_OUT_WORK_CLOCK_ACTIVE: 'Logged In' }[String(value || '').toUpperCase()] || 'Logged Out')
const workStatusTone = (value) => ['LOGGED_IN', 'WEBSITE_LOGGED_OUT_WORK_CLOCK_ACTIVE'].includes(String(value || '').toUpperCase()) ? 'logged-in' : 'logged-out'
const tabFor = (value) => value === 'call-recordings' || value === 'reports' ? 'call-records' : value === 'lead-details' ? 'lead-details-table' : ['lead-details-table', 'excel-upload', 'call-records', 'deleted-leads', 'change-history'].includes(value) ? value : 'overview'

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
function paginationItems(current, total) {
  if (total <= 3) return Array.from({ length: total }, (_, index) => index + 1)
  const start = current <= 2 ? 1 : current >= total - 1 ? total - 2 : current - 1
  const items = [start, start + 1, start + 2]
  if (start + 2 < total) items.push('ellipsis')
  return items
}
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
  return <section className="sales-admin-view-section sales-admin-lead-details-section"><div className="sales-admin-lead-summary-grid">{cards.map(([label, value, tone, Icon]) => <div className={`sales-admin-lead-summary-card ${tone}`} key={label}><div className="sales-admin-lead-summary-icon"><Icon size={18} strokeWidth={2.2} /></div><div><span>{label}</span><strong>{value}</strong></div></div>)}</div><div className="sales-admin-view-card"><div className="sales-admin-lead-table-toolbar"><div><h2>All Leads</h2><p>Excel-uploaded and manually added leads combined.</p></div><div className="sales-admin-lead-filters"><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search lead, name or phone" aria-label="Search leads" /><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option value="ALL">All Status</option><option value="HOT">Hot</option><option value="WARM">Warm</option><option value="COLD">Cold</option><option value="CLOSED">Closed</option></select><select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1) }}><option value="ALL">All Sources</option><option value="EXCEL">Excel Upload</option><option value="MANUAL">Manual Entry</option></select><select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setPage(1) }}><option value="ALL">All Branches</option>{branchOptions.map((branch) => <option value={branch.name} key={branch.id}>{branch.name}</option>)}</select></div></div>{visible.length ? <div className="sales-admin-view-table-wrap"><table className="sales-admin-unified-lead-table"><thead><tr><th>Lead ID</th><th>Lead Name</th><th>Phone Number</th><th>Course</th><th>Lead Stage</th><th>Lead Status</th><th>Added Date</th><th>Follow-up Date</th><th>Branch</th><th>Source</th><th>Actions</th></tr></thead><tbody>{visible.map((lead) => <tr key={lead.id}><td><strong>{lead.leadId || '—'}</strong></td><td>{lead.leadName || '—'}</td><td>{lead.phoneNumber || '—'}</td><td>{lead.course || '—'}</td><td><span className={`sales-admin-lead-badge ${String(lead.stage || '').toLowerCase()}`}>{leadStageLabel(lead)}</span></td><td>{String(lead.status || '—').replaceAll('_', ' ')}</td><td>{formatDate(lead.addedDate)}</td><td>{lead.followUpDate ? `${formatDate(lead.followUpDate)}${lead.followUpTime ? ` · ${formatFollowUpTime(lead.followUpTime)}` : ''}` : '—'}</td><td>{lead.branch || '—'}</td><td><span className={`sales-admin-source-badge ${lead.source.toLowerCase()}`}>{lead.source === 'EXCEL' ? 'Excel Upload' : 'Manual Entry'}</span></td><td><button type="button" className="sales-admin-lead-view-action" onClick={() => setSelectedLead(lead)}>View</button></td></tr>)}</tbody></table></div> : <EmptyState text="No leads match the selected filters." />}{filtered.length > 5 ? <div className="sales-admin-view-pagination"><span>Showing {(safePage - 1) * 5 + 1}-{Math.min(safePage * 5, filtered.length)} of {filtered.length} leads</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>{paginationItems(safePage, pageCount).map((value, index) => value === 'ellipsis' ? <span className="sales-admin-pagination-ellipsis" key={`ellipsis-${index}`}>…</span> : <button type="button" key={value} className={value === safePage ? 'active' : ''} onClick={() => setPage(value)}>{value}</button>)}<button type="button" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button></div></div> : null}</div>{selectedLead ? <div className="sales-admin-lead-detail-popover"><div><strong>{selectedLead.leadName}</strong><button type="button" onClick={() => setSelectedLead(null)} aria-label="Close lead details"><X size={18} strokeWidth={2.2} /></button></div><p>{selectedLead.leadId} · {selectedLead.phoneNumber}</p><span>{selectedLead.course}</span><span>{leadStageLabel(selectedLead)} · {String(selectedLead.status || '—').replaceAll('_', ' ')}</span></div> : null}</section>
}

function ExcelUploadSection({ uploads, branches = [], onView }) {
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const filtered = (Array.isArray(uploads) ? uploads : []).filter((upload) => (!search.trim() || String(upload.fileName || '').toLowerCase().includes(search.trim().toLowerCase())) && (branchFilter === 'ALL' || upload.branchName === branchFilter))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 5))
  const safePage = Math.min(page, pageCount)
  const visibleUploads = filtered.slice((safePage - 1) * 5, safePage * 5)
  const branchOptions = branches.filter((branch) => branch?.branchName).map((branch) => ({ id: branch.id, name: branch.branchName }))
  return <section className="sales-admin-view-section"><div className="sales-admin-view-card"><div className="sales-admin-lead-table-toolbar"><div><h2>Excel Upload History</h2><p>Every Excel upload is shown as a separate record.</p></div><div className="sales-admin-lead-filters"><input className="sales-admin-upload-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search file name" aria-label="Search Excel file name" /><select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setPage(1) }} aria-label="Filter Excel uploads by branch"><option value="ALL">All Branches</option>{branchOptions.map((branch) => <option value={branch.name} key={branch.id}>{branch.name}</option>)}</select></div></div>{filtered.length ? <><div className="sales-admin-view-table-wrap"><table><thead><tr><th>Upload Date &amp; Time</th><th>Excel File Name</th><th>Uploaded By</th><th>Assigned To</th><th>Total Leads Uploaded</th><th>Lead Completion Status</th><th>Action</th></tr></thead><tbody>{visibleUploads.map((upload) => <tr key={upload.id} className="clickable" onClick={() => onView(upload)}><td>{formatDateTime(upload.uploadDate)}</td><td>{upload.fileName || '—'}</td><td>{upload.uploadedBy || '—'}</td><td>{upload.assignedTo || '—'}</td><td>{upload.totalLeadsUploaded || 0}</td><td><span className="sales-admin-upload-status">{String(upload.status === 'COMPLETED' ? 'Completed' : upload.status || '—').replaceAll('_', ' ')}</span></td><td><button type="button" className="sales-admin-lead-view-action" onClick={(event) => { event.stopPropagation(); onView(upload) }}><Eye size={14} /> View</button></td></tr>)}</tbody></table></div>{filtered.length > 5 ? <div className="sales-admin-view-pagination"><span>Showing {(safePage - 1) * 5 + 1}-{Math.min(safePage * 5, filtered.length)} of {filtered.length} uploads</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>{paginationItems(safePage, pageCount).map((value, index) => value === 'ellipsis' ? <span className="sales-admin-pagination-ellipsis" key={`ellipsis-${index}`}>…</span> : <button type="button" key={value} className={value === safePage ? 'active' : ''} onClick={() => setPage(value)}>{value}</button>)}<button type="button" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button></div></div> : null} </> : <EmptyState text="No Excel uploads match the selected filters." />}</div></section>
}

function ExcelUploadSectionWithDeadline({ uploads, branches = [], onView, isBranchAdmin = false }) {
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const filtered = uploads.filter((upload) => (!search.trim() || String(upload.fileName || '').toLowerCase().includes(search.trim().toLowerCase())) && (branchFilter === 'ALL' || upload.branchName === branchFilter))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 5))
  const safePage = Math.min(page, pageCount)
  const visibleUploadRows = filtered.slice((safePage - 1) * 5, safePage * 5)
  const branchOptions = branches.filter((branch) => branch?.branchName).map((branch) => ({ id: branch.id, name: branch.branchName }))
  const reassignedByOriginalFile = new Map(filtered.filter((upload) => String(upload.fileName || '').endsWith(' - Reassigned')).map((upload) => [String(upload.fileName).replace(/ - Reassigned$/, ''), upload.assignedTo || upload.reassignedTo || '—']))
  const visibleUploads = visibleUploadRows.map((upload) => {
    const reassignedTo = upload.reassignedTo || reassignedByOriginalFile.get(String(upload.fileName || ''))
    return reassignedTo ? { ...upload, reassigned: true, reassignedTo, status: `Reassigned to ${reassignedTo}` } : upload
  })
  const reassignedByDeadline = new Map(visibleUploads.filter((upload) => upload.reassigned).map((upload) => [String(upload.deadlineAt || ''), upload.reassignedTo || upload.assignedTo || '—']))
  const duration = (deadline) => { const reassignedTo = reassignedByDeadline.get(String(deadline || '')); if (reassignedTo) return `Reassigned to ${reassignedTo}`; if (!deadline) return '—'; const days = Math.ceil((new Date(`${String(deadline).slice(0, 10)}T23:59:59`) - new Date()) / 86400000); return days < 0 ? 'Overdue' : `${days} day${days === 1 ? '' : 's'} left` }
  if (!Array.isArray(uploads)) return <ExcelUploadSection uploads={[]} branches={branches} onView={onView} />
  if (isBranchAdmin) return <BranchExcelUploadSection uploads={uploads} onView={(upload) => { if (upload?.distributionStatus === 'DISTRIBUTED') onView(upload) }} />
  return <section className="sales-admin-view-section"><div className="sales-admin-view-card"><div className="sales-admin-lead-table-toolbar"><div><h2>Excel Upload History</h2><p>Every Excel upload is shown with its completion deadline.</p></div><div className="sales-admin-lead-filters"><input className="sales-admin-upload-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search file name" aria-label="Search Excel file name" /><select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setPage(1) }} aria-label="Filter Excel uploads by branch"><option value="ALL">All Branches</option>{branchOptions.map((branch) => <option value={branch.name} key={branch.id}>{branch.name}</option>)}</select></div></div>{filtered.length ? <><div className="sales-admin-view-table-wrap"><table><thead><tr><th>Upload Date &amp; Time</th><th>Excel File Name</th><th>Uploaded By</th><th>Assigned To</th><th>Total Leads</th><th>Deadline</th><th>Duration</th><th>Lead Completion Status</th><th>Action</th></tr></thead><tbody>{visibleUploads.map((upload) => <tr key={upload.id} className="clickable" onClick={() => onView(upload)}><td>{formatDateTime(upload.uploadDate)}</td><td>{upload.fileName || '—'}</td><td>{upload.uploadedBy || '—'}</td><td>{upload.assignedTo || '—'}</td><td>{upload.totalLeadsUploaded || 0}</td><td>{upload.deadlineAt ? formatDate(upload.deadlineAt) : '—'}</td><td>{duration(upload.deadlineAt)}</td><td><span className="sales-admin-upload-status">{String(upload.status || '—').replaceAll('_', ' ')}</span></td><td><button type="button" className="sales-admin-lead-view-action" onClick={(event) => { event.stopPropagation(); onView(upload) }}><Eye size={14} /> View</button></td></tr>)}</tbody></table></div>{filtered.length > 5 ? <div className="sales-admin-view-pagination"><span>Showing {(safePage - 1) * 5 + 1}-{Math.min(safePage * 5, filtered.length)} of {filtered.length} uploads</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>{paginationItems(safePage, pageCount).map((value, index) => value === 'ellipsis' ? <span className="sales-admin-pagination-ellipsis" key={`ellipsis-${index}`}>…</span> : <button type="button" key={value} className={value === safePage ? 'active' : ''} onClick={() => setPage(value)}>{value}</button>)}<button type="button" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button></div></div> : null} </> : <EmptyState text="No Excel uploads match the selected filters." />}</div></section>
}

// Kept for the previous distribution-details presentation used by older cached sessions.
// eslint-disable-next-line no-unused-vars
function BranchExcelUploadSection({ uploads, onView }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [details, setDetails] = useState(null)
  useEffect(() => {
    if (!details) return undefined
    document.body.classList.add('sales-admin-distribution-open')
    return () => document.body.classList.remove('sales-admin-distribution-open')
  }, [details])
  const filtered = (Array.isArray(uploads) ? uploads : []).filter((upload) => !search.trim() || String(upload.fileName || '').toLowerCase().includes(search.trim().toLowerCase()))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 5))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * 5, safePage * 5)
  return <section className="sales-admin-view-section"><div className="sales-admin-view-card"><div className="sales-admin-lead-table-toolbar"><div><h2>Excel Upload History</h2><p>Uploads received by this Branch Admin and their distribution status.</p></div><input className="sales-admin-upload-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search file name" aria-label="Search Excel file name" /></div>{visible.length ? <><div className="sales-admin-view-table-wrap"><table><thead><tr><th>Upload Date &amp; Time</th><th>Excel File Name</th><th>Uploaded By</th><th>Total Leads</th><th>Distribution Status</th><th>Deadline</th><th>Lead Completion Status</th><th>Action</th></tr></thead><tbody>{visible.map((upload) => <tr key={upload.id} className="clickable" onClick={() => onView(upload)}><td>{formatDateTime(upload.uploadDate)}</td><td>{upload.fileName || '—'}</td><td>{upload.uploadedBy || '—'}</td><td>{upload.totalLeadsUploaded || 0}</td><td><button type="button" className="sales-admin-distribution-summary" onClick={(event) => { event.stopPropagation(); setDetails(upload) }}><span className={`sales-admin-upload-status ${upload.distributionStatus === 'DISTRIBUTED' ? 'distributed' : 'waiting'}`}>{upload.distributionStatus === 'DISTRIBUTED' ? 'Distributed' : 'Waiting'}</span><small>{upload.distributionStatus === 'DISTRIBUTED' ? `${upload.distributedLeadCount || 0} leads distributed` : 'Waiting to distribute'}</small></button></td><td>{upload.deadlineAt ? formatDate(upload.deadlineAt) : '—'}</td><td><span className="sales-admin-upload-status">{String(upload.status || '—').replaceAll('_', ' ')}</span></td><td><button type="button" className="sales-admin-lead-view-action" onClick={(event) => { event.stopPropagation(); onView(upload) }}><Eye size={14} /> View</button></td></tr>)}</tbody></table></div>{filtered.length > 5 ? <div className="sales-admin-view-pagination"><span>Showing {(safePage - 1) * 5 + 1}-{Math.min(safePage * 5, filtered.length)} of {filtered.length} uploads</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>{paginationItems(safePage, pageCount).map((value, index) => value === 'ellipsis' ? <span className="sales-admin-pagination-ellipsis" key={`branch-upload-ellipsis-${index}`}>…</span> : <button type="button" key={value} className={value === safePage ? 'active' : ''} onClick={() => setPage(value)}>{value}</button>)}<button type="button" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button></div></div> : null}</> : <EmptyState text="No Excel uploads found." />}</div>{details ? <div className="sales-admin-distribution-popover" role="dialog" aria-label="Distribution details"><div className="sales-admin-distribution-popover-heading"><div><span>Distribution details</span><strong>{details.fileName}</strong></div><button type="button" onClick={() => setDetails(null)} aria-label="Close distribution details"><X size={18} strokeWidth={2.2} /></button></div><div className="sales-admin-distribution-detail-grid"><div><span>Status</span><strong>{details.distributionStatus === 'DISTRIBUTED' ? 'Distributed' : 'Waiting to distribute'}</strong></div><div><span>Total uploaded</span><strong>{details.totalLeadsUploaded || 0}</strong></div><div><span>Distributed</span><strong>{details.distributedLeadCount || 0}</strong></div><div><span>Branch balance</span><strong>{details.branchAdminBalance || 0}</strong></div></div>{details.distributionRecipients?.length ? <div className="sales-admin-distribution-recipient-list"><span>Distributed to</span>{details.distributionRecipients.map((recipient) => <div key={recipient.id}><strong>{recipient.name}</strong><span>{recipient.leadCount} leads · Deadline {recipient.deadlineAt ? formatDate(recipient.deadlineAt) : '—'}</span></div>)}</div> : <p className="sales-admin-view-muted">This upload is waiting for Branch Admin distribution.</p>}</div> : null}</section>
}

// Kept as a compact fallback while the legacy distribution-details view remains active.
function BranchExcelUploadSectionV2({ uploads, onView }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const filtered = (Array.isArray(uploads) ? uploads : []).filter((upload) => !search.trim() || String(upload.fileName || '').toLowerCase().includes(search.trim().toLowerCase()))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 5))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * 5, safePage * 5)
  return <section className="sales-admin-view-section"><div className="sales-admin-view-card"><div className="sales-admin-lead-table-toolbar"><div><h2>Excel Upload History</h2><p>Uploads received by this Branch Admin and their distribution status.</p></div><input className="sales-admin-upload-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search file name" aria-label="Search Excel file name" /></div>{visible.length ? <><div className="sales-admin-view-table-wrap"><table><thead><tr><th>Upload Date &amp; Time</th><th>Excel File Name</th><th>Uploaded By</th><th>Total Leads</th><th>Distribution Status</th><th>Deadline</th><th>Lead Completion Status</th><th>Action</th></tr></thead><tbody>{visible.map((upload) => { const waiting = upload.distributionStatus !== 'DISTRIBUTED'; return <tr key={upload.id} className={`clickable ${waiting ? 'distribution-waiting-row' : ''}`} onClick={() => { if (!waiting) onView(upload) }}><td>{formatDateTime(upload.uploadDate)}</td><td>{upload.fileName || '—'}</td><td>{upload.uploadedBy || '—'}</td><td>{upload.totalLeadsUploaded || 0}</td><td><span className={`sales-admin-upload-status ${waiting ? 'waiting' : 'distributed'}`}>{waiting ? 'Waiting' : 'Distributed'}</span><small className="sales-admin-distribution-caption">{waiting ? 'Waiting to distribute' : `${upload.distributedLeadCount || 0} leads distributed`}</small></td><td>{upload.deadlineAt ? formatDate(upload.deadlineAt) : '—'}</td><td><span className="sales-admin-upload-status">{String(upload.status || '—').replaceAll('_', ' ')}</span></td><td><button type="button" disabled={waiting} title={waiting ? 'View is available after distribution' : 'View distributed leads'} className="sales-admin-lead-view-action" onClick={(event) => { event.stopPropagation(); if (!waiting) onView(upload) }}><Eye size={14} /> View</button></td></tr>})}</tbody></table></div>{filtered.length > 5 ? <div className="sales-admin-view-pagination"><span>Showing {(safePage - 1) * 5 + 1}-{Math.min(safePage * 5, filtered.length)} of {filtered.length} uploads</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>{paginationItems(safePage, pageCount).map((value, index) => value === 'ellipsis' ? <span className="sales-admin-pagination-ellipsis" key={`branch-upload-ellipsis-${index}`}>…</span> : <button type="button" key={value} className={value === safePage ? 'active' : ''} onClick={() => setPage(value)}>{value}</button>)}<button type="button" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button></div></div> : null}</> : <EmptyState text="No Excel uploads found." />}</div></section>
}

function ExcelUploadPerformanceReport({ batchId, onBack, salesAdminId = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [selectedLead, setSelectedLead] = useState(null)
  const [leadSearch, setLeadSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('ALL')
  const [followUpFilter, setFollowUpFilter] = useState('ALL')
  useEffect(() => { let active = true; const query = salesAdminId ? `?salesAdminId=${encodeURIComponent(salesAdminId)}` : ''; request(`/sales-admins/uploads/${encodeURIComponent(batchId)}/performance${query}`).then((result) => { if (active) setData(result?.data || null) }).catch((reason) => { if (active) setError(reason?.message || 'Unable to load upload performance report.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [batchId, salesAdminId])
  const rows = useMemo(() => data?.rows || [], [data?.rows])
  const filteredRows = useMemo(() => rows.filter((row) => {
    const query = leadSearch.trim().toLowerCase()
    const matchesSearch = !query || [row.leadId, row.leadName].some((value) => String(value || '').toLowerCase().includes(query))
    const matchesStage = stageFilter === 'ALL' || String(row.leadStage || '').toUpperCase() === stageFilter || (stageFilter === 'CLOSED' && String(row.leadStatus || '').toUpperCase() === 'CLOSED')
    const matchesFollowUp = followUpFilter === 'ALL' || (followUpFilter === 'FOLLOWED' ? ['FOLLOWED', 'UPCOMING'].includes(String(row.followUpStatus || '').toUpperCase()) : String(row.followUpStatus || '').toUpperCase() === followUpFilter)
    return matchesSearch && matchesStage && matchesFollowUp
  }), [rows, leadSearch, stageFilter, followUpFilter])
  if (loading) return <main className="sales-admin-view-page"><div className="sales-admin-view-loading"><RefreshCw className="spin" /> Loading upload performance…</div></main>
  if (error) return <main className="sales-admin-view-page"><button className="sales-admin-view-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Back to Excel Upload History</button><div className="sales-admin-view-error" role="alert">{error}</div></main>
  const upload = data?.upload || {}
  const summary = data?.summary || {}
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / 5))
  const totalPages = pageCount
  const safePage = Math.min(page, pageCount)
  const visible = filteredRows.slice((safePage - 1) * 5, safePage * 5)
  const closedLeads = rows.filter((row) => String(row.leadStage || '').toUpperCase() === 'CLOSED' || String(row.leadStatus || '').toUpperCase() === 'CLOSED').length
  const cards = [['Total Leads', summary.totalLeads, 'total', UsersRound], ['Followed Leads', summary.followedLeads, 'followed', ListTodo], ['Not Followed Leads', summary.notFollowedLeads, 'not-followed', BellRing], ['Pending Leads', summary.pendingLeads, 'pending', Clock3], ['Upcoming Leads', summary.upcomingLeads, 'upcoming', CalendarDays], ['Hot Leads', summary.hotLeads, 'hot', Flame], ['Warm Leads', summary.warmLeads, 'warm', Thermometer], ['Cold Leads', summary.coldLeads, 'cold', Snowflake], ['Closed Leads', closedLeads, 'closed', ShieldCheck], ['Admissions', summary.admissions, 'admission', GraduationCap]]
  return <main className="sales-admin-view-page sales-admin-upload-report-page"><header className="sales-admin-view-header"><button className="sales-admin-view-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Back to Excel Upload History</button><div className="sales-admin-view-title"><div><p className="eyebrow">LEAD PERFORMANCE REPORT</p><h1>{upload.fileName || 'Excel Upload'}</h1><p>{formatDateTime(upload.uploadDate)} · Uploaded by {upload.uploadedBy || '—'}</p></div><span className="sales-admin-upload-status">{String(upload.status === 'COMPLETED' ? 'Completed' : upload.status || '—').replaceAll('_', ' ')}</span></div></header><section className="sales-admin-upload-report-info"><div><span>Assigned Sales Admin</span><strong>{upload.assignedTo || '—'}</strong></div><div><span>Total Leads Uploaded</span><strong>{upload.totalLeadsUploaded || 0}</strong></div><div><span>Branch</span><strong>{upload.branchName || '—'}</strong></div></section><section className="sales-admin-view-section"><div className="sales-admin-upload-summary-grid">{cards.map(([label, value, tone]) => <div className={`sales-admin-upload-summary-card ${tone}`} key={label}><span>{label}</span><strong>{value || 0}</strong></div>)}</div><div className="sales-admin-view-card"><div className="sales-admin-lead-table-toolbar"><div><h2>Individual Lead Report</h2><p>Only leads belonging to this Excel upload are shown.</p></div><div className="sales-admin-lead-filters sales-admin-upload-report-filters"><input type="search" value={leadSearch} onChange={(event) => { setLeadSearch(event.target.value); setPage(1) }} placeholder="Search lead name or ID" aria-label="Search lead name or ID" /><select value={stageFilter} onChange={(event) => { setStageFilter(event.target.value); setPage(1) }} aria-label="Filter leads by stage"><option value="ALL">All Stages</option><option value="HOT">Hot</option><option value="WARM">Warm</option><option value="COLD">Cold</option><option value="CLOSED">Closed</option></select><select value={followUpFilter} onChange={(event) => { setFollowUpFilter(event.target.value); setPage(1) }} aria-label="Filter leads by follow-up status"><option value="ALL">All Follow-up Status</option><option value="FOLLOWED">Followed</option><option value="NOT_FOLLOWED">Not Followed</option><option value="PENDING">Pending</option><option value="UPCOMING">Upcoming</option></select></div></div>{visible.length ? <div className="sales-admin-view-table-wrap"><table className="sales-admin-upload-report-table"><thead><tr><th>Lead ID</th><th>Lead Name</th><th>Phone Number</th><th>Course</th><th>Follow-up Status</th><th>Lead Status</th><th>Lead Stage</th><th>Follow-up Date</th><th>Admission Status</th><th>Action</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><strong>{row.leadId}</strong></td><td>{row.leadName}</td><td>{row.phoneNumber}</td><td>{row.course}</td><td><span className={`sales-admin-upload-followup ${row.followUpStatus.toLowerCase()}`}>{row.followUpStatus === 'FOLLOWED' ? 'Followed' : row.followUpStatus === 'UPCOMING' ? 'Upcoming' : row.followUpStatus === 'PENDING' ? 'Pending' : 'Not Followed'}</span></td><td>{String(row.leadStatus || '—').replaceAll('_', ' ')}</td><td>{String(row.leadStage || '—').replaceAll('_', ' ')}</td><td>{row.followUpDate ? `${formatDate(row.followUpDate)}${row.followUpTime ? ` · ${formatFollowUpTime(row.followUpTime)}` : ''}` : '—'}</td><td>{String(row.admissionStatus || '—').replaceAll('_', ' ')}</td><td><button type="button" className="sales-admin-lead-view-action" onClick={() => setSelectedLead(row)}>View</button></td></tr>)}</tbody></table></div> : <EmptyState text="No leads match the selected filters." />}{filteredRows.length > 5 ? <div className="sales-admin-view-pagination"><span>Showing {(safePage - 1) * 5 + 1}-{Math.min(safePage * 5, filteredRows.length)} of {filteredRows.length} leads</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>{paginationItems(safePage, pageCount).map((value, index) => value === 'ellipsis' ? <span className="sales-admin-pagination-ellipsis" key={`ellipsis-${index}`}>…</span> : <button type="button" key={value} className={value === safePage ? 'active' : ''} onClick={() => setPage(value)}>{value}</button>)}<button type="button" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button></div></div> : null}</div></section>{selectedLead ? <div className="sales-admin-lead-detail-popover"><div><strong>{selectedLead.leadName}</strong><button type="button" onClick={() => setSelectedLead(null)} aria-label="Close lead details"><X size={18} strokeWidth={2.2} /></button></div><p>{selectedLead.leadId} · {selectedLead.phoneNumber}</p><span>{selectedLead.course}</span><span>{selectedLead.followUpStatus === 'FOLLOWED' ? 'Followed' : selectedLead.followUpStatus === 'UPCOMING' ? 'Upcoming' : selectedLead.followUpStatus === 'PENDING' ? 'Pending' : 'Not Followed'} · {selectedLead.followUps?.length || 0} follow-up records</span>{selectedLead.activities?.length ? <span>{selectedLead.activities.length} CRM activity records</span> : null}</div> : null}</main>
}

function ExcelUploadFlowOverlay({ batchId, salesAdminId = '' }) {
  const targetRequestRef = useRef(0)
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState({ branches: [], targets: [] })
  const [branchId, setBranchId] = useState('')
  const [branchEditable, setBranchEditable] = useState(false)
  const [step, setStep] = useState(1)
  const [distributionMode, setDistributionMode] = useState('single')
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([])
  const [allocations, setAllocations] = useState({})
  const [targetsLoading, setTargetsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [allocationError, setAllocationError] = useState('')
  const load = useCallback(() => { const query = salesAdminId ? `?salesAdminId=${encodeURIComponent(salesAdminId)}` : ''; return request(`/sales-admins/uploads/${encodeURIComponent(batchId)}/performance${query}`).then((result) => setData(result?.data || null)).catch((reason) => setMessage(reason?.message || 'Unable to load upload progress.')) }, [batchId, salesAdminId])
  useEffect(() => { void load() }, [load])
  const upload = data?.upload || {}
  const rows = data?.rows || []
  const pendingRows = rows.filter((row) => ['PENDING', 'NOT_FOLLOWED'].includes(row.followUpStatus) && row.leadRecordId)
  const reassignableRows = rows.filter((row) => row.reassignEligible === true && row.leadRecordId)
  const deadlinePassed = reassignableRows.length > 0 || Boolean(upload.deadlineAt && new Date(`${String(upload.deadlineAt).slice(0, 10)}T23:59:59`) < new Date())
  const status = pendingRows.length === 0 && rows.length ? 'Completed' : reassignableRows.length > 0 || upload.progressStatus === 'OVERDUE' || upload.status === 'OVERDUE' ? 'Overdue' : 'In Progress'
  const totalRows = rows.length
  const deadlineEnd = upload.deadlineAt ? new Date(`${String(upload.deadlineAt).slice(0, 10)}T23:59:59`) : null
  const daysRemaining = deadlineEnd ? Math.ceil((deadlineEnd.getTime() - new Date().getTime()) / 86400000) : null
  const statusOverdue = status === 'Overdue' || upload.progressStatus === 'OVERDUE' || upload.status === 'OVERDUE'
  const reassignAvailable = reassignableRows.length > 0
  const remainingLabel = statusOverdue ? 'Overdue' : daysRemaining === null ? 'No deadline' : daysRemaining < 0 ? 'Overdue' : daysRemaining === 0 ? 'Due today' : `${daysRemaining} ${daysRemaining === 1 ? 'DAY' : 'DAYS'} LEFT`
  const loadTargetsForBranch = async (selectedBranchId) => {
    const requestId = ++targetRequestRef.current
    setTargetsLoading(true)
    setSelectedRecipientIds([])
    setAllocations({})
    setAllocationError('')
    try {
      const result = await getLeadImportTargets(selectedBranchId || upload.branchId || '')
      const next = result?.data || result || {}
      const targetOptions = (next.targets || []).filter((target) => ['SALES_ADMIN', 'BRANCH_ADMIN'].includes(String(target.role || '').toUpperCase())).map((target) => ({ ...target, role: String(target.role || 'Sales Admin').replaceAll('_', ' ') }))
      if (requestId === targetRequestRef.current) setTargets({ ...next, targets: targetOptions })
    } catch (reason) {
      if (requestId === targetRequestRef.current) { setTargets((current) => ({ ...current, targets: [] })); setAllocationError(reason?.message || 'Unable to load recipients for this branch.') }
    } finally { if (requestId === targetRequestRef.current) setTargetsLoading(false) }
  }
  const openDialog = () => { setMessage(''); setAllocationError(''); setAllocations({}); setSelectedRecipientIds([]); setDistributionMode('single'); setStep(1); setBranchEditable(false); setBranchId(upload.branchId || ''); setOpen(true) }
  useEffect(() => {
    if (!open) return
    // Branch changes must refresh the available Sales Admin list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTargetsForBranch(branchId || upload.branchId || '')
    // The target loader is intentionally scoped to the selected branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, open, upload.branchId])
  const selectedTargets = (targets.targets || []).filter((target) => selectedRecipientIds.includes(target.id))
  const activeAllocations = selectedTargets.map((target) => ({ target, count: distributionMode === 'single' ? reassignableRows.length : Number(allocations[target.id]?.count || 0), deadlineAt: allocations[target.id]?.deadlineAt || '' })).filter((item) => item.count > 0)
  const allocatedCount = activeAllocations.reduce((sum, item) => sum + item.count, 0)
  const remainingCount = reassignableRows.length - allocatedCount
  const allocationReady = activeAllocations.length > 0 && allocatedCount === reassignableRows.length && activeAllocations.every((item) => Boolean(item.deadlineAt))
  const continueToAllocation = () => {
    if (!selectedRecipientIds.length) { setAllocationError(distributionMode === 'single' ? 'Select one recipient to continue.' : 'Select at least one recipient to continue.'); return }
    if (distributionMode === 'single' && selectedRecipientIds.length !== 1) { setAllocationError('Choose exactly one recipient for single distribution.'); return }
    setAllocationError('')
    setStep(2)
  }
  const submit = async () => {
    if (!activeAllocations.length) { setAllocationError('Enter a lead count for at least one recipient.'); return }
    if (allocatedCount !== reassignableRows.length) { setAllocationError(`Allocate all ${reassignableRows.length} eligible leads. ${remainingCount > 0 ? `${remainingCount} remain unassigned.` : `${Math.abs(remainingCount)} are over-allocated.`}`); return }
    if (activeAllocations.some((item) => !item.deadlineAt)) { setAllocationError('Choose a new deadline for every selected recipient.'); return }
    setBusy(true); setMessage('')
    try {
      await reassignLeadImport(batchId, { rowIds: reassignableRows.map((row) => row.id), branchId: branchId || upload.branchId, allocations: activeAllocations.map((item) => ({ assignedToId: item.target.id, count: item.count, deadlineAt: item.deadlineAt })) })
      setOpen(false); setMessage('Overdue leads reassigned successfully.'); await load()
    } catch (reason) { setAllocationError(reason?.message || 'Unable to reassign overdue leads.') } finally { setBusy(false) }
  }
  return <div className={`deadline-workflow-banner${salesAdminId ? ' is-scoped-sales-admin' : ''}`}>
    <div className="deadline-workflow-header">
      <strong>COMPLETION DEADLINE</strong>
      <span className={`deadline-workflow-status ${status === 'Completed' ? 'is-complete' : status === 'In Progress' ? 'is-in-progress' : deadlinePassed ? 'is-overdue' : ''}`}>{status.toUpperCase()}</span>
    </div>
    <div className="deadline-workflow-details">
      <div><span>Deadline</span><strong>{upload.deadlineAt ? formatDate(upload.deadlineAt) : '—'}</strong></div>
      <div><span>Time Remaining</span><strong className={deadlinePassed ? 'is-overdue' : ''}>{remainingLabel}</strong></div>
      <div><span>Assigned To</span><strong>{upload.assignedTo || '—'}</strong></div>
    </div>
    <div className="deadline-workflow-metrics">
      <div><span>Total Leads</span><strong>{totalRows}</strong></div>
      <div><span>Followed</span><strong>{rows.filter((row) => row.followUpStatus === 'FOLLOWED').length}</strong></div>
      <div><span>Not Followed</span><strong>{rows.filter((row) => row.followUpStatus !== 'FOLLOWED').length}</strong></div>
    </div>
    {message ? <div className={message.includes('successfully') ? 'deadline-workflow-message is-success' : 'deadline-workflow-message'}>{message}</div> : null}
    <button type="button" className="sales-admin-lead-view-action" onClick={openDialog} disabled={!reassignAvailable}>Reassign Overdue Leads{reassignableRows.length ? ` (${reassignableRows.length})` : ''}</button>
    {open ? <div className="lead-reassign-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false) }}>
      <section className={`lead-reassign-modal${step === 1 ? ' is-step-one' : ''}`} role="dialog" aria-modal="true" aria-labelledby="reassign-pending-title" aria-describedby="reassign-pending-description">
        <header className="lead-reassign-modal-header"><div className="lead-reassign-modal-icon"><UsersRound size={20} /></div><div><p>DEADLINE FOLLOW-UP</p><h2 id="reassign-pending-title">Reassign overdue leads</h2><span id="reassign-pending-description">Only leads with an expired deadline and no follow-up are included.</span></div><button type="button" className="lead-reassign-modal-close" aria-label="Close" onClick={() => setOpen(false)} disabled={busy}><X size={18} /></button></header>
        <div className="lead-reassign-modal-body">
          <div className="lead-reassign-steps" aria-label="Reassignment steps"><button type="button" className={`lead-reassign-step-trigger${step === 1 ? ' is-current' : ' is-done'}`} onClick={() => { setStep(1); setAllocationError('') }} aria-current={step === 1 ? 'step' : undefined}><b>1</b><span>Choose recipients</span></button><i /><button type="button" className={`lead-reassign-step-trigger${step === 2 ? ' is-current' : ''}`} onClick={continueToAllocation} aria-current={step === 2 ? 'step' : undefined}><b>2</b><span>Set allocation</span></button></div>
          <div className="lead-reassign-context-grid"><div className="lead-reassign-branch-card"><div><span>DESTINATION BRANCH</span><strong>{(targets.branches || []).find((branch) => branch.id === branchId)?.branchName || upload.branchName || 'Select branch'}</strong></div><button type="button" className="lead-reassign-branch-edit" aria-label={branchEditable ? 'Lock destination branch' : 'Change destination branch'} title={branchEditable ? 'Lock branch' : 'Change branch'} onClick={() => { setBranchEditable((value) => !value); setStep(1); setAllocationError('') }} disabled={busy || targetsLoading}><Edit3 size={15} /><span>{branchEditable ? 'Done' : 'Change'}</span></button>{branchEditable ? <select className="lead-reassign-branch-select" value={branchId} onChange={(event) => { setBranchId(event.target.value); setStep(1); setAllocationError('') }} disabled={busy || targetsLoading}><option value="">Select branch</option>{(targets.branches || []).map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}</select> : null}</div><div className="lead-reassign-eligible-count"><span>Eligible to reassign</span><strong>{reassignableRows.length}</strong><small>Overdue · Not followed</small></div></div>
          {step === 1 ? <>
            <div className="lead-reassign-recipient-heading"><div><h3>How would you like to distribute?</h3><p>Choose one account or split the eligible leads across several.</p></div></div>
            <div className="lead-reassign-mode-grid"><button type="button" className={`lead-reassign-mode-card${distributionMode === 'single' ? ' is-active' : ''}`} onClick={() => { setDistributionMode('single'); setSelectedRecipientIds((current) => current.slice(0, 1)); setAllocationError('') }}><strong>Single account</strong><span>Send all {reassignableRows.length} eligible leads to one account.</span></button><button type="button" className={`lead-reassign-mode-card${distributionMode === 'multiple' ? ' is-active' : ''}`} onClick={() => { setDistributionMode('multiple'); setSelectedRecipientIds([]); setAllocationError('') }}><strong>Multiple accounts</strong><span>Select branch admins or assigned sales admins and split the leads.</span></button></div>
            <div className="lead-reassign-recipient-heading"><div><h3>{distributionMode === 'single' ? 'Select one recipient' : 'Select recipients'}</h3><p>{targets.targets.length} active account{targets.targets.length === 1 ? '' : 's'} assigned to this branch. {distributionMode === 'single' ? 'Choose one account.' : 'Choose one or more accounts.'}</p></div><span>{selectedRecipientIds.length} selected</span></div>
            {targetsLoading ? <div className="lead-reassign-empty-state">Loading branch recipients...</div> : targets.targets.length ? <details className="lead-reassign-account-dropdown"><summary><strong>{selectedTargets.length ? distributionMode === 'single' ? `${selectedTargets[0].fullName} · ${selectedTargets[0].role}` : `${selectedTargets.length} accounts selected` : distributionMode === 'single' ? 'Choose one account' : 'Choose accounts'}</strong><span>{distributionMode === 'single' ? 'Select one recipient' : 'Select multiple recipients'}</span><ChevronDown size={18} aria-hidden="true" /></summary><div className="lead-reassign-choice-list">{targets.targets.map((target) => {
              const checked = selectedRecipientIds.includes(target.id)
              return <label className={`lead-reassign-choice${checked ? ' is-selected' : ''}`} key={target.id}>
                <input type={distributionMode === 'single' ? 'radio' : 'checkbox'} name="lead-reassign-recipient" checked={checked} onChange={(event) => { setSelectedRecipientIds((current) => distributionMode === 'single' ? (event.target.checked ? [target.id] : []) : event.target.checked ? [...new Set([...current, target.id])] : current.filter((id) => id !== target.id)); setAllocationError('') }} disabled={busy} />
                <strong>{target.fullName}</strong><span className={`lead-reassign-role-badge ${String(target.role).toLowerCase().replaceAll(' ', '-')}`}>{target.role}</span><small>{(targets.branches || []).find((branch) => branch.id === branchId)?.branchName || upload.branchName || ''}</small>
              </label>
            })}</div></details> : <div className="lead-reassign-empty-state">No active Sales Admin or Branch Admin accounts are assigned to this branch.</div>}
          </> : <>
            <div className="lead-reassign-recipient-heading"><div><h3>Set lead counts and new deadlines</h3><p>{distributionMode === 'single' ? 'All eligible leads go to the selected account.' : 'Counts must add up to the eligible lead total.'}</p></div><span>{selectedTargets.length} recipient{selectedTargets.length === 1 ? '' : 's'}</span></div>
            <div className="lead-reassign-recipient-list">{selectedTargets.map((target) => {
              const allocation = allocations[target.id] || {}
              const count = distributionMode === 'single' ? reassignableRows.length : allocation.count ?? ''
              const branchName = targets.branches.find((branch) => branch.id === branchId)?.branchName || upload.branchName || 'Selected branch'
              return <article className={`lead-reassign-recipient${Number(count) > 0 ? ' is-selected' : ''}`} key={target.id}>
                <div className="lead-reassign-recipient-identity"><span className={`lead-reassign-role-badge ${String(target.role).toLowerCase().replaceAll(' ', '-')}`}>{target.role}</span><strong>{target.fullName}</strong><small><GitBranch size={12} /> {branchName}</small></div>
                <label>Leads<input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={count} readOnly={distributionMode === 'single'} disabled={busy} onChange={(event) => { const value = event.target.value.replace(/\D/g, ''); setAllocations((current) => ({ ...current, [target.id]: { ...current[target.id], count: value } })); setAllocationError('') }} aria-label={`Lead count for ${target.fullName}`} aria-invalid={allocatedCount > reassignableRows.length} /></label>
                <label>New deadline<input type="date" min={todayKey()} value={allocation.deadlineAt || ''} disabled={busy} onChange={(event) => { setAllocations((current) => ({ ...current, [target.id]: { ...current[target.id], deadlineAt: event.target.value } })); setAllocationError('') }} aria-label={`New deadline for ${target.fullName}`} /></label>
              </article>
            })}</div>
            <div className={`lead-reassign-allocation-summary${remainingCount < 0 ? ' is-error' : remainingCount === 0 ? ' is-complete' : ''}`}><div><span>Assigned</span><strong>{allocatedCount} / {reassignableRows.length}</strong></div><div><span>{remainingCount >= 0 ? 'Remaining' : 'Over limit'}</span><strong>{Math.abs(remainingCount)}</strong></div><small>{remainingCount === 0 ? 'All eligible leads are allocated.' : remainingCount > 0 ? 'Allocate the remaining leads before confirming.' : 'Reduce the allocated counts to continue.'}</small></div>
          </>}
          {allocationError ? <p className="lead-reassign-error" role="alert">{allocationError}</p> : null}
        </div>
        <footer className="lead-reassign-modal-footer"><span>{step === 1 ? 'Only overdue, not-followed leads are eligible.' : 'Lead IDs stay the same. Assignment history will be recorded.'}</span><div>{step === 2 ? <button type="button" className="lead-reassign-cancel" onClick={() => { setStep(1); setAllocationError('') }} disabled={busy}>Back</button> : <button type="button" className="lead-reassign-cancel" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>}{step === 1 ? <button type="button" className="lead-reassign-confirm" onClick={continueToAllocation} disabled={busy || targetsLoading || !selectedRecipientIds.length}>Next</button> : <button type="button" className="lead-reassign-confirm" onClick={() => void submit()} disabled={busy || targetsLoading}>{busy ? 'Reassigning...' : `Confirm ${allocatedCount || 0} leads`}</button>}</div></footer>
      </section>
    </div> : null}
  </div>
}

export default function SalesAdminFullPageView({ admin, initialTab = 'overview', onBack, onEdit, branchScoped = false, isBranchAdmin = false, showEdit = true }) {
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
  const [leadDetailsPage, setLeadDetailsPage] = useState(1)
  const [downloadingReportId, setDownloadingReportId] = useState('')
  const [reportSearch, setReportSearch] = useState('')
  const [reportBranchFilter, setReportBranchFilter] = useState('ALL')
  const [changeHistory, setChangeHistory] = useState([])
  const [changeHistoryLoading, setChangeHistoryLoading] = useState(Boolean(isBranchAdmin))
  const showChangeHistory = Boolean(isBranchAdmin || admin?.role === 'SALES_ADMIN' || admin?.accountType === 'SALES_ADMIN')
  const load = useCallback(() => {
    setLoading(true); setError('')
    const params = new URLSearchParams({ from: range.from, to: range.to })
    Promise.all([request(`${branchScoped ? `/sales-admins/branch/${encodeURIComponent(admin.id)}/view` : `/sales-admins/${encodeURIComponent(admin.id)}/view`}?${params}`), listSalesCrmReportSubmissions(admin.id)])
      .then(([result, reportResult]) => { setData(result?.data || null); setReports(reportResult?.data || []) })
      .catch((reason) => setError(reason?.message || 'Unable to load Sales Admin details.'))
      .finally(() => setLoading(false))
  }, [admin.id, branchScoped, range.from, range.to])
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
  useEffect(() => {
    if (!showChangeHistory || !admin?.id) return undefined
    let active = true
    const historyPath = isBranchAdmin && admin?.managedBranch?.id
      ? `/user-role-accounts/branches/${encodeURIComponent(admin.managedBranch.id)}/admin-history`
      : `/user-role-accounts/users/${encodeURIComponent(admin.id)}/admin-history`
    request(historyPath)
      .then((response) => { if (active) setChangeHistory(Array.isArray(response?.data) ? response.data : []) })
      .catch(() => { if (active) setChangeHistory([]) })
      .finally(() => { if (active) setChangeHistoryLoading(false) })
    return () => { active = false }
  }, [admin?.id, admin?.managedBranch?.id, isBranchAdmin, showChangeHistory])
  const profile = data?.profile || admin || {}
  const excelUploads = data?.leadDetails?.excelUploads || []
  const manualLeads = data?.leadDetails?.manuallyAddedLeads || []
  const callRecords = useMemo(() => data?.callRecords || [], [data?.callRecords])
  const deletedLeads = data?.deletedLeads || []
  const branches = useMemo(() => profile.branches || [], [profile.branches])
  const tabs = [['overview', 'Overview'], ['lead-details-table', 'Lead Details'], ['excel-upload', 'Excel Upload'], ['call-records', 'Call Records & Reports'], ['deleted-leads', 'Deleted Leads'], ...(showChangeHistory ? [['change-history', 'Change History']] : [])]
  const uploadLeads = useMemo(() => selectedUpload?.leads || [], [selectedUpload])
  const workLog = data?.workLog || {}
  const branchNameById = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.branchName])), [branches])
  const reportMatches = useCallback((item) => { const query = reportSearch.trim().toLowerCase(); const branchName = item.branchName || branchNameById.get(item.branchId) || ''; return (!query || [item.leadName, item.phoneNumber, item.leadId, item.recordedBy, item.fileName, item.reportName, item.submittedBy].some((value) => String(value || '').toLowerCase().includes(query))) && (reportBranchFilter === 'ALL' || branchName === reportBranchFilter) }, [reportSearch, reportBranchFilter, branchNameById])
  const filteredCallRecords = useMemo(() => callRecords.filter(reportMatches), [callRecords, reportMatches])
  const filteredReports = useMemo(() => reports.filter((report) => { const value = report.createdAt || report.submittedAt; if (value) { const key = new Date(value).toISOString().slice(0, 10); if (key < range.from || key > range.to) return false } return reportMatches(report) }), [reports, range.from, range.to, reportMatches])
  const reportBranchOptions = branches.filter((branch) => branch?.branchName).map((branch) => ({ id: branch.id, name: branch.branchName }))
  const reportFilterControls = <div className="sales-admin-lead-filters sales-admin-report-filters"><input type="search" value={reportSearch} onChange={(event) => { setReportSearch(event.target.value); setCallPage(1); setReportsPage(1) }} placeholder="Search call records or reports" aria-label="Search call records and submitted reports" /><select value={reportBranchFilter} onChange={(event) => { setReportBranchFilter(event.target.value); setCallPage(1); setReportsPage(1) }} aria-label="Filter call records and reports by branch"><option value="ALL">All Branches</option>{reportBranchOptions.map((branch) => <option value={branch.name} key={branch.id}>{branch.name}</option>)}</select></div>
  const pageSize = 5
  const leadDetailsPageCount = Math.max(1, Math.ceil(excelUploads.length / pageSize))
  const visibleExcelUploads = excelUploads.slice((Math.min(leadDetailsPage, leadDetailsPageCount) - 1) * pageSize, Math.min(leadDetailsPage, leadDetailsPageCount) * pageSize)
  const callPageCount = Math.max(1, Math.ceil(filteredCallRecords.length / pageSize))
  const deletedPageCount = Math.max(1, Math.ceil(deletedLeads.length / pageSize))
  const reportsPageCount = Math.max(1, Math.ceil(filteredReports.length / pageSize))
  const visibleCallRecords = filteredCallRecords.slice((Math.min(callPage, callPageCount) - 1) * pageSize, Math.min(callPage, callPageCount) * pageSize)
  const visibleDeletedLeads = deletedLeads.slice((Math.min(deletedPage, deletedPageCount) - 1) * pageSize, Math.min(deletedPage, deletedPageCount) * pageSize)
  const visibleReports = filteredReports.slice((Math.min(reportsPage, reportsPageCount) - 1) * pageSize, Math.min(reportsPage, reportsPageCount) * pageSize)
  if (loading) return <main className="sales-admin-view-page"><div className="sales-admin-view-loading"><RefreshCw className="spin" /> Loading Sales Admin details…</div></main>
  if (selectedUploadReport) return <><button className={`sales-admin-view-back sales-admin-upload-report-back${branchScoped ? '' : ' is-super-admin'}`} type="button" onClick={() => setSelectedUploadReport(null)}><ArrowLeft size={18} /> Back to Excel Upload History</button><ExcelUploadFlowOverlay batchId={selectedUploadReport.id} salesAdminId={branchScoped ? '' : admin.id} /><ExcelUploadPerformanceReport batchId={selectedUploadReport.id} salesAdminId={admin.id} onBack={() => setSelectedUploadReport(null)} /></>
  return <main className={`sales-admin-view-page${isBranchAdmin ? ' is-branch-admin' : ''}`}>
    {isBranchAdmin ? <style>{`.sales-admin-view-page.is-branch-admin .sales-admin-account-fields > div:nth-child(1) span,.sales-admin-view-page.is-branch-admin .sales-admin-account-fields > div:nth-child(2) span{font-size:0}.sales-admin-view-page.is-branch-admin .sales-admin-account-fields > div:nth-child(1) span::after{content:'Branch Admin Name';font-size:12px}.sales-admin-view-page.is-branch-admin .sales-admin-account-fields > div:nth-child(2) span::after{content:'Branch Admin ID';font-size:12px}`}</style> : null}
    <header className="sales-admin-view-header"><button className="sales-admin-view-back" type="button" onClick={onBack}><ArrowLeft size={18} /> {isBranchAdmin ? 'Back to Branch Admins' : 'Back to Sales Admins'}</button><div className="sales-admin-view-title"><div><p className="eyebrow">{isBranchAdmin ? 'BRANCH ADMIN VIEW' : 'SALES ADMIN VIEW'}</p><h1>{profile.fullName || profile.name || '-'}</h1></div><div className="sales-admin-view-header-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}><div className="sales-admin-view-header-action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span className={`sales-admin-view-status ${profile.active === false ? 'inactive' : ''}`}>{profile.active === false ? 'Inactive' : 'Active'}</span>{showEdit ? <button type="button" onClick={() => onEdit?.(profile)}><Edit3 size={16} /> Edit</button> : null}</div>{tab !== 'overview' ? <DateFilter range={range} onChange={setRange} /> : null}</div></div></header>
    <nav className="sales-admin-view-tabs" aria-label="Sales Admin details tabs">{tabs.map(([key, label]) => <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {error ? <div className="sales-admin-view-error" role="alert">{error}<button type="button" onClick={load}>Retry</button></div> : null}
    {tab === 'lead-details-table' ? <LeadDetailsSection leadDetails={data?.leadDetails} branches={branches} /> : null}
    {tab === 'excel-upload' ? <ExcelUploadSectionWithDeadline uploads={excelUploads} branches={branches} onView={setSelectedUploadReport} isBranchAdmin={isBranchAdmin} /> : null}
    {tab === 'overview' ? <section className="sales-admin-view-section"><div className="sales-admin-view-grid"><article className="sales-admin-view-card sales-admin-account-card"><div className="sales-admin-view-card-heading"><div><p className="sales-admin-view-section-kicker">ACCOUNT PROFILE</p><h2>Account Information</h2></div><ShieldCheck size={22} /></div><div className="sales-admin-account-fields"><div><span><UserRound size={16} />Sales Admin Name</span><strong>{profile.fullName || profile.name || '—'}</strong></div><div><span><ShieldCheck size={16} />Sales Admin ID</span><strong>{profile.userCode || profile.id || '—'}</strong></div><div><span><Mail size={16} />Email Address</span><strong>{profile.email || '—'}</strong></div><div><span><Phone size={16} />Phone Number</span><strong>{profile.phone || '—'}</strong></div><div><span><GitBranch size={16} />Assigned Branches</span><strong className="sales-admin-branch-values">{branches.length ? branches.map((branch) => <em key={branch.id}>{branch.branchName}</em>) : '—'}</strong></div><div><span><ShieldCheck size={16} />Account Status</span><strong><b className={`sales-admin-inline-status ${profile.active === false ? 'inactive' : ''}`}>{profile.active === false ? 'Inactive' : 'Active'}</b></strong></div></div></article><article className="sales-admin-view-card sales-admin-work-card"><div className="sales-admin-view-card-heading"><div><p className="sales-admin-view-section-kicker">TODAY</p><h2>Today's Work Log</h2></div><Clock3 size={22} /></div><div className="sales-admin-view-work-grid"><div><span><ShieldCheck size={15} />Attendance Status</span><strong className={`sales-admin-work-status ${workStatusTone(workLog.status)}`}>{workStatusLabel(workLog.status || (workLog.isLoggedIn ? 'LOGGED_IN' : 'LOGGED_OUT'))}</strong></div><div><span><LogIn size={15} />Login Time</span><strong>{workLog.loginTime || workLog.firstLoginAt ? formatDateTime(workLog.loginTime || workLog.firstLoginAt) : '—'}</strong></div><div><span><LogOut size={15} />Logout Time</span><strong>{workLog.logoutTime || workLog.finalLogoutAt ? formatDateTime(workLog.logoutTime || workLog.finalLogoutAt) : '—'}</strong></div><div><span><Timer size={15} />Working Duration</span><strong>{formatDuration(workLog.workingSeconds || workLog.totalWorkingSeconds || workLog.durationSeconds) || '—'}</strong></div></div></article></div></section> : null}
    {tab === 'lead-details' ? <section className="sales-admin-view-section"><div className="sales-admin-view-summary"><div><strong>{data?.leadDetails?.counts?.excelUploads || 0}</strong><span>Excel leads</span></div><div><strong>{data?.leadDetails?.counts?.manual || 0}</strong><span>Manual leads</span></div><div><strong>{excelUploads.length}</strong><span>Excel uploads</span></div></div><div className="sales-admin-view-card"><div className="sales-admin-view-card-heading"><div><h2>Excel Uploaded Leads</h2><p>Each upload is kept as a separate record.</p></div><FileSpreadsheet size={22} /></div>{excelUploads.length ? <><div className="sales-admin-view-table-wrap"><table><thead><tr><th>Upload Date</th><th>File Name</th><th>Total Leads</th><th>Uploaded By</th><th>Assigned To</th><th>Status</th></tr></thead><tbody>{visibleExcelUploads.map((upload) => <tr key={upload.id} className="clickable" onClick={() => setSelectedUpload(upload)}><td>{formatDateTime(upload.uploadDate)}</td><td>{upload.fileName}</td><td>{upload.totalLeadsUploaded}</td><td>{upload.uploadedBy}</td><td>{upload.assignedTo || '—'}</td><td>{upload.status === 'COMPLETED' ? 'Excel Completed' : upload.status || '—'}</td></tr>)}</tbody></table></div>{excelUploads.length > 5 ? <div className="sales-admin-view-pagination"><span>Showing {(Math.min(leadDetailsPage, leadDetailsPageCount) - 1) * pageSize + 1}-{Math.min(leadDetailsPage * pageSize, excelUploads.length)} of {excelUploads.length} uploads</span><div><button type="button" disabled={leadDetailsPage === 1} onClick={() => setLeadDetailsPage((page) => Math.max(1, page - 1))}>Previous</button>{paginationItems(Math.min(leadDetailsPage, leadDetailsPageCount), leadDetailsPageCount).map((value, index) => value === 'ellipsis' ? <span className="sales-admin-pagination-ellipsis" key={`lead-details-ellipsis-${index}`}>…</span> : <button type="button" key={value} className={value === leadDetailsPage ? 'active' : ''} onClick={() => setLeadDetailsPage(value)}>{value}</button>)}<button type="button" disabled={leadDetailsPage === leadDetailsPageCount} onClick={() => setLeadDetailsPage((page) => Math.min(leadDetailsPageCount, page + 1))}>Next</button></div></div> : null}</> : <EmptyState text="No Excel uploads found for this date range." />}{selectedUpload ? <div className="sales-admin-view-upload-detail"><h3>{selectedUpload.fileName} · {selectedUpload.totalLeadsUploaded} leads</h3>{uploadLeads.length ? <div className="sales-admin-view-table-wrap"><table><thead><tr><th>Lead ID</th><th>Name</th><th>Phone</th><th>Course</th><th>Status</th></tr></thead><tbody>{uploadLeads.map((lead) => <tr key={lead.id}><td>{lead.leadId}</td><td>{lead.studentName}</td><td>{lead.phoneNumber}</td><td>{lead.course}</td><td>{lead.status || lead.stage || '-'}</td></tr>)}</tbody></table></div> : <EmptyState text="No active lead rows are available for this upload." />}</div> : null}</div><div className="sales-admin-view-card"><div className="sales-admin-view-card-heading"><div><h2>Manually Added Leads</h2><p>Leads created through Add Lead, separate from Excel uploads.</p></div></div>{manualLeads.length ? <div className="sales-admin-view-table-wrap"><table><thead><tr><th>Lead Name</th><th>Phone Number</th><th>Course</th><th>Status</th><th>Added Date</th><th>Added By</th></tr></thead><tbody>{manualLeads.map((lead) => <tr key={lead.id}><td>{lead.leadName}</td><td>{lead.phoneNumber}</td><td>{lead.course}</td><td>{lead.status || lead.stage || '-'}</td><td>{formatDate(lead.addedDate)}</td><td>{lead.addedBy}</td></tr>)}</tbody></table></div> : <EmptyState text="No manually added leads found for this date range." />}</div></section> : null}
    {tab === 'call-records' ? <section className="sales-admin-view-section">{reportFilterControls}<div className="sales-admin-view-card"><div className="sales-admin-view-card-heading"><div><h2>Call Records</h2><p>Call recordings associated with this Sales Admin.</p></div><Headphones size={22} /></div><div className="sales-admin-view-table-wrap"><table><thead><tr><th>Lead Name</th><th>Lead ID</th><th>Contact Number</th><th>Call Date</th><th>Recorded By</th><th>Recording</th><th>Action</th></tr></thead><tbody>{visibleCallRecords.length ? visibleCallRecords.map((record) => <tr key={record.id}><td>{record.leadName}</td><td>{record.leadId || '-'}</td><td>{record.phoneNumber}</td><td>{formatDateTime(record.callDate)}</td><td>{record.recordedBy}</td><td><AudioPlayer recording={record} /></td><td><RecordingDownloadButton recording={record} /></td></tr>) : <tr><td colSpan="7" className="sales-admin-table-empty-cell">No call records found for this date range.</td></tr>}</tbody></table></div>{filteredCallRecords.length > 5 && callPageCount > 1 ? <div className="sales-admin-view-pagination"><span>Showing {(Math.min(callPage, callPageCount) - 1) * pageSize + 1}-{Math.min(callPage * pageSize, filteredCallRecords.length)} of {filteredCallRecords.length} records</span><div><button type="button" disabled={callPage === 1} onClick={() => setCallPage((page) => Math.max(1, page - 1))}>Previous</button>{paginationItems(Math.min(callPage, callPageCount), callPageCount).map((value, index) => value === 'ellipsis' ? <span className="sales-admin-pagination-ellipsis" key={`call-ellipsis-${index}`}>…</span> : <button type="button" key={value} className={value === callPage ? 'active' : ''} onClick={() => setCallPage(value)}>{value}</button>)}<button type="button" disabled={callPage === callPageCount} onClick={() => setCallPage((page) => Math.min(callPageCount, page + 1))}>Next</button></div></div> : null}</div><div className="sales-admin-view-card"><h2>Submitted Reports</h2><div className="sales-admin-view-table-wrap"><table><thead><tr><th>Report</th><th>Submitted By</th><th>Submitted Date</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleReports.length ? visibleReports.map((report) => <tr key={report.id}><td>{report.fileName || report.reportName || 'Sales CRM report'}</td><td>{report.submittedBy || report.createdByName || '-'}</td><td>{formatDateTime(report.createdAt || report.submittedAt)}</td><td>{report.status || 'Submitted'}</td><td><button type="button" className="sales-admin-lead-view-action" onClick={() => downloadSubmittedReport(report)} disabled={downloadingReportId === report.id}>{downloadingReportId === report.id ? 'Downloading...' : 'Download'}</button></td></tr>) : <tr><td colSpan="5" className="sales-admin-table-empty-cell">No submitted reports found for this date range.</td></tr>}</tbody></table></div>{reportsPageCount > 1 ? <div className="sales-admin-view-pagination"><span>Showing {(Math.min(reportsPage, reportsPageCount) - 1) * pageSize + 1}-{Math.min(reportsPage * pageSize, filteredReports.length)} of {filteredReports.length} reports</span><div><button type="button" disabled={reportsPage === 1} onClick={() => setReportsPage((value) => Math.max(1, value - 1))}>Previous</button>{paginationItems(Math.min(reportsPage, reportsPageCount), reportsPageCount).map((value, index) => value === 'ellipsis' ? <span className="sales-admin-pagination-ellipsis" key={`reports-ellipsis-${index}`}>…</span> : <button type="button" key={value} className={value === reportsPage ? 'active' : ''} onClick={() => setReportsPage(value)}>{value}</button>)}<button type="button" disabled={reportsPage === reportsPageCount} onClick={() => setReportsPage((value) => Math.min(reportsPageCount, value + 1))}>Next</button></div></div> : null}</div></section> : null}
    {tab === 'deleted-leads' ? <section className="sales-admin-view-section"><div className="sales-admin-view-card"><div className="sales-admin-view-card-heading"><div><h2>Deleted Leads</h2><p>Deletion history preserved for this Sales Admin.</p></div></div><div className="sales-admin-view-table-wrap"><table><thead><tr><th>Lead Name</th><th>Phone Number</th><th>Course</th><th>Previous Status</th><th>Deleted Date</th><th>Deleted By</th><th>Details</th></tr></thead><tbody>{visibleDeletedLeads.length ? visibleDeletedLeads.map((lead) => <tr key={lead.id}><td>{lead.studentName}</td><td>{lead.phoneNumber}</td><td>{lead.course?.name || lead.otherCourse || '-'}</td><td>{lead.status || lead.stage || '-'}</td><td>{formatDateTime(lead.deletedAt)}</td><td>{lead.deletedByName || '-'}</td><td>{lead.deletedByRole || '-'}</td></tr>) : <tr><td colSpan="7" className="sales-admin-table-empty-cell">No deleted leads found for this date range.</td></tr>}</tbody></table></div>{deletedPageCount > 1 ? <div className="sales-admin-view-pagination"><span>Showing {(Math.min(deletedPage, deletedPageCount) - 1) * pageSize + 1}-{Math.min(deletedPage * pageSize, deletedLeads.length)} of {deletedLeads.length} leads</span><div><button type="button" disabled={deletedPage === 1} onClick={() => setDeletedPage((page) => Math.max(1, page - 1))}>Previous</button>{paginationItems(Math.min(deletedPage, deletedPageCount), deletedPageCount).map((value, index) => value === 'ellipsis' ? <span className="sales-admin-pagination-ellipsis" key={`deleted-ellipsis-${index}`}>…</span> : <button type="button" key={value} className={value === deletedPage ? 'active' : ''} onClick={() => setDeletedPage(value)}>{value}</button>)}<button type="button" disabled={deletedPage === deletedPageCount} onClick={() => setDeletedPage((page) => Math.min(deletedPageCount, page + 1))}>Next</button></div></div> : null}</div></section> : null}
    {tab === 'change-history' && showChangeHistory ? <section className="sales-admin-view-section"><div className="sales-admin-view-card"><div className="sales-admin-view-card-heading"><div><p className="sales-admin-view-section-kicker">AUDIT TRAIL</p><h2>Change History</h2><p>{isBranchAdmin ? 'Branch Admin account and branch assignment changes.' : 'Sales Admin account changes and verified email history.'}</p></div><ShieldCheck size={22} /></div>{changeHistoryLoading ? <div className="sales-admin-view-loading" style={{ minHeight: 180 }}>Loading change history…</div> : changeHistory.length ? <div className="sales-admin-view-table-wrap"><table><thead><tr><th>Date &amp; Time</th><th>Change</th><th>Details</th><th>Status</th></tr></thead><tbody>{changeHistory.map((item) => <tr key={item.id}><td>{formatDateTime(item.createdAt)}</td><td>{String(item.operationType || '').replaceAll('_', ' ')}</td><td>{item.operationType === 'ROLE_UPDATED' ? `${item.previousAccountType || '-'} → ${item.newAccountType || '-'}` : item.operationType === 'EMAIL_VERIFIED' ? `${item.oldEmail || '-'} → ${item.newEmail || '-'}` : item.operationType === 'ADMIN_REPLACED' ? `${item.oldEmail || 'Previous admin'} → ${item.newEmail || 'New admin'}` : item.newEmail || item.newAccountType || 'Account details updated'}</td><td>{item.status || 'COMPLETED'}</td></tr>)}</tbody></table></div> : <EmptyState text={`No change history available for this ${isBranchAdmin ? 'Branch Admin' : 'Sales Admin'}.`} />}</div></section> : null}
  </main>
}
