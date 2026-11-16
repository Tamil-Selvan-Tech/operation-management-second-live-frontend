import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, LogIn, RefreshCw, X } from 'lucide-react'
import {
  getBranchAdminAttendanceStatus,
  getBranchAdminAttendanceStatusForSuperAdmin,
  loginBranchAdminAttendance,
  logoutBranchAdminAttendance,
} from '../services/attendanceService'
import '../styles/BranchAdminAttendanceFlow.css'

function text(value) {
  return String(value ?? '').trim()
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? text(value)
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function formatClock(value, includeSeconds = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  }).format(date)
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (!hours && !minutes) return `${secs}s`
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`
}

function statusMeta(status, readOnly = false) {
  const map = {
    NOT_LOGGED_IN: ['Not Logged In', 'neutral'],
    LOGGED_IN: ['Logged In', 'success'],
    WEBSITE_LOGGED_OUT_WORKLOG_ACTIVE: ['Logged Out — Will Return', 'warning'],
    WORKLOG_COMPLETED: ['Work Log Completed', 'success'],
    AUTO_CLOSED: ['Auto Closed', 'danger'],
  }
  if (readOnly && status === 'WEBSITE_LOGGED_OUT_WORKLOG_ACTIVE') return map.LOGGED_IN
  return map[status] || ['Not Logged In', 'neutral']
}

function errorText(error, fallback) {
  return text(error?.body?.message || error?.message) || fallback
}

export const BranchAdminAttendanceFlow = forwardRef(function BranchAdminAttendanceFlow({ profileName = 'Branch Admin', branchId = '', userId = '', initialStatus = null, readOnly = false, onStatusChange }, ref) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dismissedMandatoryRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const next = readOnly
        ? (userId ? await getBranchAdminAttendanceStatusForSuperAdmin(userId) : initialStatus)
        : await getBranchAdminAttendanceStatus()
      if (!next) throw new Error('Work Log status is unavailable right now.')
      next._receivedAt = Date.now()
      setStatus(next)
      setNow(Date.now())
      onStatusChange?.(next)
      setError('')
      if (!readOnly && next.mandatoryLoginRequired && !dismissedMandatoryRef.current) setIsOpen(true)
    } catch (requestError) {
      setError(errorText(requestError, 'Work Log status is unavailable right now.'))
      onStatusChange?.({ status: 'UNAVAILABLE', mandatoryLoginRequired: false })
    }
  }, [initialStatus, onStatusChange, readOnly, userId])

  useImperativeHandle(ref, () => ({
    open: () => {
      dismissedMandatoryRef.current = false
      setIsOpen(true)
      setNow(Date.now())
    },
    refresh,
  }), [refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!readOnly && !isOpen && !status?.mandatoryLoginRequired) return undefined
    const clockId = window.setInterval(() => setNow(Date.now()), 1000)
    const pollId = window.setInterval(() => { void refresh() }, 15000)
    return () => {
      window.clearInterval(clockId)
      window.clearInterval(pollId)
    }
  }, [isOpen, readOnly, refresh, status?.mandatoryLoginRequired])

  const serverNow = status?.currentServerTime ? new Date(status.currentServerTime).getTime() : now
  const serverOffset = status?._receivedAt ? serverNow - status._receivedAt : 0
  const liveNow = useMemo(() => new Date(now + serverOffset), [now, serverOffset])
  const [statusLabel, statusTone] = statusMeta(status?.status, readOnly)
  const workingSeconds = useMemo(() => {
    const base = Number(status?.workingSeconds || 0)
    if (status?.status !== 'LOGGED_IN' || !status?.currentSession?.loginAt) return base
    // The API value already includes the open session through currentServerTime.
    // Only add time elapsed since that response; adding from loginAt double-counts
    // the entire active session.
    const receivedAt = Number(status?._receivedAt || 0)
    return base + (receivedAt ? Math.max(0, Math.floor((liveNow.getTime() - receivedAt) / 1000)) : 0)
  }, [liveNow, status])

  const handleLogin = async () => {
    if (readOnly || loading || !status?.canLogin) return
    setLoading(true)
    setError('')
    try {
      const next = await loginBranchAdminAttendance()
      next._receivedAt = Date.now()
      setStatus(next)
      setNow(Date.now())
      onStatusChange?.(next)
      setIsOpen(false)
      window.dispatchEvent(new CustomEvent('BRANCH_ADMIN_WORK_LOG_SYNC'))
    } catch (requestError) {
      setError(errorText(requestError, 'Unable to save Branch Admin Work Log login.'))
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    if (readOnly || loading || status?.status !== 'LOGGED_IN') return
    setLoading(true)
    setError('')
    try {
      const next = await logoutBranchAdminAttendance({ logoutReason: 'Work Log completed for today' })
      next._receivedAt = Date.now()
      setStatus(next)
      setNow(Date.now())
      onStatusChange?.(next)
      window.dispatchEvent(new CustomEvent('BRANCH_ADMIN_WORK_LOG_SYNC'))
    } catch (requestError) {
      setError(errorText(requestError, 'Unable to save Branch Admin Work Log logout.'))
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  const displayName = text(status?.branchAdmin?.name) || profileName
  const displayId = text(status?.branchAdmin?.userCode) || branchId || '—'
  const branchName = text(status?.branch?.name) || 'Assigned branch'
  const isMandatory = Boolean(status?.mandatoryLoginRequired)

  const modal = isOpen && typeof document !== 'undefined' ? createPortal(
    <div className="branch-admin-attendance-overlay" role="presentation">
      <section className="branch-admin-attendance-modal" role="dialog" aria-modal="true" aria-labelledby="branch-admin-attendance-title">
        <header className="branch-admin-attendance-header">
          <div>
            <span className="branch-admin-attendance-eyebrow">Branch Admin Work Log</span>
            <h2 id="branch-admin-attendance-title">Attendance</h2>
          </div>
          <button
            type="button"
            className="branch-admin-attendance-close"
            onClick={() => {
              if (readOnly || !isMandatory) setIsOpen(false)
              else dismissedMandatoryRef.current = true
            }}
            aria-label="Close Branch Admin Work Log"
          >
            <X size={19} />
          </button>
        </header>
        {error ? <div className="branch-admin-attendance-error" role="alert">{error}</div> : null}
        {!status ? (
          <div className="branch-admin-attendance-loading"><RefreshCw size={18} className="branch-admin-attendance-spin" /> Loading Work Log status…</div>
        ) : (
          <>
            <div className="branch-admin-attendance-identity">
              <div><span>Branch Admin</span><strong>{displayName}</strong></div>
              <div><span>Admin ID</span><strong>{displayId}</strong></div>
              <div><span>Branch</span><strong>{branchName}</strong></div>
              <div><span>Date</span><strong>{formatDate(status.attendanceDate)}</strong></div>
              <div><span>Current Time</span><strong>{formatClock(liveNow, true)}</strong></div>
            </div>
            <div className={`branch-admin-attendance-status branch-admin-attendance-status--${statusTone}`}><i />{statusLabel}</div>
            {!readOnly && isMandatory ? <div className="branch-admin-attendance-info">Work Log login is required before using the Branch Dashboard.</div> : null}
            {status.resumable ? <div className="branch-admin-attendance-info">Your previous website logout is resumable. Login to continue today’s Work Log.</div> : null}
            <div className="branch-admin-attendance-metrics">
              <div><span>Login Time</span><strong>{formatClock(status.firstLoginAt)}</strong></div>
              <div><span>Logout Time</span><strong>{formatClock(status.finalLogoutAt)}</strong></div>
              <div><span>Working Time</span><strong>{formatDuration(workingSeconds)}</strong></div>
            </div>
            <div className="branch-admin-attendance-actions">
              {!readOnly && status.canLogin ? <button type="button" className="branch-admin-attendance-primary" onClick={handleLogin} disabled={loading}><LogIn size={17} /> {loading ? 'Saving…' : status.resumable ? 'Resume Work Log' : 'Login'}</button> : null}
              {!readOnly && status.status === 'LOGGED_IN' ? <button type="button" className="branch-admin-attendance-primary branch-admin-attendance-logout" onClick={handleLogout} disabled={loading}>{loading ? 'Saving…' : 'Logout'}</button> : null}
              {!readOnly && !status.canLogin && status.status === 'WORKLOG_COMPLETED' ? <span className="branch-admin-attendance-complete">Today’s Work Log is complete.</span> : null}
              {readOnly ? <span className="branch-admin-attendance-read-only">Read-only Super Admin view</span> : null}
            </div>
          </>
        )}
      </section>
    </div>,
    document.body,
  ) : null

  return <>
    <button
      type="button"
      className="branch-admin-attendance-chip"
      onClick={() => { dismissedMandatoryRef.current = false; setIsOpen(true); setNow(Date.now()) }}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      title={readOnly ? 'View Branch Admin Work Log' : 'Open Branch Admin Work Log'}
    >
      <CalendarDays size={18} />
      <span>Work Log</span>
      {status?.status === 'LOGGED_IN' || (readOnly && status?.status === 'WEBSITE_LOGGED_OUT_WORKLOG_ACTIVE') ? <span className="branch-admin-attendance-chip-dot" aria-label="Logged in" /> : null}
    </button>
    {modal}
  </>
})
