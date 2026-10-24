import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Bell, BellOff, CalendarClock, Check, CheckCheck, Clock3, ExternalLink, RefreshCw, Repeat2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { filterNotificationsForDisplay, unwrapNotifications } from '../services/notificationService'
import { request } from '../services/apiClient'

const dateFilters = [['today', 'Today'], ['yesterday', 'Yesterday'], ['last7days', 'Last 7 Days'], ['thismonth', 'This Month'], ['custom', 'Custom Range']]
const statusFilters = [['all', 'All'], ['unread', 'Unread'], ['read', 'Read']]
const blankMeta = { page: 1, limit: 20, total: 0, totalPages: 1, unreadCount: 0, filteredUnreadCount: 0 }

function categoryFor(item) {
  const kind = String(item.kind || '').toUpperCase()
  const marker = String(item.requestDescription || '').toUpperCase()
  if (kind.includes('OVERDUE') || marker.startsWith('LEAD_FOLLOW_UP_OVERDUE:')) return { label: 'Overdue Follow-up', Icon: AlertCircle, color: 'red' }
  if (marker.startsWith('LEAD_FOLLOW_UP_DAILY:')) return { label: 'Daily Reminder', Icon: Repeat2, color: 'amber' }
  if (/^LEAD_FOLLOW_UP_REMINDER:[^:]+:\d{4}-\d{2}-\d{2}:\d{2}:\d{2}$/i.test(item.requestDescription || '')) return { label: 'Same-day Timed Reminder', Icon: Clock3, color: 'purple' }
  if (kind.includes('FOLLOW_UP')) return { label: 'Scheduled Follow-up', Icon: CalendarClock, color: 'blue' }
  return { label: 'Sales CRM Update', Icon: Bell, color: 'blue' }
}

function notificationMetadata(item) {
  const title = String(item.title || '')
  const separator = Math.max(title.lastIndexOf('—'), title.lastIndexOf('–'))
  const student = separator >= 0 ? title.slice(separator + 1).trim() : ''
  const leadId = String(item.message || '').match(/\((CISLEA[A-Z0-9._/-]+)\)/i)?.[1] || ''
  return { student, leadId }
}

function formattedCreatedAt(value, timeZone = 'Asia/Kolkata') {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone }).format(date)
  const time = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone }).format(date).toUpperCase()
  return `${day} · ${time}`
}

function NotificationSkeleton() {
  return <div className="sales-admin-notification-skeleton" aria-label="Loading notifications">{Array.from({ length: 5 }, (_, index) => <div key={index}><i /><span><i /><i /><i /></span><i /></div>)}</div>
}

export function SalesAdminNotificationsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(blankMeta)
  const [status, setStatus] = useState('all')
  const [datePreset, setDatePreset] = useState('last7days')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    const customInvalid = datePreset === 'custom' && (!fromDate || !toDate || fromDate > toDate)
    if (customInvalid) return () => { active = false }
    const params = new URLSearchParams({ page: String(page), limit: '20', status, datePreset, sort })
    if (datePreset === 'custom') { params.set('fromDate', fromDate); params.set('toDate', toDate) }
    const load = async () => {
      try {
        const response = await request(`/notifications?${params}`)
        const body = unwrapNotifications(response)
        if (!active) return
        setItems(filterNotificationsForDisplay(body.data || []))
        setMeta({ ...blankMeta, ...(body.meta || {}) })
        setError('')
      } catch (reason) {
        if (active) setError(reason?.message || 'Unable to load notifications')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    const timer = window.setInterval(load, 30000)
    return () => { active = false; window.clearInterval(timer) }
  }, [datePreset, fromDate, toDate, status, sort, page, reloadKey])

  const visibleItems = useMemo(() => items, [items])
  const customDateError = datePreset === 'custom' && fromDate && toDate && fromDate > toDate
    ? 'From Date cannot be later than To Date.'
    : ''
  const customDateIncomplete = datePreset === 'custom' && (!fromDate || !toDate)

  const changeStatus = (value) => { setLoading(true); setPage(1); setStatus(value) }
  const changeDatePreset = (value) => { setLoading(value !== 'custom' || Boolean(fromDate && toDate && fromDate <= toDate)); setPage(1); setDatePreset(value) }
  const changeSort = (value) => { setLoading(true); setPage(1); setSort(value) }
  const changePage = (value) => { setLoading(true); setPage(value) }
  const changeRange = (key, value) => {
    const nextFrom = key === 'fromDate' ? value : fromDate
    const nextTo = key === 'toDate' ? value : toDate
    setFromDate(nextFrom)
    setToDate(nextTo)
    setPage(1)
    setLoading(Boolean(nextFrom && nextTo && nextFrom <= nextTo))
  }
  const resetFilters = () => {
    setLoading(true); setPage(1); setStatus('all'); setDatePreset('last7days'); setFromDate(''); setToDate(''); setSort('newest')
  }

  const markRead = async (ids = null) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      await request('/notifications/mark-read', { method: 'PATCH', body: JSON.stringify(ids?.length ? { notificationIds: ids } : {}) })
      if (ids?.length) setItems((current) => current.map((item) => ids.includes(item.id) ? { ...item, read: true } : item))
      setReloadKey((value) => value + 1)
      setError('')
    } catch (reason) {
      setError(reason?.message || 'Unable to update notifications')
    } finally { setActionLoading(false) }
  }

  const openNotification = (item) => {
    if (!item.read) void markRead([item.id])
    const kind = String(item.kind || '').toUpperCase()
    const leadId = String(item.requestDescription || '').split(':')[1]
    if (['LEAD_FOLLOW_UP_DUE', 'LEAD_FOLLOW_UP_OVERDUE'].includes(kind) && leadId) navigate('/dashboard/sales-admin/leads', { state: { leadId } })
    else if (kind === 'SALES_CRM_MONTHLY_REPORT') navigate('/dashboard/sales-admin/reports')
  }

  return <section className="sales-admin-notifications-page">
    <header className="sales-admin-notifications-header">
      <div><p className="eyebrow">SALES CRM</p><h1>Notifications</h1><p>Manage your follow-up reminders and Sales CRM updates.</p></div>
      <div className="sales-admin-notification-summary"><span><small>Total</small><strong>{Number(meta.total || 0).toLocaleString('en-IN')}</strong></span><span><small>Unread</small><strong>{Number(meta.filteredUnreadCount ?? meta.unreadCount ?? 0).toLocaleString('en-IN')}</strong></span></div>
    </header>

    <div className="sales-admin-notification-date-toolbar" aria-label="Filter notifications by date">
      <div className="sales-admin-notification-date-filters">{dateFilters.map(([value, label]) => <button type="button" key={value} className={datePreset === value ? 'is-active' : ''} onClick={() => changeDatePreset(value)}>{label}</button>)}</div>
      {datePreset === 'custom' ? <div className="sales-admin-notification-date-range"><label>From Date<input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => changeRange('fromDate', event.target.value)} /></label><label>To Date<input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => changeRange('toDate', event.target.value)} /></label></div> : null}
    </div>
    {customDateError ? <p className="sales-admin-notification-filter-error" role="alert">{customDateError}</p> : null}

    <div className="sales-admin-notification-toolbar">
      <div className="sales-admin-notification-filters" aria-label="Filter by read status">{statusFilters.map(([value, label]) => <button type="button" key={value} className={status === value ? 'is-active' : ''} onClick={() => changeStatus(value)}>{label}</button>)}</div>
      <div className="sales-admin-notification-toolbar-actions">
        <label className="sales-admin-notification-sort">Sort<select value={sort} onChange={(event) => changeSort(event.target.value)}><option value="newest">Newest First</option><option value="oldest">Oldest First</option></select></label>
        <button type="button" className="sales-admin-notifications-mark-all" onClick={() => void markRead()} disabled={actionLoading || !meta.unreadCount} title="Marks all your notifications as read, regardless of the selected filters."><CheckCheck size={16} />Mark all as read</button>
      </div>
    </div>

    {error ? <div className="sales-admin-notification-error" role="alert"><AlertCircle size={18} /><span>{error}</span><button type="button" onClick={() => { setLoading(true); setReloadKey((value) => value + 1) }} disabled={loading}><RefreshCw size={15} />Retry</button></div> : null}
    {loading ? <NotificationSkeleton /> : customDateIncomplete ? <div className="sales-admin-notification-empty"><CalendarClock size={26} /><strong>Choose a date range</strong><span>Select both From Date and To Date to filter notifications.</span></div> : !visibleItems.length ? <div className="sales-admin-notification-empty"><BellOff size={27} /><strong>No notifications found</strong><span>No notifications match the selected filters.</span><button type="button" onClick={resetFilters}>Reset Filters</button></div> : <div className="sales-admin-notification-list">{visibleItems.map((item) => {
      const { label, Icon, color } = categoryFor(item)
      const { student, leadId } = notificationMetadata(item)
      const kind = String(item.kind || '').toUpperCase()
      const canOpenLead = ['LEAD_FOLLOW_UP_DUE', 'LEAD_FOLLOW_UP_OVERDUE'].includes(kind) && Boolean(String(item.requestDescription || '').split(':')[1])
      const canOpenReport = kind === 'SALES_CRM_MONTHLY_REPORT'
      return <article key={item.id} className={`sales-admin-notification-card${item.read ? '' : ' is-unread'}`}>
        <span className={`sales-admin-notification-icon is-${color}`}><Icon size={18} strokeWidth={2} /></span>
        <div className="sales-admin-notification-copy">
          <div className="sales-admin-notification-title-row"><h3>{item.title}</h3><span className={`sales-admin-notification-state${item.read ? '' : ' is-unread'}`}>{item.read ? 'Read' : 'Unread'}</span></div>
          {student || leadId ? <div className="sales-admin-notification-context">{student ? <strong>{student}</strong> : null}{leadId ? <span>Lead ID: {leadId}</span> : null}</div> : null}
          <p>{item.message}</p>
          <div className="sales-admin-notification-card-footer"><span className={`sales-admin-notification-category is-${color}`}>{label}</span><div>{!item.read ? <button type="button" className="sales-admin-notification-mark-one" onClick={() => void markRead([item.id])} disabled={actionLoading}><Check size={14} />Mark as read</button> : null}{canOpenLead || canOpenReport ? <button type="button" className="sales-admin-notification-view" onClick={() => openNotification(item)}>{canOpenLead ? 'View Lead' : 'View Report'} <ExternalLink size={14} /></button> : null}</div></div>
        </div>
        <time className="sales-admin-notification-created" dateTime={item.createdAt || undefined}>{formattedCreatedAt(item.createdAt, item.timezone)}</time>
        {!item.read ? <span className="sales-admin-notification-dot" aria-label="Unread notification" /> : null}
      </article>
    })}</div>}

    {!loading && !customDateIncomplete && meta.totalPages > 1 ? <nav className="sales-admin-notification-pagination" aria-label="Notification pages"><span>Page {meta.page} of {meta.totalPages} · {Number(meta.total || 0).toLocaleString('en-IN')} notifications</span><div><button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button><button type="button" disabled={page >= meta.totalPages} onClick={() => changePage(page + 1)}>Next</button></div></nav> : null}
  </section>
}
