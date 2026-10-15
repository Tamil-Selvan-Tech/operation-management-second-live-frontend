import { useMemo, useState } from 'react'
import { CalendarDays, Check, Download, FileSpreadsheet, Loader2, X } from 'lucide-react'
import { downloadBranchMonthlyStudentReport } from '../services/reportService'
import '../styles/BranchMonthlyReportModal.css'

const REPORT_COLUMNS = [
  ['studentId', 'Student ID'], ['studentName', 'Student Name'], ['contactNumber', 'Contact Number'], ['emailId', 'Email ID'],
  ['course', 'Course'], ['databaseSource', 'Database Source'], ['branchAdminName', 'Branch Admin Name'], ['courseStartingDate', 'Course Starting Date'],
  ['courseEndingDate', 'Course Ending Date'], ['scheduleMode', 'Weekday / Weekend / Online / Offline'], ['batchTiming', 'Batch Timing'], ['facultyName', 'Faculty Name'],
  ['attendance', 'Attendance'], ['courseFees', 'Course Fees'], ['admissionFees', 'Registration Fees'], ['totalFees', 'Total Fees'], ['installment1', 'Installment / Full Payment'],
  ['installment2', 'Installment 2'], ['installment3', 'Installment 3'], ['paidAmount', 'Paid Amount'], ['pendingAmount', 'Pending Amount'], ['modeOfCollection', 'Mode of Collection'],
  ['receiptNo', 'Receipt No'], ['studentStatus', 'Student Status'], ['remarks', 'Remarks'], ['assessment01', 'Assessment-01'], ['assessment02', 'Assessment-02'], ['assessment03', 'Assessment-03'],
  ['academicProject', 'Academic Project'],
  ['placement', 'Placement'], ['certificationStatus', 'Certification Status'], ['certificateIssuedDate', 'Certificate Issued Date'],
]

const pad = (value) => String(value).padStart(2, '0')
const monthName = (date) => new Date(`${date}T00:00:00`).toLocaleString('en', { month: 'long' })
const today = new Date()

export function BranchMonthlyReportModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('month')
  const [month, setMonth] = useState(String(today.getMonth() + 1))
  const [year, setYear] = useState(String(today.getFullYear()))
  const [fromDate, setFromDate] = useState(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`)
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10))
  const [selected, setSelected] = useState(() => new Set(REPORT_COLUMNS.map(([key]) => key)))
  const [error, setError] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const selectedKeys = useMemo(() => REPORT_COLUMNS.map(([key]) => key).filter((key) => selected.has(key)), [selected])

  if (!isOpen) return null
  const toggle = (key) => setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const submit = async (event) => {
    event.preventDefault(); setError('')
    if (!selectedKeys.length) return setError('Select at least one detail column before downloading.')
    if (mode === 'range' && fromDate > toDate) return setError('From Date cannot be later than To Date.')
    setIsDownloading(true)
    try {
      const query = mode === 'month' ? { mode, month, year, columns: selectedKeys.join(',') } : { mode, fromDate, toDate, columns: selectedKeys.join(',') }
      const fileName = mode === 'month'
        ? `${new Date(2000, Number(month) - 1, 1).toLocaleString('en', { month: 'long' })}-monthly-report-${year}.xlsx`
        : `${fromDate.slice(0, 7) === toDate.slice(0, 7) ? monthName(fromDate) : `${monthName(fromDate)}-${monthName(toDate)}`}-monthly-report-${toDate.slice(0, 4)}.xlsx`
      await downloadBranchMonthlyStudentReport(query, fileName)
      onClose()
    } catch (downloadError) { setError(downloadError?.message || 'Unable to generate the monthly report. Please try again.') } finally { setIsDownloading(false) }
  }
  return <div className="branch-monthly-report-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDownloading) onClose() }}>
    <section className="branch-monthly-report-modal" role="dialog" aria-modal="true" aria-labelledby="branch-monthly-report-title">
      <header className="branch-monthly-report-header"><div className="branch-monthly-report-title"><span><FileSpreadsheet size={20} /></span><div><p>BRANCH ADMIN REPORT</p><h2 id="branch-monthly-report-title">Monthly Student Report</h2><small>Export collection, student progress, and academic test details.</small></div></div><button type="button" className="branch-monthly-report-close" onClick={onClose} disabled={isDownloading} aria-label="Close"><X size={20} /></button></header>
      <form onSubmit={submit} className="branch-monthly-report-form">
        <div className="branch-monthly-report-section"><div className="branch-monthly-report-section-heading"><div><span>01</span><div><h3>Report period</h3><p>Choose the calendar month or a custom date range.</p></div></div><CalendarDays size={19} /></div><div className="branch-monthly-report-period-tabs"><button type="button" className={mode === 'month' ? 'is-active' : ''} onClick={() => setMode('month')}>Month & Year</button><button type="button" className={mode === 'range' ? 'is-active' : ''} onClick={() => setMode('range')}>Custom Range</button></div>{mode === 'month' ? <div className="branch-monthly-report-fields"><label>Month<select value={month} onChange={(event) => setMonth(event.target.value)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index, 1).toLocaleString('en', { month: 'long' })}</option>)}</select></label><label>Year<input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} /></label></div> : <div className="branch-monthly-report-fields"><label>From Date<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>To Date<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div>}</div>
        <div className="branch-monthly-report-section"><div className="branch-monthly-report-section-heading"><div><span>02</span><div><h3>Detail columns</h3><p>{selectedKeys.length} of {REPORT_COLUMNS.length} columns selected. Original order is preserved.</p></div></div><div className="branch-monthly-report-column-actions"><button type="button" onClick={() => setSelected(new Set(REPORT_COLUMNS.map(([key]) => key)))}>Select all</button><button type="button" onClick={() => setSelected(new Set())}>Clear all</button></div></div><div className="branch-monthly-report-column-grid">{REPORT_COLUMNS.map(([key, label]) => <label key={key} className={`branch-monthly-report-column ${selected.has(key) ? 'is-selected' : ''}`}><input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} /><span className="branch-monthly-report-check"><Check size={13} /></span><span>{label}</span></label>)}</div></div>
        {error ? <div className="branch-monthly-report-error" role="alert">{error}</div> : null}
        <footer className="branch-monthly-report-footer"><span>Excel format: `.xlsx` · Missing values use `-`</span><div><button type="button" className="branch-monthly-report-cancel" onClick={onClose} disabled={isDownloading}>Cancel</button><button type="submit" className="branch-monthly-report-download" disabled={isDownloading}>{isDownloading ? <><Loader2 className="is-spinning" size={17} /> Generating...</> : <><Download size={17} /> Download Excel</>}</button></div></footer>
      </form>
    </section>
  </div>
}
