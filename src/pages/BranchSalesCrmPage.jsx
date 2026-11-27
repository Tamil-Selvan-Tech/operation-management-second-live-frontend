import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Activity, ArrowRightLeft, BriefcaseBusiness, CalendarDays, FileSpreadsheet, GraduationCap, Mail, Phone, Search, Upload, Users, X } from 'lucide-react'
import { request } from '../services/apiClient'
import { SalesCrmReportSubmissionModal } from '../components/SalesCrmReportSubmissionModal'
import { LeadExcelUploadModal } from '../components/LeadExcelUploadModal'
import { LeadDistributionManager } from '../components/LeadDistributionManager'
import { loadSession } from '../lib/session'
import '../styles/BranchSalesCrmPage.css'
import SalesAdminFullPageView from '../components/SalesAdminFullPageView'

const PAGE_SIZE = 5
const EMPTY = '—'

function formatDate(value) {
  if (!value) return EMPTY
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(date)
}

function formatDurationHuman(value = 0) {
  const total = Math.max(0, Math.floor(Number(value) || 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const parts = []
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (minutes || hours) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
  parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`)
  return parts.join(' ')
}

function workLogLabel(status) {
  return { LOGGED_IN: 'Logged In', WEBSITE_LOGGED_OUT_WORK_CLOCK_ACTIVE: 'Logged Out', WORK_CLOCK_COMPLETED: 'Completed', WORK_LOG_COMPLETED: 'Completed', AUTO_CLOSED: 'Auto Closed', NOT_LOGGED_IN: 'Not Logged In' }[status] || 'Not Logged In'
}

function leaveTypeLabel(value) {
  return { FULL_DAY: 'Full Day Leave', HALF_DAY: 'Half Day Leave', PERMISSION: 'Permission' }[String(value || '').toUpperCase()] || 'Approved Leave'
}

function leaveDurationLabel(leave) {
  if (!leave) return '-'
  if (leave.leaveType === 'HALF_DAY') return 'Half day'
  const value = Number(leave.duration) || 1
  return leave.leaveType === 'PERMISSION' ? `${value} hour${value === 1 ? '' : 's'}` : `${value} day${value === 1 ? '' : 's'}`
}

function leaveTimeLabel(leave) {
  if (!leave?.startTime || !leave?.endTime) return '-'
  const to12Hour = (value) => { const [hours, minutes] = String(value).split(':').map(Number); const period = hours >= 12 ? 'PM' : 'AM'; return `${String(hours % 12 || 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}` }
  return `${to12Hour(leave.startTime)} - ${to12Hour(leave.endTime)}`
}

export default function BranchSalesCrmPage({ view = 'admins', title = 'Sales & CRM', showReportAction = true, showLeadImportAction = false, showLeadDistributionAction = false, showActionColumn = true }) {
  const activeTab = view
  const [salesAdmins, setSalesAdmins] = useState([])
  const [admissions, setAdmissions] = useState([])
  const [branch, setBranch] = useState(null)
  const [loadingAdmins, setLoadingAdmins] = useState(true)
  const [loadingAdmissions, setLoadingAdmissions] = useState(false)
  const [adminsLoaded, setAdminsLoaded] = useState(false)
  const [admissionsLoaded, setAdmissionsLoaded] = useState(false)
  const [adminsError, setAdminsError] = useState('')
  const [admissionsError, setAdmissionsError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [salesAdminFilter, setSalesAdminFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('name')
  const [sendReportOpen, setSendReportOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [leadImportOpen, setLeadImportOpen] = useState(false)
  const [distributionOpen, setDistributionOpen] = useState(false)
  const sessionUser = loadSession()?.user || {}

  const loadSalesAdmins = useCallback(async () => {
    setLoadingAdmins(true)
    setAdminsError('')
    try {
      const response = await request('/branches/me/sales-admins')
      const result = response?.data ?? response ?? {}
      setBranch(result.branch || null)
      setSalesAdmins(Array.isArray(result.salesAdmins) ? result.salesAdmins : [])
      setAdminsLoaded(true)
    } catch (reason) {
      setAdminsError(reason?.message || 'Unable to load Sales Admin details.')
    } finally {
      setLoadingAdmins(false)
    }
  }, [])

  const loadAdmissions = useCallback(async () => {
    setLoadingAdmissions(true)
    setAdmissionsError('')
    try {
      const response = await request('/branches/me/sales-admin-admissions')
      const result = response?.data ?? response ?? {}
      setBranch(result.branch || null)
      setAdmissions(Array.isArray(result.admissions) ? result.admissions : [])
      setAdmissionsLoaded(true)
    } catch (reason) {
      setAdmissionsError(reason?.message || 'Unable to load admitted student details.')
    } finally {
      setLoadingAdmissions(false)
    }
  }, [])

  const openActivity = (admin) => {
    setSelectedAdmin(admin)
  }

  // Load the selected branch CRM view when its sidebar route opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === 'admins') void loadSalesAdmins()
    else {
      void loadSalesAdmins()
      void loadAdmissions()
    }
  }, [activeTab, loadAdmissions, loadSalesAdmins])

  useEffect(() => {
    if (activeTab !== 'admins' || !adminsLoaded) return
    const params = new URLSearchParams(location.search)
    const adminId = params.get('adminId')
    const batchId = params.get('batchId')
    if (!adminId || !batchId) return
    const target = salesAdmins.find((admin) => [admin.userId, admin.id].some((value) => String(value || '') === adminId))
    if (!target) return
    setSelectedUploadId(batchId)
    setSelectedAdmin(target)
  }, [activeTab, adminsLoaded, location.search, salesAdmins])

  const query = search.trim().toLowerCase()
  const filteredRows = useMemo(() => {
    const rows = activeTab === 'admins' ? salesAdmins : admissions.filter((item) => item.status === 'ADMITTED')
    return rows.filter((item) => {
      if (activeTab === 'admins' && statusFilter !== 'ALL' && String(item.status || '').toUpperCase() !== statusFilter) return false
      if (activeTab === 'admissions') {
        if (salesAdminFilter !== 'ALL' && item.salesAdminId !== salesAdminFilter) return false
      }
      if (!query) return true
      const values = activeTab === 'admins'
        ? [item.id, item.name, item.email, item.phone, branch?.branchName, branch?.branchId]
        : [item.studentId, item.studentName, item.email, item.phone, item.leadId, item.courseName, item.salesAdminId, item.salesAdminName]
      return values.some((value) => String(value || '').toLowerCase().includes(query))
    })
  }, [activeTab, admissions, branch, query, salesAdminFilter, salesAdmins, statusFilter])
  const sortedRows = useMemo(() => [...filteredRows].sort((left, right) => {
    const value = (item) => activeTab === 'admins' ? (sortBy === 'status' ? item.status : item.name) : (sortBy === 'admissionDate' ? item.admissionDate : item.studentName)
    if (sortBy === 'admissionDate') return new Date(value(right) || 0) - new Date(value(left) || 0)
    return String(value(left) || '').localeCompare(String(value(right) || ''))
  }), [activeTab, filteredRows, sortBy])
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const loading = activeTab === 'admins' ? loadingAdmins : loadingAdmissions
  const error = activeTab === 'admins' ? adminsError : admissionsError
  const hasLoaded = activeTab === 'admins' ? adminsLoaded : admissionsLoaded

  if (selectedAdmin && activeTab === 'admins') {
    return <SalesAdminFullPageView admin={{ ...selectedAdmin, id: selectedAdmin.userId || selectedAdmin.id, fullName: selectedAdmin.name, email: selectedAdmin.email, phone: selectedAdmin.phone }} branchScoped showEdit={false} initialTab={selectedUploadId ? 'excel-upload' : 'overview'} initialUploadId={selectedUploadId} onBack={() => { setSelectedAdmin(null); setSelectedUploadId('') }} />
  }

  return (
    <section className="branch-sales-crm-page">
      <header className="branch-sales-crm-heading">
        <div>
          <span className="branch-sales-crm-eyebrow">USER &amp; ROLE MANAGEMENT</span>
          <h2>{title}</h2>
          <p>{branch?.branchName ? `${title === 'Sales Admin' ? 'Sales Admin accounts assigned to' : 'Sales CRM records for'} ${branch.branchName}.` : 'Sales Admin and admission records for this branch.'}</p>
        </div>
        <div className="branch-sales-crm-heading-actions">
          {showLeadDistributionAction && activeTab === 'admins' ? <button type="button" className="branch-sales-crm-distribute-button" onClick={() => setDistributionOpen(true)} disabled={loadingAdmins || !branch?.id}><ArrowRightLeft size={16} />Distribute Leads</button> : null}
          {showLeadImportAction && activeTab === 'admins' ? <button type="button" className="branch-sales-crm-upload-button" onClick={() => setLeadImportOpen(true)} disabled={loadingAdmins || !branch?.id} aria-label="Upload lead Excel for this branch"><Upload size={16} />Upload Lead Excel</button> : null}
          {showReportAction ? <button type="button" className="branch-sales-crm-report-button" onClick={() => setSendReportOpen(true)}><FileSpreadsheet size={16} />Send Report</button> : null}
          <div className="branch-sales-crm-summary">
            <span>{activeTab === 'admins' ? <Users size={18} /> : <GraduationCap size={19} />}</span>
            <div>
              <small>{activeTab === 'admins' ? 'Assigned Sales Admins' : 'Admitted Students'}</small>
              <strong>{loading ? '—' : activeTab === 'admins' ? salesAdmins.length : admissions.length}</strong>
            </div>
          </div>
        </div>
      </header>

      <SalesCrmReportSubmissionModal isOpen={sendReportOpen} onClose={() => setSendReportOpen(false)} branches={branch ? [branch] : []} initialBranchId={branch?.id || ''} onSubmitted={() => setSendReportOpen(false)} />
      {showLeadDistributionAction && activeTab === 'admins' && distributionOpen ? <LeadDistributionManager currentUser={{ ...sessionUser, fullName: sessionUser.fullName || sessionUser.name, branchId: branch?.id || sessionUser.branchId || '' }} onClose={() => setDistributionOpen(false)} /> : null}
      {showLeadImportAction && activeTab === 'admins' ? <LeadExcelUploadModal isOpen={leadImportOpen} onClose={() => setLeadImportOpen(false)} currentUser={{ ...sessionUser, role: 'BRANCH_ADMIN', branchId: branch?.id || sessionUser.branchId || '' }} onImported={() => setLeadImportOpen(false)} /> : null}

      {error ? <div className="branch-sales-crm-message is-error" role="alert">{error}</div> : null}

      <div className="branch-sales-crm-toolbar">
        <label className="branch-sales-crm-search">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label={activeTab === 'admins' ? 'Search Sales Admins' : 'Search admitted students'}
            placeholder={activeTab === 'admins' ? 'Search by Sales Admin ID or name' : 'Search by student ID, name, course or Sales Admin'}
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          />
        </label>
        {activeTab === 'admissions' ? (
          <div className="branch-sales-crm-filters">
            <select aria-label="Filter admissions by Sales Admin" value={salesAdminFilter} onChange={(event) => { setSalesAdminFilter(event.target.value); setPage(1) }}>
              <option value="ALL">All Sales Admins</option>
              {salesAdmins.map((admin) => <option key={admin.userId || admin.id} value={admin.id}>{admin.name || admin.id}</option>)}
            </select>
          </div>
        ) : null}
        {activeTab === 'admins' ? <select aria-label="Filter Sales Admin status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select> : null}
        <select aria-label="Sort records" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1) }}><option value={activeTab === 'admins' ? 'name' : 'studentName'}>Name A-Z</option>{activeTab === 'admins' ? <option value="status">Status</option> : <option value="admissionDate">Latest admission</option>}</select>
      </div>

      <div className="branch-sales-crm-table-wrap">
        {activeTab === 'admins' ? (
          <table>
            <thead><tr><th>Sales Admin ID</th><th>Name</th><th>Email</th><th>Phone Number</th><th>Branch</th><th>Account Status</th>{showActionColumn ? <th>Action</th> : null}</tr></thead>
            <tbody>
              {loading ? Array.from({ length: PAGE_SIZE }, (_, index) => <tr key={`admin-skeleton-${index}`} className="branch-sales-crm-skeleton-row"><td colSpan={showActionColumn ? 7 : 6}><span /></td></tr>)
                : error ? <tr><td colSpan={showActionColumn ? 7 : 6} className="branch-sales-crm-empty">Sales Admin details could not be loaded.</td></tr>
                  : pageRows.length ? pageRows.map((admin) => (
                    <tr
                      key={admin.userId || admin.id}
                      className="branch-sales-crm-admin-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => { if (showActionColumn) openActivity(admin) }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          if (showActionColumn) openActivity(admin)
                        }
                      }}
                    >
                      <td><strong className="branch-sales-crm-id">{admin.id || EMPTY}</strong></td>
                      <td><span className="branch-sales-crm-name"><BriefcaseBusiness size={15} />{admin.name || EMPTY}</span></td>
                      <td>{admin.email ? <a href={`mailto:${admin.email}`} onClick={(event) => event.stopPropagation()}><Mail size={14} />{admin.email}</a> : EMPTY}</td>
                      <td>{admin.phone ? <a href={`tel:${admin.phone}`} onClick={(event) => event.stopPropagation()}><Phone size={14} />{admin.phone}</a> : EMPTY}</td>
                      <td>{branch?.branchName || branch?.branchId || EMPTY}</td>
                      <td><span className={`branch-sales-crm-status${admin.status === 'ACTIVE' ? ' is-active' : ' is-inactive'}`}>{admin.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
                      {showActionColumn ? <td><button type="button" className="branch-sales-crm-view-activity" onClick={() => openActivity(admin)}><Activity size={15} />View</button></td> : null}
                    </tr>
                  )) : <tr><td colSpan={showActionColumn ? 7 : 6} className="branch-sales-crm-empty"><Users size={23} /><strong>{hasLoaded && salesAdmins.length ? 'No matching Sales Admins' : 'No Sales Admins assigned'}</strong><span>{hasLoaded && salesAdmins.length ? 'Try another Sales Admin ID or name.' : 'Sales Admins assigned to this branch by Super Admin will appear here.'}</span></td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="branch-sales-crm-admissions-table">
            <thead><tr><th>Student ID / Student Name</th><th>Email</th><th>Phone</th><th>Course</th><th>Faculty</th><th>Batch</th><th>Batch Timing</th><th>Training Mode</th><th>Schedule</th><th>Admission Date</th><th>Status</th><th>Sales Admin</th></tr></thead>
            <tbody>
              {loading ? Array.from({ length: PAGE_SIZE }, (_, index) => <tr key={`admission-skeleton-${index}`} className="branch-sales-crm-skeleton-row"><td colSpan="12"><span /></td></tr>)
                : error ? <tr><td colSpan="12" className="branch-sales-crm-empty">Admission records could not be loaded.</td></tr>
                  : pageRows.length ? pageRows.map((student) => (
                    <tr key={student.id || student.studentId}>
                      <td><span className="branch-sales-crm-student-cell"><strong className="branch-sales-crm-id">{student.studentId || EMPTY}</strong><small>{student.studentName || EMPTY}</small></span></td>
                      <td>{student.email ? <a href={`mailto:${student.email}`}><Mail size={14} />{student.email}</a> : EMPTY}</td>
                      <td>{student.phone ? <a href={`tel:${student.phone}`}><Phone size={14} />{student.phone}</a> : EMPTY}</td>
                      <td>{student.courseName || EMPTY}</td>
                      <td>{student.facultyName || EMPTY}</td>
                      <td>{student.batchName || EMPTY}</td>
                      <td>{student.batchTiming || EMPTY}</td>
                      <td>{student.trainingMode || EMPTY}</td>
                      <td>{student.schedule || EMPTY}</td>
                      <td>{formatDate(student.admissionDate)}</td>
                      <td><span className={`branch-sales-crm-admission-status is-${String(student.status || '').toLowerCase().replaceAll('_', '-')}`}>{String(student.status || EMPTY).replaceAll('_', ' ')}</span></td>
                      <td><span className="branch-sales-crm-admin-cell"><strong>{student.salesAdminName || EMPTY}</strong><small>{student.salesAdminId || ''}</small></span></td>
                    </tr>
                  )) : <tr><td colSpan="12" className="branch-sales-crm-empty"><GraduationCap size={24} /><strong>No admissions found</strong><span>{hasLoaded && admissions.length ? 'No students match the selected Sales Admin or search.' : 'Students admitted by Sales Admins assigned to this branch will appear here.'}</span></td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && filteredRows.length ? (
        <footer className="branch-sales-crm-pagination">
          <span>Showing {Math.min((page - 1) * PAGE_SIZE + 1, filteredRows.length)}–{Math.min(page * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} {activeTab === 'admins' ? 'Sales Admins' : 'admitted students'}</span>
          <div>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next</button>
          </div>
        </footer>
      ) : null}

      {selectedAdmin ? (() => {
        const activeLeave = selectedAdmin.workClock?.leaveRestrictions?.restrictions?.[0]; const todayStatus = activeLeave ? `${activeLeave.leaveType}_LEAVE` : (selectedAdmin.workClock?.status || 'NOT_LOGGED_IN')
        const todayLogin = selectedAdmin.workClock?.firstLoginAt
        const todayLogout = selectedAdmin.workClock?.finalLogoutAt
        const todayDuration = selectedAdmin.workClock?.workingSeconds ?? 0
        return <div className="branch-sales-crm-drawer-backdrop" role="presentation">
          <aside className="branch-sales-crm-drawer" role="dialog" aria-modal="true" aria-labelledby="sales-admin-activity-title">
            <header className="branch-sales-crm-drawer-header"><div><span className="branch-sales-crm-eyebrow">SALES ADMIN ACTIVITY</span><h2 id="sales-admin-activity-title">{selectedAdmin.name || EMPTY}</h2><p>{selectedAdmin.id || selectedAdmin.userId || EMPTY}</p></div><button type="button" onClick={() => setSelectedAdmin(null)} aria-label="Close activity panel"><X size={19} /></button></header>
            <div className="branch-sales-crm-drawer-body">
              <section className="branch-sales-crm-drawer-section"><h3><BriefcaseBusiness size={17} />Sales Admin Profile</h3><div className="branch-sales-crm-profile-grid"><div><span>Name</span><strong>{selectedAdmin.name || EMPTY}</strong></div><div><span>Sales Admin ID</span><strong>{selectedAdmin.id || EMPTY}</strong></div><div><span>Email Address</span><strong>{selectedAdmin.email || EMPTY}</strong></div><div><span>Phone Number</span><strong>{selectedAdmin.phone || EMPTY}</strong></div><div><span>Assigned Branch</span><strong>{branch?.branchName || branch?.branchId || EMPTY}</strong></div><div><span>Account Status</span><strong className={selectedAdmin.status === 'ACTIVE' ? 'is-green' : 'is-muted'}>{selectedAdmin.status === 'ACTIVE' ? 'Active' : 'Inactive'}</strong></div></div></section>
              <section className="branch-sales-crm-drawer-section"><h3><CalendarDays size={17} />Today's Work Log</h3><div className="branch-sales-crm-today-status"><span className={`branch-sales-crm-status is-${String(todayStatus).toLowerCase().replaceAll('_', '-')}`}>{activeLeave ? leaveTypeLabel(activeLeave.leaveType) : workLogLabel(todayStatus)}</span></div><div className="branch-sales-crm-work-log-metrics"><div><span>Login Time</span><strong>{formatTime(todayLogin)}</strong></div><div><span>Logout Time</span><strong>{formatTime(todayLogout)}</strong></div><div><span>Total Duration</span><strong>{formatDurationHuman(todayDuration)}</strong></div></div>{activeLeave ? <div className="branch-sales-crm-leave-work-log"><div><span>Leave Duration</span><strong>{leaveDurationLabel(activeLeave)}</strong></div><div><span>Leave Time</span><strong>{leaveTimeLabel(activeLeave)}</strong></div></div> : null}</section>
            </div>
          </aside>
        </div>
      })() : null}
    </section>
  )
}
