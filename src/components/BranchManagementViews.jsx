import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { request } from '../services/apiClient'
import { unwrapNotifications } from '../services/notificationService'
import { doesBranchNotificationBelongToBranch, normalizeBranchNotification } from '../data/branchNotificationsData'
import { loadNotifications } from '../lib/notificationStore'
import {
  acceptCourseEditRequest,
  listCourseEditRequests,
  rejectCourseEditRequest,
} from '../services/courseEditRequestService'

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date)
}

function formatNotificationDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  }).formatToParts(date)
  const dateText = parts.slice(0, 5).map(part => part.value).join('').trim()
  const timeText = parts.slice(6).map(part => part.value).join('').trim()
  return <span className="branch-management-date"><span>{dateText}</span><span>{timeText}</span></span>
}

function ViewState({ loading, error, empty, children }) {
  if (loading) return <p className="branch-management-view-state">Loading...</p>
  if (error) return <p className="branch-management-view-state is-error" role="alert">{error}</p>
  if (!children) return <p className="branch-management-view-state">{empty}</p>
  return children
}

export function ProgressNotificationsView({ branch = {} }) {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    request('/notifications?limit=100&page=1')
      .then(response => {
        if (!active) return
        const { data } = unwrapNotifications(response)
        const apiItems = data.map(normalizeBranchNotification)
        const localItems = loadNotifications().map(normalizeBranchNotification)
        const seen = new Set()
        const merged = [...apiItems, ...localItems].filter(item => {
          const key = item.id || `${item.kind}-${item.createdAt}-${item.title}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setItems(merged.filter(item => (
          String(item.kind).includes('progress-status') &&
          doesBranchNotificationBelongToBranch(item, branch)
        )))
        setPage(1)
      })
      .catch(err => active && setError(err.message || 'Unable to load progress notifications'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [branch])

  const pageCount = Math.max(1, Math.ceil(items.length / 5))
  const visibleItems = items.slice((page - 1) * 5, page * 5)

  return <section className="branch-management-data-page">
    <header className="branch-management-data-header"><div><p className="section-kicker">Management</p><h2>Progress Alerts</h2><p>Progress alerts received for this branch.</p></div></header>
    <div className="branch-management-table-wrap"><ViewState loading={loading} error={error} empty="No progress notifications available.">
      {items.length ? <><table><thead><tr><th>S.No</th><th>Alerts</th><th>Student</th><th>Details</th><th>Status</th><th>Date</th></tr></thead><tbody>{visibleItems.map((item, index) => <tr key={item.id || `${item.createdAt}-${item.title}`}><td>{(page - 1) * 5 + index + 1}</td><td><strong>{item.title}</strong></td><td><strong>{item.studentName || item.studentId || '-'}</strong><small>{item.studentId || ''}</small></td><td>{item.message || item.summary || '-'}</td><td><span className={`branch-management-status is-${item.unread ? 'unread' : 'read'}`}>{item.unread ? 'Unread' : 'Read'}</span></td><td>{formatNotificationDate(item.createdAt)}</td></tr>)}</tbody></table>{pageCount > 1 ? <div className="branch-management-pagination"><span>Page {page} of {pageCount}</span><div><button type="button" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</button><button type="button" disabled={page >= pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))}>Next</button></div></div> : null}</> : null}
    </ViewState></div>
  </section>
}

export function FacultyEditRequestsView() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setItems((await listCourseEditRequests({ page: 1, limit: 100 })).data || []); setPage(1) }
    catch (err) { setError(err.message || 'Unable to load faculty edit requests') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const pageCount = Math.max(1, Math.ceil(items.length / 5))
  const visibleItems = items.slice((page - 1) * 5, page * 5)

  async function review(item, action) {
    setProcessingId(item.id); setError('')
    try {
      const note = action === 'accept' ? 'Accepted by branch admin' : 'Rejected by branch admin'
      if (action === 'accept') await acceptCourseEditRequest(item.id, { responseNote: note })
      else await rejectCourseEditRequest(item.id, { responseNote: note })
      await load()
    } catch (err) { setError(err.message || 'Unable to update request') }
    finally { setProcessingId('') }
  }

  return <section className="branch-management-data-page">
    <header className="branch-management-data-header"><div><p className="section-kicker">Management</p><h2>Faculty Edit Requests</h2><p>Review course edit requests submitted by faculty in this branch.</p></div></header>
    {error ? <p className="branch-management-inline-error" role="alert">{error}</p> : null}
    <div className="branch-management-table-wrap"><ViewState loading={loading} error={!loading && error ? error : ''} empty="No faculty edit requests available.">
      {items.length ? <><table><thead><tr><th>S.No</th><th>Faculty</th><th>Course</th><th>Reason</th><th>Description</th><th>Requested Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleItems.map((item, index) => { const pending = item.requestStatus === 'pending' || item.status === 'pending'; return <tr key={item.id}><td>{(page - 1) * 5 + index + 1}</td><td><strong>{item.facultyName || item.facultyId || '-'}</strong><small>{item.facultyEmail || '-'}</small></td><td><strong>{item.courseName || '-'}</strong><small>{item.courseCode || item.branchCourseId || '-'}</small></td><td>{item.reason || '-'}</td><td>{item.description || '-'}</td><td>{formatDate(item.requestedAt)}</td><td><span className={`branch-management-status is-${item.requestStatus || item.status || 'pending'}`}>{item.requestStatus || item.status || 'pending'}</span></td><td>{pending ? <div className="branch-management-actions"><button type="button" className="branch-management-approve" disabled={processingId === item.id} onClick={() => review(item, 'accept')}><Check size={15} /> Approve</button><button type="button" className="branch-management-reject" disabled={processingId === item.id} onClick={() => review(item, 'reject')}><X size={15} /> Reject</button></div> : <span>-</span>}</td></tr> })}</tbody></table>{pageCount > 1 ? <div className="branch-management-pagination"><span>Page {page} of {pageCount}</span><div><button type="button" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</button><button type="button" disabled={page >= pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))}>Next</button></div></div> : null}</> : null}
    </ViewState></div>
  </section>
}
