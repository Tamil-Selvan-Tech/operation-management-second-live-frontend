import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, LogIn, LogOut, RefreshCw, X } from 'lucide-react'
import {
  getFacultyAttendanceBatches,
  getFacultyAttendanceStatus,
  loginFacultyAttendance,
  logoutFacultyAttendance,
} from '../services/attendanceService'
import '../styles/FacultyAttendanceFlow.css'

const STATES = ['NOT_LOGGED_IN', 'LOGGED_IN', 'ON_PERMISSION', 'LOGIN_REQUIRED', 'LOGGED_OUT']

function listFrom(value) { return Array.isArray(value) ? value : value?.batches || value?.items || value?.data || [] }
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
function statusMeta(status) {
  return { NOT_LOGGED_IN: ['Not Logged In', 'neutral'], LOGGED_IN: ['Logged In', 'success'], ON_PERMISSION: ['On Permission / Half Day', 'warning'], LOGIN_REQUIRED: ['Login Required', 'info'], LOGGED_OUT: ['Logged Out', 'danger'] }[status] || ['Not Logged In', 'neutral']
}

export function FacultyAttendanceFlow({ profileName = 'Faculty', facultyId = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [status, setStatus] = useState(null)
  const [batches, setBatches] = useState([])
  const [work, setWork] = useState({})
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(false)
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const next = responseStatus(await getFacultyAttendanceStatus({ facultyId }))
      next._receivedAt = Date.now()
      setStatus(next)
      setError('')
    } catch (errorObject) { setError(requestError(errorObject, 'Attendance status is unavailable right now.')) }
  }, [facultyId])

  useEffect(() => {
    if (!isOpen) return undefined
    window.setTimeout(() => { void refresh() }, 0)
    const clockId = window.setInterval(() => setNow(Date.now()), 1000)
    const pollId = window.setInterval(refresh, 15000)
    return () => { window.clearInterval(clockId); window.clearInterval(pollId) }
  }, [isOpen, refresh])

  const serverNow = status?.currentServerTime ? new Date(status.currentServerTime).getTime() : now
  const serverOffset = status?._receivedAt ? serverNow - status._receivedAt : 0
  const liveServerNow = useMemo(() => new Date(now + serverOffset), [now, serverOffset])
  const [statusLabel, statusTone] = statusMeta(status?.status)
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
    try { setStatus(responseStatus(await loginFacultyAttendance({ facultyId, facultyName: profileName }))) } catch (errorObject) { setError(requestError(errorObject, 'Unable to save login.')); await refresh() } finally { setLoading(false) }
  }
  const openLogout = async () => {
    if (loading || !status?.canLogout) return
    setLogoutOpen(true); setBatchesLoading(true); setError('')
    try { setBatches(listFrom(await getFacultyAttendanceBatches())) } catch (errorObject) { setError(requestError(errorObject, 'Unable to load assigned batches.')) } finally { setBatchesLoading(false) }
  }
  const handleLogout = async (event) => {
    event.preventDefault(); if (loading) return
    setLoading(true); setError('')
    try {
      const batchWork = batches.map((batch, index) => { const id = batch.id || batch.batchId || `batch-${index}`; return { batchId: id, workSummary: String(work[id] || '').trim() } })
      setStatus(responseStatus(await logoutFacultyAttendance(batchWork, { facultyId, facultyName: profileName }))); setLogoutOpen(false)
    } catch (errorObject) { setError(requestError(errorObject, 'Unable to complete logout.')); await refresh() } finally { setLoading(false) }
  }

  const displayName = status?.faculty?.name || profileName
  const displayId = status?.faculty?.facultyId || status?.faculty?.id || facultyId || '-'
  const batchGroups = useMemo(() => {
    const groups = new Map()
    batches.forEach((batch, index) => {
      const branchName = batch.branchName || batch.branch?.name || batch.branch?.branchName || `Branch ${index + 1}`
      const branchKey = String(batch.branchId || batch.branch?.id || branchName).trim().toLowerCase()
      if (!groups.has(branchKey)) groups.set(branchKey, { name: branchName, batches: [] })
      groups.get(branchKey).batches.push(batch)
    })
    return Array.from(groups.values())
  }, [batches])
  const modal = isOpen ? createPortal(
    <div className="faculty-attendance-overlay" role="presentation">
      <section className="faculty-attendance-modal" role="dialog" aria-modal="true" aria-labelledby="faculty-attendance-title">
        <header className="faculty-attendance-modal-header"><div><span className="faculty-attendance-eyebrow">Faculty Dashboard</span><h2 id="faculty-attendance-title">Attendance</h2></div><button type="button" className="faculty-attendance-close" onClick={() => { setIsOpen(false); setLogoutOpen(false) }} aria-label="Close attendance"><X size={19} /></button></header>
        {error ? <div className="faculty-attendance-error" role="alert">{error}</div> : null}
        {!status ? <div className="faculty-attendance-loading"><RefreshCw size={18} className="faculty-attendance-spin" /> Loading attendance status…</div> : <>
          <div className="faculty-attendance-identity"><div><span>Faculty Name</span><strong>{displayName}</strong></div><div><span>Faculty ID</span><strong>{displayId}</strong></div><div><span>Date</span><strong>{dateLabel(status.attendanceDate || liveServerNow)}</strong></div><div><span>Current Time</span><strong>{clock(liveServerNow, true)}</strong></div></div>
          <div className={`faculty-attendance-status faculty-attendance-status--${statusTone}`}><i />{statusLabel}</div>
          {status.status === 'ON_PERMISSION' ? <div className="faculty-attendance-interruption"><strong>{status.interruptionType === 'HALF_DAY' ? 'Half Day' : 'Permission'} active</strong><span>{clock(status.interruptionStartTime)} – {clock(status.interruptionEndTime)}</span>{status.interruptionReason ? <span>{status.interruptionReason}</span> : null}<b>Remaining: {duration(remaining)}</b></div> : null}
          {status.status === 'LOGIN_REQUIRED' ? <div className="faculty-attendance-info">Permission / Half Day completed. Login manually to resume working.</div> : null}
          <div className="faculty-attendance-metrics"><div><span>Login Time</span><strong>{clock(status.firstLoginAt)}</strong></div><div><span>Logout Time</span><strong>{clock(status.finalLogoutAt)}</strong></div><div><span>Working Time</span><strong>{duration(workingSeconds)}</strong></div></div>
          <div className="faculty-attendance-actions">{status.canLogin ? <button type="button" className="faculty-attendance-primary" onClick={handleLogin} disabled={loading}><LogIn size={17} /> {loading ? 'Saving…' : 'Login'}</button> : null}{status.canLogout ? <button type="button" className="faculty-attendance-danger" onClick={openLogout} disabled={loading}><LogOut size={17} /> Logout</button> : null}</div>
        </>}
        {logoutOpen ? <div className="faculty-attendance-logout-panel"><div className="faculty-attendance-logout-heading"><div><span className="faculty-attendance-eyebrow">End attendance day</span><h3>Today’s Work</h3></div><button type="button" className="faculty-attendance-close" onClick={() => setLogoutOpen(false)} aria-label="Close logout form"><X size={17} /></button></div><p className="faculty-attendance-muted">Add a separate summary for each assigned batch before confirming logout.</p><form onSubmit={handleLogout}>{batchesLoading ? <div className="faculty-attendance-loading">Loading assigned batches…</div> : batchGroups.length ? batchGroups.map((group) => <div className="faculty-attendance-branch-group" key={group.name}>{<strong className="faculty-attendance-branch-title">{group.name}</strong>}{group.batches.map((batch, index) => { const id = batch.id || batch.batchId || `batch-${index}`; return <label className="faculty-attendance-batch" key={id}><span>{batch.name || batch.batchName || batch.batch?.name || `Batch ${index + 1}`}</span><textarea rows="3" value={work[id] || ''} onChange={(event) => setWork((current) => ({ ...current, [id]: event.target.value }))} placeholder="What was completed today?" /></label> })}</div>) : <div className="faculty-attendance-info">No assigned batches were returned.</div>}<div className="faculty-attendance-form-actions"><button type="button" className="faculty-attendance-secondary" onClick={() => setLogoutOpen(false)}>Cancel</button><button type="submit" className="faculty-attendance-danger" disabled={loading || batchesLoading || !batches.length}>{loading ? 'Saving…' : 'Confirm Logout'}</button></div></form></div> : null}
      </section>
    </div>, document.body,
  ) : null

  return <><button type="button" className="faculty-attendance-chip" onClick={() => { setIsOpen(true); setNow(Date.now()) }} aria-haspopup="dialog" aria-expanded={isOpen}><CalendarDays size={18} /><span>Attendance</span></button>{modal}</>
}
