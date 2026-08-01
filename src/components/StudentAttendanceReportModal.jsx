import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, Layers3, LoaderCircle } from 'lucide-react'

import { Button } from './Button'
import { downloadBatchAttendanceReport } from '../services/reportService'

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

function getBatchOptions(students = []) {
  const optionsById = new Map()

  for (const student of Array.isArray(students) ? students : []) {
    const value = String(student?.batchId || student?.batchEntryId || '').trim()
    if (!value) continue

    const batchName = String(student?.batchName || student?.batch || '').trim()
    const existing = optionsById.get(value)

    if (!existing) {
      optionsById.set(value, {
        value,
        label: batchName || value,
        batchName,
      })
      continue
    }

    if (!existing.batchName && batchName) {
      optionsById.set(value, {
        ...existing,
        label: batchName || value,
        batchName,
      })
    }
  }

  return Array.from(optionsById.values())
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
  const isCourseMode = mode === 'course'
  const [form, setForm] = useState({ fromDate: '', toDate: '' })
  const [selectedBatchId, setSelectedBatchId] = useState(() => (isCourseMode ? resolveBatchId(batchId, students) || 'all' : resolveBatchId(batchId, students)))
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

  const fixedCourseName = String(courseName || 'Course').trim()
  const fixedBatchName = String(batchName || '').trim()
  const batchOptions = useMemo(() => getBatchOptions(students), [students])
  const resolvedBatchId = useMemo(() => resolveBatchId(batchId, students), [batchId, students])
  const activeBatchId = String((isCourseMode ? selectedBatchId : resolvedBatchId) || '').trim()
  const activeBatchOption = batchOptions.find((batch) => String(batch.value || '').trim() === activeBatchId) || null
  const scopeBatchLabel = isCourseMode
    ? activeBatchId === 'all'
      ? 'All Batches'
      : activeBatchOption?.label || fixedBatchName || 'Selected Batch'
    : fixedBatchName || 'Selected Batch'

  if (!isOpen) return null

  const canDownload = Boolean(
    form.fromDate &&
      form.toDate &&
      form.toDate >= form.fromDate &&
      !isDownloading &&
      (!isCourseMode || activeBatchId),
  )
  const validationErrors = {
    fromDate: touched.fromDate && !form.fromDate ? 'From Date is required.' : '',
    toDate:
      touched.toDate && !form.toDate
        ? 'To Date is required.'
        : form.fromDate && form.toDate && form.toDate < form.fromDate
          ? 'To Date cannot be before From Date.'
          : '',
    batch:
      isCourseMode && touched.batch && !activeBatchId
        ? batchOptions.length
          ? 'Batch is required.'
          : 'No batches were found for this course.'
        : '',
  }

  const handleDownload = async () => {
    setTouched({
      fromDate: true,
      toDate: true,
      ...(isCourseMode ? { batch: true } : {}),
    })

    if (!form.fromDate || !form.toDate || form.toDate < form.fromDate) {
      setErrorMessage(!form.fromDate || !form.toDate ? 'Please select a valid date range.' : 'To Date cannot be before From Date.')
      return
    }

    const batchIdForDownload = isCourseMode ? (activeBatchId === 'all' ? '' : activeBatchId) : resolvedBatchId

    if (isCourseMode && !batchIdForDownload && activeBatchId !== 'all') {
      setErrorMessage(
        batchOptions.length
          ? 'Please select a batch before downloading the attendance report.'
          : 'Batch attendance report download requires a valid batch. Please open the report from a selected batch.',
      )
      return
    }

    setErrorMessage('')
    setIsDownloading(true)

    try {
      await downloadBatchAttendanceReport({
        batchId: batchIdForDownload,
        batchName: isCourseMode
          ? activeBatchId === 'all'
            ? 'All Batches'
            : activeBatchOption?.batchName || activeBatchOption?.label || ''
          : fixedBatchName,
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
          <div className="course-form-grid student-form-grid student-form-grid-tight attendance-report-grid">
            {isCourseMode ? (
              <label className="course-field student-field student-field-has-icon">
                <span>
                  Batch
                  <b>*</b>
                </span>
                <div className="student-field-control">
                  <span className="student-field-icon">
                    <Layers3 size={18} />
                  </span>
                  <select
                    value={activeBatchId}
                    onChange={(event) => {
                      setSelectedBatchId(event.target.value)
                      setTouched((current) => ({ ...current, batch: true }))
                      setErrorMessage('')
                    }}
                    disabled={!batchOptions.length}
                  >
                    <option value="all">{batchOptions.length ? 'All Batches' : 'No batches available'}</option>
                    {batchOptions.map((batch) => (
                      <option key={batch.value} value={batch.value}>
                        {batch.label}
                      </option>
                    ))}
                  </select>
                </div>
                {validationErrors.batch ? <small className="student-field-error">{validationErrors.batch}</small> : null}
              </label>
            ) : null}

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
