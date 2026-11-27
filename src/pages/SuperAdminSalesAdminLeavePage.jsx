import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { request } from '../services/apiClient'

const PAGE_SIZE = 5
const dateLabel = (value) => { const [year, month, day] = String(value || '').slice(0, 10).split('-'); return year && month && day ? `${day}-${month}-${year}` : '-' }
const timeLabel = (value) => { const [hour, minute] = String(value || '').split(':').map(Number); return Number.isFinite(hour) && Number.isFinite(minute) ? `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}` : '-' }
const typeLabel = (value) => ({ FULL_DAY: 'Full Day', HALF_DAY: 'Half Day', PERMISSION: 'Permission' }[String(value || '').toUpperCase()] || value || '-')

export default function SuperAdminSalesAdminLeavePage() {
  const [rows, setRows] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [branch, setBranch] = useState('ALL')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    request('/super-admin/sales-admin-leave-requests').then((response) => {
      if (active) { setRows(response?.data?.requests || response?.requests || []); setBranchOptions(response?.data?.branches || response?.branches || []) }
    }).catch((reason) => { if (active) setError(reason?.body?.message || reason?.message || 'Unable to load Sales Admin leave requests.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesStatus = status === 'ALL' || String(row.status || '').toUpperCase() === status
      const matchesBranch = branch === 'ALL' || String(row.branch?.id || row.branchId || '') === branch
      const haystack = [row.salesAdminName, row.salesAdminCode, row.branchName, row.branchCode, row.reason, row.leaveType].join(' ').toLowerCase()
      return matchesStatus && matchesBranch && (!query || haystack.includes(query))
    })
  }, [rows, search, status, branch])
  const branches = useMemo(() => branchOptions.map((item) => ({ id: item.id, name: item.branchName || item.branchId || 'Branch' })), [branchOptions])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return <section className="super-admin-global-panel">
    <div className="super-admin-global-header"><div><p className="branch-management-kicker">LEAVE MANAGEMENT</p><h1>Sales Admin Leave</h1><p>Sales Admin leave requests across every branch.</p></div><div className="super-admin-global-header-actions"><label className="super-admin-student-search"><Search size={16} /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search Sales Admin, ID or branch" aria-label="Search Sales Admin leave requests" /></label><select className="super-admin-global-select" value={branch} onChange={(event) => { setBranch(event.target.value); setPage(1) }} aria-label="Filter Sales Admin leave by branch"><option value="ALL">All Branches</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="super-admin-global-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Filter Sales Admin leave status"><option value="ALL">All status</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option></select><span className="super-admin-global-count">{filtered.length} requests</span></div></div>
    {error ? <div className="super-admin-global-state is-error">{error}</div> : loading ? <div className="super-admin-global-state">Loading Sales Admin leave requests...</div> : <><div className="super-admin-global-table-wrap"><table className="super-admin-global-table"><thead><tr><th>S.No</th><th>Sales Admin ID</th><th>Sales Admin Name</th><th>Branch</th><th>Request Date</th><th>Leave Type</th><th>Leave Date</th><th>Duration</th><th>Time</th><th>Status</th></tr></thead><tbody>{visible.map((row, index) => <tr key={row.id}><td>{(safePage - 1) * PAGE_SIZE + index + 1}</td><td>{row.salesAdminCode || '-'}</td><td><strong>{row.salesAdminName || '-'}</strong></td><td><strong>{row.branchName || '-'}</strong><small>{row.branchCode || '-'}</small></td><td>{dateLabel(row.createdAt)}</td><td>{typeLabel(row.leaveType)}</td><td>{dateLabel(row.startDate)}{row.endDate && row.endDate !== row.startDate ? ` - ${dateLabel(row.endDate)}` : ''}</td><td>{row.leaveType === 'PERMISSION' ? `${row.duration || 1} hour${Number(row.duration) === 1 ? '' : 's'}` : row.leaveType === 'HALF_DAY' ? 'Half day' : `${row.duration || 1} day${Number(row.duration) === 1 ? '' : 's'}`}</td><td>{row.startTime && row.endTime ? `${timeLabel(row.startTime)} - ${timeLabel(row.endTime)}` : '-'}</td><td><span className={`super-admin-global-status ${String(row.status || '').toLowerCase()}`}>{row.status || '-'}</span></td></tr>)}{!visible.length ? <tr><td colSpan="10" className="super-admin-global-empty">No Sales Admin leave requests found.</td></tr> : null}</tbody></table></div>{filtered.length > PAGE_SIZE ? <div className="super-admin-pagination"><span>Page {safePage} of {totalPages}</span><div><button type="button" disabled={safePage <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" disabled={safePage >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div> : null}</>}
  </section>
}
