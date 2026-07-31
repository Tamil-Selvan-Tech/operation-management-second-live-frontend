import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, LoaderCircle } from 'lucide-react'

import { Button } from './Button'
import { downloadBatchAttendanceReport } from '../services/reportService'

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

function resolveBatchId(batchId = '', students = []) {
  const normalizedBatchId = String(batchId || '').trim()
  if (normalizedBatchId) return normalizedBatchId

  const uniqueBatchIds = Array.from(
    new Set(
      (Array.isArray(students) ? students : [])
        .map((student) => String(student?.batchId || student?.batchEntryId || '').trim())
        .filter(Boolean),
    ),
  )

  return uniqueBatchIds.length === 1 ? uniqueBatchIds[0] : ''
}

export function StudentAttendanceReportModal({
  isOpen,
  mode = 'course',
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

  const isCourseMode = mode === 'course'
  const fixedCourseName = String(courseName || 'Course').trim()
  const fixedBatchName = String(batchName || '').trim()
  const scopeBatchLabel = isCourseMode ? 'All Batches' : fixedBatchName || 'Selected Batch'
  const resolvedBatchId = useMemo(() => resolveBatchId(batchId, students), [batchId, students])

  if (!isOpen) return null

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
    setTouched({ fromDate: true, toDate: true })

    if (!form.fromDate || !form.toDate || form.toDate < form.fromDate) {
      setErrorMessage(!form.fromDate || !form.toDate ? 'Please select a valid date range.' : 'To Date cannot be before From Date.')
      return
    }

    if (!resolvedBatchId) {
      setErrorMessage('Batch attendance report download requires a valid batch. Please open the report from a selected batch.')
      return
    }

    setErrorMessage('')
    setIsDownloading(true)

    try {
      await downloadBatchAttendanceReport({
        batchId: resolvedBatchId,
        batchName: fixedBatchName,
        courseId: String(courseId || '').trim(),
        fromDate: form.fromDate,
        toDate: form.toDate,
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
            <small>{isCourseMode ? 'Attendance export is available for saved batch records.' : `Batch: ${scopeBatchLabel}`}</small>
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
