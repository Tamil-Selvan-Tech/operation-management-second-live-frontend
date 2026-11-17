import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, LogIn, LogOut, RefreshCw, X } from 'lucide-react'
import {
  getSalesAdminWorkClockStatus,
  loginSalesAdminWorkClock,
  logoutSalesAdminWorkClock,
} from '../services/salesAdminWorkClockService'
import '../styles/SalesAdminWorkClock.css'

function errorMessage(error, fallback) {
  return error?.body?.message || error?.message || fallback
}

function timeLabel(value, withSeconds = false) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}), hour12: true }).format(date)
}

function dateLabel(value) {
  const date = value ? new Date(`${String(value).slice(0, 10)}T00:00:00`) : new Date()
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function duration(value = 0) {
  const total = Math.max(0, Math.floor(Number(value) || 0))
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map((part) => String(part).padStart(2, '0')).join(':')
}

export function SalesAdminWorkClock({ name = 'Sales Admin', salesAdminId = '', onStatusChange, readOnlyStatus = null }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(() => readOnlyStatus ? { ...readOnlyStatus, _receivedAt: Date.now() } : null)
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isReadOnly = Boolean(readOnlyStatus)

  const refresh = useCallback(async () => {
    try {
      const next = await getSalesAdminWorkClockStatus()
      const received = { ...next, _receivedAt: Date.now() }
      setStatus(received)
      onStatusChange?.(received)
      setError('')
      if (next?.mandatoryLoginRequired) setOpen(true)
    } catch (reason) {
      setError(errorMessage(reason, 'Work Log status is unavailable right now.'))
    }
  }, [onStatusChange])

  useEffect(() => {
    if (isReadOnly) {
      const statusId = window.setTimeout(() => setStatus(readOnlyStatus ? { ...readOnlyStatus, _receivedAt: Date.now() } : null), 0)
      return () => window.clearTimeout(statusId)
    }
    const refreshId = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(refreshId)
  }, [isReadOnly, readOnlyStatus, refresh])
  useEffect(() => {
    if (!open) return undefined
    const clockId = window.setInterval(() => setNow(Date.now()), 1000)
    const pollId = window.setInterval(() => { void refresh() }, 15000)
    return () => { window.clearInterval(clockId); window.clearInterval(pollId) }
  }, [open, refresh])
  useEffect(() => {
    document.body.classList.toggle('sales-work-log-open', open)
    return () => document.body.classList.remove('sales-work-log-open')
  }, [open])

  const liveWorkingSeconds = useMemo(() => {
    const base = Number(status?.workingSeconds || 0)
    // A website logout means “I’ll return”, so the Work Log remains active.
    // Keep the displayed duration running for that state as well as while
    // the Sales Admin is actively logged in.
    if (!['LOGGED_IN', 'WEBSITE_LOGGED_OUT_WORK_CLOCK_ACTIVE'].includes(status?.status) || !status?._receivedAt) return base
    return base + Math.max(0, Math.floor((now - status._receivedAt) / 1000))
  }, [now, status])
  const handleLogin = async () => {
    if (loading || !status?.canLogin) return
    setLoading(true); setError('')
    try {
      const next = await loginSalesAdminWorkClock()
      const received = { ...next, _receivedAt: Date.now() }
      setStatus(received)
      onStatusChange?.(received)
      setOpen(false)
    } catch (reason) {
      setError(errorMessage(reason, 'Unable to save Work Log login.'))
      await refresh()
    } finally { setLoading(false) }
  }

  const handleLogout = async () => {
    if (loading || !status?.canLogout) return
    setLoading(true); setError('')
    try {
      const next = await logoutSalesAdminWorkClock()
      const received = { ...next, _receivedAt: Date.now() }
      setStatus(received)
      onStatusChange?.(received)
    } catch (reason) {
      setError(errorMessage(reason, 'Unable to save Work Log logout.'))
      await refresh()
    } finally { setLoading(false) }
  }

  const modal = open ? (
    <div className="sales-work-clock-backdrop" role="presentation">
      <section className="sales-work-clock-modal" role="dialog" aria-modal="true" aria-labelledby="sales-work-clock-title">
        <header className="sales-work-clock-modal-header">
          <div><span>Sales Admin Dashboard</span><h2 id="sales-work-clock-title">Work Log</h2></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close Work Log"><X size={18} /></button>
        </header>
        {error ? <div className="sales-work-clock-error" role="alert">{error}</div> : null}
        {!status ? <div className="sales-work-clock-loading"><RefreshCw size={17} className="is-spinning" /> Loading Work Log...</div> : <>
          <div className="sales-work-clock-identity"><div><span>Sales Admin</span><strong>{status?.salesAdmin?.name || name}</strong></div><div><span>Sales Admin ID</span><strong>{status?.salesAdmin?.salesAdminId || salesAdminId || '-'}</strong></div><div><span>Date</span><strong>{dateLabel(status.attendanceDate)}</strong></div><div><span>Current Time</span><strong>{timeLabel(status.currentServerTime || now, true)}</strong></div></div>
          <div className="sales-work-clock-metrics"><div><span>Login Time</span><strong>{timeLabel(status.firstLoginAt)}</strong></div><div><span>Logout Time</span><strong>{timeLabel(status.finalLogoutAt)}</strong></div><div><span>Working Time</span><strong>{duration(liveWorkingSeconds)}</strong></div></div>
          {!isReadOnly ? <div className="sales-work-clock-actions">{status.canLogin ? <button type="button" onClick={handleLogin} disabled={loading}><LogIn size={16} />{loading ? 'Saving...' : 'Login Work Log'}</button> : null}{status.canLogout ? <button type="button" className="is-logout" onClick={handleLogout} disabled={loading}><LogOut size={16} />{loading ? 'Saving...' : 'Logout Work Log'}</button> : null}</div> : null}
        </>}
      </section>
    </div>
  ) : null

  return <><button type="button" className={`sales-work-clock-button${status?.status === 'LOGGED_IN' ? ' is-active' : ''}`} onClick={() => { setOpen(true); setNow(Date.now()) }}><Clock3 size={17} /><span>Work Log</span>{status?.status === 'LOGGED_IN' ? <i aria-label="Work Log active" /> : null}</button>{modal}</>
}

