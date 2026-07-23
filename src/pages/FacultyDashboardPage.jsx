import { useEffect, useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'

import { NotificationBell } from '../components/NotificationBell'
import { roleDashboards } from '../data/authData'
import { getCurrentFacultyProfile } from '../services/facultyService'
import { StudentInfoItem, StudentSectionCard } from './studentDashboardUtils.jsx'

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getInitials(name) {
  const value = String(name || '').trim()
  if (!value) return 'ST'
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2)
}

function useCurrentFacultyProfile() {
  const [faculty, setFaculty] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await getCurrentFacultyProfile()
        if (!active) return
        setFaculty(result)
      } catch {
        if (!active) return
        setFaculty(null)
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [])

  return { faculty, isLoading }
}

function getFacultyGreetingName(facultyName) {
  const value = String(facultyName || '').trim()
  if (!value) return ''
  return value.split(/\s+/)[0] || ''
}

function getFacultyGreetingLabel() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function formatFacultyHeaderDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function FacultyDashboardPage({ dashboard = roleDashboards.faculty }) {
  const { faculty: latestFaculty, isLoading } = useCurrentFacultyProfile()
  const profileName = latestFaculty?.facultyName || 'Faculty'
  const profileInitials = getInitials(profileName)
  const greetingName = getFacultyGreetingName(latestFaculty?.facultyName)
  const greetingLabel = getFacultyGreetingLabel()
  const todayLabel = formatFacultyHeaderDate()

  if (isLoading) {
    return (
      <section className="student-dashboard-page">
        <header className="student-dashboard-header">
          <div className="student-dashboard-header-copy">
            <p className="student-dashboard-header-title">Loading Faculty Dashboard...</p>
            <p className="student-dashboard-header-subtitle">Please wait while we fetch your dashboard details.</p>
          </div>
        </header>
        <article className="panel-card student-dashboard-empty">
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
          <div className="student-empty-state">
            <strong>Loading faculty profile...</strong>
            <p>Please wait while we fetch your dashboard details.</p>
          </div>
        </article>
      </section>
    )
  }

  if (!latestFaculty) {
    return (
      <section className="student-dashboard-page">
        <header className="student-dashboard-header">
          <div className="student-dashboard-header-copy">
            <p className="student-dashboard-header-title">Faculty Dashboard</p>
            <p className="student-dashboard-header-subtitle">Welcome back to your faculty dashboard.</p>
          </div>
        </header>
        <article className="panel-card student-dashboard-empty">
          <h2>{dashboard.title}</h2>
          <p>{dashboard.summary}</p>
          <div className="student-empty-state">
            <strong>No faculty profile found</strong>
            <p>Please contact the operation manager to create or activate your faculty record.</p>
          </div>
        </article>
      </section>
    )
  }

  const batchNames = Array.isArray(latestFaculty.batchEntries)
    ? latestFaculty.batchEntries.map((entry) => String(entry.batchName || '').trim()).filter(Boolean)
    : []

  return (
    <section className="student-dashboard-page faculty-dashboard-page">
      <header className="student-dashboard-header faculty-dashboard-header">
        <div className="student-dashboard-header-copy">
          <p className="student-dashboard-header-title">
            {greetingLabel}
            {greetingName ? `, ${greetingName}! 👋` : '!'}
          </p>
          <p className="student-dashboard-header-subtitle">Welcome back to your faculty dashboard.</p>
        </div>

        <div className="student-dashboard-header-actions">
          <NotificationBell />
          <div className="student-dashboard-date-pill" aria-label={todayLabel}>
            <CalendarDays size={18} strokeWidth={2.15} aria-hidden="true" focusable="false" />
            <div>
              <strong>{todayLabel}</strong>
              <span>TODAY</span>
            </div>
          </div>
          <div className="student-dashboard-profile-chip" aria-label={profileName}>
            <span className="student-dashboard-profile-initials" aria-hidden="true">
              {profileInitials}
            </span>
            <span className="student-dashboard-profile-name">{profileName}</span>
            <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
          </div>
        </div>
      </header>

      <div className="student-dashboard-grid">
        <StudentSectionCard
          title="Faculty Information"
          subtitle="Primary faculty profile and contact details"
          kicker="Faculty Data"
        >
          <div className="student-dashboard-info-grid">
            <StudentInfoItem label="Faculty Name" value={latestFaculty.facultyName} />
            <StudentInfoItem label="Faculty Email" value={latestFaculty.facultyEmail} />
            <StudentInfoItem label="Faculty Phone" value={latestFaculty.facultyPhone} />
            <StudentInfoItem label="Course" value={latestFaculty.courseName || latestFaculty.course?.name || '-'} />
            <StudentInfoItem label="Status" value={latestFaculty.status} />
            <StudentInfoItem label="Created On" value={formatDate(latestFaculty.createdAt)} />
          </div>
        </StudentSectionCard>

        <StudentSectionCard title="Assigned Batches" subtitle="Batch schedule and timing details" kicker="Faculty Data">
          <div className="student-dashboard-info-grid">
            {batchNames.length ? (
              latestFaculty.batchEntries.map((entry) => (
                <div key={entry.id || `${entry.batchName}-${entry.batchTiming}`} className="student-dashboard-info-item">
                  <span>{entry.batchName || 'Batch'}</span>
                  <strong>{entry.batchTiming || '-'}</strong>
                </div>
              ))
            ) : (
              <div className="student-dashboard-info-item student-dashboard-info-item-full">
                <span>Batch assignments</span>
                <strong>No batches assigned yet</strong>
              </div>
            )}
          </div>
        </StudentSectionCard>
      </div>
    </section>
  )
}
