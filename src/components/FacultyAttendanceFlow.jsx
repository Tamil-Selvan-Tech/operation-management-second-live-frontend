import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, LogIn, LogOut, RefreshCw, X } from 'lucide-react'
import {
  getFacultyAttendanceStatus,
  loginFacultyAttendance,
} from '../services/attendanceService'
import { FACULTY_ATTENDANCE_SYNC_EVENT } from '../lib/facultyAttendanceStore'
import '../styles/FacultyAttendanceFlow.css'

const STATES = ['NOT_LOGGED_IN', 'LOGGED_IN', 'ON_PERMISSION', 'LOGIN_REQUIRED', 'LOGGED_OUT', 'WORKLOG_COMPLETED', 'WEBSITE_LOGGED_OUT_WORKLOG_ACTIVE', 'AUTO_CLOSED']

function responseStatus(payload) {
  const source = payload?.attendance || payload?.data || payload || {}
  const legacySessions = Array.isArray(source?.facultySession?.sessions) ? source.facultySession.sessions : []
  const legacyLatest = legacySessions[legacySessions.length - 1] || null
  const legacyStatus = legacyLatest?.logoutAt ? 'LOGGED_OUT' : legacyLatest?.loginAt ? 'LOGGED_IN' : ''
  const value = String(source.status || legacyStatus || 'NOT_LOGGED_IN').toUpperCase()
  const status = STATES.includes(value) ? value : 'NOT_LOGGED_IN'

  if (!source.status && legacyStatus) {
    const firstLoginAt = legacySessions[0]?.loginAt || legacyLatest?.loginAt || null
    const workingSeconds = legacySessions.reduce((total, session) => {
      const start = new Date(session?.loginAt || '').getTime()
      const end = new Date(session?.logoutAt || Date.now()).getTime()
      return Number.isFinite(start) && Number.isFinite(end) ? total + Math.max(0, Math.floor((end - start) / 1000)) : total
    }, 0)

    return {
      ...source,
      status,
      firstLoginAt,
      finalLogoutAt: legacyLatest?.logoutAt || null,
      currentSession: status === 'LOGGED_IN' ? legacyLatest : null,
      workingSeconds,
      canLogin: false,
      canLogout: status === 'LOGGED_IN',
    }
  }

  // A fresh attendance day must not display stale session timestamps that a
  // legacy overview endpoint may include alongside an empty status.
  if (status === 'NOT_LOGGED_IN') {
    return {
      ...source,
      status,
      firstLoginAt: null,
      finalLogoutAt: null,
      currentSession: null,
      workingSeconds: 0,
      canLogin: true,
      canLogout: false,
    }
  }

  return { ...source, status }
}
function requestError(error, fallback) { return error?.body?.message || error?.message || fallback }
function clock(value, seconds = false) {
  if (!value) return '-'
  const timeValue = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i)
  if (timeValue) {
    let hour = Number(timeValue[1])
    const minute = timeValue[2]
    const second = timeValue[3] || '00'
    const period = timeValue[4]?.toUpperCase()
    if (period) {
      if (hour < 1 || hour > 12) return '-'
      hour = hour % 12 + (period === 'PM' ? 12 : 0)
    } else if (hour > 23) return '-'
    const displayHour = hour % 12 || 12
    return `${String(displayHour).padStart(2, '0')}:${minute}${seconds ? `:${second}` : ''} ${hour >= 12 ? 'PM' : 'AM'}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: seconds ? '2-digit' : '2-digit', second: seconds ? '2-digit' : undefined, hour12: true }).format(date)
}
function duration(value = 0) {
  const total = Math.max(0, Math.floor(Number(value) || 0))
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map((part) => String(part).padStart(2, '0')).join(':')
}
function dateLabel(value) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}
function statusMeta(status, exemption) {
  if (exemption?.exempt) {
    return [exemption.reason === 'APPROVED_LEAVE' ? 'Approved Leave' : 'Week Off', 'neutral']
  }
  return { NOT_LOGGED_IN: ['Not Logged In', 'neutral'], LOGGED_IN: ['Logged In', 'success'], ON_PERMISSION: ['On Permission / Half Day', 'warning'], LOGIN_REQUIRED: ['Login Required', 'info'], LOGGED_OUT: ['Logged Out', 'danger'], WORKLOG_COMPLETED: ['Work Log Completed', 'success'], WEBSITE_LOGGED_OUT_WORKLOG_ACTIVE: ['Logged In', 'success'], AUTO_CLOSED: ['Auto Closed', 'danger'] }[status] || ['Not Logged In', 'neutral']
}

export const FacultyAttendanceFlow = forwardRef(function FacultyAttendanceFlow({ profileName = 'Faculty', facultyId = '', onStatusChange, onWorkLogLogout }, ref) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dismissedMandatoryRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const next = responseStatus(await getFacultyAttendanceStatus({ facultyId }))
      next._receivedAt = Date.now()
      setStatus(next)
      onStatusChange?.(next)
      if (next.mandatoryLoginRequired && !dismissedMandatoryRef.current) setIsOpen(true)
      setError('')
    } catch (errorObject) { setError(requestError(errorObject, 'Attendance status is unavailable right now.')); onStatusChange?.({ status: 'UNAVAILABLE', mandatoryLoginRequired: false }) }
  }, [facultyId, onStatusChange])

  useImperativeHandle(ref, () => ({
    open: () => setIsOpen(true),
    refresh,
  }), [refresh])

  useEffect(() => {
    window.setTimeout(() => { void refresh() }, 0)
    if (!isOpen) return undefined
    const clockId = window.setInterval(() => setNow(Date.now()), 1000)
    const pollId = window.setInterval(refresh, 15000)
    return () => { window.clearInterval(clockId); window.clearInterval(pollId) }
  }, [isOpen, refresh])

  const serverNow = status?.currentServerTime ? new Date(status.currentServerTime).getTime() : now
  const serverOffset = status?._receivedAt ? serverNow - status._receivedAt : 0
  const liveServerNow = useMemo(() => new Date(now + serverOffset), [now, serverOffset])
  const [statusLabel, statusTone] = statusMeta(status?.status, status?.exemption)
  const activeEnd = status?.interruptionEndTime ? new Date(status.interruptionEndTime).getTime() : 0
  const remaining = status?.remainingSeconds !== undefined
    ? Math.max(0, Number(status.remainingSeconds) - Math.floor(Math.max(0, now - Number(status._receivedAt || now)) / 1000))
    : (activeEnd ? Math.max(0, Math.ceil((activeEnd - liveServerNow.getTime()) / 1000)) : 0)
  const workingSeconds = useMemo(() => {
    const base = Number(status?.workingSeconds || 0)
    if (status?.status !== 'LOGGED_IN' || !status?.currentSession?.loginAt) return base
    const loginAt = new Date(status.currentSession.loginAt).getTime()
    return base + (Number.isFinite(loginAt) ? Math.max(0, Math.floor((liveServerNow.getTime() - loginAt) / 1000)) : 0)
  }, [liveServerNow, status])

  const handleLogin = async () => {
    if (loading || !status?.canLogin) return
    setLoading(true); setError('')
    try {
      const next = responseStatus(await loginFacultyAttendance({ facultyId, facultyName: profileName }))
      setStatus(next)
      onStatusChange?.(next)
      if (!next.mandatoryLoginRequired) setIsOpen(false)
      window.dispatchEvent(new CustomEvent(FACULTY_ATTENDANCE_SYNC_EVENT))
    } catch (errorObject) { setError(requestError(errorObject, 'Unable to save login.')); await refresh() } finally { setLoading(false) }
  }
  const handleWorkLogLogout = async () => {
    if (loading || !status?.canLogout || !onWorkLogLogout) return
    setLoading(true); setError('')
    try {
      const nextPayload = await onWorkLogLogout()
      if (nextPayload) {
        const next = responseStatus(nextPayload)
        next._receivedAt = Date.now()
        setStatus(next)
        onStatusChange?.(next)
      }
    } catch (errorObject) { setError(requestError(errorObject, 'Unable to complete Work Log logout.')) } finally { setLoading(false) }
  }
  const displayName = status?.faculty?.name || profileName
  const displayId = status?.faculty?.facultyId || status?.faculty?.id || facultyId || '-'
  const modal = isOpen ? createPortal(
    <div className="faculty-attendance-overlay" role="presentation">
      <section className="faculty-attendance-modal" role="dialog" aria-modal="true" aria-labelledby="faculty-attendance-title">
        <header className="faculty-attendance-modal-header"><div><span className="faculty-attendance-eyebrow">Faculty Dashboard</span><h2 id="faculty-attendance-title">Attendance</h2></div><button type="button" className="faculty-attendance-close" onClick={() => { dismissedMandatoryRef.current = Boolean(status?.mandatoryLoginRequired); setIsOpen(false) }} aria-label="Close attendance"><X size={19} /></button></header>
        {error ? <div className="faculty-attendance-error" role="alert">{error}</div> : null}
        {!status ? <div className="faculty-attendance-loading"><RefreshCw size={18} className="faculty-attendance-spin" /> Loading attendance status…</div> : <>
          <div className="faculty-attendance-identity"><div><span>Faculty Name</span><strong>{displayName}</strong></div><div><span>Faculty ID</span><strong>{displayId}</strong></div><div><span>Date</span><strong>{dateLabel(status.attendanceDate || liveServerNow)}</strong></div><div><span>Current Time</span><strong>{clock(liveServerNow, true)}</strong></div></div>
          <div className={`faculty-attendance-status faculty-attendance-status--${statusTone}`}><i />{statusLabel}</div>
          {status.status === 'ON_PERMISSION' ? <div className="faculty-attendance-interruption"><strong>{status.interruptionType === 'HALF_DAY' ? 'Half Day' : 'Permission'} active</strong><span>{clock(status.interruptionStartTime)} – {clock(status.interruptionEndTime)}</span>{status.interruptionReason ? <span>{status.interruptionReason}</span> : null}<b>Remaining: {duration(remaining)}</b></div> : null}
          {status.mandatoryLoginRequired ? <div className="faculty-attendance-info">Work Log login is required before you can use the Faculty Dashboard.</div> : null}
          {status.exemption?.exempt ? <div className="faculty-attendance-info">Work Log login is not required today because this date is exempted.</div> : null}
          <div className="faculty-attendance-metrics"><div><span>Login Time</span><strong>{clock(status.firstLoginAt)}</strong></div><div><span>Logout Time</span><strong>{clock(status.finalLogoutAt)}</strong></div><div><span>Working Time</span><strong>{duration(workingSeconds)}</strong></div></div>
          <div className="faculty-attendance-actions">{status.canLogin ? <button type="button" className="faculty-attendance-primary" onClick={handleLogin} disabled={loading}><LogIn size={17} /> {loading ? 'Saving…' : 'Login'}</button> : null}{status.canLogout && onWorkLogLogout ? <button type="button" className="faculty-attendance-danger" onClick={handleWorkLogLogout} disabled={loading}><LogOut size={17} /> {loading ? 'Logging out…' : 'Logout'}</button> : null}</div>
        </>}
      </section>
    </div>, document.body,
  ) : null

  const isExempt = Boolean(status?.exemption?.exempt)
  return <><button type="button" className="faculty-attendance-chip" disabled={isExempt} title={isExempt ? 'Work Log is not required today' : 'Open Work Log'} onClick={() => { dismissedMandatoryRef.current = false; setIsOpen(true); setNow(Date.now()) }} aria-haspopup="dialog" aria-expanded={isOpen} aria-disabled={isExempt}><CalendarDays size={18} /><span>Work Log</span></button>{modal}</>
})
