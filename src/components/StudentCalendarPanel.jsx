import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, CircleX, Flag, Sparkles } from 'lucide-react'

import { buildStudentCourseCalendar, formatCalendarDate, formatCalendarLongDate } from '../lib/studentCalendar'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getStatusTone(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'course day') return 'tone-course-day'
  if (normalized === 'holiday' || normalized === 'government holiday') return 'tone-holiday'
  if (normalized === 'leave') return 'tone-holiday'
  if (normalized === 'present') return 'tone-present'
  if (normalized === 'absent') return 'tone-absent'
  return 'tone-no-class'
}

function getInitialMonthIndex(calendar) {
  if (!calendar?.months?.length) return 0

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const foundIndex = calendar.months.findIndex((month) => month.key === todayKey)
  if (foundIndex >= 0) return foundIndex

  const firstMonthDate = calendar.months[0]?.date
  const lastMonthDate = calendar.months.at(-1)?.date

  if (firstMonthDate && today < firstMonthDate) return 0
  if (lastMonthDate && today > lastMonthDate) return calendar.months.length - 1

  return 0
}

function CalendarSummaryCard({ icon: Icon, label, value, note, tone = 'tone-no-class' }) {
  return (
    <article className={`student-calendar-summary-card ${tone}`.trim()}>
      <span className="student-calendar-summary-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <div className="student-calendar-summary-copy">
        <span>{label}</span>
        <strong>{value || '-'}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </article>
  )
}

function CalendarDayCell({ day }) {
  if (day.isPlaceholder) {
    return <div className="student-calendar-day is-placeholder" aria-hidden="true" />
  }

  return (
    <article className={`student-calendar-day ${getStatusTone(day.status)} ${day.isStartDate ? 'is-start-date' : ''} ${day.isEndDate ? 'is-end-date' : ''}`.trim()}>
      <div className="student-calendar-day-head">
        <span className="student-calendar-day-number">{day.dayNumber}</span>
        <span className="student-calendar-day-weekday">{day.weekday}</span>
      </div>

      <div className="student-calendar-day-status">
        <span className="student-calendar-day-pill">{day.status}</span>
      </div>

      <div className="student-calendar-day-foot">
        {day.holidayName ? <span className="student-calendar-day-note">{day.holidayName}</span> : null}
        {day.markers?.length ? (
          <div className="student-calendar-day-markers">
            {day.markers.map((marker) => (
              <span key={marker} className="student-calendar-day-marker">{marker}</span>
            ))}
          </div>
        ) : null}
        {!day.holidayName && !day.markers?.length ? (
          <span className="student-calendar-day-note">{day.attendanceStatus ? day.attendanceStatus : day.isCourseDay ? 'Scheduled class day' : 'No class scheduled'}</span>
        ) : null}
      </div>
    </article>
  )
}

export function StudentCalendarPanel({ student }) {
  const calendar = useMemo(() => buildStudentCourseCalendar(student || {}), [student])
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0)

  useEffect(() => {
    setSelectedMonthIndex(getInitialMonthIndex(calendar))
  }, [calendar])

  const selectedMonth = calendar.months[selectedMonthIndex] || calendar.months[0] || null
  const canGoBack = selectedMonthIndex > 0
  const canGoNext = selectedMonthIndex < calendar.months.length - 1

  if (!calendar.isReady) {
    return (
      <section className="student-new-calendar-page">
        <div className="student-new-calendar-empty">
          <p className="student-new-dashboard-kicker">CALENDAR</p>
          <h2>Course calendar not available yet</h2>
          <p>We could not find a saved course start date for this student.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="student-new-calendar-page">
      <h1 className="student-new-calendar-page-title">Course Calendar</h1>

      <div className="student-new-calendar-summary-grid">
        <CalendarSummaryCard
          icon={CalendarDays}
          label="Course Name"
          value={calendar.courseName || 'Not assigned'}
          note="Saved student course"
          tone="tone-course-day"
        />
        <CalendarSummaryCard
          icon={Flag}
          label="Course Start Date"
          value={formatCalendarDate(calendar.startDate)}
          note={formatCalendarLongDate(calendar.startDate)}
          tone="tone-start"
        />
        <CalendarSummaryCard
          icon={Sparkles}
          label="Course Duration"
          value={calendar.durationMonths
            ? `${calendar.durationMonths} month${calendar.durationMonths === 1 ? '' : 's'}`
            : 'Not available'}
          note={`Schedule: ${calendar.schedule}`}
          tone="tone-course-day"
        />
        <CalendarSummaryCard
          icon={CheckCircle2}
          label="Course End Date"
          value={formatCalendarDate(calendar.endDate)}
          note={formatCalendarLongDate(calendar.endDate)}
          tone="tone-end"
        />
        <CalendarSummaryCard
          icon={CircleX}
          label="General Holidays"
          value={String(calendar.summary.holidays)}
          note="Holiday dates inside course range"
          tone="tone-holiday"
        />
      </div>

      <div className="student-new-calendar-panel">
        <div className="student-new-calendar-panel-head">
          <div>
            <p className="student-new-calendar-panel-kicker">COURSE CALENDAR</p>
            <h2>{selectedMonth ? selectedMonth.label : '-'}</h2>
            <p>
              {selectedMonth
                ? `Showing ${selectedMonth.label}. Use the arrows to move month by month across the full course duration.`
                : 'Use the arrows to browse the course calendar.'}
            </p>
          </div>

          <div className="student-new-calendar-navigation">
            <button
              type="button"
              className="student-new-calendar-nav-button"
              onClick={() => setSelectedMonthIndex((current) => Math.max(0, current - 1))}
              disabled={!canGoBack}
              aria-label="Previous month"
            >
              <ChevronLeft size={18} strokeWidth={2.4} aria-hidden="true" focusable="false" />
            </button>

            <div className="student-new-calendar-month-label">
              <strong>{selectedMonth ? selectedMonth.label : '-'}</strong>
              <span>
                {selectedMonthIndex + 1} / {calendar.months.length}
              </span>
            </div>

            <button
              type="button"
              className="student-new-calendar-nav-button"
              onClick={() => setSelectedMonthIndex((current) => Math.min(calendar.months.length - 1, current + 1))}
              disabled={!canGoNext}
              aria-label="Next month"
            >
              <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" focusable="false" />
            </button>
          </div>
        </div>

        <div className="student-new-calendar-month-strip" role="tablist" aria-label="Course months">
          {calendar.months.map((month, index) => (
            <button
              key={month.key}
              type="button"
              role="tab"
              aria-selected={index === selectedMonthIndex}
              className={`student-new-calendar-month-chip ${index === selectedMonthIndex ? 'is-active' : ''}`.trim()}
              onClick={() => setSelectedMonthIndex(index)}
            >
              {month.label}
            </button>
          ))}
        </div>

        <div className="student-new-calendar-legend" aria-label="Calendar legend">
          <span className="student-new-calendar-legend-item tone-course-day">Course Day</span>
          <span className="student-new-calendar-legend-item tone-no-class">No Class</span>
          <span className="student-new-calendar-legend-item tone-holiday">General Holiday</span>
          <span className="student-new-calendar-legend-item tone-present">Present</span>
          <span className="student-new-calendar-legend-item tone-absent">Absent</span>
          <span className="student-new-calendar-legend-item tone-start">Course Start Date</span>
          <span className="student-new-calendar-legend-item tone-end">Course End Date</span>
        </div>

        <div className="student-new-calendar-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="student-new-calendar-weekday">
              {label}
            </div>
          ))}

          {selectedMonth?.days?.map((day) => (
            <CalendarDayCell key={day.key} day={day} />
          )) || null}
        </div>

        <div className="student-new-calendar-footer">
          <div className="student-new-calendar-footer-stat">
            <strong>{calendar.summary.courseDays}</strong>
            <span>Course days</span>
          </div>
          <div className="student-new-calendar-footer-stat">
            <strong>{calendar.summary.noClassDays}</strong>
            <span>No class days</span>
          </div>
          <div className="student-new-calendar-footer-stat">
            <strong>{calendar.summary.presentDays}</strong>
            <span>Present</span>
          </div>
          <div className="student-new-calendar-footer-stat">
            <strong>{calendar.summary.absentDays}</strong>
            <span>Absent</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default StudentCalendarPanel
