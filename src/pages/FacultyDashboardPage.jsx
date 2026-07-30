import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Check, GraduationCap, Layers3, Menu, UsersRound, X } from 'lucide-react'

import { NotificationBell } from '../components/NotificationBell'
import { roleDashboards } from '../data/authData'
import { loadFacultyRecords } from '../data/facultyRecords'
import { loadFacultySnapshot, saveFacultySnapshot } from '../lib/facultySnapshot'
import { loadStudentSnapshot, saveStudentSnapshot } from '../lib/studentSnapshot'
import { buildFacultyCoursePath, enrichStudentsWithFacultyReferences, getFacultyBatchEntriesForCourse, getFacultyBatchStudentRecords, getFacultyCourseIds, getFacultyCourses, getMatchingStudents, getUniqueStudentCountForFacultyRecords, getUniqueStudentCountForFacultyScope, sortByNameThenTiming } from '../lib/facultyFlow'
import { getFacultyMyBatchesSummary } from '../services/dashboardService'
import { getCurrentFacultyProfile } from '../services/facultyService'
import { listFacultyRecords, normalizeFacultyList } from '../services/facultyService'
import { listCourses } from '../services/courseService'
import { listStudents } from '../services/studentService'
import { useMobileMenu } from '../layouts/mobileMenuContext'
import { FacultyAttendanceFlow } from '../components/FacultyAttendanceFlow'

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

function formatDisplayDate(value) {
  if (!value) return '-'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function useCurrentFacultyProfile() {
  const [faculty, setFaculty] = useState(() => loadFacultySnapshot())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await getCurrentFacultyProfile()
        if (!active) return
        setFaculty((current) => {
          const nextFaculty = preferFacultyProfileSnapshot(current, result)
          saveFacultySnapshot(nextFaculty)
          return nextFaculty
        })
      } catch {
        if (!active) return
        setFaculty((current) => {
          saveFacultySnapshot(current)
          return current
        })
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
  const [students, setStudents] = useState(() => loadStudentSnapshot())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await listStudents({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
        if (!active) return
        const nextStudents = Array.isArray(result?.data) ? result.data : []
        saveStudentSnapshot(nextStudents)
        setStudents(nextStudents.length ? nextStudents : loadStudentSnapshot())
      } catch {
        if (!active) return
        setStudents(loadStudentSnapshot())
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

function useFacultyBatchesSummary() {
  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await getFacultyMyBatchesSummary()
        if (!active) return
        setSummary(result || null)
      } catch {
        if (!active) return
        setSummary(null)
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

  return { summary, isLoading }
}

function loadStoredFaculty() {
  return normalizeFacultyList(loadFacultyRecords())
}

function mergeFacultyRecords(primary = null, secondary = null) {
  if (!primary && !secondary) return null
  if (!primary) return secondary
  if (!secondary) return primary

  const mergedBatchEntries = Array.from(
    new Map(
      [...(Array.isArray(primary.batchEntries) ? primary.batchEntries : []), ...(Array.isArray(secondary.batchEntries) ? secondary.batchEntries : [])].map((entry) => [
        String(entry?.id || `${entry?.courseId || ''}-${entry?.batchName || ''}-${entry?.batchTiming || ''}`).trim().toLowerCase(),
        entry,
      ]),
    ).values(),
  )

  const mergedCourseIds = Array.from(
    new Set([...(Array.isArray(primary.courseIds) ? primary.courseIds : []), ...(Array.isArray(secondary.courseIds) ? secondary.courseIds : [])].map((courseId) => String(courseId || '').trim()).filter(Boolean)),
  )

  return {
    ...primary,
    ...secondary,
    batchEntries: mergedBatchEntries.length ? mergedBatchEntries : Array.isArray(secondary.batchEntries) ? secondary.batchEntries : Array.isArray(primary.batchEntries) ? primary.batchEntries : [],
    courseIds: mergedCourseIds.length ? mergedCourseIds : Array.isArray(secondary.courseIds) ? secondary.courseIds : Array.isArray(primary.courseIds) ? primary.courseIds : [],
    courseId: secondary.courseId || primary.courseId || '',
    courseName: secondary.courseName || primary.courseName || '',
    courseAssignments: Array.isArray(secondary.courseAssignments) && secondary.courseAssignments.length ? secondary.courseAssignments : primary.courseAssignments || [],
    batchCount: Number(secondary.batchCount || primary.batchCount || mergedBatchEntries.length || 0) || 0,
  }
}

function preferFacultyProfileSnapshot(current = null, next = null) {
  if (!current && !next) return null
  if (!current) return next
  if (!next) return current

  return {
    ...current,
    ...next,
    batchEntries: Array.isArray(next.batchEntries) && next.batchEntries.length ? next.batchEntries : Array.isArray(current.batchEntries) ? current.batchEntries : [],
    courseIds: Array.isArray(next.courseIds) && next.courseIds.length ? next.courseIds : Array.isArray(current.courseIds) ? current.courseIds : [],
    courseAssignments:
      Array.isArray(next.courseAssignments) && next.courseAssignments.length ? next.courseAssignments : Array.isArray(current.courseAssignments) ? current.courseAssignments : [],
    batchCount: Number(next.batchCount || current.batchCount || 0) || 0,
  }
}

function useFacultyRecords() {
  const [facultyRecords, setFacultyRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await listFacultyRecords({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
        if (!active) return
        setFacultyRecords(Array.isArray(result?.data) ? result.data : loadStoredFaculty())
      } catch {
        if (!active) return
        setFacultyRecords(loadStoredFaculty())
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [])

  return { facultyRecords, isLoading }
}

function useFacultyCourses() {
  const [courses, setCourses] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await listCourses({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
        if (!active) return
        setCourses(Array.isArray(result?.data) ? result.data : [])
      } catch {
        if (!active) return
        setCourses([])
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

  return { courses, isLoading }
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

function formatFacultyMonthYear(date) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function buildFacultyAttendanceSeed(value = '') {
  return Array.from(String(value || '')).reduce((sum, character) => sum + character.charCodeAt(0), 0)
}

function buildBatchProgressValue(seed = '', index = 0) {
  const value = buildFacultyAttendanceSeed(`${seed}-${index}`)
  return 52 + (value % 39)
}

function buildBatchTestScores(seed = '', index = 0) {
  const base = buildFacultyAttendanceSeed(`${seed}-${index}`)
  const first = 48 + (base % 17)
  const second = Math.min(98, first + 6 + (base % 8))
  const third = Math.min(99, second + 4 + (base % 6))
  return [first, second, third]
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
    const courseId = String(entry?.courseId || '').trim()
    const courseName = String(entry?.courseName || '').trim()
    const fallbackKey = `${label || 'batch'}-${timing || 'timing'}-${index}`

    return {
      id: String(entry?.id || fallbackKey).trim() || fallbackKey,
      label: label || `Batch ${index + 1}`,
      timing,
      courseId,
      courseName,
      sequenceNo: Number(entry?.sequenceNo || index + 1) || index + 1,
    }
  })
}

function getBatchProgressValue(studentCount = 0, totalStudents = 0) {
  if (!totalStudents) return 0
  return Math.max(10, Math.min(100, Math.round((studentCount / totalStudents) * 100)))
}

function FacultySummaryCard({ icon: Icon, label, value, note, tone = 'blue', badge }) {
  return (
    <article className={`student-summary-card faculty-summary-card tone-${tone}`.trim()}>
      <div className="student-summary-card-icon faculty-summary-card-icon" aria-hidden="true">
        <Icon size={26} strokeWidth={2.2} />
      </div>
      <div className="student-summary-card-copy faculty-summary-card-copy">
        <span className="student-summary-card-label faculty-summary-card-label">{label}</span>
        <strong className="student-summary-card-value faculty-summary-card-value">{value ?? '-'}</strong>
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

function FacultyBatchProgressCard({ batches = [] }) {
  const visibleBatches = batches.slice(0, 6)

  return (
    <section className="faculty-batch-progress-card panel-card">
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
    </section>
  )
}

function FacultyBatchPerformanceCard({ batches = [] }) {
  const visibleBatches = batches.slice(0, 6)
  const testLabels = ['Test 1', 'Test 2', 'Test 3']
  const legendTones = ['blue', 'green', 'violet']

  return (
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
  )
}

export function FacultyDashboardPage({ dashboard = roleDashboards.faculty }) {
  const openMenu = useMobileMenu()
  const { faculty: latestFaculty, isLoading } = useCurrentFacultyProfile()
  const { facultyRecords, isLoading: isFacultyRecordsLoading } = useFacultyRecords()
  const { students, isLoading: isStudentsLoading } = useFacultyStudents()
  const { summary: batchesSummary, isLoading: isBatchesSummaryLoading } = useFacultyBatchesSummary()
  const activeFaculty = latestFaculty || null

  useEffect(() => {
    if (!activeFaculty) return
    saveFacultySnapshot(activeFaculty)
  }, [activeFaculty])

  const backfilledStudents = useMemo(
    () => enrichStudentsWithFacultyReferences(students, facultyRecords),
    [facultyRecords, students],
  )

  useEffect(() => {
    if (backfilledStudents === students) return
    saveStudentSnapshot(backfilledStudents)
  }, [backfilledStudents, students])

  const profileName = activeFaculty?.facultyName || latestFaculty?.facultyName || 'Faculty'
  const profileInitials = getInitials(profileName)
  const facultyAttendanceId = activeFaculty?.id || latestFaculty?.id || ''
  const greetingName = getFacultyGreetingName(activeFaculty?.facultyName || latestFaculty?.facultyName)
  const greetingLabel = getFacultyGreetingLabel()
  const batchNames = useMemo(
    () =>
      Array.isArray(activeFaculty?.batchEntries)
        ? activeFaculty.batchEntries.map((entry) => String(entry?.batchName || '').trim()).filter(Boolean)
        : [],
    [activeFaculty],
  )
  const batchOptions = getFacultyBatchOptions(activeFaculty || {})
  const facultyCourseIds = getFacultyCourseIds(activeFaculty || {})
  const courseScopedStudentCount = useMemo(
    () =>
      getUniqueStudentCountForFacultyScope(backfilledStudents, {
        facultyName: activeFaculty?.facultyName || latestFaculty?.facultyName || '',
        facultyId: activeFaculty?.id || latestFaculty?.id || '',
        courseId: activeFaculty?.courseId || facultyCourseIds[0] || '',
        courseName: activeFaculty?.courseName || '',
        batchNames,
        batchIds: Array.isArray(activeFaculty?.batchEntries) ? activeFaculty.batchEntries.map((entry) => String(entry?.id || '').trim()).filter(Boolean) : [],
      }),
    [activeFaculty, latestFaculty, backfilledStudents, facultyCourseIds, batchNames],
  )
  const batchLinkedStudentCount = useMemo(
    () =>
      getUniqueStudentCountForFacultyRecords(backfilledStudents, {
        facultyName: activeFaculty?.facultyName || latestFaculty?.facultyName || '',
        facultyId: activeFaculty?.id || latestFaculty?.id || '',
        batchEntries: activeFaculty?.batchEntries || latestFaculty?.batchEntries || [],
      }),
    [activeFaculty, latestFaculty, backfilledStudents],
  )
  const matchingStudents = useMemo(
    () =>
      getMatchingStudents(backfilledStudents, {
        facultyName: activeFaculty?.facultyName || '',
        facultyId: activeFaculty?.id || latestFaculty?.id || '',
        courseId: activeFaculty?.courseId || facultyCourseIds[0] || '',
        courseName: activeFaculty?.courseName || '',
      }),
    [activeFaculty, latestFaculty, facultyCourseIds, backfilledStudents],
  )
  const activeStudentCount = matchingStudents.filter((student) =>
    ['active', 'present', 'ongoing'].includes(String(student?.status || student?.currentStatus || '').trim().toLowerCase()),
  ).length
  const totalStudents = Number(batchesSummary?.totalStudents || 0) || batchLinkedStudentCount || courseScopedStudentCount || matchingStudents.length
  const dashboardTotalBatchCount = Number(batchesSummary?.totalBatches || 0) || (Array.isArray(activeFaculty?.batchEntries)
    ? activeFaculty.batchEntries.length
    : Number(activeFaculty?.batchCount || 0) || 0)
  const attendanceValue = useMemo(() => {
    if (!batchLinkedStudentCount) return 92.5

    const baseValue = 85.5 + Math.min(4, facultyCourseIds.length * 1.1) + Math.min(3.5, batchNames.length * 0.7)
    const activityBoost = (activeStudentCount / Math.max(1, batchLinkedStudentCount)) * 3
    const studentBoost = Math.min(3, batchLinkedStudentCount / 25)
    const value = baseValue + activityBoost + studentBoost
    return Math.max(75, Math.min(99.5, Math.round(value * 10) / 10))
  }, [activeStudentCount, batchLinkedStudentCount, batchNames.length, facultyCourseIds.length])
  const summaryCards = [
    {
      icon: GraduationCap,
      label: 'Total Courses',
      value: facultyCourseIds.length || (activeFaculty?.courseName ? 1 : 0),
      note: 'Courses you are teaching',
      tone: 'blue',
      badge: `${facultyCourseIds.length || (activeFaculty?.courseName ? 1 : 0)}`,
    },
    {
      icon: UsersRound,
      label: 'Total Students',
      value: totalStudents,
      note: 'Students across all courses',
      tone: 'green',
      badge: `${totalStudents}`,
    },
    {
      icon: Layers3,
      label: 'Total Batches',
      value: dashboardTotalBatchCount,
      note: 'Batches running',
      tone: 'violet',
      badge: `${dashboardTotalBatchCount}`,
    },
    {
      icon: BookOpen,
      label: 'Attendance',
      value: `${attendanceValue.toFixed(1)}%`,
      note: 'Average Attendance',
      tone: 'violet',
      badge: isStudentsLoading || isFacultyRecordsLoading || isBatchesSummaryLoading ? '...' : 'Live',
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
          <div className="student-dashboard-header-actions">
            <FacultyAttendanceFlow profileName={profileName} profileInitials={profileInitials} facultyId={facultyAttendanceId} />
            <div className="student-dashboard-profile-chip" aria-label={profileName}>
              <span className="student-dashboard-profile-initials" aria-hidden="true">
                {profileInitials}
              </span>
              <span className="student-dashboard-profile-name">{profileName}</span>
              <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            </div>
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
          <div className="student-dashboard-header-actions">
            <FacultyAttendanceFlow profileName={profileName} profileInitials={profileInitials} facultyId={facultyAttendanceId} />
            <div className="student-dashboard-profile-chip" aria-label={profileName}>
              <span className="student-dashboard-profile-initials" aria-hidden="true">
                {profileInitials}
              </span>
              <span className="student-dashboard-profile-name">{profileName}</span>
              <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            </div>
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
        <button
          type="button"
          className="mobile-menu-button faculty-dashboard-mobile-menu-button"
          onClick={openMenu}
          aria-label="Open navigation menu"
        >
          <Menu />
        </button>
        <div className="student-dashboard-header-copy">
          <p className="student-dashboard-header-title">
            {greetingLabel}
            {greetingName ? `, ${greetingName}!` : '!'}
          </p>
          <p className="student-dashboard-header-subtitle">Welcome back to your faculty dashboard.</p>
        </div>

        <div className="student-dashboard-header-actions">
          <NotificationBell />
          <FacultyAttendanceFlow profileName={profileName} profileInitials={profileInitials} facultyId={facultyAttendanceId} />
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

      <div className="faculty-dashboard-analytics-grid">
        <FacultyAttendanceCard faculty={activeFaculty || latestFaculty} batches={batchOptions} />
        <FacultyBatchProgressCard batches={batchOptions} />
      </div>

      <FacultyBatchPerformanceCard batches={batchOptions} />

    </section>
  )
}

export function FacultyMyBatchesPage() {
  const openMenu = useMobileMenu()
  const navigate = useNavigate()
  const { faculty: latestFaculty, isLoading } = useCurrentFacultyProfile()
  const { facultyRecords, isLoading: isFacultyRecordsLoading } = useFacultyRecords()
  const { students, isLoading: isStudentsLoading } = useFacultyStudents()
  const { summary: batchesSummary, isLoading: isBatchesSummaryLoading } = useFacultyBatchesSummary()
  const { courses: courseOptions, isLoading: isCoursesLoading } = useFacultyCourses()
  const [selectedBatchContext, setSelectedBatchContext] = useState(null)

  const profileName = latestFaculty?.facultyName || 'Faculty'
  const profileInitials = getInitials(profileName)
  const greetingName = getFacultyGreetingName(latestFaculty?.facultyName)
  const greetingLabel = getFacultyGreetingLabel()
  const activeFaculty = latestFaculty || null
  const facultyAttendanceId = activeFaculty?.id || latestFaculty?.id || ''

  useEffect(() => {
    if (!activeFaculty) return
    saveFacultySnapshot(activeFaculty)
  }, [activeFaculty])

  const displayFaculty = activeFaculty || latestFaculty

  const facultyBackfillPool = useMemo(() => {
    const pool = []
    if (displayFaculty) pool.push(displayFaculty)
    if (Array.isArray(facultyRecords) && facultyRecords.length) pool.push(...facultyRecords)
    return pool
  }, [displayFaculty, facultyRecords])

  const backfilledStudents = useMemo(
    () => enrichStudentsWithFacultyReferences(students, facultyBackfillPool, courseOptions),
    [courseOptions, facultyBackfillPool, students],
  )

  useEffect(() => {
    if (backfilledStudents === students) return
    saveStudentSnapshot(backfilledStudents)
  }, [backfilledStudents, students])

  const facultyCourseIds = getFacultyCourseIds(displayFaculty || {}, courseOptions)
  const batchSummaryEntries = useMemo(
    () => (Array.isArray(batchesSummary?.batchCounts) ? batchesSummary.batchCounts : []),
    [batchesSummary],
  )

  const getBatchSummaryForRow = useCallback((batch = {}, batchIndex = -1) => {
    const rowBatchId = String(batch?.id || '').trim().toLowerCase()
    const rowBatchName = String(batch?.batchName || batch?.label || '').trim().toLowerCase()

    const normalizeStudentRecords = (entry = null) => ({
      studentCount: Number(entry?.studentCount || entry?.studentRecords?.length || 0) || 0,
      studentRecords: Array.isArray(entry?.studentRecords) ? entry.studentRecords : [],
    })

    if (rowBatchId) {
      const idMatch = batchSummaryEntries.find((entry) => String(entry?.batchId || '').trim().toLowerCase() === rowBatchId)
      if (idMatch) return normalizeStudentRecords(idMatch)
    }

    if (rowBatchName) {
      const nameMatch = batchSummaryEntries.find((entry) =>
        Array.isArray(entry?.studentRecords)
          ? entry.studentRecords.some((student) => String(student?.batchName || '').trim().toLowerCase() === rowBatchName)
          : false,
      )

      if (nameMatch) return normalizeStudentRecords(nameMatch)
    }

    const fallbackEntry = batchSummaryEntries[Number(batchIndex) || 0]
    if (fallbackEntry) return normalizeStudentRecords(fallbackEntry)

    return { studentCount: 0, studentRecords: [] }
  }, [batchSummaryEntries])

  const facultyCourseGroups = useMemo(() => {
    if (!displayFaculty) return []

    const courseRecords = getFacultyCourses(displayFaculty, courseOptions)
    const fallbackCourseName = String(displayFaculty?.courseName || '').trim()
    const fallbackCourseId = String(displayFaculty?.courseId || '').trim()
    const batchEntries = Array.isArray(displayFaculty?.batchEntries) ? displayFaculty.batchEntries : []

    const resolvedCourses =
      courseRecords.length > 0
        ? courseRecords
        : fallbackCourseName || fallbackCourseId
          ? [
              {
                courseId: fallbackCourseId,
                courseName: fallbackCourseName || fallbackCourseId || 'Course',
                batchCount: batchEntries.length,
              },
            ]
          : []

    return resolvedCourses.map((course, courseIndex) => {
      const batches = sortByNameThenTiming(getFacultyBatchEntriesForCourse(displayFaculty, course.courseId, courseOptions)).map((batch, batchIndex) => {
        const batchName = String(batch?.batchName || '').trim() || `Batch ${Number(batch?.sequenceNo || batchIndex + 1) || batchIndex + 1}`
        const batchTiming = String(batch?.batchTiming || '').trim()
        const batchSummary = getBatchSummaryForRow(batch, batchIndex)
        const localStudentRecords = getFacultyBatchStudentRecords(backfilledStudents, {
          facultyName: displayFaculty?.facultyName || latestFaculty?.facultyName || '',
          facultyId: displayFaculty?.id || latestFaculty?.id || '',
          courseId: course.courseId,
          courseName: course.courseName,
          batchName: batchName,
          batchId: batch?.id || '',
        })
        const studentRecords = Array.isArray(batchSummary.studentRecords) && batchSummary.studentRecords.length ? batchSummary.studentRecords : localStudentRecords
        const studentCount = Number(batchSummary.studentCount || studentRecords.length || localStudentRecords.length || 0) || 0
        const present = 0
        const absent = 0
        const progress = getBatchProgressValue(present, studentCount)

        return {
          ...batch,
          id: String(batch?.id || `${course.courseId || 'course'}-${batchName}-${batchIndex}`).trim(),
          label: batchName,
          timing: batchTiming,
          sequenceNo: Number(batch?.sequenceNo || batchIndex + 1) || batchIndex + 1,
          studentRecords,
          studentCount,
          present,
          absent,
          progress,
          progressLabel: progress >= 90 ? 'Completed' : `Week ${Math.max(1, Math.ceil(progress / 10))} / 12`,
        }
      })

      const groupProgress = batches.length
        ? Math.round(batches.reduce((sum, batch) => sum + batch.progress, 0) / batches.length)
        : 0

      return {
        ...course,
        courseIndex,
        batches,
        totalStudents: batches.reduce((sum, batch) => sum + Number(batch.studentCount || 0), 0),
        groupProgress,
      }
    })
  }, [backfilledStudents, courseOptions, displayFaculty, getBatchSummaryForRow, latestFaculty?.facultyName, latestFaculty?.id])

  const totalBatchCount = Number(batchesSummary?.totalBatches || 0) || facultyCourseGroups.reduce((sum, group) => sum + group.batches.length, 0)
  const totalStudents = Number(batchesSummary?.totalStudents || 0) || facultyCourseGroups.reduce((sum, group) => sum + Number(group.totalStudents || 0), 0)

  const averageProgress = totalBatchCount
    ? Math.round(
        facultyCourseGroups.reduce((sum, group) => sum + group.batches.reduce((batchSum, batch) => batchSum + batch.progress, 0), 0) /
          totalBatchCount,
      )
    : 0
  const summaryCards = [
    {
      icon: GraduationCap,
      label: 'Courses',
      value: facultyCourseGroups.length || facultyCourseIds.length || (activeFaculty?.courseName ? 1 : 0),
      note: 'You teach',
      tone: 'blue',
      badge: `${facultyCourseGroups.length || facultyCourseIds.length || (activeFaculty?.courseName ? 1 : 0)}`,
    },
    {
      icon: Layers3,
      label: 'Total Batches',
      value: totalBatchCount,
      note: 'Across all courses',
      tone: 'green',
      badge: `${totalBatchCount}`,
    },
    {
      icon: UsersRound,
      label: 'Total Students',
      value: totalStudents,
      note: 'Across all batches',
      tone: 'violet',
      badge: `${totalStudents}`,
    },
    {
      icon: BookOpen,
      label: 'Avg Course Progress',
      value: `${averageProgress}%`,
      note: 'Overall average',
      tone: 'orange',
      badge: isBatchesSummaryLoading || isCoursesLoading || isFacultyRecordsLoading || isStudentsLoading ? '...' : 'Live',
    },
  ]

  const selectedBatchStudents = useMemo(() => {
    if (!selectedBatchContext) return []

    return Array.isArray(selectedBatchContext.students)
      ? selectedBatchContext.students.map((student, index) => ({
          id: String(student?.id || `${selectedBatchContext.batchName || 'batch'}-${index}`).trim(),
          studentName: String(student?.studentName || '-').trim(),
          initials: getInitials(student?.studentName),
          emailAddress: String(student?.emailAddress || '-').trim(),
          mobileNumber: String(student?.mobileNumber || '-').trim(),
          course: String(student?.courseInterested || student?.courseName || selectedBatchContext.courseName || '-').trim(),
          facultyName: String(student?.facultyName || selectedBatchContext.facultyName || '-').trim(),
          batchName: String(student?.batchName || student?.batch || selectedBatchContext.batchName || '-').trim(),
          location: String(student?.location || '-').trim(),
          qualification: String(student?.qualification || '-').trim(),
          passedOutYear: String(student?.passedOutYear || '-').trim(),
          currentStatus: String(student?.currentStatus || '-').trim(),
          admissionDate: formatDisplayDate(student?.admissionDate),
          status: String(student?.status || 'Inactive').trim(),
        }))
      : []
  }, [selectedBatchContext])
  const selectedBatchStudentCount = selectedBatchStudents.length
  const selectedBatchVisibleCount = Math.min(selectedBatchStudentCount, 8)

  const openBatchStudents = (group, batch) => {
    if (!group || !batch) return

    setSelectedBatchContext({
      courseId: String(group.courseId || '').trim(),
      courseName: String(group.courseName || group.courseId || 'Course').trim(),
      facultyId: String(activeFaculty?.id || '').trim(),
      facultyName: String(activeFaculty?.facultyName || latestFaculty?.facultyName || '').trim(),
      batchId: String(batch.id || '').trim(),
      batchName: String(batch.label || '').trim(),
      batchTiming: String(batch.timing || '').trim(),
      students: Array.isArray(batch.studentRecords) ? batch.studentRecords : [],
    })
  }

  if (isLoading || isCoursesLoading || isBatchesSummaryLoading || isFacultyRecordsLoading || isStudentsLoading) {
    return (
      <section className="student-dashboard-page faculty-dashboard-page faculty-my-batches-page">
        <header className="student-dashboard-header faculty-dashboard-header">
          <div className="student-dashboard-header-copy">
            <p className="student-dashboard-header-title">
              {greetingLabel}
              {greetingName ? `, ${greetingName}!` : '!'}
            </p>
            <p className="student-dashboard-header-subtitle">Welcome back to your faculty dashboard.</p>
          </div>

          <div className="student-dashboard-header-actions">
            <NotificationBell />
            <FacultyAttendanceFlow profileName={profileName} profileInitials={profileInitials} facultyId={facultyAttendanceId} />
            <div className="student-dashboard-profile-chip" aria-label={profileName}>
              <span className="student-dashboard-profile-initials" aria-hidden="true">
                {profileInitials}
              </span>
              <span className="student-dashboard-profile-name">{profileName}</span>
              <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            </div>
          </div>
        </header>

        <section className="panel-card faculty-my-batches-loading-card">
          <strong>Loading batches...</strong>
          <p>Please wait while we fetch your faculty, course, and student data.</p>
        </section>
      </section>
    )
  }

  return (
    <section className="student-dashboard-page faculty-dashboard-page faculty-my-batches-page">
      <header className="student-dashboard-header faculty-dashboard-header">
        <button
          type="button"
          className="mobile-menu-button faculty-dashboard-mobile-menu-button"
          onClick={openMenu}
          aria-label="Open navigation menu"
        >
          <Menu />
        </button>
        <div className="student-dashboard-header-copy">
          <p className="student-dashboard-header-title">
            {greetingLabel}
            {greetingName ? `, ${greetingName}!` : '!'}
          </p>
          <p className="student-dashboard-header-subtitle">Welcome back to your faculty dashboard.</p>
        </div>

        <div className="student-dashboard-header-actions">
          <NotificationBell />
          <FacultyAttendanceFlow profileName={profileName} profileInitials={profileInitials} facultyId={facultyAttendanceId} />
          <div className="student-dashboard-profile-chip" aria-label={profileName}>
            <span className="student-dashboard-profile-initials" aria-hidden="true">
              {profileInitials}
            </span>
            <span className="student-dashboard-profile-name">{profileName}</span>
            <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
          </div>
        </div>
      </header>

      <div className="student-summary-strip faculty-summary-strip faculty-my-batches-summary-grid" aria-label="My batches summary cards">
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

      <div className="faculty-my-batches-groups">
        {facultyCourseGroups.length ? (
          facultyCourseGroups.map((group) => (
            <section key={group.courseId || group.courseName || group.courseIndex} className="panel-card faculty-batch-group-card">
              <div className="faculty-batch-group-head">
                <div className="faculty-batch-group-brand">
                  <span className="faculty-batch-group-avatar" aria-hidden="true">
                    {getInitials(group.courseName || group.courseId || 'Course')}
                  </span>
                  <div>
                    <div className="faculty-batch-group-title-row">
                      <strong>{group.courseName || group.courseId || 'Course'}</strong>
                      <span className="faculty-batch-group-pill">{group.batches.length} Batches</span>
                    </div>
                    <div className="faculty-batch-group-subcopy">
                      <span>Total Students: {group.totalStudents}</span>
                      <span>Course Progress: {group.groupProgress}%</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="faculty-course-details-button"
                  aria-label={`${group.courseName || 'Course'} details`}
                  onClick={() => {
                    if (!activeFaculty?.id || !group.courseId) return
                    navigate(buildFacultyCoursePath(activeFaculty.id, group.courseId))
                  }}
                >
                  <CalendarDays size={14} strokeWidth={2.1} aria-hidden="true" focusable="false" />
                  <span>Course Details</span>
                  <ChevronDown size={14} strokeWidth={2.3} aria-hidden="true" focusable="false" />
                </button>
              </div>

              <div className="faculty-batch-table" role="table" aria-label={`${group.courseName || 'Course'} batch details`}>
                <div className="faculty-batch-table-head" role="row">
                  <span>Batch Details</span>
                  <span>Students</span>
                  <span>Schedule</span>
                  <span>Progress</span>
                  <span>Today&apos;s Attendance</span>
                  <span>Actions</span>
                </div>

                {group.batches.map((batch) => (
                  <div key={batch.id} className="faculty-batch-table-row" role="row">
                    <div className="faculty-batch-table-cell faculty-batch-table-batch" role="cell">
                      <div>
                        <strong>{batch.label}</strong>
                        <span>{batch.progress >= 90 ? 'Completed' : 'Active'}</span>
                      </div>
                    </div>

                    <div className="faculty-batch-table-cell faculty-batch-table-students" role="cell">
                      <UsersRound size={14} strokeWidth={2.1} aria-hidden="true" focusable="false" />
                      <strong>{batch.studentCount}</strong>
                    </div>

                    <div className="faculty-batch-table-cell faculty-batch-table-schedule" role="cell">
                      <CalendarDays size={14} strokeWidth={2.1} aria-hidden="true" focusable="false" />
                      <div>
                        <strong>{batch.timing || '-'}</strong>
                        <span>Batch {batch.sequenceNo}</span>
                      </div>
                    </div>

                    <div className="faculty-batch-table-cell faculty-batch-table-progress" role="cell">
                      <strong>{batch.progress}%</strong>
                      <div className="faculty-batch-table-track" aria-hidden="true">
                        <div className="faculty-batch-table-fill" style={{ width: `${batch.progress}%` }} />
                      </div>
                    </div>

                    <div className="faculty-batch-table-cell faculty-batch-table-attendance" role="cell">
                      <span className="faculty-batch-table-present">
                        <UsersRound size={12} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                        {batch.present} Present
                      </span>
                      <span className="faculty-batch-table-absent">{batch.absent} Absent</span>
                    </div>

                    <div className="faculty-batch-table-cell faculty-batch-table-actions" role="cell">
                      <button type="button" aria-label={`${batch.label} student details`} onClick={() => openBatchStudents(group, batch)}>
                        <UsersRound size={14} strokeWidth={2.1} aria-hidden="true" focusable="false" />
                      </button>
                      <button type="button" aria-label={`${batch.label} schedule`}>
                        <CalendarDays size={14} strokeWidth={2.1} aria-hidden="true" focusable="false" />
                      </button>
                      <button type="button" aria-label={`${batch.label} progress`}>
                        <Check size={14} strokeWidth={2.3} aria-hidden="true" focusable="false" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <section className="panel-card faculty-my-batches-loading-card">
            <strong>No batches assigned yet</strong>
            <p>Add batches in Faculty Management to show them here.</p>
          </section>
        )}
      </div>

      {selectedBatchContext ? (
        <div
          className="course-modal-backdrop student-modal-backdrop batch-student-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedBatchContext(null)}
        >
          <div
            className="course-modal panel-card student-modal batch-student-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="course-modal-close batch-student-modal-close"
              onClick={() => setSelectedBatchContext(null)}
              aria-label="Close batch students"
            >
              <X size={16} />
            </button>

            <div className="batch-student-modal-header">
              <div className="batch-student-modal-header-main">
                <div className="batch-student-avatar" aria-hidden="true">
                  {getInitials(selectedBatchContext.courseName || 'Course')}
                </div>
                <div className="batch-student-modal-header-copy">
                  <p className="section-kicker">Batch Students</p>
                  <h3>{selectedBatchContext.courseName}</h3>
                  <p>
                    Faculty: {selectedBatchContext.facultyName || '-'} | Batch: {selectedBatchContext.batchName || '-'}
                    {selectedBatchContext.batchTiming ? ` (${selectedBatchContext.batchTiming})` : ''}
                  </p>
                </div>
              </div>
              <div className="batch-student-status active">
                <UsersRound size={16} />
                <span>{selectedBatchStudentCount} Students</span>
              </div>
            </div>

            {selectedBatchStudents.length ? (
              <div className="batch-student-table-shell">
                <div className="faculty-flow-table-wrap batch-student-table-wrap">
                  <table className="faculty-flow-table batch-student-table">
                    <thead>
                      <tr>
                        <th>Student Name</th>
                        <th>Email Address</th>
                        <th>Mobile Number</th>
                        <th>Location</th>
                        <th>Qualification</th>
                        <th>Passed Out Year</th>
                        <th>Current Status</th>
                        <th>Admission Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                  <tbody>
                      {selectedBatchStudents.map((student, index) => {
                        const studentStatus = String(student.status || 'Inactive').trim()
                        const studentStatusClass = studentStatus.toLowerCase().replace(/\s+/g, '-')

                        return (
                          <tr key={student.id || `${student.studentName}-${index}`}>
                            <td className="batch-student-table-name-cell">
                              <div className="batch-student-table-name">
                                <div className="batch-student-table-avatar" aria-hidden="true">
                                  {student.initials}
                                </div>
                                <div className="batch-student-table-name-copy">
                                  <strong>{student.studentName}</strong>
                                </div>
                              </div>
                            </td>
                            <td className="batch-student-table-email-cell">{student.emailAddress}</td>
                            <td>{student.mobileNumber}</td>
                            <td>{student.location}</td>
                            <td>{student.qualification}</td>
                            <td>{student.passedOutYear}</td>
                            <td>{student.currentStatus}</td>
                            <td>{student.admissionDate}</td>
                            <td>
                              <span className={`status-pill ${studentStatusClass}`.trim()}>{studentStatus}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="batch-student-table-footer" aria-label="Batch student pagination">
                  <div className="batch-student-table-summary">
                    <strong>Showing {selectedBatchVisibleCount} of {selectedBatchStudentCount}</strong>
                    <span>students in this batch</span>
                  </div>

                  <div className="batch-student-pagination" aria-hidden="true">
                    <button type="button" className="batch-student-pagination-link" disabled>
                      <ChevronLeft size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
                      <span>Previous</span>
                    </button>
                    <div className="batch-student-pagination-pages">
                      <button type="button" className="batch-student-pagination-page active" aria-current="page" disabled>
                        1
                      </button>
                      <button type="button" className="batch-student-pagination-page" disabled>
                        2
                      </button>
                      <button type="button" className="batch-student-pagination-page" disabled>
                        3
                      </button>
                      <span className="batch-student-pagination-dots">...</span>
                      <button type="button" className="batch-student-pagination-page" disabled>
                        8
                      </button>
                      <button type="button" className="batch-student-pagination-page" disabled>
                        9
                      </button>
                      <button type="button" className="batch-student-pagination-page" disabled>
                        10
                      </button>
                    </div>
                    <button type="button" className="batch-student-pagination-link" disabled>
                      <span>Next</span>
                      <ChevronRight size={15} strokeWidth={2.4} aria-hidden="true" focusable="false" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="faculty-flow-empty">
                <strong>No students found for this batch</strong>
                <p>Try another batch or check whether the student data is mapped correctly.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
