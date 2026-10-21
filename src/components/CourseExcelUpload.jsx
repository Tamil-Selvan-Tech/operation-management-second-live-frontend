import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CheckCircle2, ChevronDown, Download, FileSpreadsheet, Loader2, Search, Upload, X } from 'lucide-react'
import { downloadCourseErrors, downloadCourseTemplate, importCourseWorkbook, previewCourseWorkbook, validateCourseFile } from '../services/courseImportService'
import { friendlyCourseImportMessage } from '../lib/courseImportMessages'
import CourseImportSheetTable from './CourseImportSheetTable'
import '../styles/CourseExcelUpload.css'

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0))
const percent = (value) => Number(value || 0).toFixed(2) + '%'
const PAGE_SIZE = 10
const isDuplicateIssue = (message) => /duplicate|already exists|matches multiple active branch templates/i.test(message)
const SHEET_NAMES = ['Courses', 'Course Modules', 'Course Submodules', 'Payment Plans']

function CourseImportRowFilter({ value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const options = [
    { value: 'all', label: 'All rows' },
    { value: 'valid', label: 'Valid' },
    { value: 'invalid', label: 'Invalid' },
    { value: 'duplicates', label: 'Duplicates' },
  ]
  const selectedOption = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className={'course-import-row-filter' + (isOpen ? ' is-open' : '')}>
      <button type="button" className="course-import-row-filter-trigger" aria-label="Filter preview rows" aria-haspopup="listbox" aria-expanded={isOpen} disabled={disabled} onClick={() => setIsOpen((current) => !current)}>
        <span>{selectedOption.label}</span><ChevronDown size={15} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {isOpen ? <div className="course-import-row-filter-menu" role="listbox" aria-label="Filter preview rows">
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={'course-import-row-filter-option' + (option.value === value ? ' is-selected' : '')} onClick={() => { onChange(option.value); setIsOpen(false) }}>{option.label}</button>)}
      </div> : null}
    </div>
  )
}

function CourseImportCourseDetails({ course }) {
  return <>
    {course.enteredCode !== course.courseCode ? <p className="course-import-code">Entered code: {course.enteredCode} &rarr; Final code: {course.courseCode}</p> : null}
    <dl className="course-import-fields">{[['Course type', course.courseType], ['Mode', course.mode], ['Duration (months)', course.duration], ['Total hours', course.hours], ['Standard fee', money(course.actualFees)], ['Registration fee', money(course.registrationFees)], ['Discount', money(course.discount)], ['Final fee', course.afterDiscount == null ? '-' : money(course.afterDiscount)], ['Academic tests', course.academicTestCount], ['Status', course.status]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || value === 0 ? value : '?'}</dd></div>)}</dl>
    <h4>Modules &amp; submodules</h4>{(course.modules || []).map((module, moduleIndex) => <div className="course-import-module" key={moduleIndex}><strong>{module.title || module.name} <span>{percent(module.percentage)}</span></strong><ul>{(module.submodules || []).map((submodule, childIndex) => <li key={childIndex}><span>{submodule.title || submodule.name}</span><span>{percent(submodule.percentage)}</span></li>)}</ul></div>)}
    <h4>Payment plans</h4>{(course.paymentPlans || []).map((plan, planIndex) => <div className="course-import-plan" key={planIndex}><strong>{plan.templateName}</strong><span>{plan.installmentCount} installment(s) &middot; {plan.dueRule || 'Admission'}</span><p>{(plan.installments || []).map(money).join(' + ') || 'Amounts available after validation'}</p></div>)}
  </>
}

export function CourseExcelUpload({ onImported, onView, onStart, onClose, pageMode = false, latestCourseCode = '' }) {
  const [open, setOpen] = useState(pageMode)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [showImportReview, setShowImportReview] = useState(false)
  const [selectedImportCourse, setSelectedImportCourse] = useState(null)
  const [showImportConfirmation, setShowImportConfirmation] = useState(false)
  const [showImportSuccess, setShowImportSuccess] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [page, setPage] = useState(1)
  const [coursePage, setCoursePage] = useState(1)
  const [sheetSearch, setSheetSearch] = useState('')
  const [sheetFilter, setSheetFilter] = useState('all')
  const [activeSheet, setActiveSheet] = useState('Courses')
  const [errorPage, setErrorPage] = useState(1)
  const [edits, setEdits] = useState({})
  const [editsPending, setEditsPending] = useState(false)
  const editsRef = useRef({})
  const lock = useRef(false)
  const dialog = useRef(null)
  const courseDetailDialog = useRef(null)
  const workflowDialog = useRef(null)
  const reviewSection = useRef(null)
  const summaryCards = useRef(null)
  const importReviewSection = useRef(null)
  const scrollToSummaryOnPreview = useRef(false)

  useEffect(() => {
    if (!open || pageMode) return undefined
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    function onKey(event) {
      if (event.key === 'Escape' && !lock.current) setOpen(false)
      if (event.key !== 'Tab') return
      const items = [...(dialog.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], summary, [tabindex="0"]') || [])].filter((item) => item.getClientRects().length)
      if (!items.length) { event.preventDefault(); dialog.current?.focus(); return }
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open, pageMode])

  useEffect(() => {
    if (!selectedImportCourse) return undefined
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => courseDetailDialog.current?.focus())
    function onKey(event) {
      if (event.key === 'Escape') setSelectedImportCourse(null)
      if (event.key !== 'Tab') return
      const items = [...(courseDetailDialog.current?.querySelectorAll('button:not(:disabled), [tabindex="0"]') || [])].filter((item) => item.getClientRects().length)
      if (!items.length) { event.preventDefault(); courseDetailDialog.current?.focus(); return }
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === courseDetailDialog.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === courseDetailDialog.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [selectedImportCourse])

  useEffect(() => {
    const active = showImportConfirmation || showImportSuccess
    if (!active) return undefined
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => workflowDialog.current?.querySelector('button:not(:disabled)')?.focus())
    function onKey(event) {
      if (event.key === 'Escape' && showImportConfirmation && busy !== 'import') { setShowImportConfirmation(false); return }
      if (event.key !== 'Tab') return
      const items = [...(workflowDialog.current?.querySelectorAll('button:not(:disabled)') || [])].filter((item) => item.getClientRects().length)
      if (!items.length) { event.preventDefault(); workflowDialog.current?.focus(); return }
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === workflowDialog.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === workflowDialog.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [showImportConfirmation, showImportSuccess, busy])

  useEffect(() => {
    if (!preview || busy === 'preview' || !scrollToSummaryOnPreview.current) return undefined
    scrollToSummaryOnPreview.current = false
    const frame = window.requestAnimationFrame(() => summaryCards.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [preview, busy])

  async function run(action, callback) {
    if (lock.current) return
    lock.current = true
    setBusy(action)
    setError('')
    try { await callback() } catch (failure) {
      setError(failure.message || 'Unable to complete this action. Please try again.')
      if (action === 'import') setShowImportConfirmation(false)
    }
    finally { lock.current = false; setBusy('') }
  }
  function choose(next) {
    if (lock.current) return
    setPreview(null); setShowImportReview(false); setResult(null); setPage(1); setCoursePage(1); setSheetSearch(''); setSheetFilter('all'); setActiveSheet('Courses'); setErrorPage(1); editsRef.current = {}; setEdits({}); setEditsPending(false)
    const issue = validateCourseFile(next)
    setFile(issue ? null : next)
    setError(issue)
    if (!issue) {
      scrollToSummaryOnPreview.current = true
      void validateFile(next)
    }
  }
  function start() {
    setFile(null); setPreview(null); setShowImportReview(false); setResult(null); setError(''); setPage(1); setCoursePage(1); setSheetSearch(''); setSheetFilter('all'); setActiveSheet('Courses'); setErrorPage(1); editsRef.current = {}; setEdits({}); setEditsPending(false); setOpen(true)
  }
  function returnToValidation() {

    setShowImportReview(false)
    window.requestAnimationFrame(() => reviewSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  function returnToWorkbookUpload() {
    setFile(null); setPreview(null);  setShowImportReview(false); setResult(null); setError(''); setPage(1); setCoursePage(1); setSheetSearch(''); setSheetFilter('all'); setActiveSheet('Courses'); setErrorPage(1); editsRef.current = {}; setEdits({}); setEditsPending(false); scrollToSummaryOnPreview.current = false
    window.requestAnimationFrame(() => dialog.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  function closeUpload() {
    if (pageMode) {
      if (showImportReview && !result) { returnToValidation(); return }
      if (preview && !result) { returnToWorkbookUpload(); return }
      onClose?.()
      return
    }
    setOpen(false)
  }
  function requestImport() {
    if (lock.current || !preview?.valid || editsPending) return
    setShowImportConfirmation(true)
  }
  function confirmImport() {
    void importFile()
  }
  function finishImportSuccess() {
    setShowImportSuccess(false)
    if (pageMode) onClose?.()
    else setOpen(false)
  }
  async function importFile() {
    await run('import', async () => {
      const next = await importCourseWorkbook(file, preview.previewHash, editsRef.current)
      if (!next.imported) {
        setShowImportConfirmation(false)
        setShowImportReview(false)
        setPreview(next); setEditsPending(false); setPage(1); setCoursePage(1); setSheetSearch(''); setSheetFilter('all'); setErrorPage(1)
        setError('The workbook needs corrections. No courses were imported.')
        return
      }
      setResult(next)
      try { await onImported?.() } catch { setError('Courses were imported. Refresh the course table to load them.') }
      setShowImportConfirmation(false)
      setShowImportSuccess(true)
    })
  }
  async function updateSheetEdit(sheet, row, changes) {
    const current = editsRef.current
    const next = {
      ...current,
      [sheet]: {
        ...(current[sheet] || {}),
        [row]: { ...(current[sheet]?.[row] || {}), ...changes },
      },
    }
    editsRef.current = next
    setEdits(next)
    setEditsPending(true)
    setPreview((current) => {
      const currentSheet = current?.sheets?.[sheet]
      if (!currentSheet) return current
      return {
        ...current,
        sheets: {
          ...current.sheets,
          [sheet]: {
            ...currentSheet,
            rows: currentSheet.rows.map((item) => item.row === row ? { ...item, values: { ...item.values, ...changes } } : item),
          },
        },
      }
    })
    await run('preview', async () => {
      const validatedPreview = await previewCourseWorkbook(file, next)
      setPreview(validatedPreview)
      setEditsPending(false)
      setPage(1)
      setCoursePage(1)
      setSheetSearch('')
      setSheetFilter('all')
      setErrorPage(1)
    })
  }
  async function validateFile(targetFile = file) {
    if (!targetFile) return
    await run('preview', async () => {
      const next = await previewCourseWorkbook(targetFile, editsRef.current)
      setPreview(next); setEditsPending(false); setPage(1); setCoursePage(1); setSheetSearch(''); setSheetFilter('all'); setErrorPage(1)
    })
  }
  const errors = preview?.errors || []
  const courses = preview?.courses || []
  const sheetRows = preview?.sheets?.[activeSheet]?.rows || []
  const invalidRows = new Set(preview?.invalidRowsBySheet?.[activeSheet] || errors.filter((item) => item.sheet === activeSheet && item.row >= 2).map((item) => item.row))
  const duplicateRows = new Set(preview?.duplicateRowsBySheet?.[activeSheet] || errors.filter((item) => item.sheet === activeSheet && item.row >= 2 && isDuplicateIssue(item.message)).map((item) => item.row))
  const courseTotalCount = Number(preview?.validationCounts?.Courses?.total ?? preview?.totals?.courses ?? preview?.sheets?.Courses?.rows?.length ?? 0)
  const courseInvalidRows = new Set(preview?.invalidRowsBySheet?.Courses ?? errors.filter((item) => item.sheet === 'Courses' && item.row >= 2).map((item) => item.row))
  const courseDuplicateRows = new Set(preview?.duplicateRowsBySheet?.Courses ?? errors.filter((item) => item.sheet === 'Courses' && item.row >= 2 && isDuplicateIssue(item.message)).map((item) => item.row))
  const invalidCourseCount = Math.min(courseTotalCount, Number(preview?.validationCounts?.Courses?.invalid ?? courseInvalidRows.size))
  const validCourseCount = Math.max(0, Number(preview?.validationCounts?.Courses?.valid ?? courseTotalCount - invalidCourseCount))
  const duplicateCourseCount = Math.min(courseTotalCount, courseDuplicateRows.size)
  const sheetFilterLabel = ({ all: 'All rows', valid: 'Valid', invalid: 'Invalid', duplicates: 'Duplicates' })[sheetFilter] || 'All rows'
  const sheetSearchLabel = sheetSearch.trim()
  const emptySheetMessage = 'No rows found for ' + sheetFilterLabel + (sheetSearchLabel ? ' matching ' + sheetSearchLabel : '') + '.'
  const filteredSheetRows = sheetRows.filter((row) => {
    if (sheetFilter === 'valid' && invalidRows.has(row.row)) return false
    if (sheetFilter === 'invalid' && !invalidRows.has(row.row)) return false
    if (sheetFilter === 'duplicates' && !duplicateRows.has(row.row)) return false
    const search = sheetSearch.trim().toLocaleLowerCase()
    if (!search) return true
    const editedValues = Object.values(edits[activeSheet]?.[row.row] || {})
    return [...Object.values(row.values || {}), ...editedValues].some((value) => String(value ?? '').toLocaleLowerCase().includes(search))
  })
  const pages = Math.max(1, Math.ceil(filteredSheetRows.length / PAGE_SIZE))
  const coursePages = Math.max(1, Math.ceil(courses.length / PAGE_SIZE))
  const errorPages = Math.max(1, Math.ceil(errors.length / PAGE_SIZE))
  const uploadPanel = (
    <section className={pageMode ? 'course-import-page' : 'course-import-dialog'} role={pageMode ? undefined : 'dialog'} aria-modal={pageMode ? undefined : true} aria-labelledby="course-import-title" aria-describedby="course-import-description" tabIndex={-1} ref={dialog} aria-busy={Boolean(busy)}>
      <header className="course-import-header">
              <div className="course-import-heading"><span className="course-import-icon"><FileSpreadsheet size={24} /></span><div><p>COURSE MANAGEMENT</p><h2 id="course-import-title">Excel course upload</h2></div></div>
              {latestCourseCode ? <div className="course-import-latest-code" title="Most recently added course code"><span>Last added course code</span><strong>{latestCourseCode}</strong></div> : null}
              <button type="button" className={pageMode ? "course-import-close course-import-page-back" : "course-import-close"} aria-label={pageMode ? (result ? "Back to Course Management" : showImportReview ? "Back to review and validate" : preview ? "Back to workbook upload" : "Back to Course Management") : "Close Excel upload"} disabled={Boolean(busy)} onClick={closeUpload}>{pageMode ? <ArrowLeft size={21} /> : <X size={21} />}</button>
            </header>
            <div className="course-import-body">
              <p id="course-import-description" className="course-import-description">Create courses with their modules, submodules and existing payment plans in one upload.</p>
              <ol className="course-import-steps" aria-label="Upload progress">
                {['Upload course excel', 'Review & validate', 'Import results'].map((label, index) => {
                  const current = result || showImportReview ? 2 : preview ? 1 : 0
                  return <li key={label} className={index <= current ? 'is-active' : ''} aria-current={index === current ? 'step' : undefined}><span>{index + 1}</span>{label}</li>
                })}
              </ol>
              {error ? <div className="course-import-alert is-error" role="alert">{error}</div> : null}
              {busy && busy !== 'import' && busy !== 'preview' ? <div className="course-import-loading" role="status"><Loader2 size={17} className="course-import-spinner" />{busy === 'preview' ? 'Validating the workbook...' : 'Preparing your download...'}</div> : null}
              {result ? (
                <div className="course-import-results">
                  <div className="course-import-alert is-success"><CheckCircle2 size={22} /><div><strong>{result.alreadyImported ? 'This workbook was already imported' : 'Courses imported successfully'}</strong><p>{result.courses.length} courses are available in Course Management.</p></div></div>
                  <div className="course-import-table-wrap"><table><thead><tr><th>Course code</th><th>Course name</th><th>Action</th></tr></thead><tbody>{result.courses.map((course) => <tr key={course.id}><td>{course.courseCode}</td><td>{course.name}</td><td><button className="button button-ghost" type="button" disabled={Boolean(busy)} onClick={() => { closeUpload(); void onView?.(course) }}>View course</button></td></tr>)}</tbody></table></div>
                </div>
              ) : (
                <>
                  {(!preview || !pageMode || busy === 'preview') ? <div className={'course-import-upload-options' + (preview && busy !== 'preview' ? ' has-preview' : '')}>
                    {(!preview || (pageMode && busy === 'preview')) ? <div className="course-import-instructions"><strong>Before you upload</strong><p>Complete all four template sheets, then upload the .xlsx file.</p><button type="button" className="button button-ghost" disabled={Boolean(busy)} onClick={() => void run('template', downloadCourseTemplate)}><Download size={15} /> Download template</button></div> : null}
                    <label className={"course-import-file" + (file ? " has-file" : "") + (busy === 'preview' ? " is-loading" : "")} aria-busy={busy === 'preview'}><>{busy === 'preview' ? <div className="course-import-file-progress" role="status" aria-live="polite"><Loader2 size={23} className="course-import-spinner" aria-hidden="true" /><strong>Uploading course workbook...</strong><span>{file?.name || 'Please wait while we validate the workbook.'}</span></div> : <><Upload size={23} /><strong>{file?.name || 'Choose an Excel workbook'}</strong><span>{file ? (file.size / 1024).toFixed(1) + ' KB | .xlsx' : '.xlsx only | up to 8 MB | 100 courses per upload'}</span></>}</><input aria-label="Choose course Excel workbook" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={Boolean(busy)} onChange={(event) => { if (event.target.files?.[0]) choose(event.target.files[0]); event.target.value = '' }} /></label>
                  </div> : null}
                  {preview && busy !== 'preview' ? (
                    <>
                      <div ref={summaryCards} className="course-import-stats" role="group" aria-label="Course validation summary"><div className="is-total"><strong>{courseTotalCount}</strong><span>Total Courses</span></div><div className="is-valid"><strong>{validCourseCount}</strong><span>Valid Courses</span></div><div className="is-invalid"><strong>{invalidCourseCount}</strong><span>Invalid Courses</span></div><div className="is-duplicate"><strong>{duplicateCourseCount}</strong><span>Duplicate Courses</span></div></div>
<>
                      {editsPending || !preview.valid ? <div className={'course-import-alert ' + (editsPending ? 'is-pending' : 'is-error')} role="status">{editsPending ? 'Edited values have not been validated yet. Revalidate before import.' : 'Fix all errors shown by sheet, row and column. No courses have been saved.'}</div> : null}
                      {(!pageMode || !showImportReview) && errors.length ? (
                        <details className="course-import-error-details">
                          <summary><strong>Validation errors</strong><span>{errors.length} row and column issues</span></summary>
                          <div className="course-import-error-body">
                            <div className="course-import-section-title"><h3>Workbook errors</h3><button type="button" className="button button-ghost" disabled={Boolean(busy) || editsPending} onClick={() => void run('errors', () => downloadCourseErrors(file, editsRef.current))}><Download size={15} /> Download error report</button></div>
                            <div className="course-import-table-wrap"><table><thead><tr><th>Sheet</th><th>Row</th><th>Column</th><th>Error</th></tr></thead><tbody>{errors.slice((errorPage - 1) * PAGE_SIZE, errorPage * PAGE_SIZE).map((item, index) => <tr key={index}><td>{item.sheet}</td><td>{item.row || '-'}</td><td>{item.column}</td><td><span className="course-import-error-message">{friendlyCourseImportMessage(item.column, item.message)}</span></td></tr>)}</tbody></table></div>
                            <div className="course-import-pagination"><button type="button" disabled={Boolean(busy) || errorPage <= 1} onClick={() => setErrorPage(errorPage - 1)}>Previous</button><span>Error page {errorPage} of {errorPages}</span><button type="button" disabled={Boolean(busy) || errorPage >= errorPages} onClick={() => setErrorPage(errorPage + 1)}>Next</button></div>
                          </div>
                        </details>
                      ) : null}
                      <section ref={reviewSection} className={'course-import-sheet-review' + (pageMode && showImportReview ? ' is-step-hidden' : '')} aria-label="Workbook sheet preview">
                        <div className="course-import-sheet-navigation">
                          <div className="course-import-sheet-tabs" role="tablist" aria-label="Workbook sheets">
                            {SHEET_NAMES.map((sheetName) => {
                              const tabId = 'course-import-tab-' + sheetName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                              const panelId = 'course-import-panel-' + sheetName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                              const issueCount = errors.filter((item) => item.sheet === sheetName).length
                              return <button type="button" id={tabId} aria-controls={panelId} role="tab" aria-selected={activeSheet === sheetName} className={'course-import-sheet-tab' + (activeSheet === sheetName ? ' is-active' : '')} key={sheetName} onClick={() => { setActiveSheet(sheetName); setPage(1); setSheetSearch(''); setSheetFilter('all') }}><span>{sheetName}</span>{issueCount ? <span className="course-import-sheet-errors">{issueCount} errors</span> : null}</button>
                            })}
                          </div>
                          <label className="course-import-grid-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search {activeSheet}</span><input type="search" value={sheetSearch} placeholder={'Search ' + activeSheet.toLowerCase() + '...'} onChange={(event) => { setSheetSearch(event.target.value); setPage(1) }} disabled={Boolean(busy)} /></label>
                          <CourseImportRowFilter value={sheetFilter} onChange={(value) => { setSheetFilter(value); setPage(1) }} disabled={Boolean(busy)} />
                        </div>
                        <CourseImportSheetTable sheetName={activeSheet} sheet={preview.sheets?.[activeSheet]} panelId={'course-import-panel-' + activeSheet.toLowerCase().replace(/[^a-z0-9]+/g, '-')} rows={filteredSheetRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)} errors={errors} edits={edits} invalidRows={[...invalidRows]} duplicateRows={[...duplicateRows]} emptyMessage={emptySheetMessage} availablePaymentPlans={preview.availablePaymentPlans || []} ambiguousPaymentPlanNames={preview.ambiguousPaymentPlanNames || []} busy={Boolean(busy)} onEditRow={updateSheetEdit} />
                        {filteredSheetRows.length > 0 ? <div className="course-import-pagination"><button type="button" disabled={Boolean(busy) || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Showing {Math.min((page - 1) * PAGE_SIZE + 1, filteredSheetRows.length)}-{Math.min(page * PAGE_SIZE, filteredSheetRows.length)} of {filteredSheetRows.length} rows &middot; page {page} of {pages}</span><button type="button" disabled={Boolean(busy) || page >= pages} onClick={() => setPage(page + 1)}>Next</button></div> : null}
                      </section>
                      {pageMode && !showImportReview ? <div className="course-import-page-actions course-import-page-next"><button type="button" className="button button-solid" disabled={Boolean(busy) || !preview?.valid || editsPending || courseTotalCount === 0} onClick={() => { setShowImportReview(true); window.requestAnimationFrame(() => importReviewSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }}>Next Import results</button></div> : null}
{(pageMode ? showImportReview : activeSheet === 'Courses') ? <section ref={pageMode ? importReviewSection : undefined} className={pageMode ? 'course-import-import-review' : undefined} aria-label={pageMode ? 'Import results review' : 'Calculated course payment and weights preview'}><div className="course-import-section-title"><h3>{pageMode ? 'Import results' : 'Modules and payment details'}</h3><span>{pageMode ? 'Select a course to review its details, modules, submodules and payment plans.' : editsPending ? 'Details below use the last validated values; validate changes to refresh them.' : 'Select a course to review hierarchy and installment amounts.'}</span></div>
                        {courses.slice((coursePage - 1) * PAGE_SIZE, coursePage * PAGE_SIZE).map((course, index) => {
                          const name = edits.Courses?.[course.row]?.['Course Name'] ?? course.name ?? 'Unnamed course'
                          const code = edits.Courses?.[course.row]?.['Course Code'] ?? course.enteredCode ?? course.courseCode
                          return <button type="button" className="course-import-course-card" key={course.row || index} onClick={() => setSelectedImportCourse(course)} aria-label={'View details for ' + name}>
                            <span className="course-import-course-card-main"><strong>{name}</strong><small>{code} &middot; {(course.modules || []).length} modules &middot; {(course.paymentPlans || []).length} payment plans</small></span>
                            <span className="course-import-course-card-fee">{course.afterDiscount == null ? 'Review required' : money(course.afterDiscount)}</span>
                            <span className="course-import-course-card-link">View details</span>
                          </button>
                        })}
                        {coursePages > 1 ? <div className="course-import-pagination"><button type="button" disabled={Boolean(busy) || coursePage <= 1} onClick={() => setCoursePage(coursePage - 1)}>Previous</button><span>Showing {(coursePage - 1) * PAGE_SIZE + 1}-{Math.min(coursePage * PAGE_SIZE, courses.length)} of {courses.length} courses &middot; page {coursePage} of {coursePages}</span><button type="button" disabled={Boolean(busy) || coursePage >= coursePages} onClick={() => setCoursePage(coursePage + 1)}>Next</button></div> : null}
                        {pageMode && showImportReview ? <div className="course-import-page-actions"><button type="button" className="button button-ghost" disabled={Boolean(busy)} onClick={returnToValidation}>Back to validation</button><button type="button" className="button button-solid" disabled={Boolean(busy) || !preview?.valid || editsPending} onClick={requestImport}>Import {preview?.valid ? preview.totals.courses + ' ' : ''}{preview?.valid && preview.totals.courses === 1 ? 'course' : 'courses'}</button></div> : null}
                      </section> : null}
                    </>
                    </>
                  ) : null}
                </>
              )}
            </div>
            {!pageMode ? <footer className="course-import-footer"><span>{result ? 'View and edit courses from the existing course list.' : 'All courses are imported together. Any failure rolls back the upload.'}</span><div><button type="button" className="button button-ghost" disabled={Boolean(busy)} onClick={closeUpload}>{result ? 'Done' : 'Cancel'}</button>{!result ? <><button type="button" className="button button-ghost" disabled={Boolean(busy) || !file} onClick={() => void validateFile()}>{editsPending ? 'Validate changes' : preview ? 'Revalidate' : 'Retry validation'}</button><button type="button" className="button button-solid" disabled={Boolean(busy) || !preview?.valid || editsPending} onClick={requestImport}>Import {preview?.valid ? preview.totals.courses + " " : ""}{preview?.valid && preview.totals.courses === 1 ? "course" : "courses"}</button></> : null}</div></footer> : null}
    </section>
  )

  return (
    <>
      {!pageMode ? (
        <>
          <button type="button" className="button button-ghost course-import-toolbar-button" disabled={Boolean(busy)} onClick={() => onStart ? onStart() : start()}>
            <Upload size={16} /> Excel Upload
          </button>
          {!open && error ? <span className="course-import-toolbar-error" role="alert">{error}</span> : null}
        </>
      ) : null}
      {open ? (pageMode ? uploadPanel : createPortal(<div className="course-import-backdrop">{uploadPanel}</div>, document.body)) : null}
      {selectedImportCourse ? createPortal(
        <div className="course-import-course-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedImportCourse(null) }}>
          <section ref={courseDetailDialog} className="course-import-course-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="course-import-detail-title" tabIndex={-1}>
            <header className="course-import-course-detail-header"><div><p>COURSE DETAILS</p><h2 id="course-import-detail-title">{selectedImportCourse.name || selectedImportCourse.enteredCode || selectedImportCourse.courseCode || 'Course'}</h2><span>{selectedImportCourse.enteredCode || selectedImportCourse.courseCode}</span></div><button type="button" aria-label="Close course details" onClick={() => setSelectedImportCourse(null)}><X size={20} /></button></header>
            <div className="course-import-course-detail-body"><CourseImportCourseDetails course={selectedImportCourse} /></div>
          </section>
        </div>,
        document.body
      ) : null}
      {showImportConfirmation || showImportSuccess ? createPortal(
        <div className="course-import-workflow-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && showImportConfirmation && busy !== 'import') setShowImportConfirmation(false) }}>
          <section ref={workflowDialog} className="course-import-workflow-dialog" role="dialog" aria-modal="true" aria-labelledby="course-import-workflow-title" aria-describedby="course-import-workflow-message" tabIndex={-1}>
            {showImportConfirmation ? busy === 'import' ? <>
              <header className="course-import-workflow-header"><span className="course-import-workflow-icon is-confirm"><Loader2 size={22} className="course-import-spinner" /></span><div><p>COURSE MANAGEMENT</p><h2 id="course-import-workflow-title">Importing courses</h2></div></header>
              <div className="course-import-workflow-content"><p id="course-import-workflow-message">Importing {preview?.totals?.courses || courseTotalCount} {Number(preview?.totals?.courses || courseTotalCount) === 1 ? 'course' : 'courses'}...</p><span>Please keep this page open while all course data is saved.</span><div className="course-import-progress-track is-dialog-progress" role="progressbar" aria-label="Importing courses"><span /></div></div>
            </> : <>
              <header className="course-import-workflow-header"><span className="course-import-workflow-icon is-confirm"><FileSpreadsheet size={22} /></span><div><p>COURSE MANAGEMENT</p><h2 id="course-import-workflow-title">Confirm course import</h2></div><button type="button" aria-label="Cancel import" onClick={() => setShowImportConfirmation(false)}><X size={19} /></button></header>
              <div className="course-import-workflow-content"><p id="course-import-workflow-message">Import {preview?.totals?.courses || courseTotalCount} {Number(preview?.totals?.courses || courseTotalCount) === 1 ? 'course' : 'courses'} from this workbook?</p><span>All courses will be imported together. If any course cannot be saved, none will be imported.</span></div>
              <footer className="course-import-workflow-actions"><button type="button" className="button button-ghost" onClick={() => setShowImportConfirmation(false)}>Cancel</button><button type="button" className="button button-solid" onClick={confirmImport}>OK</button></footer>
            </> : <>
              <header className="course-import-workflow-header is-success"><span className="course-import-workflow-icon"><CheckCircle2 size={24} /></span><div><p>COURSE MANAGEMENT</p><h2 id="course-import-workflow-title">{result?.alreadyImported ? 'Workbook already imported' : 'Courses imported successfully'}</h2></div></header>
              <div className="course-import-workflow-content"><p id="course-import-workflow-message">{result?.courses?.length || 0} {result?.courses?.length === 1 ? 'course is' : 'courses are'} available in Course Management.</p></div>
              <footer className="course-import-workflow-actions is-success"><button type="button" className="button button-solid" onClick={finishImportSuccess}>OK</button></footer>
            </>}
          </section>
        </div>,
        document.body
      ) : null}
    </>
  )
}
