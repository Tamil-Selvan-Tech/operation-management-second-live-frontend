import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { StudentCalendarPanel } from '../components/StudentCalendarPanel'
import { getStudentCalendar } from '../services/studentService'
import { getStudentCalendarAttendance } from '../lib/studentAttendanceCalendar'
import '../styles/StudentCalendarPage.css'

function getStudentKey(student = {}) {
  return String(student.studentId || student.id || student._id || '').trim()
}

export function StudentCalendarPage({ student: initialStudent, studentId, backPath, onBack }) {
  const [student, setStudent] = useState(() => initialStudent
    ? { ...initialStudent, attendanceByDate: { ...(initialStudent.attendanceByDate || {}), ...getStudentCalendarAttendance(initialStudent) } }
    : null)
  const [error, setError] = useState('')
  const resolvedId = String(studentId || getStudentKey(initialStudent)).trim()

  useEffect(() => {
    if (initialStudent) {
      setStudent({
        ...initialStudent,
        attendanceByDate: { ...(initialStudent.attendanceByDate || {}), ...getStudentCalendarAttendance(initialStudent) },
      })
    }
  }, [initialStudent])

  useEffect(() => {
    const refreshAttendance = () => {
      setStudent((current) => current
        ? { ...current, attendanceByDate: { ...(current.attendanceByDate || {}), ...getStudentCalendarAttendance(current) } }
        : current)
    }
    window.addEventListener('cispro:student-calendar-attendance-changed', refreshAttendance)
    return () => window.removeEventListener('cispro:student-calendar-attendance-changed', refreshAttendance)
  }, [])

  useEffect(() => {
    let active = true
    if (!resolvedId) return undefined

    getStudentCalendar(resolvedId)
      .then((calendar) => {
        if (!active || !calendar) return
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
          scheduleSummary: calendar,
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
  }, [resolvedId])

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
        </div>
      </header>

      {error ? <p className="student-calendar-page-error">{error}</p> : null}
      <StudentCalendarPanel student={student} externalUi />
    </section>
  )
}

export default StudentCalendarPage
