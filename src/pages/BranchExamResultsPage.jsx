import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { listBranchReportShares } from '../services/examService'
import { request } from '../services/apiClient'
import '../styles/FacultyExamReports.css'
import '../styles/SuperAdminDashboardPage.css'

function parseMarks(value) {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
  return match ? { obtained: Number(match[1]), total: Number(match[2]) } : null
}

function reportSummary(items = [], type) {
  const evaluated = items.map((item) => ({ item, marks: parseMarks(item.marks) })).filter(({ item, marks }) => marks && (type === 'test' ? item.status === 'SUBMITTED' : item.status === 'EVALUATED'))
  const obtained = evaluated.reduce((sum, row) => sum + row.marks.obtained, 0)
  const total = evaluated.reduce((sum, row) => sum + row.marks.total, 0)
  const notAttended = items.length > 0 && items.every((item) => ['NOT_ATTEMPTED', 'NOT_SUBMITTED'].includes(item.status))
  return { obtained, total, percentage: total ? (obtained / total) * 100 : null, notAttended }
}

function ReportCell({ items, type }) {
  return <div className="branch-report-cell">{items.length ? items.map((item, index) => { const evaluated = ['SUBMITTED', 'EVALUATED'].includes(item.status); const notAttended = ['NOT_ATTEMPTED', 'NOT_SUBMITTED'].includes(item.status); return <div key={`${item.module}-${index}`}><span>{type === 'test' ? item.testName : item.assessmentName}: {notAttended ? 'Not Attended' : evaluated ? item.marks : '-'}</span>{evaluated && <small>{item.percentage != null ? `${Number(item.percentage).toFixed(2)}%` : '-'}</small>}</div> }) : <span>-</span>}</div>
}

function ReportTypeFilterSelect({ value, options, onChange, ariaLabel, width = 145 }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const selectedOption = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [isOpen])

  return (
    <div ref={containerRef} className={`super-admin-branch-filter branch-report-type-filter ${isOpen ? 'is-open' : ''}`.trim()} style={{ width: `${width}px` }}>
      <button type="button" className="super-admin-branch-filter-trigger" aria-label={ariaLabel} aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
        <span>{selectedOption?.label || 'Select'}</span>
        <ChevronDown size={15} strokeWidth={2.2} aria-hidden="true" />
      </button>
      {isOpen ? <div className="super-admin-branch-filter-menu" role="listbox" aria-label={ariaLabel}>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={`super-admin-branch-filter-option ${option.value === value ? 'is-selected' : ''}`.trim()} onClick={() => { onChange(option.value); setIsOpen(false) }}>{option.label}</button>)}</div> : null}
    </div>
  )
}

function StudentReportsView({ share, branchId, onBack }) {
  const [data, setData] = useState(null)
  const [activeReport, setActiveReport] = useState('test')
  const [studentPage, setStudentPage] = useState(1)
  const [error, setError] = useState('')
  useEffect(() => {
    request(`/exams/branch-admin/report-shares/${share.id}/students`, {
      ...(branchId ? { impersonateBranchId: branchId } : {}),
    }).then((response) => setData(response?.data ?? response)).catch((e) => setError(e.message))
  }, [branchId, share.id])
  const pageSize = 3
  const totalPages = Math.max(1, Math.ceil((data?.students?.length || 0) / pageSize))
  const visibleStudents = data?.students?.slice((studentPage - 1) * pageSize, studentPage * pageSize) || []
  return <div className="branch-student-reports-view"><button type="button" className="exam-back branch-student-reports-back" onClick={onBack}><ArrowLeft size={16} /> Back to Shared Reports</button><div className="faculty-reports-tabs branch-student-report-tabs"><button type="button" className={activeReport === 'test' ? 'is-active' : ''} onClick={() => { setActiveReport('test'); setStudentPage(1) }}>Test Report</button><button type="button" className={activeReport === 'assessment' ? 'is-active' : ''} onClick={() => { setActiveReport('assessment'); setStudentPage(1) }}>Assessment Report</button></div>{error && <div className="exam-error">{error}</div>}{!data && !error ? <p className="exam-muted">Loading student reports...</p> : null}{data?.students?.length ? <><div className="exam-table-wrap branch-inline-student-table-wrap"><table className="branch-inline-student-table"><thead><tr><th>Student Name</th><th>Module Name</th>{activeReport === 'test' ? <><th>Total Tests</th><th>Test Report</th><th>Overall Test Marks</th><th>Overall Test Percentage</th></> : <><th>Total Assessments</th><th>Assessment Report</th><th>Overall Assessment Marks</th><th>Overall Assessment Percentage</th></>}</tr></thead><tbody>{visibleStudents.flatMap((student) => { const items = activeReport === 'test' ? (student.tests || []) : (student.assessments || []); const modules = [...new Set(items.map((item) => item.module).filter(Boolean))].sort((a, b) => { const left = String(a).toLowerCase(); const right = String(b).toLowerCase(); if (left === 'html') return -1; if (right === 'html') return 1; return left.localeCompare(right) }); const moduleRows = modules.length ? modules : ['-']; return moduleRows.map((moduleName) => { const moduleItems = moduleName === '-' ? items : items.filter((item) => item.module === moduleName); const summary = reportSummary(moduleItems, activeReport); const overallMarks = summary.total ? `${summary.obtained} / ${summary.total}` : summary.notAttended ? 'Not Attended' : '-'; const overallPercentage = summary.percentage != null ? `${summary.percentage.toFixed(2)}%` : summary.notAttended ? 'Not Attended' : '-'; return <tr key={`${student.studentId}-${activeReport}-${moduleName}`}><td><strong>{student.studentName}</strong><small>{student.studentId || '-'}</small></td><td>{moduleName}</td><td>{moduleItems.length || '-'}</td><td className="branch-report-active-cell"><ReportCell items={moduleItems} type={activeReport} /></td><td><strong>{overallMarks}</strong></td><td><strong className="branch-report-percentage">{overallPercentage}</strong></td></tr> })})}</tbody></table></div><div className="branch-student-pagination"><span>Page {studentPage} of {totalPages}</span><div><button type="button" disabled={studentPage === 1} onClick={() => setStudentPage((page) => page - 1)}>Previous</button><button type="button" disabled={studentPage === totalPages} onClick={() => setStudentPage((page) => page + 1)}>Next</button></div></div></> : data && <p className="exam-muted">No students found for this batch.</p>}</div>
}

export default function BranchExamResultsPage({ branchId = '' }) {
  const [shares, setShares] = useState([])
  const [selected, setSelected] = useState(null)
  const [sharePage, setSharePage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [reportTypeFilter, setReportTypeFilter] = useState('all')
  useEffect(() => {
    listBranchReportShares(branchId).then(setShares).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [branchId])
  const sharePageSize = 5
  const filteredShares = useMemo(() => shares
    .filter((share) => {
      const query = appliedSearch.trim().toLowerCase()
      if (!query) return true
      return `${share.batch?.batchName || ''} ${share.batch?.batchId || ''} ${share.course?.name || ''}`.toLowerCase().includes(query)
    })
    .filter((share) => reportTypeFilter === 'all' || String(share.reportType || share.type || 'test').toLowerCase() === reportTypeFilter)
    .sort((left, right) => {
      return String(right.sentAt || '').localeCompare(String(left.sentAt || ''))
    }), [appliedSearch, reportTypeFilter, shares])
  const shareTotalPages = Math.max(1, Math.ceil(filteredShares.length / sharePageSize))
  const visibleShares = filteredShares.slice((sharePage - 1) * sharePageSize, sharePage * sharePageSize)
  return (
    <section className="exam-reports-page branch-exam-results-page">
      <div className="exam-reports-header"><div><p className="exam-kicker">BRANCH ADMIN WORKSPACE</p><h1>Exams &amp; Results</h1><p>Faculty-shared test and assessment reports for your branch.</p></div></div>
      {error && <div className="exam-error">{error}</div>}
      <div className="exam-card exam-reports-table-card">
        <div className="exam-card-heading"><h2>{selected ? 'Student Reports' : 'Shared Reports'}</h2></div>
        {selected ? <StudentReportsView share={selected} branchId={branchId} onBack={() => setSelected(null)} /> : (
          <>
            <div className="branch-report-toolbar">
              <label className="branch-report-search"><span>Search Batch</span><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setAppliedSearch(search.trim()); setSharePage(1) } }} placeholder="Batch name or batch ID" /></label>
              <button type="button" className="button button-solid branch-report-search-button" onClick={() => { setAppliedSearch(search.trim()); setSharePage(1) }}>Search</button>
              <div className="branch-report-filter"><ReportTypeFilterSelect value={reportTypeFilter} ariaLabel="Filter reports by type" options={[{ value: 'all', label: 'All types' }, { value: 'test', label: 'Test' }, { value: 'assessment', label: 'Assessment' }]} onChange={(value) => { setReportTypeFilter(value); setSharePage(1) }} /></div>
            </div>
            <div className="exam-table-wrap">
              <table>
                <thead><tr><th>Batch</th><th>Course</th><th>Module</th><th>Sent By</th><th>Sent At</th><th>Action</th></tr></thead>
                <tbody>
                  {loading ? Array.from({ length: 5 }, (_, index) => <tr key={`report-loading-${index}`} className="branch-report-skeleton-row" aria-hidden="true">{Array.from({ length: 6 }, (_, cellIndex) => <td key={cellIndex}><span /></td>)}</tr>) : filteredShares.length ? visibleShares.map((share) => <tr key={share.id}><td>{share.batch?.batchName || '-'}</td><td>{share.course?.name || '-'}</td><td>{share.moduleNames?.join(', ') || '-'}</td><td>{share.faculty?.fullName || '-'}</td><td>{share.sentAt ? new Date(share.sentAt).toLocaleString() : '-'}</td><td><button type="button" className="exam-link" onClick={() => setSelected(share)}>View Students</button></td></tr>) : <tr><td colSpan="6" className="exam-empty">{appliedSearch || reportTypeFilter !== 'all' ? 'No reports match the selected search or filters.' : 'No reports shared yet.'}</td></tr>}
                </tbody>
              </table>
            </div>
            {filteredShares.length > sharePageSize && <div className="branch-student-pagination"><span>Page {sharePage} of {shareTotalPages}</span><div><button type="button" disabled={sharePage === 1} onClick={() => setSharePage((page) => page - 1)}>Previous</button><button type="button" disabled={sharePage === shareTotalPages} onClick={() => setSharePage((page) => page + 1)}>Next</button></div></div>}
          </>
        )}
      </div>
    </section>
  )
}
