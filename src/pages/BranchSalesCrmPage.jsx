import { useCallback, useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, GraduationCap, Mail, Phone, Search, Users } from 'lucide-react'
import { request } from '../services/apiClient'
import '../styles/BranchSalesCrmPage.css'

const PAGE_SIZE = 5
const EMPTY = '—'

function formatDate(value) {
  if (!value) return EMPTY
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export default function BranchSalesCrmPage({ view = 'admins' }) {
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

  // Load the selected branch CRM view when its sidebar route opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === 'admins') void loadSalesAdmins()
    else {
      void loadSalesAdmins()
      void loadAdmissions()
    }
  }, [activeTab, loadAdmissions, loadSalesAdmins])

  const query = search.trim().toLowerCase()
  const filteredRows = useMemo(() => {
    const rows = activeTab === 'admins' ? salesAdmins : admissions.filter((item) => item.status === 'ADMITTED')
    return rows.filter((item) => {
      if (activeTab === 'admissions') {
        if (salesAdminFilter !== 'ALL' && item.salesAdminId !== salesAdminFilter) return false
      }
      if (!query) return true
      const values = activeTab === 'admins'
        ? [item.id, item.name, item.email, item.phone]
        : [item.studentId, item.studentName, item.email, item.phone, item.leadId, item.courseName, item.salesAdminId, item.salesAdminName]
      return values.some((value) => String(value || '').toLowerCase().includes(query))
    })
  }, [activeTab, admissions, query, salesAdminFilter, salesAdmins])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const loading = activeTab === 'admins' ? loadingAdmins : loadingAdmissions
  const error = activeTab === 'admins' ? adminsError : admissionsError
  const hasLoaded = activeTab === 'admins' ? adminsLoaded : admissionsLoaded

  return (
    <section className="branch-sales-crm-page">
      <header className="branch-sales-crm-heading">
        <div>
          <span className="branch-sales-crm-eyebrow">USER &amp; ROLE MANAGEMENT</span>
          <h2>Sales &amp; CRM</h2>
          <p>{branch?.branchName ? `Sales CRM records for ${branch.branchName}.` : 'Sales Admin and admission records for this branch.'}</p>
        </div>
        <div className="branch-sales-crm-heading-actions">
          <div className="branch-sales-crm-summary">
            <span>{activeTab === 'admins' ? <Users size={18} /> : <GraduationCap size={19} />}</span>
            <div>
              <small>{activeTab === 'admins' ? 'Assigned Sales Admins' : 'Admitted Students'}</small>
              <strong>{loading ? '—' : activeTab === 'admins' ? salesAdmins.length : admissions.length}</strong>
            </div>
          </div>
        </div>
      </header>

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
      </div>

      <div className="branch-sales-crm-table-wrap">
        {activeTab === 'admins' ? (
          <table>
            <thead><tr><th>Sales Admin ID</th><th>Name</th><th>Email</th><th>Phone Number</th><th>Status</th></tr></thead>
            <tbody>
              {loading ? Array.from({ length: PAGE_SIZE }, (_, index) => <tr key={`admin-skeleton-${index}`} className="branch-sales-crm-skeleton-row"><td><span /></td><td><span /></td><td><span /></td><td><span /></td><td><span /></td></tr>)
                : error ? <tr><td colSpan="5" className="branch-sales-crm-empty">Sales Admin details could not be loaded.</td></tr>
                  : pageRows.length ? pageRows.map((admin) => (
                    <tr key={admin.userId || admin.id}>
                      <td><strong className="branch-sales-crm-id">{admin.id || EMPTY}</strong></td>
                      <td><span className="branch-sales-crm-name"><BriefcaseBusiness size={15} />{admin.name || EMPTY}</span></td>
                      <td>{admin.email ? <a href={`mailto:${admin.email}`}><Mail size={14} />{admin.email}</a> : EMPTY}</td>
                      <td>{admin.phone ? <a href={`tel:${admin.phone}`}><Phone size={14} />{admin.phone}</a> : EMPTY}</td>
                      <td><span className={`branch-sales-crm-status${admin.status === 'ACTIVE' ? ' is-active' : ' is-inactive'}`}>{admin.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
                    </tr>
                  )) : <tr><td colSpan="5" className="branch-sales-crm-empty"><Users size={23} /><strong>{hasLoaded && salesAdmins.length ? 'No matching Sales Admins' : 'No Sales Admins assigned'}</strong><span>{hasLoaded && salesAdmins.length ? 'Try another Sales Admin ID or name.' : 'Sales Admins assigned to this branch by Super Admin will appear here.'}</span></td></tr>}
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
    </section>
  )
}
