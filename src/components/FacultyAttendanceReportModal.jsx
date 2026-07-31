import { useEffect, useState } from 'react'
import { CalendarDays, Download, LoaderCircle } from 'lucide-react'
import { Button } from './Button'
import { getCurrentFacultyAttendanceOverview } from '../services/attendanceService'
import { getAttendanceDateKey, listFacultyAttendanceStates, normalizeAttendanceSessions } from '../lib/facultyAttendanceStore'

function formatFileDate(value) {
  if (!value) return ''

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

function formatDisplayDate(value) {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatTime(value) {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDuration(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) return '-'

  const diffMs = Math.max(0, end.getTime() - start.getTime())
  if (!Number.isFinite(diffMs) || diffMs <= 0) return '-'

  const totalMinutes = Math.max(1, Math.round(diffMs / (60 * 1000)))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getDateKeysInRange(fromDate, toDate) {
  const start = new Date(`${fromDate}T00:00:00`)
  const end = new Date(`${toDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return []

  const keys = []
  const cursor = new Date(start)

  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }

  return keys
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function collectAttendanceGroups(source, dateKey, groups = [], seen = new Set()) {
  if (!source) return groups

  if (Array.isArray(source)) {
    source.forEach((item) => collectAttendanceGroups(item, dateKey, groups, seen))
    return groups
  }

  if (typeof source !== 'object') return groups

  if (source.facultySession) {
    collectAttendanceGroups(source.facultySession, dateKey, groups, seen)
  }

  ;['facultySessions', 'sessions', 'data', 'items', 'results', 'records', 'faculties', 'attendance'].forEach((key) => {
    if (Array.isArray(source?.[key])) {
      source[key].forEach((item) => collectAttendanceGroups(item, dateKey, groups, seen))
    }
  })

  const sessionLike =
    Array.isArray(source.sessions) ||
    source.loginTimestamp ||
    source.logoutTimestamp ||
    source.loginAt ||
    source.logoutAt

  if (sessionLike) {
    const normalizedSessions = normalizeAttendanceSessions(source)
    if (normalizedSessions.length) {
      const facultyId = String(source.facultyId || source.id || source._id || '').trim()
      const facultyName = String(source.facultyName || source.name || '').trim()
      const signature = normalizedSessions
        .map(
          (session) =>
            `${session.loginTimestamp || ''}-${session.logoutTimestamp || ''}-${session.logoutType || ''}-${session.logoutReason || ''}-${session.workCompleted || ''}-${session.workReport || ''}`,
        )
        .join('|')
      const key = `${facultyId}::${facultyName}::${String(source.dateKey || dateKey || '').trim()}::${signature}`

      if (!seen.has(key)) {
        seen.add(key)
        groups.push({
          facultyId,
          facultyName,
          dateKey: String(source.dateKey || dateKey || '').trim(),
          logoutType: String(source.logoutType || '').trim().toLowerCase(),
          logoutReason: String(source.logoutReason || '').trim(),
          workReport: String(source.workReport || '').trim(),
          workCompleted: String(source.workCompleted || '').trim(),
          sessions: normalizedSessions,
        })
      }
    }
  }

  return groups
}

function getLocalFallbackOverview(dateKey, facultyId = '') {
  const todayKey = getAttendanceDateKey()
  if (dateKey !== todayKey) return null

  const allStates = listFacultyAttendanceStates()
  const normalizedFacultyId = String(facultyId || '').trim().toLowerCase()

  if (normalizedFacultyId) {
    const matchingState =
      allStates.find(
        (state) =>
          String(state?.facultyId || state?.id || '').trim().toLowerCase() === normalizedFacultyId ||
          normalizeText(state?.facultyName || '') === normalizedFacultyId,
      ) || null

    return matchingState ? { facultySession: matchingState } : null
  }

  return allStates.length ? { facultySessions: allStates } : null
}

async function fetchAttendanceOverviewForDate(dateKey, facultyId = '') {
  try {
    return await getCurrentFacultyAttendanceOverview(
      facultyId
        ? {
            date: dateKey,
            facultyId,
          }
        : { date: dateKey },
    )
  } catch {
    return getLocalFallbackOverview(dateKey, facultyId)
  }
}

function buildReportRows(overview, dateKey, mode = 'all', todayKey = getAttendanceDateKey()) {
  const groups = collectAttendanceGroups(overview, dateKey)
  const rows = []

  groups.forEach((group) => {
    const normalizedFacultyName = String(group.facultyName || '').trim() || '-'
    const sessions = Array.isArray(group.sessions) ? group.sessions : []

    sessions.forEach((session, index) => {
      const loginDateTime = session?.loginTimestamp ? new Date(Number(session.loginTimestamp)) : null
      const logoutDateTime = session?.logoutTimestamp ? new Date(Number(session.logoutTimestamp)) : null
      const activeSessionEnd = !logoutDateTime && dateKey === todayKey && loginDateTime ? new Date() : null
      const workedDuration = loginDateTime && (logoutDateTime || activeSessionEnd) ? formatDuration(loginDateTime, logoutDateTime || activeSessionEnd) : '-'
      const isEarlyLogout = String(session?.logoutType || group.logoutType || 'normal').trim().toLowerCase() === 'early'
      const reason = isEarlyLogout ? String(session?.logoutReason || group.logoutReason || '').trim() || '-' : '-'
      const workCompleted = String(session?.workCompleted || group.workCompleted || '').trim() || '-'
      const workReport = String(session?.workReport || group.workReport || '').trim() || '-'

      const baseRow = [
        formatDisplayDate(dateKey),
        String(index + 1),
        formatTime(loginDateTime),
        formatTime(logoutDateTime),
        workedDuration,
        isEarlyLogout ? 'Yes' : 'No',
        reason,
        workCompleted,
        workReport,
      ]

      if (mode === 'all') {
        rows.push([formatDisplayDate(dateKey), normalizedFacultyName, ...baseRow.slice(1)])
        return
      }

      rows.push(baseRow)
    })
  })

  return rows
}

function downloadFacultyAttendanceReport({ fromDate, toDate, mode = 'all', facultyName = 'All Faculty', rows = [] }) {
  const headers =
    mode === 'all'
      ? ['Date', 'Faculty Name', 'Session', 'Login Time', 'Logout Time', 'Worked Duration', 'Early Logout', 'Reason for Logout', 'Work Completed Until Now', "Today's Work Report"]
      : ['Date', 'Session', 'Login Time', 'Logout Time', 'Worked Duration', 'Early Logout', 'Reason for Logout', 'Work Completed Until Now', "Today's Work Report"]

  const bodyRows = rows.length
    ? rows
    : [mode === 'all' ? ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-'] : ['-', '-', '-', '-', '-', '-', '-', '-', '-']]

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: top; }
    th { background: #eff6ff; font-weight: 700; }
    .title { font-size: 18px; font-weight: 700; }
    .meta { color: #475569; }
  </style>
</head>
<body>
  <table>
    <tr><td class="title" colspan="${headers.length}">Faculty Attendance Report</td></tr>
    <tr><td class="meta" colspan="${headers.length}">${escapeHtml(mode === 'all' ? 'All Faculty' : facultyName)}</td></tr>
    <tr><td colspan="${headers.length}"><strong>From:</strong> ${escapeHtml(formatDisplayDate(fromDate))} | <strong>To:</strong> ${escapeHtml(formatDisplayDate(toDate))}</td></tr>
    <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
    ${bodyRows
      .map(
        (row) => `
          <tr>
            ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
          </tr>`,
      )
      .join('')}
  </table>
</body>
</html>`

  const blob = new Blob([html], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Faculty_Attendance_Report_${formatFileDate(fromDate) || 'from-date'}_to_${formatFileDate(toDate) || 'to-date'}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function getFacultyReportLabel(mode, faculty = null) {
  if (mode === 'single') {
    return String(faculty?.facultyName || '').trim() || 'Selected Faculty'
  }

  return 'All Faculty'
}

export function FacultyAttendanceReportModal({
  isOpen,
  mode = 'all',
  faculty = null,
  onClose,
}) {
  const [form, setForm] = useState({ fromDate: '', toDate: '' })
  const [isDownloading, setIsDownloading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const facultyLabel = getFacultyReportLabel(mode, faculty)
  const canDownload = Boolean(form.fromDate && form.toDate && form.toDate >= form.fromDate && !isDownloading)
  const validationErrors = {
    fromDate: touched.fromDate && !form.fromDate ? 'From Date is required.' : '',
    toDate:
      touched.toDate && !form.toDate
        ? 'To Date is required.'
        : form.fromDate && form.toDate && form.toDate < form.fromDate
          ? 'To Date cannot be before From Date.'
          : '',
  }

  const handleDownload = async () => {
    const nextTouched = { fromDate: true, toDate: true }
    setTouched(nextTouched)

    if (!form.fromDate || !form.toDate || form.toDate < form.fromDate) {
      setErrorMessage(!form.fromDate || !form.toDate ? 'Please select a valid date range.' : 'To Date cannot be before From Date.')
      return
    }

    setErrorMessage('')
    setIsDownloading(true)

    try {
      const dateKeys = getDateKeysInRange(form.fromDate, form.toDate)
      const facultyId = String(faculty?.id || faculty?.facultyId || '').trim()
      const settled = await Promise.all(
        dateKeys.map(async (dateKey) => ({
          dateKey,
          overview: await fetchAttendanceOverviewForDate(dateKey, mode === 'single' ? facultyId : ''),
        })),
      )

      const todayKey = getAttendanceDateKey()
      const rows = settled.flatMap(({ overview, dateKey }) => buildReportRows(overview, dateKey, mode, todayKey))

      downloadFacultyAttendanceReport({
        fromDate: form.fromDate,
        toDate: form.toDate,
        mode,
        facultyName: facultyLabel,
        rows,
      })
    } catch (error) {
      setErrorMessage(error?.body?.message || error?.message || 'Unable to generate faculty attendance report right now.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="course-modal-backdrop student-modal-backdrop attendance-report-backdrop faculty-attendance-report-backdrop" role="presentation">
      <form
        className="course-modal panel-card student-modal attendance-report-modal faculty-attendance-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="faculty-attendance-report-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          if (canDownload) {
            void handleDownload()
          }
        }}
      >
        <button type="button" className="course-modal-close" onClick={onClose} aria-label="Close faculty attendance report modal">
          X
        </button>

        <div className="course-modal-header student-modal-header attendance-report-header">
          <div>
            <p className="section-kicker">Attendance Report</p>
            <h3 id="faculty-attendance-report-title">Generate Faculty Attendance Report</h3>
          </div>
          <div className="attendance-report-summary">
            <div className="attendance-report-summary-chip">
              <CalendarDays size={16} />
              <span>{facultyLabel}</span>
            </div>
          </div>
        </div>

        <div className="attendance-report-card">
          <div className="attendance-report-student-card faculty-attendance-report-card">
            <span>Report Scope</span>
            <strong>{mode === 'single' ? 'Selected Faculty' : 'All Faculty'}</strong>
            <small>{mode === 'single' ? facultyLabel : 'The export will include every faculty attendance session in the selected date range.'}</small>
          </div>

          <div className="course-form-grid student-form-grid student-form-grid-tight attendance-report-grid faculty-attendance-report-grid">
            <label className="course-field student-field student-field-has-icon">
              <span>
                From Date
                <b>*</b>
              </span>
              <div className="student-field-control">
                <span className="student-field-icon">
                  <CalendarDays size={18} />
                </span>
                <input
                  type="date"
                  value={form.fromDate}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, fromDate: event.target.value }))
                    setTouched((current) => ({ ...current, fromDate: true }))
                    setErrorMessage('')
                  }}
                />
              </div>
              {validationErrors.fromDate ? <small className="student-field-error">{validationErrors.fromDate}</small> : null}
            </label>

            <label className="course-field student-field student-field-has-icon">
              <span>
                To Date
                <b>*</b>
              </span>
              <div className="student-field-control">
                <span className="student-field-icon">
                  <CalendarDays size={18} />
                </span>
                <input
                  type="date"
                  value={form.toDate}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, toDate: event.target.value }))
                    setTouched((current) => ({ ...current, toDate: true }))
                    setErrorMessage('')
                  }}
                  min={form.fromDate || undefined}
                />
              </div>
              {validationErrors.toDate ? <small className="student-field-error">{validationErrors.toDate}</small> : null}
            </label>
          </div>

          {errorMessage ? (
            <div className="attendance-report-error" role="alert">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="course-form-actions attendance-report-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canDownload}>
            {isDownloading ? (
              <>
                <LoaderCircle className="attendance-report-spinner" />
                Generating Faculty Attendance Report...
              </>
            ) : (
              <>
                <Download />
                Download Excel
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
