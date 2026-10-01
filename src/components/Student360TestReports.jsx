import { useEffect, useState } from 'react'
import { getBranchStudentSyllabusReports } from '../services/examService'
import { getBranchStudentAcademicReports } from '../services/academicTestService'

const completed = (value) => ['SUBMITTED', 'EVALUATED', 'COMPLETED', 'VALIDATED', 'PASS', 'FAIL'].includes(String(value || '').trim().toUpperCase())
const number = (value) => { const result = Number(value); return Number.isFinite(result) ? result : null }
const percent = (obtained, total) => total > 0 ? (obtained / total) * 100 : null
const displayPercent = (value) => value == null ? '-' : `${Number(value).toFixed(2).replace(/\.00$/, '')}%`
const displayDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
const unwrap = (value) => Array.isArray(value) ? value : value?.items || value?.results || value?.tests || value?.reports || []
const isBusinessAnalytics = (item = {}) => String(item.courseName || item.course?.name || '').trim().toLowerCase() === 'business analytics'

function score(item = {}) {
  const source = item.final || (item.result && typeof item.result === 'object' ? item.result : item)
  const marks = source.marks || source.score || {}
  const obtained = number(source.marksObtained ?? source.obtainedMarks ?? marks.obtained ?? marks.marksObtained)
  const total = number(source.totalMarks ?? marks.total ?? marks.totalMarks)
  return { obtained, total, percentage: number(source.percentage) ?? percent(obtained, total) }
}

function summary(items) {
  const scored = items.map(score).filter((item) => item.obtained != null && item.total > 0)
  const obtained = scored.reduce((sum, item) => sum + item.obtained, 0)
  const total = scored.reduce((sum, item) => sum + item.total, 0)
  return { count: scored.length, obtained, total, percentage: percent(obtained, total) }
}

// Retained for backwards-compatible styling/data helpers; summary cards are no longer rendered here.
// eslint-disable-next-line no-unused-vars
function ProgressSummary({ title, summary: result, items = [] }) {
  const width = Math.min(100, Math.max(0, result.percentage || 0))
  const groups = [...new Set(items.map((item) => item.module || item.subject || item.moduleName || item.courseName || item.course?.name).filter(Boolean))]
  return <div className="student360-report-summary"><div><span>{title}</span><strong>{result.obtained} / {result.total}</strong></div><div className="student360-report-summary-meta"><span>{displayPercent(result.percentage)}</span><small>{result.count} completed test{result.count === 1 ? '' : 's'}</small></div><div className="student360-report-progress"><span style={{ width: `${width}%` }} /></div>{groups.length ? <div className="student360-report-groups">{groups.map((group) => { const groupItems = items.filter((item) => (item.module || item.subject || item.moduleName || item.courseName || item.course?.name) === group); const groupResult = summary(groupItems); return <div key={group}><span>{group}</span><strong>{groupResult.obtained} / {groupResult.total} · {displayPercent(groupResult.percentage)}</strong></div> })}</div> : null}</div>
}

function ReportSection({ title, description, loading, error, items, columns, empty }) {
  return <section className="student360-card student360-report-card"><div className="student360-card-heading"><div><h2>{title}</h2><p>{description}</p></div></div>{loading ? <div className="student360-no-data">Loading report data...</div> : error ? <div className="student360-no-data student360-report-error">{error}</div> : items.length ? <div className="student360-report-table-wrap"><table className="student360-report-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{items.map((item, index) => <tr key={item.id || item.testId || `${item.name}-${index}`}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(item) : item[column.key] || '-'}</td>)}</tr>)}</tbody></table></div> : <div className="student360-no-data">{empty}</div>}</section>
}

export function Student360TestReports({ studentId, branchId = '' }) {
  const [syllabus, setSyllabus] = useState({ items: [], loading: true, error: '' })
  const [academic, setAcademic] = useState({ items: [], loading: true, error: '' })

  useEffect(() => {
    if (!studentId) return undefined
    let active = true
    setSyllabus({ items: [], loading: true, error: '' })
    getBranchStudentSyllabusReports(studentId, branchId).then((response) => {
      if (!active) return
      const items = unwrap(response).filter((item) => completed(item.status || item.resultStatus || item.submissionStatus || item.final?.status) && score(item).obtained != null)
      setSyllabus({ items, loading: false, error: '' })
    }).catch((error) => active && setSyllabus({ items: [], loading: false, error: error.message || 'Unable to load syllabus test results.' }))
    setAcademic({ items: [], loading: true, error: '' })
    getBranchStudentAcademicReports(studentId, branchId).then((response) => {
      if (!active) return
      const items = unwrap(response).filter((item) => !isBusinessAnalytics(item) && completed(item.status || item.validationStatus || item.result?.status || item.final?.status) && score(item).obtained != null)
      setAcademic({ items, loading: false, error: '' })
    }).catch((error) => active && setAcademic({ items: [], loading: false, error: error.message || 'Unable to load academic test results.' }))
    return () => { active = false }
  }, [branchId, studentId])

  const syllabusColumns = [{ key: 'name', label: 'Test', render: (item) => item.testName || item.name || item.title }, { key: 'module', label: 'Module / Subject', render: (item) => item.module || item.subject || item.moduleName }, { key: 'marks', label: 'Marks', render: (item) => { const value = score(item); return `${value.obtained}/${value.total}` } }, { key: 'percentage', label: 'Percentage', render: (item) => displayPercent(score(item).percentage) }, { key: 'status', label: 'Status', render: () => 'Completed' }]
  const academicColumns = [{ key: 'name', label: 'Test Name', render: (item) => item.testName || item.name || item.title }, { key: 'course', label: 'Course', render: (item) => item.courseName || item.course?.name }, { key: 'batch', label: 'Batch', render: (item) => item.batchName || item.batch?.batchName }, { key: 'type', label: 'Test Type', render: (item) => item.testType || item.type }, { key: 'date', label: 'Test Date', render: (item) => displayDate(item.testDate || item.date || item.completedAt) }, { key: 'marks', label: 'Marks', render: (item) => { const value = score(item); return `${value.obtained}/${value.total}` } }, { key: 'percentage', label: 'Percentage', render: (item) => displayPercent(score(item).percentage) }, { key: 'result', label: 'Pass / Fail', render: (item) => item.result || item.passFail || '-' }, { key: 'project', label: 'Project %', render: (item) => displayPercent(number(item.projectPercentage ?? item.project?.percentage)) }]
  return <div className="student360-test-reports"><ReportSection title="Syllabus-wise Test" description="Completed syllabus tests for this student." loading={syllabus.loading} error={syllabus.error} items={syllabus.items} columns={syllabusColumns} empty="No completed syllabus tests available." /><ReportSection title="Academic Test" description="Completed and validated academic test results for this student." loading={academic.loading} error={academic.error} items={academic.items} columns={academicColumns} empty="No completed academic tests available." /></div>
}
