import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, Search, Upload } from 'lucide-react'
import { request, requestBlob } from '../services/apiClient'
import { LeadExcelUploadModal } from './LeadExcelUploadModal'

const text = (value, fallback = '-') => String(value ?? '').trim() || fallback
const dateLabel = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function SalesCrmTableSkeleton({ isAdmissions }) {
  const columnCount = isAdmissions ? 7 : 9
  return (
    <div className="super-admin-sales-crm-table-wrap super-admin-sales-crm-skeleton-wrap" role="status" aria-label={`Loading ${isAdmissions ? 'admission students' : 'leads'}`}>
      <table className="super-admin-sales-crm-table super-admin-sales-crm-skeleton-table" aria-hidden="true">
        <thead><tr>{(isAdmissions ? ['Student', 'Student ID', 'Branch', 'Course', 'Admission Date', 'Assigned To', 'Payment'] : ['Lead', 'Phone', 'Branch', 'Course', 'Stage', 'Status', 'Uploaded By', 'Assigned', 'Lead Date']).map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{Array.from({ length: 5 }, (_, rowIndex) => <tr key={rowIndex}>{Array.from({ length: columnCount }, (_, cellIndex) => <td key={cellIndex}><span /></td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function SuperAdminSalesCrmPanel({ view = 'leads', students = [], studentsLoading = false, branches = [], currentUser = {} }) {
  const isAdmissions = view === 'admissions'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [isDownloadOpen, setIsDownloadOpen] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [downloadBranchFilter, setDownloadBranchFilter] = useState('all')
  const [downloadError, setDownloadError] = useState('')
  const [leadImportOpen, setLeadImportOpen] = useState(false)
  const admissionRows = useMemo(() => students.filter((student) => student?.admissionDate || student?.sourceLeadId || student?.admissionSource), [students])

  useEffect(() => {
    let active = true
    if (isAdmissions) return () => { active = false }
    const loadAllLeads = async () => {
      const firstResponse = await request('/leads?page=1&limit=100&sortBy=createdAt&sortOrder=desc')
      const firstRows = Array.isArray(firstResponse?.data) ? firstResponse.data : []
      const totalPages = Math.min(100, Math.max(1, Number(firstResponse?.meta?.totalPages || 1)))
      const remainingResponses = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => request(`/leads?page=${index + 2}&limit=100&sortBy=createdAt&sortOrder=desc`)),
      )
      return [
        ...firstRows,
        ...remainingResponses.flatMap((response) => (Array.isArray(response?.data) ? response.data : [])),
      ]
    }
    loadAllLeads()
      .then((leadRows) => {
        if (!active) return
        setRows(leadRows)
      })
      .catch((reason) => { if (active) setError(reason?.message || 'Unable to load Sales CRM records.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isAdmissions, reloadKey])

  const sourceRows = isAdmissions ? admissionRows : rows
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return sourceRows.filter((row) => {
      const student = isAdmissions ? row.admissionStudent : row
      const branchKey = String(row.branchId || row.branch?.id || row.branch?.branchId || row.branchRecord?.id || row.branchRecord?.branchId || '').trim()
      const matchesBranch = branchFilter === 'all' || branchKey === String(branchFilter)
      const matchesSearch = !query || [row.leadId, row.studentId, row.studentName, row.emailAddress, row.email, row.branchName, row.branch?.branchName, row.branchRecord?.branchName, row.courseName, row.otherCourse, row.course?.name, row.courseEnrollments?.[0]?.courseName, row.assignedAdminName, row.assignedTo?.fullName, student?.studentId, student?.studentName]
        .some((value) => String(value || '').toLowerCase().includes(query))
      return matchesBranch && matchesSearch
    })
  }, [branchFilter, isAdmissions, search, sourceRows])

  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const downloadReport = async () => {
    if (!fromDate || !toDate) {
      setDownloadError('Please select both From Date and To Date.')
      return
    }
    if (fromDate > toDate) {
      setDownloadError('From Date cannot be later than To Date.')
      return
    }
    setDownloading(true)
    setError('')
    setDownloadError('')
    try {
      const scope = isAdmissions ? 'admissions' : 'all'
      const branchQuery = downloadBranchFilter === 'all' ? '' : `&branchId=${encodeURIComponent(downloadBranchFilter)}`
      const result = await requestBlob(`/leads/report/export?scope=${scope}&period=custom&fromDate=${fromDate}&toDate=${toDate}${branchQuery}`)
      if (!result?.blob) throw new Error('The report file could not be created.')
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.fileName || `${isAdmissions ? 'Admission_Students' : 'All_Leads'}_Report.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setIsDownloadOpen(false)
    } catch (reason) {
      setDownloadError(reason?.message || 'Unable to download the report.')
    } finally {
      setDownloading(false)
    }
  }
  const title = isAdmissions ? 'Admission Management' : 'Lead Management'
  const description = isAdmissions ? 'Converted admission students across all active branches.' : 'All lead students across every active branch.'

  return (
    <section className="super-admin-sales-crm-panel" aria-labelledby="super-admin-sales-crm-title">
      <header className="super-admin-sales-crm-header">
        <div><p className="branch-management-kicker">Sales &amp; CRM</p><h1 id="super-admin-sales-crm-title">{title}</h1><p>{description}</p></div>
        <div className="super-admin-sales-crm-actions">
          <button type="button" className="super-admin-outline-action" onClick={() => { setError(''); setLoading(true); setReloadKey((value) => value + 1) }} disabled={loading}><RefreshCw size={16} className={loading ? 'is-spinning' : ''} /> Refresh</button>
          {!isAdmissions ? <button type="button" className="super-admin-primary-action" onClick={() => setLeadImportOpen(true)}><Upload size={16} /> Upload Lead Excel</button> : null}
          <button type="button" className="super-admin-primary-action" onClick={() => { setDownloadError(''); setDownloadBranchFilter(branchFilter); setIsDownloadOpen(true) }} disabled={downloading}><Download size={16} /> Download Excel</button>
        </div>
      </header>
      <div className="super-admin-sales-crm-toolbar"><div className="super-admin-sales-crm-filters"><label className="super-admin-sales-crm-search"><Search size={17} /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1) }} placeholder={isAdmissions ? 'Search admission student, branch, course...' : 'Search lead, student, branch, course...'} aria-label={`Search ${title}`} /></label><label className="super-admin-sales-crm-branch-filter"><span className="sr-only">Filter by branch</span><select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setCurrentPage(1) }} aria-label="Filter leads by branch"><option value="all">All branches</option>{branches.map((branch) => { const value = branch.id || branch.branchId; return <option key={value} value={value}>{branch.branchName || branch.branchId || 'Unnamed branch'}</option> })}</select></label></div><span>{filteredRows.length} records</span></div>
      {error ? <div className="super-admin-global-state is-error" role="alert">{error}</div> : null}
      {((isAdmissions ? studentsLoading : loading)) ? <SalesCrmTableSkeleton isAdmissions={isAdmissions} /> : (
        <div className="super-admin-sales-crm-table-wrap">
          <table className="super-admin-sales-crm-table">
            <thead>{isAdmissions ? <tr><th>Student</th><th>Student ID</th><th>Branch</th><th>Course</th><th>Admission Date</th><th>Assigned To</th><th>Payment</th></tr> : <tr><th>Lead</th><th>Phone</th><th>Branch</th><th>Course</th><th>Stage</th><th>Status</th><th>Uploaded By</th><th>Assigned</th><th>Lead Date</th></tr>}</thead>
            <tbody>
              {paginatedRows.map((row) => {
                const student = row.admissionStudent || row
                return isAdmissions ? <tr key={row.id || row.leadId || row.studentId}><td><strong>{text(student.studentName || row.studentName)}</strong><small>{text(row.leadId || row.sourceLeadId)}</small></td><td>{text(student.studentId || row.studentId)}</td><td>{text(row.branchName || row.branch?.branchName || row.branchRecord?.branchName)}</td><td>{text(row.courseName || row.course?.name || row.courseEnrollments?.[0]?.courseName)}</td><td>{dateLabel(student.admissionDate || row.admissionDate || row.createdAt)}</td><td>{text(row.assignedAdminName || row.assignedTo?.fullName)}</td><td>{text(row.paymentStatus || row.paidProgress?.percentage ? `${row.paymentStatus || 'Paid'}${row.paidProgress?.percentage !== undefined ? ` (${row.paidProgress.percentage}%)` : ''}` : '')}</td></tr> : <tr key={row.id || row.leadId}><td><strong>{text(row.studentName)}</strong><small>{text(row.leadId)}</small></td><td>{text(row.phoneNumber)}</td><td>{text(row.branch?.branchName)}</td><td><strong>{text(row.course?.name || row.otherCourse)}</strong>{!row.course?.id && row.otherCourse ? <small className="super-admin-course-warning-chip" title={row.courseBranchWarning || `Course ${row.otherCourse} is not available in ${row.branch?.branchName || 'this branch'}`}>Course not in branch</small> : null}</td><td><span className="super-admin-sales-crm-badge">{text(row.stage)}</span></td><td>{text(row.status)}</td><td>{text(row.createdBy?.fullName || row.createdByName)}</td><td>{text(row.assignedTo?.fullName || row.assignedToName)}</td><td>{dateLabel(row.leadDate || row.createdAt)}</td></tr>
              })}
              {!filteredRows.length ? <tr><td colSpan={isAdmissions ? 7 : 9} className="super-admin-sales-crm-empty">No matching {isAdmissions ? 'admission students' : 'leads'} found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
      {!(isAdmissions ? studentsLoading : loading) && !error && filteredRows.length > pageSize ? <div className="super-admin-sales-crm-pagination"><span>Page {safePage} of {totalPages}</span><div><button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage === 1}>Previous</button><button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safePage === totalPages}>Next</button></div></div> : null}
      {!isAdmissions ? <LeadExcelUploadModal isOpen={leadImportOpen} onClose={() => setLeadImportOpen(false)} currentUser={{ role: 'SUPER_ADMIN', ...(currentUser || {}) }} onImported={() => { setError(''); setLoading(true); setReloadKey((value) => value + 1) }} /> : null}
      {isDownloadOpen ? <div className="super-admin-sales-crm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !downloading) setIsDownloadOpen(false) }}><section className="super-admin-sales-crm-download-modal" role="dialog" aria-modal="true" aria-labelledby="sales-crm-download-title"><div className="super-admin-sales-crm-download-heading"><div><p>DOWNLOAD REPORT</p><h2 id="sales-crm-download-title">{isAdmissions ? 'Admission Students Excel' : 'Lead Management Excel'}</h2></div><button type="button" onClick={() => setIsDownloadOpen(false)} disabled={downloading} aria-label="Close">×</button></div><div className="super-admin-sales-crm-date-fields"><label>From Date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>To Date<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label><label className="super-admin-sales-crm-download-branch">Branch<select value={downloadBranchFilter} onChange={(event) => setDownloadBranchFilter(event.target.value)}><option value="all">All branches</option>{branches.map((branch) => { const value = branch.id || branch.branchId; return <option key={value} value={value}>{branch.branchName || branch.branchId || 'Unnamed branch'}</option> })}</select></label></div>{downloadError ? <p className="super-admin-sales-crm-download-error" role="alert">{downloadError}</p> : null}<div className="super-admin-sales-crm-download-actions"><button type="button" onClick={() => setIsDownloadOpen(false)} disabled={downloading}>Cancel</button><button type="button" className="super-admin-primary-action" onClick={() => void downloadReport()} disabled={downloading}>{downloading ? 'Preparing...' : 'Download Excel'}</button></div></section></div> : null}
    </section>
  )
}
