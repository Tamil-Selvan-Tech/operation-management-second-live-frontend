import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, CheckCircle2, Clock3, FileText, LogIn, LogOut, X } from 'lucide-react'

const ATTENDANCE_STORAGE_PREFIX = 'cispro.faculty.attendance'

function formatOrdinalDay(day) {
  const suffix = day % 10 === 1 && day % 100 !== 11 ? 'st' : day % 10 === 2 && day % 100 !== 12 ? 'nd' : day % 10 === 3 && day % 100 !== 13 ? 'rd' : 'th'
  return `${day}${suffix}`
}

function formatAttendanceDate(date = new Date()) {
  const day = formatOrdinalDay(date.getDate())
  const month = date.toLocaleString('en-GB', { month: 'long' })
  const year = date.getFullYear()
  return `${day} ${month}, ${year}`
}

function getAttendanceDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeStorageSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'faculty'
}

function buildAttendanceStorageKey(profileName, profileInitials) {
  return `${ATTENDANCE_STORAGE_PREFIX}.${normalizeStorageSlug(profileName || profileInitials)}`
}

function loadStoredAttendanceState(storageKey) {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || parsed.dateKey !== getAttendanceDateKey()) return null

    return parsed
  } catch {
    return null
  }
}

function saveStoredAttendanceState(storageKey, payload) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch {
    // Ignore storage failures and keep the UI functional.
  }
}

function clearStoredAttendanceState(storageKey) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    // Ignore storage failures and keep the UI functional.
  }
}

function formatAttendanceTime(date = new Date()) {
  return date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDuration(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) return '-'
  const diffMs = Math.max(0, end.getTime() - start.getTime())
  const totalSeconds = Math.max(1, Math.ceil(diffMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours}h ${minutes}m ${seconds}s`
}

function getGreetingLabel() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function AttendanceStatusPill({ status }) {
  const toneClass =
    status === 'logged-in'
      ? 'is-success'
      : status === 'logout-form'
        ? 'is-warning'
        : status === 'logged-out'
          ? 'is-error'
          : 'is-neutral'

  const label =
    status === 'logged-in'
      ? 'Logged In'
      : status === 'logout-form'
        ? 'Logging Out'
        : status === 'logged-out'
          ? 'Logged Out'
          : 'Not Logged In'

  return (
    <div className={`faculty-attendance-status ${toneClass}`.trim()}>
      <span className="faculty-attendance-status-dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function FacultyAttendanceFlow({ profileName = 'Faculty', profileInitials = 'FA' }) {
  const storageKey = buildAttendanceStorageKey(profileName, profileInitials)
  const initialAttendance = loadStoredAttendanceState(storageKey)
  const [isOpen, setIsOpen] = useState(false)
  const [viewState, setViewState] = useState(() => initialAttendance?.viewState || 'idle')
  const [logoutType, setLogoutType] = useState(() => initialAttendance?.logoutType || 'normal')
  const [loginTime, setLoginTime] = useState(() => (initialAttendance?.loginTimestamp ? new Date(initialAttendance.loginTimestamp) : null))
  const [logoutTime, setLogoutTime] = useState(() => (initialAttendance?.logoutTimestamp ? new Date(initialAttendance.logoutTimestamp) : null))
  const [workReport, setWorkReport] = useState(() => initialAttendance?.workReport || '')
  const [logoutReason, setLogoutReason] = useState(() => initialAttendance?.logoutReason || '')
  const [workCompleted, setWorkCompleted] = useState(() => initialAttendance?.workCompleted || '')
  const [errorMessage, setErrorMessage] = useState('')
  const activeDateKeyRef = useRef(initialAttendance?.dateKey || getAttendanceDateKey())

  const greetingLabel = getGreetingLabel()
  const todayLabel = formatAttendanceDate(new Date())
  const displayTime = viewState === 'logged-in' ? loginTime : viewState === 'logged-out' ? logoutTime : new Date()
  const displayTimeLabel = formatAttendanceTime(displayTime)
  const loginLabel = loginTime ? formatAttendanceTime(loginTime) : 'N/A'
  const logoutLabel = logoutTime ? formatAttendanceTime(logoutTime) : 'N/A'
  const workedDuration = loginTime && logoutTime ? formatDuration(loginTime, logoutTime) : '-'
  const isLogoutMode = viewState === 'logout-form'
  const isLoggedIn = viewState === 'logged-in' || viewState === 'logout-form'
  const primaryLabel = isLoggedIn ? 'Log Out' : 'Log In'
  const primaryTone = isLoggedIn ? 'logout' : 'login'

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        setErrorMessage('')
        setViewState((current) => (current === 'logout-form' ? 'logged-in' : current))
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    const todayKey = getAttendanceDateKey()
    activeDateKeyRef.current = todayKey

    if (initialAttendance?.dateKey && initialAttendance.dateKey !== todayKey) {
      clearStoredAttendanceState(storageKey)
    }
  }, [initialAttendance?.dateKey, storageKey])

  useEffect(() => {
    const payload = {
      dateKey: getAttendanceDateKey(),
      viewState,
      logoutType,
      loginTimestamp: loginTime ? loginTime.getTime() : null,
      logoutTimestamp: logoutTime ? logoutTime.getTime() : null,
      workReport,
      logoutReason,
      workCompleted,
    }

    activeDateKeyRef.current = payload.dateKey
    saveStoredAttendanceState(storageKey, payload)
  }, [loginTime, logoutReason, logoutTime, logoutType, storageKey, viewState, workCompleted, workReport])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const intervalId = window.setInterval(() => {
      const nextDateKey = getAttendanceDateKey()
      if (nextDateKey === activeDateKeyRef.current) return

      activeDateKeyRef.current = nextDateKey
      clearStoredAttendanceState(storageKey)
      setIsOpen(false)
      setViewState('idle')
      setLogoutType('normal')
      setLoginTime(null)
      setLogoutTime(null)
      setWorkReport('')
      setLogoutReason('')
      setWorkCompleted('')
      setErrorMessage('')
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [storageKey])

  const openPanel = () => setIsOpen(true)

  const closePanel = () => {
    setIsOpen(false)
    setErrorMessage('')
    if (viewState === 'logout-form') {
      setViewState('logged-in')
    }
  }

  const handleLogin = () => {
    const now = new Date()
    activeDateKeyRef.current = getAttendanceDateKey(now)
    setLoginTime(now)
    setLogoutTime(null)
    setWorkReport('')
    setLogoutReason('')
    setWorkCompleted('')
    setLogoutType('normal')
    setErrorMessage('')
    setViewState('logged-in')
    setIsOpen(true)
  }

  const openLogoutForm = () => {
    if (viewState === 'logged-in') {
      setLogoutType('normal')
      setErrorMessage('')
      setViewState('logout-form')
    }
  }

  const submitLogout = (event) => {
    event.preventDefault()

    if (logoutType === 'early') {
      if (!logoutReason.trim()) {
        setErrorMessage('Reason for logout is required.')
        return
      }
    }

    setLogoutTime(new Date())
    setErrorMessage('')
    setViewState('logged-out')
  }

  const handlePrimaryAction = () => {
    if (viewState === 'logged-in') {
      openLogoutForm()
      return
    }

    if (viewState === 'logout-form') {
      return
    }

    handleLogin()
  }

  const renderMainAction = () => {
    if (viewState === 'logout-form') {
      return null
    }

    return (
      <button
        type="button"
        className={`faculty-attendance-action faculty-attendance-action-${primaryTone}`.trim()}
        onClick={handlePrimaryAction}
        aria-label={primaryLabel}
      >
        {primaryTone === 'login' ? <LogIn size={36} strokeWidth={2.1} aria-hidden="true" focusable="false" /> : <LogOut size={36} strokeWidth={2.1} aria-hidden="true" focusable="false" />}
        <span>{primaryLabel}</span>
      </button>
    )
  }

  const drawer = isOpen
    ? createPortal(
        <div className="faculty-attendance-drawer-backdrop" role="presentation">
          <aside
            className="faculty-attendance-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-attendance-kicker"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="faculty-attendance-drawer-header">
              <div>
                <p className="faculty-attendance-kicker" id="faculty-attendance-kicker">Faculty Attendance</p>
              </div>
              <button type="button" className="faculty-attendance-close" onClick={closePanel} aria-label="Close attendance panel">
                <X size={18} strokeWidth={2.2} />
              </button>
            </header>

            <div className="faculty-attendance-segmented" role="tablist" aria-label="Attendance actions">
              <button
                type="button"
                className={`faculty-attendance-segment ${!isLoggedIn && !isLogoutMode ? 'is-active' : ''}`.trim()}
                onClick={handleLogin}
              >
                Log In
              </button>
              <button
                type="button"
                className={`faculty-attendance-segment ${isLoggedIn ? 'is-active' : ''}`.trim()}
                onClick={openLogoutForm}
                disabled={!isLoggedIn}
              >
                Log Out
              </button>
            </div>

            <section className="faculty-attendance-hero">
              <div className="faculty-attendance-greeting">
                <p>{greetingLabel}</p>
                <strong>{profileName}</strong>
              </div>
              <div className="faculty-attendance-avatar" aria-hidden="true">
                {profileInitials}
              </div>
            </section>

            <AttendanceStatusPill status={viewState} />

            <div className="faculty-attendance-timestamp">
              <div className="faculty-attendance-time-icon" aria-hidden="true">
                <Clock3 size={22} strokeWidth={2.1} />
              </div>
              <strong>{displayTimeLabel}</strong>
              <span>{todayLabel}</span>
            </div>

            {!isLogoutMode ? (
              <>
                <div className="faculty-attendance-action-shell">{renderMainAction()}</div>

                <div className="faculty-attendance-summary">
                  <div>
                    <span>Log In</span>
                    <strong className={loginTime ? 'is-success' : ''}>{loginLabel}</strong>
                  </div>
                  <div>
                    <span>Log Out</span>
                    <strong className={logoutTime ? 'is-error' : ''}>{logoutLabel}</strong>
                  </div>
                </div>

                {viewState === 'logged-out' ? (
                  <div className="faculty-attendance-note">
                    <CheckCircle2 size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                    <span>Duration worked: {workedDuration}.</span>
                  </div>
                ) : null}
              </>
            ) : (
              <form className="faculty-attendance-form" onSubmit={submitLogout}>
                <div className="faculty-attendance-form-header">
                  <div className="faculty-attendance-form-title">
                    <FileText size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                    <span>Logout Details</span>
                  </div>
                  <div className="faculty-attendance-mode-switch" role="tablist" aria-label="Logout type">
                    <button
                      type="button"
                      className={`faculty-attendance-mode ${logoutType === 'normal' ? 'is-active' : ''}`.trim()}
                      onClick={() => setLogoutType('normal')}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      className={`faculty-attendance-mode ${logoutType === 'early' ? 'is-active' : ''}`.trim()}
                      onClick={() => setLogoutType('early')}
                    >
                      Early
                    </button>
                  </div>
                </div>

                {logoutType === 'early' ? (
                  <>
                    <label className="faculty-attendance-field">
                      <span>Reason for Logout *</span>
                      <input
                        type="text"
                        value={logoutReason}
                        onChange={(event) => setLogoutReason(event.target.value)}
                        placeholder="Permission / Emergency"
                      />
                    </label>
                    <label className="faculty-attendance-field">
                      <span>Work Completed Until Now (Optional)</span>
                      <textarea
                        rows="7"
                        value={workCompleted}
                        onChange={(event) => setWorkCompleted(event.target.value)}
                        placeholder="Write what you completed so far..."
                      />
                    </label>
                  </>
                ) : (
                  <label className="faculty-attendance-field">
                    <span>Today's Work Report (Optional)</span>
                    <textarea
                      rows="8"
                      value={workReport}
                      onChange={(event) => setWorkReport(event.target.value)}
                      placeholder="Write what you worked on today..."
                    />
                  </label>
                )}

                {errorMessage ? <p className="faculty-attendance-error">{errorMessage}</p> : null}

                <div className="faculty-attendance-form-actions">
                  <button type="button" className="faculty-attendance-secondary" onClick={closePanel}>
                    Cancel
                  </button>
                  <button type="submit" className="faculty-attendance-submit">
                    Confirm Logout
                  </button>
                </div>
              </form>
            )}
          </aside>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button type="button" className="faculty-attendance-chip" onClick={openPanel} aria-haspopup="dialog" aria-expanded={isOpen} aria-label="Open attendance panel">
        <CalendarDays size={18} strokeWidth={2.15} aria-hidden="true" focusable="false" />
        <span>Attendance</span>
      </button>
      {drawer}
    </>
  )
}
