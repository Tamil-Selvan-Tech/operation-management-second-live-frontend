import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Eye, FileSpreadsheet, Flame, RefreshCw, XCircle } from 'lucide-react'
import { request } from '../services/apiClient'

const dateTime = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '-'
const dateOnly = (value) => {
  const dateKey = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '-'
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(year, month - 1, day))
}
const label = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
const normalizedStatus = (value) => String(value || '').toUpperCase().replaceAll(' ', '_')

function Count({ icon: Icon, title, value, tone = 'blue' }) {
  return <div className={`sales-admin-upload-count is-${tone}`}><span><Icon size={16} /></span><div><small>{title}</small><strong>{Number(value || 0).toLocaleString('en-IN')}</strong></div></div>
}

export function SalesAdminUploadsPage({ salesAdminId = '' } = {}) {
  const [uploads, setUploads] = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [uploaderFilter, setUploaderFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const params = new URLSearchParams(); if (search.trim()) params.set('search', search.trim()); if (salesAdminId) params.set('salesAdminId', salesAdminId); const response = await request(`/sales-admins/uploads${params.toString() ? `?${params.toString()}` : ''}`); setUploads(response?.data?.uploads || []) }
    catch (reason) { setError(reason?.message || 'Unable to load upload history') }
    finally { setLoading(false) }
  }, [search, salesAdminId])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  const filtered = useMemo(() => uploads.filter((upload) => (!search.trim() || String(upload.fileName || '').toLowerCase().includes(search.trim().toLowerCase())) && (statusFilter === 'ALL' || normalizedStatus(upload.status) === statusFilter) && (uploaderFilter === 'ALL' || normalizedStatus(upload.uploadedByRole) === uploaderFilter)), [uploads, search, statusFilter, uploaderFilter])
  const pageCount = Math.max(1, Math.ceil(filtered.length / 5))
  const visibleUploads = filtered.slice((page - 1) * 5, page * 5)
  useEffect(() => { const timer = window.setTimeout(() => setPage(1), 0); return () => window.clearTimeout(timer) }, [search, statusFilter, uploaderFilter])
  const pagination = pageCount <= 3 ? Array.from({ length: pageCount }, (_, index) => index + 1) : page === 1 ? [1, 2, 3] : page === pageCount ? [pageCount - 2, pageCount - 1, pageCount] : [page - 1, page, page + 1]

  if (selected) return <UploadDetail upload={selected} salesAdminId={salesAdminId} onBack={() => setSelected(null)} />
  return <section className="sales-admin-uploads-page">
    <header className="sales-admin-uploads-header"><div><p className="eyebrow">SALES CRM</p><h2>Upload History</h2><p>Review every Excel upload assigned to you, including direct uploads and reassigned lead groups.</p></div><button type="button" className="sales-admin-upload-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'is-spinning' : ''} /> Refresh</button></header>
    <div className="sales-admin-uploads-toolbar"><label className="sales-admin-upload-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Excel file" aria-label="Search Excel file" /></label><label className="sales-admin-upload-filter"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by lead status"><option value="ALL">All Status</option><option value="IN_PROGRESS">In Progress</option><option value="OVERDUE">Overdue</option><option value="COMPLETED">Completed</option></select></label><label className="sales-admin-upload-filter sales-admin-upload-uploader-filter"><select value={uploaderFilter} onChange={(event) => setUploaderFilter(event.target.value)} aria-label="Filter by uploader"><option value="ALL">All Uploaders</option><option value="SUPER_ADMIN">Super Admin</option><option value="BRANCH_ADMIN">Branch Admin</option><option value="SALES_ADMIN">Sales Admin</option></select></label><span className="sales-admin-upload-total">{filtered.length} upload{filtered.length === 1 ? '' : 's'}</span></div>
    {error ? <div className="sales-admin-upload-error" role="alert">{error}<button type="button" onClick={() => void load()}>Try again</button></div> : null}
    <div className="sales-admin-upload-table-wrap"><table className="sales-admin-upload-table"><thead><tr><th>S.No</th><th>Excel File</th><th>Upload Date &amp; Time</th><th>Uploaded By</th><th>Total Leads</th><th>Completed</th><th>Followed</th><th>Not Followed</th><th>Lead Status</th><th>Action</th></tr></thead><tbody>{loading ? <SkeletonRows /> : visibleUploads.length ? visibleUploads.map((upload) => <tr key={upload.id} className="sales-admin-upload-clickable-row" onClick={() => setSelected(upload)} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelected(upload) }}><td>{upload.serial}</td><td><div className="sales-admin-upload-file"><FileSpreadsheet size={17} /><strong>{upload.fileName}</strong>{upload.reassigned ? <small>Reassigned {upload.assignmentCount} time{upload.assignmentCount === 1 ? '' : 's'}</small> : null}</div></td><td>{dateTime(upload.uploadDate)}</td><td><strong>{upload.uploadedBy}</strong><small className="sales-admin-upload-role">{label(upload.uploadedByRole)}</small></td><td>{upload.totalLeads}</td><td>{upload.completedLeads}</td><td><span className="sales-admin-upload-number is-followed">{upload.followedLeads}</span></td><td><span className="sales-admin-upload-number is-pending">{upload.notFollowedLeads}</span></td><td><span className={`sales-admin-upload-status is-${String(upload.status || '').toLowerCase()}`}>{label(upload.status)}</span></td><td><button type="button" className="sales-admin-upload-view" onClick={(event) => { event.stopPropagation(); setSelected(upload) }}><Eye size={18} /> View</button></td></tr>) : <tr><td colSpan="10" className="sales-admin-upload-empty">No Excel uploads found.</td></tr>}</tbody></table></div><Pagination page={page} pageCount={pageCount} pagination={pagination} onPage={setPage} />
  </section>
}

function SkeletonRows() { return Array.from({ length: 5 }, (_, row) => <tr key={`upload-skeleton-${row}`} className="sales-admin-upload-skeleton-row">{Array.from({ length: 10 }, (_, column) => <td key={column}><span /></td>)}</tr>) }
function Pagination({ page, pageCount, pagination, onPage }) { if (pageCount <= 1) return null; return <nav className="sales-admin-upload-pagination" aria-label="Upload history pagination"><button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}>Previous</button>{pagination.map((item, index) => <span key={item}>{index > 0 && item - pagination[index - 1] > 1 ? <i>...</i> : null}<button type="button" className={item === page ? 'is-current' : ''} onClick={() => onPage(item)}>{item}</button></span>)}<button type="button" onClick={() => onPage(Math.min(pageCount, page + 1))} disabled={page === pageCount}>Next</button></nav> }

function UploadDetail({ upload: initialUpload, salesAdminId = '', onBack }) {
  const [upload, setUpload] = useState(initialUpload)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; request(`/sales-admins/uploads/${encodeURIComponent(initialUpload.id)}/performance${salesAdminId ? `?salesAdminId=${encodeURIComponent(salesAdminId)}` : ''}`).then((response) => { if (active) setUpload({ ...initialUpload, ...(response?.data?.upload || {}), summary: response?.data?.summary || {}, rows: response?.data?.rows || [], assignmentHistory: response?.data?.assignmentHistory || [] }) }).catch((reason) => { if (active) setError(reason?.message || 'Unable to load upload details') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [initialUpload, salesAdminId])
  const summary = upload.summary || {}
  const progressPercentage = summary.totalLeads ? Math.round((Number(summary.completedLeads || 0) / Number(summary.totalLeads)) * 100) : 0
  useEffect(() => { document.documentElement.style.setProperty('--sales-upload-progress', `${progressPercentage}%`); return () => document.documentElement.style.removeProperty('--sales-upload-progress') }, [progressPercentage])
  const [leadSearch, setLeadSearch] = useState('')
  const [followFilter, setFollowFilter] = useState('ALL')
  const [stageFilter, setStageFilter] = useState('ALL')
  const [detailPage, setDetailPage] = useState(1)
  const filteredRows = useMemo(() => (upload.rows || []).filter((row) => (!leadSearch.trim() || `${row.leadName || ''} ${row.leadId || ''}`.toLowerCase().includes(leadSearch.trim().toLowerCase())) && (followFilter === 'ALL' || row.followUpStatus === followFilter) && (stageFilter === 'ALL' || String(row.leadStage || '').toUpperCase() === stageFilter)), [upload.rows, leadSearch, followFilter, stageFilter])
  const detailPageCount = Math.max(1, Math.ceil(filteredRows.length / 5))
  const visibleRows = filteredRows.slice((detailPage - 1) * 5, detailPage * 5)
  useEffect(() => { const timer = window.setTimeout(() => setDetailPage(1), 0); return () => window.clearTimeout(timer) }, [leadSearch, followFilter, stageFilter])
  const detailPagination = detailPageCount <= 3 ? Array.from({ length: detailPageCount }, (_, index) => index + 1) : detailPage === 1 ? [1, 2, 3] : detailPage === detailPageCount ? [detailPageCount - 2, detailPageCount - 1, detailPageCount] : [detailPage - 1, detailPage, detailPage + 1]
  return <section className="sales-admin-upload-detail"><button type="button" className="sales-admin-upload-back" onClick={onBack}><ArrowLeft size={17} /> Back to Upload History</button><header className="sales-admin-upload-detail-header"><div><p className="eyebrow">EXCEL UPLOAD DETAILS</p><h2>{upload.fileName}</h2><p>Uploaded on {dateTime(upload.uploadDate)} by <strong>{upload.uploadedBy}</strong></p></div><span className={`sales-admin-upload-status is-${String(upload.status || '').toLowerCase()}`}>{label(upload.status)}</span></header><div className="sales-admin-upload-detail-meta"><div><small>Assigned To</small><strong>{upload.assignedTo || '-'}</strong></div><div><small>Deadline</small><strong>{dateOnly(upload.deadlineAt)}</strong></div><div><small>Branch</small><strong>{upload.branchName || '-'}</strong></div></div><div className="sales-admin-upload-counts"><Count icon={FileSpreadsheet} title="Total Leads" value={summary.totalLeads} /><Count icon={CheckCircle2} title="Followed" value={summary.followedLeads} tone="green" /><Count icon={Clock3} title="Not Followed" value={summary.notFollowedLeads} tone="orange" /><Count icon={Clock3} title="Pending" value={summary.pendingLeads} tone="orange" /><Count icon={CalendarDays} title="Upcoming" value={summary.upcomingLeads} tone="blue" /><Count icon={Flame} title="Hot" value={summary.hotLeads} tone="red" /><Count icon={XCircle} title="Closed" value={summary.closedLeads} tone="slate" /><Count icon={CheckCircle2} title="Warm" value={summary.warmLeads} tone="amber" /><Count icon={Clock3} title="Cold" value={summary.coldLeads} tone="blue" /></div>{error ? <div className="sales-admin-upload-error" role="alert">{error}</div> : null}<div className="sales-admin-upload-detail-toolbar"><label className="sales-admin-upload-search"><input value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} placeholder="Search lead name or ID" aria-label="Search lead name or ID" /></label><label className="sales-admin-upload-filter"><select value={followFilter} onChange={(event) => setFollowFilter(event.target.value)} aria-label="Filter by follow-up"><option value="ALL">All Follow-up</option><option value="FOLLOWED">Followed</option><option value="PENDING">Pending</option><option value="UPCOMING">Upcoming</option><option value="NOT_FOLLOWED">Not Followed</option></select></label><label className="sales-admin-upload-filter"><select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} aria-label="Filter by lead stage"><option value="ALL">All Stages</option><option value="HOT">Hot</option><option value="WARM">Warm</option><option value="COLD">Cold</option><option value="CLOSED">Closed</option></select></label></div><div className="sales-admin-upload-detail-table-wrap"><table className="sales-admin-upload-detail-table"><thead><tr><th>Lead ID</th><th>Lead Name</th><th>Phone Number</th><th>Follow-up</th><th>Lead Status</th><th>Lead Stage</th><th>Follow-up Date</th></tr></thead><tbody>{loading ? <DetailSkeletonRows /> : visibleRows.length ? visibleRows.map((row) => <tr key={row.id}><td>{row.leadId}</td><td>{row.leadName}</td><td>{row.phoneNumber}</td><td><span className={`sales-admin-follow-pill is-${String(row.followUpStatus || '').toLowerCase()}`}>{label(row.followUpStatus)}</span></td><td>{label(row.leadStatus)}</td><td>{label(row.leadStage)}</td><td>{row.followUpDate ? `${dateOnly(row.followUpDate)}${row.followUpTime ? ` · ${row.followUpTime}` : ''}` : '-'}</td></tr>) : <tr><td colSpan="7" className="sales-admin-upload-empty">No lead rows found.</td></tr>}</tbody></table></div><Pagination page={detailPage} pageCount={detailPageCount} pagination={detailPagination} onPage={setDetailPage} /></section>
}

function DetailSkeletonRows() { return Array.from({ length: 5 }, (_, row) => <tr key={`detail-skeleton-${row}`} className="sales-admin-upload-skeleton-row">{Array.from({ length: 7 }, (_, column) => <td key={column}><span /></td>)}</tr>) }
