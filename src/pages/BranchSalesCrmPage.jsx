import { useCallback, useEffect, useState } from 'react'
import { BriefcaseBusiness, Mail, Phone, Search, Users } from 'lucide-react'
import { request } from '../services/apiClient'
import '../styles/BranchSalesCrmPage.css'

export default function BranchSalesCrmPage() {
  const [salesAdmins, setSalesAdmins] = useState([])
  const [branch, setBranch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 5
  const query = search.trim().toLowerCase()
  const filteredAdmins = salesAdmins.filter((admin) => !query || String(admin.id || '').toLowerCase().includes(query) || String(admin.name || '').toLowerCase().includes(query))
  const totalPages = Math.max(1, Math.ceil(filteredAdmins.length / pageSize))
  const pageAdmins = filteredAdmins.slice((page - 1) * pageSize, page * pageSize)

  const loadSalesAdmins = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await request('/branches/me/sales-admins')
      const result = response?.data ?? response ?? {}
      setBranch(result.branch || null)
      setSalesAdmins(Array.isArray(result.salesAdmins) ? result.salesAdmins : [])
      setPage(1)
    } catch (reason) {
      setError(reason?.message || 'Unable to load Sales Admin details.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadSalesAdmins() }, [loadSalesAdmins])

  return (
    <section className="branch-sales-crm-page">
      <header className="branch-sales-crm-heading">
        <div>
          <span className="branch-sales-crm-eyebrow">USER &amp; ROLE MANAGEMENT</span>
          <h2>Sales &amp; CRM</h2>
          <p>{branch?.branchName ? `Sales Admins assigned to ${branch.branchName}.` : 'Sales Admins assigned to this branch.'}</p>
        </div>
        <div className="branch-sales-crm-heading-actions">
          <div className="branch-sales-crm-summary">
            <span><Users size={18} /></span>
            <div><small>Assigned Sales Admins</small><strong>{loading ? '—' : salesAdmins.length}</strong></div>
          </div>
        </div>
      </header>

      {error ? <div className="branch-sales-crm-message is-error" role="alert">{error}</div> : null}

      <label className="branch-sales-crm-search">
        <Search size={17} aria-hidden="true" />
        <input aria-label="Search by Sales Admin ID or name" placeholder="Search by Sales Admin ID or name" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
      </label>

      <div className="branch-sales-crm-table-wrap">
        <table>
          <thead><tr><th>Sales Admin ID</th><th>Name</th><th>Email</th><th>Phone Number</th><th>Status</th></tr></thead>
          <tbody>
            {loading ? Array.from({ length: pageSize }, (_, index) => (
              <tr key={`skeleton-${index}`} className="branch-sales-crm-skeleton-row">
                <td><span /></td><td><span /></td><td><span /></td><td><span /></td><td><span /></td>
              </tr>
            )) : error ? <tr><td colSpan="5" className="branch-sales-crm-empty">Sales Admin details could not be loaded.</td></tr> : salesAdmins.length ? pageAdmins.map((admin) => (
              <tr key={admin.userId || admin.id}>
                <td><strong className="branch-sales-crm-id">{admin.id || '—'}</strong></td>
                <td><span className="branch-sales-crm-name"><BriefcaseBusiness size={15} />{admin.name || '—'}</span></td>
                <td>{admin.email ? <a href={`mailto:${admin.email}`}><Mail size={14} />{admin.email}</a> : '—'}</td>
                <td>{admin.phone ? <a href={`tel:${admin.phone}`}><Phone size={14} />{admin.phone}</a> : '—'}</td>
                <td><span className={`branch-sales-crm-status${admin.status === 'ACTIVE' ? ' is-active' : ' is-inactive'}`}>{admin.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
              </tr>
            )) : <tr><td colSpan="5" className="branch-sales-crm-empty"><Users size={23} /><strong>{salesAdmins.length ? 'No matching Sales Admins' : 'No Sales Admins assigned'}</strong><span>{salesAdmins.length ? 'Try another Sales Admin ID or name.' : 'Sales Admins assigned to this branch by Super Admin will appear here.'}</span></td></tr>}
          </tbody>
        </table>
      </div>
      {!loading && !error && filteredAdmins.length ? (
        <footer className="branch-sales-crm-pagination">
          <span>Showing {Math.min((page - 1) * pageSize + 1, filteredAdmins.length)}–{Math.min(page * pageSize, filteredAdmins.length)} of {filteredAdmins.length} Sales Admins</span>
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
