import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download, LoaderCircle } from 'lucide-react'
import { Button } from './Button'
import { downloadBranchBatchAttendanceReport, downloadBranchStudentAttendanceReport } from '../services/reportService'

export function BranchAttendanceReportModal({ isOpen, mode = 'student', record = null, branchId = '', onClose }) {
  const courseOptions = useMemo(() => {
    if (mode !== 'student' || !record) return []
    const enrollments = Array.isArray(record.courseEnrollments) ? record.courseEnrollments : Array.isArray(record.courses) ? record.courses : []
    const normalized = enrollments.map((course) => ({
      courseId: String(course.courseId || course.course?.id || course.id || ''),
      courseName: String(course.courseName || course.course?.name || course.name || '').trim(),
    })).filter((course) => course.courseId && course.courseName)
    if (!normalized.length) {
      const courseId = String(record.courseId || record.course?.id || '')
      const courseName = String(record.courseName || record.course?.name || '').trim()
      if (courseId && courseName) normalized.push({ courseId, courseName })
    }
    return [...new Map(normalized.map((course) => [course.courseId, course])).values()]
  }, [mode, record])
  const [form, setForm] = useState({ fromDate: '', toDate: '' })
  const [selectedCourseId, setSelectedCourseId] = useState(() => courseOptions[0]?.courseId || '')
  const [errorMessage, setErrorMessage] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [isOpen])

  if (!isOpen) return null
  const isStudent = mode === 'student'
  const title = isStudent ? 'Download Student Attendance' : 'Download Batch Attendance'
  const label = isStudent
    ? `${record?.studentId || ''} - ${record?.studentName || 'Selected student'}`
    : `${record?.batchId || ''} - ${record?.batchName || 'Selected batch'}`
  const effectiveSelectedCourseId = courseOptions.some((course) => course.courseId === selectedCourseId) ? selectedCourseId : courseOptions[0]?.courseId || ''
  const selectedCourse = courseOptions.find((course) => course.courseId === effectiveSelectedCourseId)
  const validRange = Boolean(form.fromDate && form.toDate && form.toDate >= form.fromDate)
  const fileLabel = String(isStudent ? record?.studentName : record?.batchName || '').trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || (isStudent ? 'student' : 'batch')

  const submit = async (event) => {
    event.preventDefault()
    if (!validRange) {
      setErrorMessage(!form.fromDate || !form.toDate ? 'Please select both dates.' : 'To Date cannot be before From Date.')
      return
    }
    const id = String(isStudent ? (record?.id || record?.studentId) : (record?.batchId || record?.id) || '').trim()
    if (!id) { setErrorMessage(`Unable to identify the selected ${isStudent ? 'student' : 'batch'}.`); return }
    if (isStudent && courseOptions.length > 1 && !effectiveSelectedCourseId) { setErrorMessage('Please select a course.'); return }
    setIsDownloading(true)
    setErrorMessage('')
    try {
      const query = { [isStudent ? 'studentId' : 'batchId']: id, fromDate: form.fromDate, toDate: form.toDate }
      if (isStudent && courseOptions.length > 1) query.courseId = effectiveSelectedCourseId
      if (branchId) query.branchId = branchId
      const courseFileLabel = selectedCourse?.courseName.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      const fileName = `${fileLabel}${courseFileLabel ? `-${courseFileLabel}` : ''}-attendance-report-${form.fromDate}-${form.toDate}.xlsx`
      if (isStudent) await downloadBranchStudentAttendanceReport(query, fileName)
      else await downloadBranchBatchAttendanceReport(query, fileName)
    } catch (error) {
      setErrorMessage(error?.body?.message || error?.message || 'Unable to generate the attendance report.')
    } finally { setIsDownloading(false) }
  }

  return (
    <div className="course-modal-backdrop attendance-report-backdrop" role="presentation">
      <form className="course-modal panel-card attendance-report-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <button type="button" className="course-modal-close" onClick={onClose} aria-label="Close attendance report">X</button>
        <div className="course-modal-header attendance-report-header">
          <div><p className="section-kicker">Attendance Report</p><h3>{title}</h3></div>
          <div className="attendance-report-summary-chip"><CalendarDays size={16} /><span>{label}</span></div>
        </div>
        <div className="attendance-report-card">
          <div className="course-form-grid student-form-grid attendance-report-grid">
            {isStudent && courseOptions.length > 1 ? <label className="course-field student-field">
              <span>Select Course <b>*</b></span>
              <select value={effectiveSelectedCourseId} onChange={(event) => { setSelectedCourseId(event.target.value); setErrorMessage('') }} required>
                {courseOptions.map((course) => <option key={course.courseId} value={course.courseId}>{course.courseName}</option>)}
              </select>
            </label> : null}
            {['fromDate', 'toDate'].map((field) => (
              <label key={field} className="course-field student-field student-field-has-icon">
                <span>{field === 'fromDate' ? 'From Date' : 'To Date'} <b>*</b></span>
                <div className="student-field-control"><span className="student-field-icon"><CalendarDays size={18} /></span><input type="date" value={form[field]} min={field === 'toDate' ? form.fromDate || undefined : undefined} onChange={(event) => { setForm((current) => ({ ...current, [field]: event.target.value })); setErrorMessage('') }} /></div>
              </label>
            ))}
          </div>
          {errorMessage ? <div className="attendance-report-error" role="alert">{errorMessage}</div> : null}
        </div>
        <div className="course-form-actions attendance-report-actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!validRange || isDownloading || (isStudent && courseOptions.length > 1 && !selectedCourseId)}>{isDownloading ? <><LoaderCircle className="attendance-report-spinner" /> Generating...</> : <><Download /> Download Excel</>}</Button>
        </div>
      </form>
    </div>
  )
}
