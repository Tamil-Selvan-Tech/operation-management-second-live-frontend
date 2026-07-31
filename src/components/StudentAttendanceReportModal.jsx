import { useEffect, useState } from 'react'
import { CalendarDays, Download, LoaderCircle } from 'lucide-react'
import { Button } from './Button'
import { getCurrentFacultyAttendanceOverview } from '../services/attendanceService'

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeStatus(value = '') {
  const normalized = normalizeText(value)
  if (['present', 'p', 'login', 'loggedin', 'logged-in'].includes(normalized)) return 'Present'
  if (['absent', 'a', 'logout', 'loggedout', 'logged-out', 'unmarked'].includes(normalized)) return 'Absent'
  return ''
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

function formatFileDate(value) {
  if (!value) return ''

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sanitizeFilePart(value = '') {
  return String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim()
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

function getIdentityKeys(student = {}) {
  return Array.from(
    new Set(
      [student?.id, student?.studentId, student?.emailAddress, student?.mobileNumber, student?.studentCode, student?.studentName]
        .map((value) => normalizeText(value))
        .filter(Boolean),
    ),
  )
}

function matchesStudent(candidate = {}, student = {}) {
  const candidateKeys = getIdentityKeys(candidate)
  if (!candidateKeys.length) return false

  return getIdentityKeys(student).some((key) => candidateKeys.includes(key))
}

function collectBatchRecords(source, records = [], seen = new Set()) {
  if (!source) return records

  if (Array.isArray(source)) {
    source.forEach((item) => collectBatchRecords(item, records, seen))
    return records
  }

  if (typeof source !== 'object') return records

  ;['batches', 'batchs', 'items', 'results', 'records', 'data'].forEach((key) => {
    if (Array.isArray(source?.[key])) {
      source[key].forEach((item) => collectBatchRecords(item, records, seen))
    }
  })

  const hasNestedBatchList =
    Array.isArray(source.batches) ||
    Array.isArray(source.batchs) ||
    Array.isArray(source.items) ||
    Array.isArray(source.results) ||
    Array.isArray(source.data) ||
    Array.isArray(source.records)

  const looksLikeBatchRecord =
    Array.isArray(source.students) ||
    Array.isArray(source.studentRecords) ||
    (!hasNestedBatchList && (source.batchName || source.batchId || source.courseId || source.courseName || source.id))

  if (looksLikeBatchRecord) {
    const signature = [
      source.id,
      source.batchId,
      source.batchName,
      source.courseId,
      source.courseName,
      Array.isArray(source.students) ? source.students.length : 0,
      Array.isArray(source.studentRecords) ? source.studentRecords.length : 0,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .join('::')

    if (!seen.has(signature)) {
      seen.add(signature)
      records.push(source)
    }
  }

  return records
}

function getRelevantBatchRecords(overview, { courseId = '', courseName = '', batchId = '', batchName = '' } = {}) {
  const batches = collectBatchRecords(overview)
  const normalizedCourseId = normalizeText(courseId)
  const normalizedCourseName = normalizeText(courseName)
  const normalizedBatchId = normalizeText(batchId)
  const normalizedBatchName = normalizeText(batchName)

  return batches.filter((batch) => {
    const recordCourseId = normalizeText(batch?.courseId)
    const recordCourseName = normalizeText(batch?.courseName)
    const recordBatchId = normalizeText(batch?.batchId || batch?.id)
    const recordBatchName = normalizeText(batch?.batchName || batch?.label || batch?.batch)

    if (normalizedBatchId && recordBatchId && recordBatchId !== normalizedBatchId) return false
    if (normalizedBatchName && recordBatchName && recordBatchName !== normalizedBatchName) return false
    if (normalizedCourseId && recordCourseId && recordCourseId !== normalizedCourseId) return false
    if (normalizedCourseName && recordCourseName && recordCourseName !== normalizedCourseName) return false

    return Boolean(recordCourseId || recordCourseName || recordBatchId || recordBatchName)
  })
}

function getStudentAttendanceFromBatchRecord(batchRecord, student) {
  const arrays = []
  if (Array.isArray(batchRecord?.students)) arrays.push(...batchRecord.students)
  if (Array.isArray(batchRecord?.studentRecords)) arrays.push(...batchRecord.studentRecords)

  const matchedStudent = arrays.find((candidate) => matchesStudent(candidate, student)) || null
  if (matchedStudent) {
    const status = normalizeStatus(matchedStudent.attendanceStatus || matchedStudent.status || matchedStudent.attendance || matchedStudent.mark || matchedStudent.value)
    return status || 'Absent'
  }

  const records = batchRecord?.records && typeof batchRecord.records === 'object' ? batchRecord.records : null
  if (records) {
    const keys = getIdentityKeys(student)
    for (const key of keys) {
      const status = normalizeStatus(records[key] || records[String(key).trim()] || '')
      if (status) return status
    }
  }

  if (batchRecord?.attendanceStatus || batchRecord?.status) {
    return normalizeStatus(batchRecord.attendanceStatus || batchRecord.status) || 'Absent'
  }

  return 'Absent'
}

function getDateRowsForOverview({ overview, dateKey, students = [], scope = {}, courseName = '', batchName = '' }) {
  const batches = getRelevantBatchRecords(overview, scope)
  if (!batches.length) return []

  const rows = []

  batches.forEach((batchRecord) => {
    const recordCourseName = String(batchRecord?.courseName || courseName || '').trim()
    const recordBatchName = String(batchRecord?.batchName || batchRecord?.label || batchRecord?.batch || batchName || '').trim()
    const recordBatchId = String(batchRecord?.batchId || batchRecord?.id || '').trim()
    const batchStudents = Array.isArray(students)
      ? students.filter((student) => {
          const studentCourseId = normalizeText(student?.courseId)
          const studentCourseName = normalizeText(student?.courseInterested || student?.courseName || '')
          const studentBatchId = normalizeText(student?.batchId || student?.batchEntryId)
          const studentBatchName = normalizeText(student?.batchName || student?.batch || '')
          const studentBatchToken = studentBatchName.replace(/\s+/g, ' ')
          const batchCourseId = normalizeText(batchRecord?.courseId)
          const batchCourseName = normalizeText(batchRecord?.courseName || '')
          const batchRecordBatchId = normalizeText(recordBatchId)
          const batchRecordBatchName = normalizeText(recordBatchName)

          const courseMatches =
            !batchCourseId ||
            !studentCourseId ||
            studentCourseId === batchCourseId ||
            (batchCourseName && studentCourseName && studentCourseName === batchCourseName)

          const batchHasIdentity = Boolean(batchRecordBatchId || batchRecordBatchName)
          const batchMatches = !batchHasIdentity
            ? true
            : (batchRecordBatchId && studentBatchId && studentBatchId === batchRecordBatchId) ||
              (batchRecordBatchName && (studentBatchName === batchRecordBatchName || studentBatchToken === batchRecordBatchName))

          return courseMatches && batchMatches
        })
      : []

    batchStudents.forEach((student) => {
      rows.push([
        String(student?.studentName || '-').trim() || '-',
        recordCourseName || '-',
        recordBatchName || '-',
        formatDisplayDate(dateKey),
        getStudentAttendanceFromBatchRecord(batchRecord, student),
      ])
    })
  })

  return rows
}

function getReportFileName({ courseName = '', batchName = '', fromDate = '', toDate = '', isCourseMode = true }) {
  const coursePart = sanitizeFilePart(courseName || 'Course') || 'Course'
  const batchPart = isCourseMode ? 'All_Batches' : sanitizeFilePart(batchName || 'Batch') || 'Batch'
  return `${coursePart}_${batchPart}_Attendance_${formatFileDate(fromDate) || 'from-date'}_to_${formatFileDate(toDate) || 'to-date'}.xlsx`
}

function downloadStudentAttendanceReport({ courseName, batchName, fromDate, toDate, isCourseMode, rows = [] }) {
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
    <tr><td class="title" colspan="5">Student Attendance Report</td></tr>
    <tr><td class="meta" colspan="5"><strong>Course:</strong> ${escapeHtml(courseName || '-')} | <strong>Batch:</strong> ${escapeHtml(batchName || 'All Batches')}</td></tr>
    <tr><td colspan="5"><strong>From:</strong> ${escapeHtml(formatDisplayDate(fromDate))} | <strong>To:</strong> ${escapeHtml(formatDisplayDate(toDate))}</td></tr>
    <tr>
      <th>Student Name</th>
      <th>Course</th>
      <th>Batch</th>
      <th>Date</th>
      <th>Attendance</th>
    </tr>
    ${rows
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
  anchor.download = getReportFileName({ courseName, batchName, fromDate, toDate, isCourseMode })
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function StudentAttendanceReportModal({
  isOpen,
  mode = 'course',
  facultyId = '',
  courseId = '',
  courseName = '',
  batchId = '',
  batchName = '',
  students = [],
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

  const isCourseMode = mode === 'course'
  const fixedCourseName = String(courseName || courseId || 'Course').trim()
  const fixedBatchName = String(batchName || '').trim()
  const scopeBatchLabel = isCourseMode ? 'All Batches' : fixedBatchName || 'Selected Batch'
  const displayStudents = Array.isArray(students) ? students : []
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
      const settled = await Promise.all(
        dateKeys.map(async (dateKey) => ({
          dateKey,
          overview: await getCurrentFacultyAttendanceOverview(
            facultyId
              ? {
                  date: dateKey,
                  facultyId,
                }
              : { date: dateKey },
          ),
        })),
      )

      const scope = {
        courseId,
        courseName: fixedCourseName,
        batchId,
        batchName: isCourseMode ? '' : fixedBatchName,
      }

      const rows = settled.flatMap(({ overview, dateKey }) =>
        getDateRowsForOverview({
          overview,
          dateKey,
          students: displayStudents,
          scope,
          courseName: fixedCourseName,
          batchName: scopeBatchLabel,
        }),
      )

      downloadStudentAttendanceReport({
        courseName: fixedCourseName,
        batchName: scopeBatchLabel,
        fromDate: form.fromDate,
        toDate: form.toDate,
        isCourseMode,
        rows,
      })
    } catch (error) {
      setErrorMessage(error?.body?.message || error?.message || 'Unable to generate student attendance report right now.')
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
        aria-labelledby="student-attendance-report-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          if (canDownload) {
            void handleDownload()
          }
        }}
      >
        <button type="button" className="course-modal-close" onClick={onClose} aria-label="Close student attendance report modal">
          X
        </button>

        <div className="course-modal-header student-modal-header attendance-report-header">
          <div>
            <p className="section-kicker">Attendance Report</p>
            <h3 id="student-attendance-report-title">Generate Student Attendance Report</h3>
          </div>
          <div className="attendance-report-summary">
            <div className="attendance-report-summary-chip">
              <CalendarDays size={16} />
              <span>{fixedCourseName}</span>
            </div>
            <div className="attendance-report-summary-chip is-muted">
              <span>{scopeBatchLabel}</span>
            </div>
          </div>
        </div>

        <div className="attendance-report-card">
          <div className="attendance-report-student-card">
            <span>Report Scope</span>
            <strong>{fixedCourseName}</strong>
            <small>{isCourseMode ? 'All batches under this course will be included.' : `Batch: ${scopeBatchLabel}`}</small>
          </div>

          <div className="course-form-grid student-form-grid student-form-grid-tight attendance-report-grid">
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
                Generating Student Attendance Report...
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
