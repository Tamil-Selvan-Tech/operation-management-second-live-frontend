import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Edit3, FileSpreadsheet, LoaderCircle, Save, Table2, Trash2, Upload, X } from 'lucide-react'
import { downloadCompletedStudentFailedRows, downloadCompletedStudentTemplate, importCompletedStudents, previewCompletedStudentImport, revalidateCompletedStudentImport } from '../services/completedStudentImportService'
import '../styles/CompletedStudentUploadModal.css'

function errorMessage(error) { return error?.body?.message || error?.body?.error || error?.message || 'Something went wrong. Please try again.' }
const PAGE_SIZE = 10
const COLUMN_LABELS = {
  studentId: 'Student ID', studentName: 'Student Name', contactNumber: 'Contact Number', emailId: 'Email ID', parentGuardian: 'Parent / Guardian', parentSpouseNumber: 'Parent / Spouse Number', qualification: 'Qualification', educationLevel: 'Education Level', educationStatus: 'Education Status', passedOutYear: 'Passed Out Year', currentStatus: 'Current Status', designation: 'Designation', companyName: 'Company Name', purpose: 'Purpose', linkedInUrl: 'LinkedIn URL', course: 'Course', batchName: 'Batch Name', databaseSource: 'Database Source', branchAdminName: 'Branch Admin Name', courseStartingDate: 'Course Starting Date', courseEndingDate: 'Course Ending Date', scheduleMode: 'Weekday / Weekend / Online / Offline', batchTiming: 'Batch Timing', facultyName: 'Faculty Name', attendance: 'Attendance', courseFees: 'Course Fees', registrationFees: 'Registration Fees', totalFees: 'Total Fees', studentStatus: 'Student Status', remarks: 'Remarks', academicProject: 'Academic Project Percentage', placement: 'Placement', certificationStatus: 'Certification Status', certificateIssuedDate: 'Certificate Issued Date',
}
const COLUMN_ORDER = ['studentId', 'studentName', 'contactNumber', 'emailId', 'parentGuardian', 'parentSpouseNumber', 'qualification', 'educationLevel', 'educationStatus', 'passedOutYear', 'currentStatus', 'designation', 'companyName', 'purpose', 'linkedInUrl', 'course', 'batchName', 'databaseSource', 'branchAdminName', 'courseStartingDate', 'courseEndingDate', 'scheduleMode', 'batchTiming', 'facultyName', 'attendance', 'courseFees', 'registrationFees', 'totalFees', 'studentStatus', 'remarks', 'academicProject', 'placement', 'certificationStatus', 'certificateIssuedDate', 'assessment01', 'assessment02', 'assessment03']
function columnLabel(field) { const match = field.match(/^assessment(\d+)$/); if (match) return `Assessment-${String(Number(match[1])).padStart(2, '0')} Percentage`; const installment = field.match(/^installment(\d+)(.+)$/); if (installment) return `Installment ${installment[1]} - ${installment[2].replace(/([a-z])([A-Z])/g, '$1 $2')}`; return COLUMN_LABELS[field] || field }
function isDuplicateRow(row) { return row.errors?.some((error) => /duplicate/i.test(error)) }
function isWarningRow(row) { return row.warnings?.length > 0 || row.errors?.some((error) => /^warning/i.test(error)) }
function displayCellValue(value) { return value === null || value === undefined || value === '' ? '-' : String(value) }
function invalidFieldFromMessage(message = '') {
  const matchers = [
    [/Student ID/i, 'studentId'], [/Student Name/i, 'studentName'], [/Contact Number/i, 'contactNumber'], [/Email ID/i, 'emailId'], [/Parent \/ Guardian/i, 'parentGuardian'], [/Qualification/i, 'qualification'], [/Education Level/i, 'educationLevel'], [/Education Status/i, 'educationStatus'], [/Passed Out Year/i, 'passedOutYear'], [/Current Status/i, 'currentStatus'], [/Designation/i, 'designation'], [/Company Name/i, 'companyName'], [/Course Starting Date/i, 'courseStartingDate'], [/Course Ending Date/i, 'courseEndingDate'], [/Course/i, 'course'], [/Attendance/i, 'attendance'], [/Registration Fees/i, 'registrationFees'], [/Course Fees/i, 'courseFees'], [/Total Fees/i, 'totalFees'], [/Academic Project/i, 'academicProject'], [/Assessment-(\d+)/i, (_, number) => `assessment${String(Number(number)).padStart(2, '0')}`], [/Installment (\d+).*Paid Amount/i, (_, number) => `installment${number}paidamount`], [/Installment (\d+).*Pending Amount/i, (_, number) => `installment${number}pendingamount`], [/Installment (\d+).*Payment Date/i, (_, number) => `installment${number}paymentdate`], [/Installment (\d+).*Mode/i, (_, number) => `installment${number}modeofcollection`], [/Installment (\d+).*Receipt/i, (_, number) => `installment${number}receiptnumber`],
  ]
  const found = matchers.find(([pattern]) => pattern.test(message))
  if (!found) return ''
  const match = message.match(found[0])
  return typeof found[1] === 'function' ? found[1](...match) : found[1]
}
function firstInvalidField(row) { return (row.errors || []).map(invalidFieldFromMessage).find(Boolean) || 'studentId' }
function isMissingContactError(error = '') { return /^(Contact Number|Email ID) is missing\./i.test(error) }
function hasOnlyMissingContactErrors(row) { return Boolean(row.errors?.length) && row.errors.every(isMissingContactError) }
function markEditingInvalidFields(row) {
  if (typeof document === 'undefined') return
  const fields = [...new Set([
    ...(row.errors || []).map(invalidFieldFromMessage).filter(Boolean),
    ...(row.errors || []).some((error) => /Student Status/i.test(error)) ? ['studentStatus'] : [],
  ])]
  document.body.dataset.completedUploadInvalidFields = fields.join(' ')
  window.requestAnimationFrame(() => {
    document.querySelectorAll('.completed-upload-inline-input.is-invalid-field').forEach((input) => input.classList.remove('is-invalid-field'))
    fields.forEach((field) => document.querySelector(`[data-edit-field="${field}"]`)?.classList.add('is-invalid-field'))
  })
}
function normalizeCompletedStudentImportPreview(preview) {
  if (!preview?.rows) return preview
  const rows = preview.rows.map((row) => {
    const data = { ...row.data }
    ;['attendance', 'academicProject', 'assessment01', 'assessment02', 'assessment03'].forEach((field) => {
      if (typeof data[field] === 'string' && /^\s*\d+(?:\.\d+)?\s*%\s*$/.test(data[field])) data[field] = data[field].replace('%', '').trim()
    })
    const rawStatus = String(data.studentStatus || '').trim().replace(/\s+/g, ' ').toLowerCase()
    const acceptedStatus = ['completed', 'completed student', 'completed students', 'discontinued', 'discontinued student', 'discontinued students'].includes(rawStatus)
    if (!acceptedStatus) return { ...row, data }
    const canonicalStatus = rawStatus.startsWith('discontinued') ? 'Discontinued Student' : 'Completed Student'
    const errors = (row.errors || []).filter((error) => !/^Student Status must be Completed Student(?: or Discontinued Student)?\.?$/i.test(String(error).trim()))
    return { ...row, data: { ...data, studentStatus: canonicalStatus }, errors, valid: errors.length === 0 }
  })
  return { ...preview, rows, totalRows: preview.totalRows ?? rows.length, validRows: rows.filter((row) => row.valid).length, invalidRows: rows.filter((row) => !row.valid).length, warningRows: rows.filter((row) => row.warnings?.length).length }
}

export function CompletedStudentUploadModal({ isOpen, onClose, onImported }) {
  const inputRef = useRef(null)
  const invalidInputRef = useRef(null)
  const previewTableRef = useRef(null)
  const previewTableWrapRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [editingRow, setEditingRow] = useState(null)
  const [tableFilter, setTableFilter] = useState('all')
  const [studentSearch, setStudentSearch] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const [showPreview, setShowPreview] = useState(false)
  const [contactReview, setContactReview] = useState(null)
  const [importConfirmation, setImportConfirmation] = useState(null)
  const [importProgress, setImportProgress] = useState(0)

  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [busy, isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    setFile(null)
    setPreview(null)
    setBusy(false)
    setDragging(false)
    setError('')
    setResult(null)
    setEditingRow(null)
    setTableFilter('all')
    setStudentSearch('')
    setTablePage(1)
    setShowPreview(false)
    setContactReview(null)
    setImportConfirmation(null)
    setImportProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }, [isOpen])

  useEffect(() => {
    if (!showPreview || !previewTableRef.current) return undefined
    const shell = previewTableRef.current
    const wrap = previewTableWrapRef.current || shell.querySelector('.completed-upload-table-wrap')
    if (!wrap) return undefined
    let scrollFrame = 0
    const syncFixedColumns = () => {
      const hiddenWidth = Math.max(0, wrap.scrollWidth - wrap.clientWidth)
      shell.style.setProperty('--completed-upload-sticky-shift', `${-hiddenWidth}px`)
      shell.style.setProperty('--completed-upload-scroll-left', `${wrap.scrollLeft}px`)
      shell.style.setProperty('--completed-upload-scroll-top', `${wrap.scrollTop}px`)
    }
    const handleScroll = () => {
      if (scrollFrame) return
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0
        shell.style.setProperty('--completed-upload-scroll-left', `${wrap.scrollLeft}px`)
        shell.style.setProperty('--completed-upload-scroll-top', `${wrap.scrollTop}px`)
      })
    }
    const frame = window.requestAnimationFrame(syncFixedColumns)
    wrap.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', syncFixedColumns)
    return () => {
      window.cancelAnimationFrame(frame)
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
      wrap.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', syncFixedColumns)
    }
  }, [showPreview, tableFilter, tablePage, preview?.rows?.length])

  useEffect(() => {
    if (!editingRow?.focusField) return undefined
    const frame = window.requestAnimationFrame(() => {
      invalidInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      invalidInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editingRow?.rowNumber, editingRow?.focusField])

  if (!isOpen) return null

  const selectFile = async (nextFile) => {
    setError(''); setResult(null); setPreview(null); setEditingRow(null); setTableFilter('all'); setStudentSearch(''); setTablePage(1); setShowPreview(false); setContactReview(null); setImportConfirmation(null); setImportProgress(0)
    if (!nextFile) return
    if (!/\.xlsx$/i.test(nextFile.name)) { setError('Only .xlsx files are supported.'); return }
    if (nextFile.size > 8 * 1024 * 1024) { setError('File size must be 8 MB or less.'); return }
    setFile(nextFile); setBusy(true)
    try { const response = await previewCompletedStudentImport(nextFile); setPreview(normalizeCompletedStudentImportPreview(response?.data || response)) } catch (requestError) { setError(errorMessage(requestError)) } finally { setBusy(false) }
  }

  const importRows = async () => {
    if (!preview?.rows?.length) return
    const softInvalidRows = preview.rows.filter(hasOnlyMissingContactErrors)
    const hardInvalidRows = preview.rows.filter((row) => !row.valid && !hasOnlyMissingContactErrors(row))
    const validRows = preview.rows.filter((row) => row.valid)
    const importableRows = [...validRows, ...softInvalidRows]
    if (!importableRows.length) return
    setImportConfirmation({
      rows: importableRows,
      missingContactRows: softInvalidRows.map((row) => ({ row, selected: true })),
      skippedRows: hardInvalidRows.length,
    })
  }

  const confirmImport = async () => {
    if (!importConfirmation) return
    const selectedMissing = importConfirmation.missingContactRows.filter((item) => item.selected).map((item) => item.row.rowNumber)
    const selectedRows = importConfirmation.rows.filter((row) => row.valid || selectedMissing.includes(row.rowNumber))
    if (!selectedRows.length) return
    setError(''); setBusy(true); setImportProgress(12)
    const progressTimer = window.setInterval(() => setImportProgress((value) => Math.min(value + 8, 86)), 350)
    try {
      const response = await importCompletedStudents(selectedRows, { allowMissingContact: selectedMissing.length > 0 })
      setImportProgress(100)
      const importedResult = response?.data || response
      if (!Number(importedResult?.importedRows)) {
        setImportProgress(0)
        setError(importedResult?.message || 'No records were imported. Review the validation errors and try again.')
        return
      }
      setResult(importedResult)
      if (importedResult?.importedRows) {
        await new Promise((resolve) => window.setTimeout(resolve, 900))
        await onImported?.()
      }
    } catch (requestError) { setError(errorMessage(requestError)); setImportProgress(0) } finally { window.clearInterval(progressTimer); setBusy(false) }
  }

  const toggleImportConfirmationRow = (rowNumber) => setImportConfirmation((current) => current ? ({ ...current, missingContactRows: current.missingContactRows.map((item) => item.row.rowNumber === rowNumber ? { ...item, selected: !item.selected } : item) }) : current)

  const removePreviewRow = (rowNumber) => {
    setPreview((current) => {
      if (!current) return current
      const rows = current.rows.filter((row) => row.rowNumber !== rowNumber)
      return { ...current, rows, totalRows: rows.length, validRows: rows.filter((row) => row.valid).length, invalidRows: rows.filter((row) => !row.valid).length, warningRows: rows.filter((row) => row.warnings?.length).length }
    })
    setEditingRow((current) => current?.rowNumber === rowNumber ? null : current)
  }

  const confirmContactImport = async () => {
    const selectedRowNumbers = new Set((contactReview || []).filter((item) => item.selected).map((item) => item.row.rowNumber))
    const selectedRows = (preview?.rows || []).filter((row) => row.valid || selectedRowNumbers.has(row.rowNumber))
    if (!selectedRows.length) return
    setContactReview(null)
    setError(''); setBusy(true); setImportProgress(12)
    const progressTimer = window.setInterval(() => setImportProgress((value) => Math.min(value + 8, 86)), 350)
    try {
      const response = await importCompletedStudents(selectedRows, { allowMissingContact: true })
      const importedResult = response?.data || response
      setImportProgress(100)
      if (!Number(importedResult?.importedRows)) {
        setImportProgress(0)
        setError(importedResult?.message || 'No records were imported. Review the validation errors and try again.')
        return
      }
      setResult(importedResult)
      if (importedResult?.importedRows) {
        await new Promise((resolve) => window.setTimeout(resolve, 900))
        await onImported?.()
      }
    } catch (requestError) { setError(errorMessage(requestError)); setImportProgress(0) } finally { window.clearInterval(progressTimer); setBusy(false) }
  }

  const toggleContactReviewRow = (rowNumber) => setContactReview((current) => current.map((item) => item.row.rowNumber === rowNumber ? { ...item, selected: !item.selected } : item))

  const updateEditedRow = (field, value) => {
    const nextValue = field === 'contactNumber' ? String(value).replace(/\D/g, '').slice(0, 10) : value
    setEditingRow((current) => ({ ...current, data: { ...current.data, [field]: nextValue } }))
  }
  const beginEditing = (row) => {
    setShowPreview(true)
    markEditingInvalidFields(row)
    setEditingRow({ ...row, focusField: firstInvalidField(row), data: { ...row.data } })
  }
  const saveEditedRow = async () => {
    if (!editingRow || !preview) return
    setError(''); setBusy(true)
    try {
      const nextRows = preview.rows.map((row) => row.rowNumber === editingRow.rowNumber ? editingRow : row)
      const response = await revalidateCompletedStudentImport(nextRows)
      setPreview(normalizeCompletedStudentImportPreview(response?.data || response)); setEditingRow(null); setTablePage(1); setShowPreview(true)
    } catch (requestError) { setError(errorMessage(requestError)) } finally { setBusy(false) }
  }

  const normalizedStudentSearch = studentSearch.trim().toLowerCase()
  const filteredRows = (preview?.rows || []).filter((row) => {
    const matchesStatus = tableFilter === 'valid' ? row.valid : tableFilter === 'invalid' ? !row.valid && !isDuplicateRow(row) : tableFilter === 'duplicate' ? isDuplicateRow(row) : tableFilter === 'warning' ? isWarningRow(row) : true
    const matchesStudent = !normalizedStudentSearch || [row.data?.studentName, row.data?.studentId].some((value) => String(value ?? '').toLowerCase().includes(normalizedStudentSearch))
    return matchesStatus && matchesStudent
  })
  const tableColumns = [...COLUMN_ORDER, ...[...new Set((preview?.rows || []).flatMap((row) => Object.keys(row.data || {})))].filter((field) => !COLUMN_ORDER.includes(field))]
  const totalTablePages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const visibleRows = filteredRows.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE)
  const duplicateRows = (preview?.rows || []).filter(isDuplicateRow)
  const needsFixingRows = (preview?.rows || []).filter((row) => !row.valid && !isDuplicateRow(row))
  const setFilter = (nextFilter) => { setTableFilter(nextFilter); setTablePage(1) }

  const reset = () => { if (busy) return; setFile(null); setPreview(null); setResult(null); setError(''); setEditingRow(null); setTableFilter('all'); setStudentSearch(''); setTablePage(1); setShowPreview(false); setContactReview(null); setImportConfirmation(null); setImportProgress(0); if (inputRef.current) inputRef.current.value = '' }
  return <div className="completed-upload-page-shell">
    <section className="completed-upload-page" role="main" aria-labelledby="completed-upload-title">
      <header className="completed-upload-header"><div className="completed-upload-title"><span className="completed-upload-icon"><FileSpreadsheet size={20} /></span><div><p>COMPLETED STUDENTS</p><h2 id="completed-upload-title">Upload Student Report</h2><span>Upload, validate and safely add completed course records.</span></div></div><button type="button" className="completed-upload-close" onClick={onClose} disabled={busy} aria-label="Back to completed students"><ArrowLeft size={19} /></button></header>
      <div className="completed-upload-body">
        <div className="completed-upload-actions"><button type="button" className="completed-upload-template" onClick={() => void downloadCompletedStudentTemplate()} disabled={busy}><Download size={16} /> Download Template</button><span className="completed-upload-limit"><strong>Upload limit</strong><span>Maximum <b>100 rows</b> per Excel file</span><i>.xlsx format</i></span></div>
        {!result ? <>
          <div className={`completed-upload-dropzone${dragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void selectFile(event.dataTransfer.files?.[0]) }} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') inputRef.current?.click() }}>
            <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={(event) => void selectFile(event.target.files?.[0])} />
            {busy ? <LoaderCircle className="completed-upload-spinner" size={28} /> : <Upload size={27} />}
            <strong>{file ? file.name : 'Drop your completed student Excel file here'}</strong><span>{file ? 'Click to choose a different file' : 'or click to browse .xlsx files'}</span>
          </div>
          {preview ? <div className="completed-upload-summary"><div><strong>{preview.totalRows}</strong><span>Total rows</span></div><div className="is-valid"><strong>{preview.validRows}</strong><span>Valid</span></div><div className="is-invalid"><strong>{needsFixingRows.length}</strong><span>Needs fixing</span></div>{duplicateRows.length ? <div className="is-duplicate"><strong>{duplicateRows.length}</strong><span>Duplicate</span></div> : null}{preview.warningRows ? <div className="is-warning"><strong>{preview.warningRows}</strong><span>Warnings</span></div> : null}{preview.invalidRows > 0 ? <button type="button" className="completed-upload-error-download" onClick={() => void downloadCompletedStudentFailedRows(preview.rows)} disabled={busy}><Download size={15} /> Download Errors</button> : null}</div> : null}
          {busy && importProgress > 0 && !result ? <div className="completed-upload-progress completed-upload-page-progress"><div><span>Uploading records...</span><strong>{importProgress}%</strong></div><div className="completed-upload-progress-track"><span style={{ width: `${importProgress}%` }} /></div></div> : null}
          {preview?.rows?.length && !showPreview ? <button type="button" className="completed-upload-preview-card" onClick={() => setShowPreview(true)}><span className="completed-upload-preview-icon"><Table2 size={20} /></span><span><strong>Preview validated data</strong><small>Open the full table to review every uploaded field, duplicate, invalid row and inline edit option.</small></span><span className="completed-upload-preview-arrow">Open preview</span></button> : null}
          {preview?.rows?.length && showPreview ? <><div className="completed-upload-preview-heading"><div><p>VALIDATION PREVIEW</p><h3>Uploaded student data</h3><span>Review all fields below. Use filters and inline edit before importing.</span></div><button type="button" className="completed-upload-preview-back" onClick={() => setShowPreview(false)}><ArrowLeft size={15} /> Back to summary</button></div><label className="completed-upload-filter-bar" aria-label="Filter validation rows"><span className="completed-upload-filter-label">Filter rows</span><input className="completed-upload-student-search" type="search" value={studentSearch} onChange={(event) => { setStudentSearch(event.target.value); setTablePage(1) }} placeholder="Search student name or ID" aria-label="Search student name or ID" /><select value={tableFilter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter validation rows"><option value="all">All ({preview.totalRows})</option><option value="valid">Valid ({preview.validRows})</option><option value="invalid">Invalid ({preview.invalidRows - preview.rows.filter(isDuplicateRow).length})</option><option value="duplicate">Duplicate ({preview.rows.filter(isDuplicateRow).length})</option><option value="warning">Warning ({preview.warningRows ?? preview.rows.filter(isWarningRow).length})</option></select></label><div className={`completed-upload-table-shell${visibleRows.length <= 4 ? ' is-compact' : ''}`} ref={previewTableRef}><div className="completed-upload-table-wrap" ref={previewTableWrapRef}><table className="completed-upload-full-table"><thead><tr><th className="completed-upload-sticky-column">S.No</th>{tableColumns.map((field) => <th key={field}>{columnLabel(field)}</th>)}<th>Status</th><th>Validation</th><th className="completed-upload-action-column">Action</th></tr></thead><tbody>{visibleRows.map((row, visibleIndex) => { const isEditing = editingRow?.rowNumber === row.rowNumber; const warning = isWarningRow(row); const serialNumber = ((tablePage - 1) * PAGE_SIZE) + visibleIndex + 1; return <tr key={row.rowNumber}>
  <td className="completed-upload-sticky-column">{serialNumber}</td>
  {tableColumns.map((field) => <td key={`${row.rowNumber}-${field}`}>{isEditing ? <input ref={field === editingRow.focusField ? invalidInputRef : undefined} autoFocus={field === editingRow.focusField} data-edit-field={field} className={`completed-upload-inline-input${field === editingRow.focusField ? ' is-focused-error' : ''}`} value={editingRow.data?.[field] ?? ''} onChange={(event) => updateEditedRow(field, event.target.value)} /> : displayCellValue(row.data?.[field])}</td>)}
  <td className="completed-upload-background-status-cell"><span className={`completed-upload-pill ${isDuplicateRow(row) ? 'is-duplicate' : row.valid ? warning ? 'is-warning' : 'is-valid' : 'is-invalid'}`}>{isDuplicateRow(row) ? 'Duplicate' : row.valid ? warning ? 'Warning' : 'Valid' : 'Invalid'}</span></td>
  <td className="completed-upload-validation-cell">{row.errors?.length ? row.errors.join(' ') : row.warnings?.length ? row.warnings.join(' ') : 'Ready to import'}</td>
  <td className="completed-upload-action-column">{isDuplicateRow(row) ? <button type="button" className="completed-upload-row-action is-remove" onClick={() => removePreviewRow(row.rowNumber)} disabled={busy}><Trash2 size={14} /> Remove</button> : isEditing ? <button type="button" className="completed-upload-row-action is-save" onClick={() => void saveEditedRow()} disabled={busy}><Save size={14} /> Save</button> : <button type="button" className="completed-upload-row-action" onClick={() => beginEditing(row)} disabled={busy}><Edit3 size={14} /> Edit</button>}</td>
</tr> })}</tbody></table></div><div className="completed-upload-fixed-result-rail" aria-label="Fixed validation results"><table><thead><tr><th>Status</th><th>Validation</th><th>Action</th></tr></thead><tbody style={{ transform: 'translate3d(0, calc(var(--completed-upload-scroll-top, 0px) * -1), 0)' }}>{visibleRows.map((row) => { const isEditing = editingRow?.rowNumber === row.rowNumber; const warning = isWarningRow(row); return <tr key={`fixed-${row.rowNumber}`}><td><span className={`completed-upload-pill ${isDuplicateRow(row) ? 'is-duplicate' : row.valid ? warning ? 'is-warning' : 'is-valid' : 'is-invalid'}`}>{isDuplicateRow(row) ? 'Duplicate' : row.valid ? warning ? 'Warning' : 'Valid' : 'Invalid'}</span></td><td>{row.errors?.length ? row.errors.join(' ') : row.warnings?.length ? row.warnings.join(' ') : 'Ready to import'}</td><td>{isDuplicateRow(row) ? <button type="button" className="completed-upload-row-action is-remove" onClick={() => removePreviewRow(row.rowNumber)} disabled={busy}><Trash2 size={14} /> Remove</button> : isEditing ? <button type="button" className="completed-upload-row-action is-save" onClick={() => void saveEditedRow()} disabled={busy}><Save size={14} /> Save</button> : <button type="button" className="completed-upload-row-action" onClick={() => beginEditing(row)} disabled={busy}><Edit3 size={14} /> Edit</button>}</td></tr> })}</tbody></table></div></div><div className="completed-upload-pagination"><span>Showing {visibleRows.length ? ((tablePage - 1) * PAGE_SIZE) + 1 : 0}-{Math.min(tablePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}</span><div><button type="button" onClick={() => setTablePage((page) => Math.max(1, page - 1))} disabled={tablePage <= 1}>Previous</button><strong>Page {tablePage} of {totalTablePages}</strong><button type="button" onClick={() => setTablePage((page) => Math.min(totalTablePages, page + 1))} disabled={tablePage >= totalTablePages}>Next</button></div></div><div className="completed-upload-preview-actions"><button type="button" className="completed-upload-secondary" onClick={reset} disabled={busy}>Clear</button><button type="button" className="completed-upload-primary" onClick={() => void importRows()} disabled={busy || !preview?.rows?.length || !preview.rows.some((row) => row.valid || hasOnlyMissingContactErrors(row))}>{busy ? <><LoaderCircle className="completed-upload-spinner" size={16} /> Importing...</> : 'Import Valid Rows'}</button></div></> : null}
        </> : <div className="completed-upload-result" role="status"><CheckCircle2 size={30} /><div><h3>Successfully imported</h3><p>{result.importedRows || 0} student record{Number(result.importedRows || 0) === 1 ? '' : 's'} added successfully.</p></div></div>}
        {error ? <div className="completed-upload-error" role="alert"><AlertCircle size={17} />{error}</div> : null}
        {importConfirmation ? <div className="completed-upload-confirm-backdrop" role="presentation"><div className={`completed-upload-confirm-card completed-upload-import-confirm-card${result ? ' is-complete' : ''}`} role="dialog" aria-modal="true" aria-labelledby="completed-upload-import-confirm-title"><div className="completed-upload-confirm-header"><div><p>CONFIRM IMPORT</p><h3 id="completed-upload-import-confirm-title">Ready to import student records</h3><span>Review the import summary before saving these historical records.</span></div><button type="button" onClick={() => setImportConfirmation(null)} disabled={busy} aria-label="Close import confirmation"><X size={18} /></button></div><div className="completed-upload-import-summary"><div><strong>{importConfirmation.rows.filter((row) => row.valid).length}</strong><span>Ready to import</span></div><div><strong>{importConfirmation.missingContactRows.length}</strong><span>Missing contact review</span></div><div><strong>{importConfirmation.skippedRows}</strong><span>Will be skipped</span></div></div>{importConfirmation.missingContactRows.length ? <div className="completed-upload-confirm-list">{importConfirmation.missingContactRows.map(({ row, selected }) => <label className={`completed-upload-confirm-row${selected ? ' is-selected' : ''}`} key={`import-${row.rowNumber}`}><input type="checkbox" checked={selected} onChange={() => toggleImportConfirmationRow(row.rowNumber)} /><span><strong>{row.data?.studentName || row.studentId || 'Unnamed student'}</strong><small>Row {row.rowNumber} · {row.studentId || '-'}</small></span><em>{row.errors.filter(isMissingContactError).map((error) => error.replace(/\. Confirm before importing with an empty value\./i, '')).join(' and ')}</em></label>)}</div> : <div className="completed-upload-import-ready"><CheckCircle2 size={18} /><span>All selected rows contain the required import data.</span></div>}{result ? <div className="completed-upload-import-success"><CheckCircle2 size={28} /><strong>Successfully imported</strong></div> : null}{importProgress > 0 && busy ? <div className="completed-upload-progress"><div><span>Uploading records...</span><strong>{importProgress}%</strong></div><div className="completed-upload-progress-track"><span style={{ width: `${importProgress}%` }} /></div></div> : null}<div className="completed-upload-confirm-actions"><button type="button" className="completed-upload-secondary" onClick={() => setImportConfirmation(null)} disabled={busy}>Cancel</button><button type="button" className="completed-upload-primary" onClick={() => void confirmImport()} disabled={busy || !importConfirmation.missingContactRows.some((item) => item.selected) && importConfirmation.rows.every((row) => !row.valid)}>{busy ? <><LoaderCircle className="completed-upload-spinner" size={16} /> Uploading...</> : 'Confirm & Import'}</button></div><div className="completed-upload-confirm-actions completed-upload-success-actions">{result ? <button type="button" className="completed-upload-primary" onClick={() => { reset(); onClose() }} disabled={busy}>OK</button> : null}</div></div></div> : null}        {contactReview ? <div className="completed-upload-confirm-backdrop" role="presentation"><div className="completed-upload-confirm-card" role="dialog" aria-modal="true" aria-labelledby="completed-upload-confirm-title"><div className="completed-upload-confirm-header"><div><p>CONFIRM HISTORICAL DATA</p><h3 id="completed-upload-confirm-title">Some important fields are missing</h3><span>Select the students you want to import. Unselected students will be skipped.</span></div><button type="button" onClick={() => setContactReview(null)} disabled={busy} aria-label="Close confirmation"><X size={18} /></button></div><div className="completed-upload-confirm-list">{contactReview.map(({ row, selected }) => <label className={`completed-upload-confirm-row${selected ? ' is-selected' : ''}`} key={row.rowNumber}><input type="checkbox" checked={selected} onChange={() => toggleContactReviewRow(row.rowNumber)} /><span><strong>{row.data?.studentName || row.studentId || 'Unnamed student'}</strong><small>Row {row.rowNumber} · {row.studentId || '-'}</small></span><em>{row.errors.filter(isMissingContactError).map((error) => error.replace(/\. Confirm before importing with an empty value\./i, '')).join(' and ')}</em></label>)}</div><div className="completed-upload-confirm-actions"><button type="button" className="completed-upload-secondary" onClick={() => setContactReview(null)} disabled={busy}>Cancel</button><button type="button" className="completed-upload-primary" onClick={() => void confirmContactImport()} disabled={busy || !contactReview.some((item) => item.selected)}>Import Selected</button></div></div></div> : null}
      </div>
    </section>
  </div>
}

export default CompletedStudentUploadModal
