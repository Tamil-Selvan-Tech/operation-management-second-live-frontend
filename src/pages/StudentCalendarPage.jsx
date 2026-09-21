import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { StudentCalendarPanel } from '../components/StudentCalendarPanel'
import { getStudentCalendar } from '../services/studentService'
import { getFacultyCalendar, getFacultyLeaveRequests } from '../services/facultyCalendarService'
import { getStudentCalendarAttendance } from '../lib/studentAttendanceCalendar'
import { getStudentCalendarSummary } from '../lib/studentCalendarSummary'
import '../styles/StudentCalendarPage.css'

function getStudentKey(student = {}) {
  return String(student.studentId || student.id || student._id || '').trim()
}

function toCalendarDate(value) {
  const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function mergeFacultyLeaveEvents(calendar = {}, requests = []) {
  const events = Array.isArray(calendar?.events) ? calendar.events : []
  const leaveEvents = (Array.isArray(requests) ? requests : [])
    .filter((request) => String(request?.status || '').toUpperCase() === 'APPROVED')
    .flatMap((request) => {
      const from = toCalendarDate(request?.fromDate)
      const to = toCalendarDate(request?.toDate || request?.fromDate)
      if (!from || !to) return []

      const rows = []
      for (let cursor = from; cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
        rows.push({
          ...request,
          date: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
          code: request.durationType === 'PERMISSION' ? 'PERMISSION' : request.durationType === 'HALF_DAY' ? 'HALF_DAY' : 'LEAVE',
          status: 'Approved',
        })
      }
      return rows
    })
  const existingKeys = new Set(events.map((event) => `${event?.id || ''}:${String(event?.date || '').slice(0, 10)}:${String(event?.code || event?.status || '').toUpperCase()}`))

  return {
    ...calendar,
    events: [
      ...events,
      ...leaveEvents.filter((event) => !existingKeys.has(`${event?.id || ''}:${String(event?.date || '').slice(0, 10)}:${String(event?.code || event?.status || '').toUpperCase()}`)),
    ],
  }
}

function hydrateStudentCalendarSummary(student) {
  if (!student) return student
  const summary = getStudentCalendarSummary(student)
  return {
    ...student,
    ...(summary ? {
      courseEndDate: summary.endDate || student.courseEndDate || '',
      totalHours: summary.totalHours || summary.course?.totalHours || student.totalHours || '',
      hoursPerDay: summary.hoursPerDay || student.hoursPerDay || '',
      requiredTeachingDays: summary.requiredTeachingDays || student.requiredTeachingDays || '',
      actualTeachingDays: summary.actualTeachingDays || student.actualTeachingDays || '',
      calendarDurationDays: summary.calendarDurationDays || student.calendarDurationDays || '',
      courseMode: summary.courseMode || summary.course?.mode || student.courseMode || '',
      calendarEvents: Array.isArray(summary.events) ? summary.events : student.calendarEvents || [],
      scheduleSummary: summary,
    } : {}),
    attendanceByDate: { ...(student.attendanceByDate || {}), ...getStudentCalendarAttendance(student) },
  }
}

export function StudentCalendarPage({ student: initialStudent, studentId, backPath, onBack, useFacultyCalendar = false }) {
  const [student, setStudent] = useState(() => hydrateStudentCalendarSummary(initialStudent))
  const [facultyCalendar, setFacultyCalendar] = useState(null)
  const [error, setError] = useState('')
  const resolvedId = String(studentId || getStudentKey(initialStudent)).trim()

  useEffect(() => {
    if (initialStudent) {
      // The dashboard student list hydrates asynchronously after the route mounts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStudent(hydrateStudentCalendarSummary(initialStudent))
    }
  }, [initialStudent])

  useEffect(() => {
    const refreshAttendance = () => {
      setStudent((current) => current
        ? { ...current, attendanceByDate: { ...(current.attendanceByDate || {}), ...getStudentCalendarAttendance(current) } }
        : current)
    }
    const refreshSummary = () => {
      setStudent((current) => hydrateStudentCalendarSummary(current))
    }
    window.addEventListener('cispro:student-calendar-attendance-changed', refreshAttendance)
    window.addEventListener('cispro:student-calendar-summary-changed', refreshSummary)
    return () => {
      window.removeEventListener('cispro:student-calendar-attendance-changed', refreshAttendance)
      window.removeEventListener('cispro:student-calendar-summary-changed', refreshSummary)
    }
  }, [])

  useEffect(() => {
    let active = true
    if (!resolvedId) return undefined

    getStudentCalendar(resolvedId)
      .then((calendar) => {
        if (!active || !calendar) return
        const savedSummary = getStudentCalendarSummary(initialStudent || {})
        setStudent((current) => ({
          ...(current || {}),
          courseEndDate: calendar.endDate || current?.courseEndDate || '',
          totalWorkingDays: calendar.totalWorkingDays || current?.totalWorkingDays || '',
          totalHours: calendar.totalHours || calendar.course?.totalHours || current?.totalHours || '',
          hoursPerDay: calendar.hoursPerDay || current?.hoursPerDay || '',
          requiredTeachingDays: calendar.requiredTeachingDays || current?.requiredTeachingDays || '',
          actualTeachingDays: calendar.actualTeachingDays || current?.actualTeachingDays || '',
          calendarDurationDays: calendar.calendarDurationDays || current?.calendarDurationDays || '',
          courseMode: calendar.courseMode || calendar.course?.mode || current?.courseMode || '',
          calendarEvents: Array.isArray(calendar.events) ? calendar.events : current?.calendarEvents || [],
          scheduleSummary: { ...(savedSummary || {}), ...calendar },
        }))
      })
      .catch((requestError) => {
        // Calendar detail hydration is optional for dashboard users. The
        // dashboard student record remains the source of truth when the
        // role cannot access the dedicated calendar endpoint.
        const status = Number(requestError?.status || requestError?.statusCode || requestError?.body?.statusCode)
        const message = String(requestError?.message || '').toLowerCase()
        const isPermissionError = message.includes('permission') || message.includes('not authorized') || message.includes('unauthorized')
        if (active && ![401, 403, 404].includes(status) && !isPermissionError) setError(requestError?.message || 'Unable to refresh calendar data.')
      })

    return () => { active = false }
  }, [initialStudent, resolvedId])

  useEffect(() => {
    let active = true
    if (!useFacultyCalendar || !resolvedId) return undefined

    Promise.all([getFacultyCalendar(), getFacultyLeaveRequests()])
      .then(([calendar, requests]) => {
        if (active) setFacultyCalendar(mergeFacultyLeaveEvents(calendar || {}, requests))
      })
      .catch(() => {
        // Student calendar data remains available if the faculty calendar
        // endpoint is unavailable for the current dashboard role.
      })

    return () => { active = false }
  }, [resolvedId, useFacultyCalendar])

  const back = onBack || (() => { window.location.assign(backPath) })

  if (!student) {
    return <section className="student-calendar-page"><p className="student-calendar-page-error">Student record not found.</p></section>
  }

  return (
    <section className="student-calendar-page">
      <button type="button" className="student-calendar-back-button" onClick={back}>
        <ArrowLeft size={17} /> Back to Students
      </button>

      <header className="student-calendar-page-header">
        <div>
          <h1>Student Calendar</h1>
          <p>{student.studentName || student.name || student.studentId || resolvedId}</p>
        </div>
      </header>

      {error ? <p className="student-calendar-page-error">{error}</p> : null}
      <StudentCalendarPanel student={student} facultyCalendar={facultyCalendar} externalUi />
    </section>
  )
}

export default StudentCalendarPage
