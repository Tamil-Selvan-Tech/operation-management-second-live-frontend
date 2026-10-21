import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Download, FileSpreadsheet, Loader2, X } from 'lucide-react'
import { downloadBranchMonthlyStudentReport } from '../services/reportService'
import '../styles/BranchMonthlyReportModal.css'

const pad = (value) => String(value).padStart(2, '0')
const today = new Date()
const todayValue = today.toISOString().slice(0, 10)
const REPORT_FIELD_GROUPS = [
  { label: 'Student details', fields: [['studentId', 'Student ID'], ['studentName', 'Student Name'], ['contactNumber', 'Contact Number'], ['emailId', 'Email ID'], ['parentGuardian', 'Parent / Guardian'], ['qualification', 'Qualification'], ['educationLevel', 'Education Level'], ['educationStatus', 'Education Status'], ['passedOutYear', 'Passed Out Year'], ['currentStatus', 'Current Status'], ['studentStatus', 'Student Status']] },
  { label: 'Course & schedule', fields: [['course', 'Course'], ['databaseSource', 'Database Source'], ['branchAdminName', 'Branch Admin Name'], ['courseStartingDate', 'Course Starting Date'], ['courseEndingDate', 'Course Ending Date'], ['scheduleMode', 'Schedule Mode'], ['batchTiming', 'Batch Timing'], ['facultyName', 'Faculty Name'], ['attendance', 'Attendance']] },
  { label: 'Fees & payment', fields: [['courseFees', 'Course Fees'], ['registrationFees', 'Registration Fees'], ['totalFees', 'Total Fees'], ['paidAmount', 'Paid Amount'], ['pendingAmount', 'Pending Amount']] },
  { label: 'Academic & outcome', fields: [['remarks', 'Remarks'], ['academicProject', 'Academic Project'], ['assessment01', 'Assessment-01'], ['assessment02', 'Assessment-02'], ['assessment03', 'Assessment-03'], ['placement', 'Placement'], ['certificationStatus', 'Certification Status'], ['certificateIssuedDate', 'Certificate Issued Date']] },
  { label: 'Installments', fields: [1, 2, 3].flatMap((number) => [['installment' + number + '.paidAmount', `Installment ${number} - Paid Amount`], ['installment' + number + '.pendingAmount', `Installment ${number} - Pending Amount`], ['installment' + number + '.paymentDate', `Installment ${number} - Payment Date`], ['installment' + number + '.mode', `Installment ${number} - Mode of Collection`], ['installment' + number + '.receiptNumber', `Installment ${number} - Receipt Number`]]) },
]
const REPORT_FIELDS = REPORT_FIELD_GROUPS.flatMap((group) => group.fields)
const DEFAULT_REPORT_FIELDS = REPORT_FIELDS.map(([key]) => key)

function ReportFilterSelect({ label, value, onChange, options }) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)
  const selected = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return <div ref={rootRef} className="branch-monthly-report-custom-select">
    <span className="branch-monthly-report-custom-select-label">{label}</span>
    <button type="button" className={isOpen ? 'branch-monthly-report-custom-select-trigger is-open' : 'branch-monthly-report-custom-select-trigger'} onClick={() => setIsOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={isOpen}>
      <span>{selected.label}</span>{isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
    </button>
    {isOpen ? <div className="branch-monthly-report-custom-select-menu" role="listbox" aria-label={label}>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'is-selected' : ''} onClick={() => { onChange(option.value); setIsOpen(false) }}>{option.label}</button>)}</div> : null}
  </div>
}

export function BranchMonthlyReportModal({ isOpen, onClose, reportVariant = 'monthly' }) {
  const isMonthlyReport = reportVariant === 'monthly'
  const [mode, setMode] = useState('month')
  const [status, setStatus] = useState(reportVariant === 'monthly' ? 'all' : 'completed')
  const [month, setMonth] = useState(String(today.getMonth() + 1))
  const [year, setYear] = useState(String(today.getFullYear()))
  const [fromDate, setFromDate] = useState(today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-01')
  const [toDate, setToDate] = useState(todayValue)
  const [error, setError] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [selectedFields, setSelectedFields] = useState(DEFAULT_REPORT_FIELDS)
  const [columnsOpen, setColumnsOpen] = useState(true)
  const selectedFieldSet = new Set(selectedFields)
  const installmentGroup = REPORT_FIELD_GROUPS.find((group) => group.label === 'Installments')
  const installmentFieldKeys = installmentGroup?.fields.map(([key]) => key) || []
  const allInstallmentsSelected = installmentFieldKeys.length > 0 && installmentFieldKeys.every((key) => selectedFieldSet.has(key))
  if (!isOpen) return null
  const submit = async (event) => {
    event.preventDefault(); setError('')
    if (['week', 'range'].includes(mode) && (!fromDate || !toDate || fromDate > toDate)) return setError('Please select a valid date range.')
    setIsDownloading(true)
    try {
      if (!selectedFields.length) return setError('Select at least one report field before downloading.')
      const reportOptions = isMonthlyReport ? { includeCollectionSummary: 'true', includeStatusLegend: 'true' } : {}
      const query = mode === 'month' ? { mode, month, year, status, columns: JSON.stringify(selectedFields), ...reportOptions } : mode === 'year' ? { mode, year, status, columns: JSON.stringify(selectedFields), ...reportOptions } : mode === 'all' ? { mode, status, columns: JSON.stringify(selectedFields), ...reportOptions } : { mode, fromDate, toDate, status, columns: JSON.stringify(selectedFields), ...reportOptions }
      const statusLabel = status === 'all' ? 'All Students' : status === 'completed' ? 'Completed Students' : 'Discontinued Students'
      const statusName = status === 'all' ? 'All_Students' : status === 'completed' ? 'Completed_Students' : 'Discontinued_Students'
      const periodName = mode === 'month' ? 'Monthly_' + year + '-' + pad(month) : mode === 'year' ? 'Yearly_' + year : mode === 'all' ? 'All_Records' : mode === 'week' ? 'Weekly_' + fromDate : 'Custom_' + fromDate + '_to_' + toDate
      const monthlyFileName = mode === 'month' ? `${statusLabel}_monthly-${year}-${pad(month)}.xlsx` : `${statusLabel}_${periodName}.xlsx`
      await downloadBranchMonthlyStudentReport(query, isMonthlyReport ? monthlyFileName : statusName + '_' + periodName + '.xlsx')
      onClose()
    } catch (downloadError) { setError(downloadError?.message || 'Unable to generate the report. Please try again.') } finally { setIsDownloading(false) }
  }
  return <div className="branch-monthly-report-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDownloading) onClose() }}>
    <section className="branch-monthly-report-modal" role="dialog" aria-modal="true" aria-labelledby="branch-monthly-report-title">
      <header className="branch-monthly-report-header"><div className="branch-monthly-report-title"><span><FileSpreadsheet size={20} /></span><div><p>{isMonthlyReport ? 'BRANCH ADMIN REPORT' : 'COMPLETED STUDENTS REPORT'}</p><h2 id="branch-monthly-report-title">{isMonthlyReport ? 'Monthly Collection Report' : 'Student Status Report'}</h2><small>{isMonthlyReport ? 'Export monthly collection and student details in the reference report format.' : 'Export completed student data with course, payment and academic details.'}</small></div></div><button type="button" className="branch-monthly-report-close" onClick={onClose} disabled={isDownloading} aria-label="Close"><X size={20} /></button></header>
      <form onSubmit={submit} className="branch-monthly-report-form">
        <div className="branch-monthly-report-section"><div className="branch-monthly-report-select-row"><ReportFilterSelect label="Period type" value={mode} onChange={setMode} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'year', label: 'Year' }, { value: 'range', label: 'Custom Range' }, { value: 'all', label: 'All Records' }]} /><ReportFilterSelect label="Student status" value={status} onChange={setStatus} options={[{ value: 'completed', label: 'Completed Students' }, { value: 'discontinued', label: 'Discontinued Students' }, { value: 'all', label: 'All Students' }]} /></div>{mode === 'month' ? <div className="branch-monthly-report-fields"><label>Month<select value={month} onChange={(event) => setMonth(event.target.value)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index, 1).toLocaleString('en', { month: 'long' })}</option>)}</select></label><label>Year<input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} /></label></div> : mode === 'year' ? <div className="branch-monthly-report-fields"><label>Year<input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} /></label></div> : mode === 'all' ? <p className="branch-monthly-report-hint">No date filter. This includes completed and discontinued course records.</p> : <div className="branch-monthly-report-fields"><label>{mode === 'week' ? 'Week Start' : 'From Date'}<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>{mode === 'week' ? 'Week End' : 'To Date'}<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div>}</div>
        <div className="branch-monthly-report-section branch-monthly-report-columns-section"><div className="branch-monthly-report-section-heading"><div><span>03</span><div><h3>Report columns</h3><p>Choose the fields you want in the downloaded Excel file.</p></div></div><button type="button" className="branch-monthly-report-columns-toggle" onClick={() => setColumnsOpen((open) => !open)}>{columnsOpen ? 'Hide fields' : 'Show fields'}{columnsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></div>{columnsOpen ? <><div className="branch-monthly-report-column-toolbar"><span><strong>{selectedFields.length}</strong> of {REPORT_FIELDS.length} fields selected</span><div><button type="button" onClick={() => setSelectedFields(DEFAULT_REPORT_FIELDS)}>Select all</button><button type="button" onClick={() => setSelectedFields([])}>Clear all</button></div></div><div className="branch-monthly-report-column-groups">{REPORT_FIELD_GROUPS.map((group) => <div className="branch-monthly-report-column-group" key={group.label}><h4>{group.label}</h4><div className="branch-monthly-report-column-grid">{group.label === 'Installments' ? <label className={`branch-monthly-report-column branch-monthly-report-installments-toggle${allInstallmentsSelected ? ' is-selected' : ''}`}><input type="checkbox" checked={allInstallmentsSelected} onChange={() => setSelectedFields((current) => allInstallmentsSelected ? current.filter((key) => !installmentFieldKeys.includes(key)) : [...current, ...installmentFieldKeys.filter((key) => !current.includes(key))])} /><span className="branch-monthly-report-check">{allInstallmentsSelected ? <Check size={12} /> : null}</span><span>Installments</span></label> : group.fields.map(([key, label]) => <label className={`branch-monthly-report-column${selectedFieldSet.has(key) ? ' is-selected' : ''}`} key={key}><input type="checkbox" checked={selectedFieldSet.has(key)} onChange={() => setSelectedFields((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} /><span className="branch-monthly-report-check">{selectedFieldSet.has(key) ? <Check size={12} /> : null}</span><span>{label}</span></label>)}</div></div>)}</div></> : null}</div>
        {error ? <div className="branch-monthly-report-error" role="alert">{error}</div> : null}
        <footer className="branch-monthly-report-footer"><span>Excel format: xlsx · Missing values use -</span><div><button type="button" className="branch-monthly-report-cancel" onClick={onClose} disabled={isDownloading}>Cancel</button><button type="submit" className="branch-monthly-report-download" disabled={isDownloading}>{isDownloading ? <><Loader2 className="is-spinning" size={17} /> Generating...</> : <><Download size={17} /> Download Excel</>}</button></div></footer>
      </form>
      {isDownloading ? <div className="branch-monthly-report-loading" role="status" aria-live="polite"><div className="branch-monthly-report-loading-card"><Loader2 size={30} className="is-spinning" /><strong>Preparing report...</strong><span>Collecting student, course, payment and academic data. Please wait.</span></div></div> : null}
    </section>
  </div>
}
