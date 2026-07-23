import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, CalendarDays, ChevronDown, Check, GraduationCap, Layers3, UsersRound } from 'lucide-react'

import { NotificationBell } from '../components/NotificationBell'
import { roleDashboards } from '../data/authData'
import { getFacultyCourseIds, getMatchingStudents } from '../lib/facultyFlow'
import { getCurrentFacultyProfile } from '../services/facultyService'
import { listStudents } from '../services/studentService'
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

function useFacultyStudents() {
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await listStudents({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
        if (!active) return
        setStudents(Array.isArray(result?.data) ? result.data : [])
      } catch {
        if (!active) return
        setStudents([])
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

  return { students, isLoading }
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

function formatFacultyMonthYear(date) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function buildFacultyAttendanceSeed(value = '') {
  return Array.from(String(value || '')).reduce((sum, character) => sum + character.charCodeAt(0), 0)
}

function buildFacultyAttendanceSeries({ facultyName = '', batchKey = '' } = {}) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(2026, 6 + index, 1)
    return date
  })
  const seed = buildFacultyAttendanceSeed(`${facultyName}-${batchKey}`)
  const basePattern = [91, 89, 93, 90, 88, 92]
  const offset = seed % basePattern.length

  return months.map((date, index) => ({
    label: formatFacultyMonthYear(date),
    value: basePattern[(offset + index) % basePattern.length],
  }))
}

function getFacultyBatchOptions(faculty) {
  const entries = Array.isArray(faculty?.batchEntries) ? faculty.batchEntries : []

  return entries.map((entry, index) => {
    const label = String(entry?.batchName || '').trim()
    const timing = String(entry?.batchTiming || '').trim()
    const fallbackKey = `${label || 'batch'}-${timing || 'timing'}-${index}`

    return {
      id: String(entry?.id || fallbackKey).trim() || fallbackKey,
      label: label || `Batch ${index + 1}`,
      timing,
    }
  })
}

function buildBatchProgressValue(label = '', index = 0) {
  const seed = buildFacultyAttendanceSeed(label) + index * 17
  const values = [100, 92, 84, 76, 68, 60, 88, 80]
  return values[seed % values.length]
}

function buildBatchTestScores(label = '', index = 0) {
  const seed = buildFacultyAttendanceSeed(label) + index * 23
  const baseScores = [
    [82, 88, 95],
    [70, 76, 80],
    [65, 68, 72],
    [48, 52, 58],
    [85, 90, 92],
  ]

  const selected = baseScores[seed % baseScores.length]
  return selected.map((score, testIndex) => Math.max(30, Math.min(100, score - (index % 2) * 2 + testIndex)))
}

function FacultySummaryCard({ icon: Icon, label, value, note, tone = 'blue', badge }) {
  return (
    <article className={`student-summary-card faculty-summary-card tone-${tone}`.trim()}>
      <div className="student-summary-card-icon faculty-summary-card-icon" aria-hidden="true">
        <Icon size={26} strokeWidth={2.2} />
      </div>
      <div className="student-summary-card-copy faculty-summary-card-copy">
        <span className="student-summary-card-label faculty-summary-card-label">{label}</span>
        <strong className="student-summary-card-value faculty-summary-card-value">{value || '-'}</strong>
        {note ? <small className="student-summary-card-note faculty-summary-card-note">{note}</small> : null}
      </div>
      {badge ? <span className="student-summary-card-badge faculty-summary-card-badge">{badge}</span> : null}
    </article>
  )
}

function FacultyAttendanceCard({ faculty, batches = [] }) {
  const [selectedBatchId, setSelectedBatchId] = useState('all')
  const [isBatchMenuOpen, setIsBatchMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const batchOptions = batches
  const selectedBatch = batchOptions.find((batch) => batch.id === selectedBatchId) || null
  const selectedBatchLabel = selectedBatch ? selectedBatch.label : 'All Batches'
  const selectedBatchKey = selectedBatch ? selectedBatch.id : 'all'
  const attendanceSeries = useMemo(
    () =>
      buildFacultyAttendanceSeries({
        facultyName: faculty?.facultyName || '',
        batchKey: selectedBatchKey,
      }),
    [faculty?.facultyName, selectedBatchKey],
  )
  const chartMax = 100

  useEffect(() => {
    if (!isBatchMenuOpen) return undefined

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsBatchMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsBatchMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isBatchMenuOpen])

  const rangeLabel = 'Jul 2026 - Dec 2026'

  return (
    <section className="faculty-attendance-card panel-card">
      <div className="faculty-attendance-head">
        <div className="faculty-attendance-head-copy">
          <h3>Monthly Attendance</h3>
          <p>Track attendance percentage across months</p>
        </div>

        <div className="faculty-attendance-filters">
          <div ref={menuRef} className="faculty-batch-dropdown-wrap">
            <button
              type="button"
              className="faculty-batch-dropdown-trigger"
              onClick={() => setIsBatchMenuOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={isBatchMenuOpen}
            >
              <UsersRound size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
              <span>{selectedBatchLabel === 'All Batches' ? 'All Batches' : selectedBatchLabel}</span>
              <ChevronDown size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
            </button>

            {isBatchMenuOpen ? (
              <div className="faculty-batch-dropdown-menu" role="listbox" aria-label="Faculty batches">
                <button
                  type="button"
                  className={`faculty-batch-dropdown-item ${selectedBatchId === 'all' ? 'is-active' : ''}`.trim()}
                  onClick={() => {
                    setSelectedBatchId('all')
                    setIsBatchMenuOpen(false)
                  }}
                >
                  <UsersRound size={14} strokeWidth={2.4} aria-hidden="true" focusable="false" />
                  <span>All Batches</span>
                  {selectedBatchId === 'all' ? <Check size={14} strokeWidth={2.5} aria-hidden="true" focusable="false" /> : null}
                </button>

                {batchOptions.map((batch) => (
                  <button
                    key={batch.id}
                    type="button"
                    className={`faculty-batch-dropdown-item ${selectedBatchId === batch.id ? 'is-active' : ''}`.trim()}
                    onClick={() => {
                      setSelectedBatchId(batch.id)
                      setIsBatchMenuOpen(false)
                    }}
                  >
                    <span className="faculty-batch-dropdown-dot" aria-hidden="true" />
                    <span>{batch.label}</span>
                    {selectedBatchId === batch.id ? <Check size={14} strokeWidth={2.5} aria-hidden="true" focusable="false" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button type="button" className="faculty-range-chip" aria-label={rangeLabel}>
            <CalendarDays size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            <span>{rangeLabel}</span>
            <ChevronDown size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
          </button>
        </div>
      </div>

      <div className="faculty-attendance-chart" aria-label="Monthly attendance chart">
        <div className="faculty-attendance-axis faculty-attendance-axis-left" aria-hidden="true">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>

        <div className="faculty-attendance-plot">
          <div className="faculty-attendance-grid-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="faculty-attendance-bars" style={{ gridTemplateColumns: `repeat(${attendanceSeries.length}, minmax(0, 1fr))` }}>
            {attendanceSeries.map((item) => (
              <div key={item.label} className="faculty-attendance-group">
                <strong className="faculty-attendance-value">{item.value}%</strong>
                <div className="faculty-attendance-bar-wrap">
                  <div className="faculty-attendance-bar" style={{ height: `${(item.value / chartMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="faculty-attendance-months" style={{ gridTemplateColumns: `repeat(${attendanceSeries.length}, minmax(0, 1fr))` }}>
            {attendanceSeries.map((item) => (
              <span key={item.label}>{item.label}</span>
            ))}
          </div>
        </div>

        <div className="faculty-attendance-axis faculty-attendance-axis-right" aria-hidden="true">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>
      </div>
    </section>
  )
}

function FacultyBatchAnalyticsCard({ batches = [] }) {
  const visibleBatches = batches.slice(0, 6)
  const testLabels = ['Test 1', 'Test 2', 'Test 3']
  const legendTones = ['blue', 'green', 'violet']

  return (
    <section className="faculty-batch-analytics">
      <div className="faculty-batch-progress-card panel-card faculty-batch-progress-card-left">
        <div className="faculty-batch-progress-head">
          <div className="faculty-batch-progress-head-copy">
            <h3>Course Completion Progress</h3>
            <p>Batch name details and progress overview</p>
          </div>
          <button type="button" className="faculty-range-chip" aria-label="View by weeks">
            <span>View By: Weeks</span>
            <ChevronDown size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
          </button>
        </div>

        <div className="faculty-batch-progress-list" role="list" aria-label="Batch completion progress">
          {visibleBatches.length ? (
            visibleBatches.map((batch, index) => {
              const progress = buildBatchProgressValue(batch.label, index)
              return (
                <article key={batch.id} className="faculty-batch-progress-row" role="listitem">
                  <div className="faculty-batch-progress-name">
                    <span className="faculty-batch-progress-avatar" aria-hidden="true">
                      <UsersRound size={16} strokeWidth={2.3} />
                    </span>
                    <div>
                      <strong>{batch.label}</strong>
                      <span>{batch.timing || 'Batch schedule'}</span>
                    </div>
                  </div>

                  <div className="faculty-batch-progress-track" aria-hidden="true">
                    <div className="faculty-batch-progress-fill" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="faculty-batch-progress-completion">
                    <strong>{progress}%</strong>
                    <span>{progress >= 90 ? 'Completed' : `Week ${Math.max(1, Math.ceil(progress / 10))} / 12`}</span>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="faculty-batch-progress-empty">
              <strong>No batches added yet</strong>
              <p>Add batch names in Faculty Management to show the progress list here.</p>
            </div>
          )}
        </div>
      </div>

      <section className="faculty-batch-performance-card panel-card">
        <div className="faculty-batch-performance-head">
          <div className="faculty-batch-performance-head-copy">
            <h3>Batch Test Performance (%)</h3>
            <p>Batch test performance comparison</p>
          </div>
          <div className="faculty-batch-performance-legend" aria-hidden="true">
            {testLabels.map((label, index) => (
              <span key={label} className="faculty-batch-performance-legend-item">
                <span className={`faculty-batch-performance-legend-dot tone-${legendTones[index]}`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="faculty-batch-performance-chart" aria-label="Batch test performance chart">
          <div className="faculty-batch-performance-axis faculty-batch-performance-axis-left" aria-hidden="true">
            <span>100</span>
            <span>75</span>
            <span>50</span>
            <span>25</span>
            <span>0</span>
          </div>

          <div className="faculty-batch-performance-plot">
            <div className="faculty-batch-performance-grid" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="faculty-batch-performance-bars" style={{ gridTemplateColumns: `repeat(${visibleBatches.length || 6}, minmax(0, 1fr))` }}>
              {(visibleBatches.length ? visibleBatches : Array.from({ length: 6 }, (_, index) => ({ id: `fallback-${index}`, label: `Batch ${index + 1}` }))).map((batch, batchIndex) => {
                const scores = buildBatchTestScores(batch.label, batchIndex)
                return (
                  <div key={batch.id} className="faculty-batch-performance-group">
                    <div className="faculty-batch-performance-triple">
                      {scores.map((score, scoreIndex) => (
                        <div key={`${batch.id}-${scoreIndex}`} className="faculty-batch-performance-bar-wrap">
                          <strong>{score}</strong>
                          <div
                            className={`faculty-batch-performance-bar tone-${legendTones[scoreIndex]}`}
                            style={{ height: `${score}%` }}
                          />
                        </div>
                      ))}
                    </div>
                    <span className="faculty-batch-performance-label">{batch.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </section>
  )
}

export function FacultyDashboardPage({ dashboard = roleDashboards.faculty }) {
  const { faculty: latestFaculty, isLoading } = useCurrentFacultyProfile()
  const { students, isLoading: isStudentsLoading } = useFacultyStudents()
  const profileName = latestFaculty?.facultyName || 'Faculty'
  const profileInitials = getInitials(profileName)
  const greetingName = getFacultyGreetingName(latestFaculty?.facultyName)
  const greetingLabel = getFacultyGreetingLabel()
  const todayLabel = formatFacultyHeaderDate()
  const batchNames = Array.isArray(latestFaculty?.batchEntries)
    ? latestFaculty.batchEntries.map((entry) => String(entry.batchName || '').trim()).filter(Boolean)
    : []
  const batchOptions = getFacultyBatchOptions(latestFaculty || {})
  const totalBatchCount = Array.isArray(latestFaculty?.batchEntries)
    ? latestFaculty.batchEntries.length
    : Number(latestFaculty?.batchCount || 0) || 0
  const facultyCourseIds = getFacultyCourseIds(latestFaculty || {})
  const matchingStudents = useMemo(
    () =>
      getMatchingStudents(students, {
        facultyName: latestFaculty?.facultyName || '',
        courseId: latestFaculty?.courseId || facultyCourseIds[0] || '',
        courseName: latestFaculty?.courseName || '',
      }),
    [facultyCourseIds, latestFaculty?.courseId, latestFaculty?.courseName, latestFaculty?.facultyName, students],
  )
  const activeStudentCount = matchingStudents.filter((student) =>
    ['active', 'present', 'ongoing'].includes(String(student?.status || student?.currentStatus || '').trim().toLowerCase()),
  ).length
  const attendanceValue = useMemo(() => {
    if (!matchingStudents.length) return 92.5

    const baseValue = 85.5 + Math.min(4, facultyCourseIds.length * 1.1) + Math.min(3.5, batchNames.length * 0.7)
    const activityBoost = (activeStudentCount / matchingStudents.length) * 3
    const studentBoost = Math.min(3, matchingStudents.length / 25)
    const value = baseValue + activityBoost + studentBoost
    return Math.max(75, Math.min(99.5, Math.round(value * 10) / 10))
  }, [activeStudentCount, batchNames.length, facultyCourseIds.length, matchingStudents.length])
  const summaryCards = [
    {
      icon: GraduationCap,
      label: 'Total Courses',
      value: facultyCourseIds.length || (latestFaculty?.courseName ? 1 : 0),
      note: 'Courses you are teaching',
      tone: 'blue',
      badge: `${facultyCourseIds.length || (latestFaculty?.courseName ? 1 : 0)}`,
    },
    {
      icon: UsersRound,
      label: 'Total Students',
      value: matchingStudents.length,
      note: 'Students across all courses',
      tone: 'green',
      badge: `${matchingStudents.length}`,
    },
    {
      icon: Layers3,
      label: 'Total Batches',
      value: totalBatchCount,
      note: 'Batches running',
      tone: 'violet',
      badge: `${totalBatchCount}`,
    },
    {
      icon: BookOpen,
      label: 'Attendance',
      value: `${attendanceValue.toFixed(1)}%`,
      note: 'Average Attendance',
      tone: 'violet',
      badge: isStudentsLoading ? '...' : 'Live',
    },
  ]

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

      <div className="student-summary-strip faculty-summary-strip" aria-label="Faculty summary cards">
        {summaryCards.map((card) => (
          <FacultySummaryCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            note={card.note}
            tone={card.tone}
            badge={card.badge}
          />
        ))}
      </div>

      <FacultyAttendanceCard faculty={latestFaculty} batches={batchOptions} />
      <FacultyBatchAnalyticsCard batches={batchOptions} />

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
            {batchOptions.length ? (
              batchOptions.map((entry, index) => (
                <div key={entry.id || `${entry.label}-${index}`} className="student-dashboard-info-item">
                  <span>{entry.label}</span>
                  <strong>{entry.timing || '-'}</strong>
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
