import { useEffect, useState } from 'react'
import { CalendarDays, Download, LoaderCircle } from 'lucide-react'

import { Button } from './Button'
import { downloadAllFacultyAttendanceReport, downloadFacultyAttendanceReport } from '../services/reportService'

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

  const facultyLabel = mode === 'single' ? String(faculty?.facultyName || '').trim() || 'Selected Faculty' : 'All Faculty'
  const facultyId = String(faculty?.id || faculty?.facultyId || '').trim()
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

    if (mode === 'single' && !facultyId) {
      setErrorMessage('Faculty attendance report download requires a valid faculty record.')
      return
    }

    setErrorMessage('')
    setIsDownloading(true)

    try {
      if (mode === 'single') {
        await downloadFacultyAttendanceReport({
          facultyId,
          fromDate: form.fromDate,
          toDate: form.toDate,
        })
      } else {
        await downloadAllFacultyAttendanceReport({
          fromDate: form.fromDate,
          toDate: form.toDate,
        })
      }
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
