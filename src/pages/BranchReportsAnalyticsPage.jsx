import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Search,
  Users,
} from 'lucide-react'

import { BranchAttendanceReportModal } from '../components/BranchAttendanceReportModal'
import { BranchMonthlyReportModal } from '../components/BranchMonthlyReportModal'
import { getBranchReportOptions, listReportBranches } from '../services/reportService'
import '../styles/BranchReportsAnalyticsPage.css'

const text = (value, fallback = '') => String(value ?? '').trim() || fallback

function isActiveAttendanceStudent(student = {}) {
  const lifecycleValues = [
    student.status,
    student.recordStatus,
    student.studentStatus,
    student.currentStatus,
    student.lifecycleStatus,
    student.studentLifecycleStatus,
    student.courseCompletion,
    student.courseCompletionStatus,
  ].map((value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_'))

  if (student.isDiscontinued === true || student.courseCompletedAt || student.completedAt) return false
  if (lifecycleValues.some((value) => value === 'DISCONTINUED' || value === 'COMPLETED' || value === 'COURSE_COMPLETED')) return false

  const enrollments = Array.isArray(student.courseEnrollments) ? student.courseEnrollments : []
  if (enrollments.length) {
    const hasActiveEnrollment = enrollments.some((entry) => {
      const status = String(entry?.status || entry?.recordStatus || '').trim().toUpperCase()
      return !['COMPLETED', 'DISCONTINUED'].includes(status) && !entry?.courseCompletedAt && !entry?.completedAt
    })
    if (!hasActiveEnrollment) return false
  }

  return true
}

function studentKey(student) {
  return text(student?.id || student?.studentId || student?.studentCode)
}

function batchKey(batch) {
  return text(batch?.id || batch?.batchId || batch?.batchCode)
}

function recordBranchId(record) {
  return text(record?.branchId || record?.branch?.id || record?.branchRecord?.id || record?.branchRecord?.branchId || record?.branchCode)
}

function flattenBatches(groups = []) {
  const rows = []
  for (const group of Array.isArray(groups) ? groups : []) {
    const groupBatches = Array.isArray(group?.batches) ? group.batches : []
    for (const batch of groupBatches) {
      const id = batchKey(batch)
      if (!id) continue
      rows.push({
        ...batch,
        id,
        batchId: text(batch?.batchId || id),
        batchName: text(batch?.batchName || batch?.name || batch?.batchId || id),
        courseName: text(batch?.courseName || group?.courseName || group?.name),
      })
    }
  }
  return [...new Map(rows.map((batch) => [batch.id, batch])).values()]
}

function SearchableReportPicker({ label, value, options, onChange, placeholder, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((option) => String(option.value) === String(value))
  const filteredOptions = options.filter((option) => String(option.label || '').toLowerCase().includes(query.trim().toLowerCase()))
  const displayValue = open ? query : (selected?.label || '')

  return (
    <div className="branch-report-picker">
      <span>{label}</span>
      <div className={`branch-report-search-picker ${open ? 'is-open' : ''}`}>
        <div className="branch-report-search-input-wrap">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={displayValue}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={`Search ${label.toLowerCase()}`}
            onFocus={() => { setOpen(true); setQuery('') }}
            onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
            onBlur={() => window.setTimeout(() => { setOpen(false); setQuery('') }, 120)}
          />
        </div>
        {open ? (
          <div className="branch-report-search-options" role="listbox" aria-label={`${label} options`}>
            {filteredOptions.length ? filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={String(option.value) === String(value)}
                className={String(option.value) === String(value) ? 'is-selected' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onChange(option.value); setOpen(false); setQuery('') }}
              >
                <span>{option.label}</span>
                {String(option.value) === String(value) ? <span className="branch-report-search-check">✓</span> : null}
              </button>
            )) : <p className="branch-report-search-empty">No matching {label.toLowerCase()} found.</p>}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function BranchReportsAnalyticsPage({ students = [], batchGroups = [], branchId = '', compactHeader = false }) {
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('all')
  const [remoteOptions, setRemoteOptions] = useState(null)
  const [optionsError, setOptionsError] = useState('')
  const [monthlyOpen, setMonthlyOpen] = useState(false)
  const [studentStatusOpen, setStudentStatusOpen] = useState(false)
  const [attendanceTarget, setAttendanceTarget] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState('')

  useEffect(() => {
    let active = true
    listReportBranches().then((items) => {
      if (!active) return
      const normalized = Array.isArray(items) ? items : []
      setBranches(normalized)
      if (!normalized.some((item) => String(item.id) === String(branchId))) setSelectedBranchId('all')
    }).catch((error) => { if (active) setOptionsError(error?.body?.message || error?.message || 'Unable to load branch filters.') })
    return () => { active = false }
  }, [branchId])

  useEffect(() => {
    if (!selectedBranchId || selectedBranchId === 'all') return undefined
    let active = true
    getBranchReportOptions(selectedBranchId).then((data) => { if (active) setRemoteOptions(data) }).catch((error) => { if (active) setOptionsError(error?.body?.message || error?.message || 'Unable to load selected branch data.') })
    return () => { active = false }
  }, [selectedBranchId])

  const activeStudents = useMemo(() => selectedBranchId === 'all' ? students : (remoteOptions?.students || []), [selectedBranchId, students, remoteOptions])
  const activeBatches = useMemo(() => selectedBranchId === 'all' ? batchGroups : [{ courseName: '', batches: remoteOptions?.batches || [] }], [selectedBranchId, batchGroups, remoteOptions])
  const reportBranchId = selectedBranchId === 'all' ? 'all' : selectedBranchId

  const studentOptions = useMemo(() => (
    (Array.isArray(activeStudents) ? activeStudents : [])
      .filter(isActiveAttendanceStudent)
      .map((student) => ({ ...student, id: studentKey(student) }))
      .filter((student) => student.id)
      .sort((a, b) => text(a.studentName).localeCompare(text(b.studentName)))
  ), [activeStudents])
  const batchOptions = useMemo(() => flattenBatches(activeBatches), [activeBatches])

  const effectiveStudentId = studentOptions.some((student) => student.id === selectedStudentId) ? selectedStudentId : studentOptions[0]?.id || ''
  const effectiveBatchId = batchOptions.some((batch) => batch.id === selectedBatchId) ? selectedBatchId : batchOptions[0]?.id || ''
  const selectedStudent = studentOptions.find((student) => student.id === effectiveStudentId) || null
  const selectedBatch = batchOptions.find((batch) => batch.id === effectiveBatchId) || null
  const selectedStudentBranchId = selectedBranchId === 'all' ? recordBranchId(selectedStudent) : selectedBranchId
  const selectedBatchBranchId = selectedBranchId === 'all' ? recordBranchId(selectedBatch) : selectedBranchId

  return (
    <section className="branch-reports-page" aria-labelledby="branch-reports-title">
      <header className="branch-reports-page-header">
        <div>
          {!compactHeader ? <p className="branch-reports-page-kicker">REPORTS &amp; ANALYTICS</p> : null}
          <h1 id="branch-reports-title">{compactHeader ? 'Reports & Analytics' : 'Report Downloads'}</h1>
          {!compactHeader ? <p>Download student and attendance reports with a branch filter in Excel format.</p> : null}
        </div>
        <div className="branch-reports-page-badge"><BarChart3 size={18} /> {selectedBranchId === 'all' ? 'All branches' : 'Selected branch'}</div>
      </header>

      <div className="branch-reports-filter-bar">
        <label><span>Branch</span><select value={selectedBranchId} onChange={(event) => { setSelectedBranchId(event.target.value); setOptionsError(''); setRemoteOptions(null); setSelectedStudentId(''); setSelectedBatchId('') }}><option value="all">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName || branch.branchId}</option>)}</select></label>
        {optionsError ? <span className="branch-reports-filter-error" role="alert">{optionsError}</span> : null}
      </div>

      <div className="branch-reports-card-grid">
        <article className="branch-report-download-card is-blue">
          <div className="branch-report-download-icon"><FileSpreadsheet size={20} aria-hidden="true" /></div>
          <div className="branch-report-download-copy"><h2>Student Monthly Report</h2><p>Monthly, yearly, custom range and all-record student collection report.</p></div>
          <button type="button" className="branch-report-download-button" onClick={() => setMonthlyOpen(true)}><Download size={16} /> Download</button>
        </article>

        <article className="branch-report-download-card is-green">
          <div className="branch-report-download-icon"><CheckCircle2 size={20} aria-hidden="true" /></div>
          <div className="branch-report-download-copy"><h2>Student Status Report</h2><p>Export completed, discontinued or all student status records.</p></div>
          <button type="button" className="branch-report-download-button" onClick={() => setStudentStatusOpen(true)}><Download size={16} /> Download</button>
        </article>

        <article className="branch-report-download-card is-purple">
          <div className="branch-report-download-icon"><Users size={20} aria-hidden="true" /></div>
          <div className="branch-report-download-copy"><h2>Student Attendance</h2><p>Choose a student and download attendance for a date range.</p></div>
          <div className="branch-report-card-action-row">
            <SearchableReportPicker label="Student" value={effectiveStudentId} onChange={setSelectedStudentId} options={studentOptions.map((student) => ({ value: student.id, label: `${text(student.studentName, student.studentId || student.id)}${student.studentId ? ` (${student.studentId})` : ''}` }))} placeholder="Search active student" disabled={!studentOptions.length} />
            <button type="button" className="branch-report-download-button" onClick={() => setAttendanceTarget({ mode: 'student', record: selectedStudent, branchId: selectedStudentBranchId })}><Download size={16} /> Download</button>
          </div>
        </article>

        <article className="branch-report-download-card is-amber">
          <div className="branch-report-download-icon"><CalendarDays size={20} aria-hidden="true" /></div>
          <div className="branch-report-download-copy"><h2>Batch Attendance</h2><p>Choose a batch and download attendance for a date range.</p></div>
          <div className="branch-report-card-action-row">
            <SearchableReportPicker label="Batch" value={effectiveBatchId} onChange={setSelectedBatchId} options={batchOptions.map((batch) => ({ value: batch.id, label: `${batch.batchName}${batch.courseName ? ` - ${batch.courseName}` : ''}` }))} placeholder="Search active batch" disabled={!batchOptions.length} />
            <button type="button" className="branch-report-download-button" onClick={() => setAttendanceTarget({ mode: 'batch', record: selectedBatch, branchId: selectedBatchBranchId })}><Download size={16} /> Download</button>
          </div>
        </article>

      </div>

      {selectedBranchId === 'all' ? <div className="branch-reports-page-note"><GraduationCap size={18} /><span>Select a specific branch to download student or batch attendance. Monthly and status reports support all branches.</span></div> : (!studentOptions.length || !batchOptions.length ? <div className="branch-reports-page-note"><GraduationCap size={18} /><span>Student and batch selectors become available when records are created for this branch.</span></div> : null)}

      <BranchMonthlyReportModal isOpen={monthlyOpen} onClose={() => setMonthlyOpen(false)} reportVariant="monthly" branchId={reportBranchId} />
      <BranchMonthlyReportModal isOpen={studentStatusOpen} onClose={() => setStudentStatusOpen(false)} reportVariant="student-status" branchId={reportBranchId} />
      <BranchAttendanceReportModal
        isOpen={Boolean(attendanceTarget)}
        mode={attendanceTarget?.mode || 'student'}
        record={attendanceTarget?.record || null}
        branchId={attendanceTarget?.branchId || (reportBranchId === 'all' ? '' : reportBranchId)}
        onClose={() => setAttendanceTarget(null)}
      />
    </section>
  )
}

