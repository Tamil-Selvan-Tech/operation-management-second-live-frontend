import { useMemo, useState } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { PaginationBar } from './PaginationBar'

const PAGE_SIZE = 5
const branchFilterMetrics = new Set(['admissions', 'total-payment', 'month-payment', 'outstanding', 'month-due', 'today-due', 'overdue', 'today-collection'])
const money = (value) => { const amount = Number(value); return `₹${(Number.isFinite(amount) ? amount : 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` }
const text = (value) => String(value ?? '').trim()
const dateKey = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? text(value).slice(0, 10) : date.toISOString().slice(0, 10)
}
const monthKey = (value) => dateKey(value).slice(0, 7)

function studentBranch(student) {
  return student.branchRecord?.branchName || student.branchName || student.branchId || '-'
}

function studentTotal(student) {
  return Number(student.courseAmount || student.totalFees || 0)
}

function studentPaid(student) {
  if (Array.isArray(student.payments) && student.payments.length) return student.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const installments = student.installmentSchedule || student.installments
  return Array.isArray(installments) ? installments.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0) : 0
}

function buildRows(metric, students, branches, period = {}) {
  const now = new Date()
  const today = dateKey(now)
  const periodStart = period.startDate || `${monthKey(now)}-01`
  const periodEnd = period.endDate || today
  const inPeriod = (value) => { const key = dateKey(value); return key && key >= periodStart && key <= periodEnd }
  if (metric === 'branches') return branches.map((branch) => {
    const rows = students.filter((student) => String(student.branchId || '').toLowerCase() === String(branch.id || branch.branchId || '').toLowerCase())
    return { id: branch.id || branch.branchId, branch: branch.branchName || branch.name || '-', students: rows.length, collected: money(rows.reduce((sum, item) => sum + studentPaid(item), 0)), outstanding: money(rows.reduce((sum, item) => sum + Math.max(studentTotal(item) - studentPaid(item), 0), 0)), status: branch.status || 'Active' }
  })
  if (metric === 'students') return students.map((student) => ({ id: student.id || student.studentId, student: student.studentName || student.name || '-', studentId: student.studentId || '-', branch: studentBranch(student), course: student.courseName || '-', batch: student.batchName || '-', status: student.recordStatus || student.currentStatus || 'Active' }))
  if (metric === 'admissions') return students.filter((student) => inPeriod(student.admissionDate || student.createdAt)).map((student) => {
    const enrollmentRecords = Array.isArray(student.courseEnrollments) ? student.courseEnrollments : []
    const enrollmentCount = enrollmentRecords.length
    const enrollmentArrangement = enrollmentRecords.find((entry) => entry?.arrangementType)?.arrangementType
    const arrangement = student.arrangementType || enrollmentArrangement || student.enrollmentType || (enrollmentCount > 1 ? 'PARALLEL' : 'SINGLE')
    const courseRecords = enrollmentRecords.filter((entry) => entry?.courseName || entry?.course?.name || entry?.name)
    const courseNames = courseRecords.map((entry) => entry.courseName || entry.course?.name || entry.name)
    const facultyNames = courseRecords.map((entry) => entry.facultyName || entry.faculty?.name || student.facultyName || '-')
    return { id: student.id, student: [student.studentName || '-', student.studentId || '-'], studentId: student.studentId || '-', branch: studentBranch(student), course: courseNames.length ? courseNames : [student.courseName || '-'], faculty: facultyNames.length ? facultyNames : [student.facultyName || '-'], enrollmentType: text(arrangement).toUpperCase(), admissionDate: dateKey(student.admissionDate || student.createdAt) }
  })
  if (['total-payment', 'month-payment', 'today-collection'].includes(metric)) {
    const paymentRows = students.flatMap((student) => (student.payments || []).filter((payment) => metric === 'total-payment' || (metric === 'today-collection' ? dateKey(payment.paymentDate) === today : inPeriod(payment.paymentDate))).map((payment) => ({ id: payment.id || `${student.id}-${payment.paymentDate}`, student: student.studentName || '-', studentId: student.studentId || '-', branch: studentBranch(student), amount: money(payment.amount), date: dateKey(payment.paymentDate), mode: payment.paymentMode || '-', receipt: payment.receiptNumber || '-' })))
    return [...new Map(paymentRows.map((row) => [`${row.studentId}|${row.date}|${row.amount}|${row.mode}`, row])).values()]
  }
  const installmentRows = students.flatMap((student) => (student.installmentSchedule || student.installments || []).map((installment) => ({ id: installment.id || `${student.id}-${installment.installmentNumber}`, student: student.studentName || '-', studentId: student.studentId || '-', branch: studentBranch(student), installment: installment.installmentNumber || '-', dueDate: dateKey(installment.dueDate), amount: Number(installment.amount || 0), paid: Number(installment.amountPaid || 0), pending: Math.max(Number(installment.amount || 0) - Number(installment.amountPaid || 0), 0) })))
  if (metric === 'outstanding') return students.map((student) => ({ id: student.id, student: student.studentName || '-', studentId: student.studentId || '-', branch: studentBranch(student), total: money(studentTotal(student)), paid: money(studentPaid(student)), outstanding: money(Math.max(studentTotal(student) - studentPaid(student), 0)) })).filter((row) => row.outstanding !== '₹0')
  const dueRows = installmentRows.filter((row) => row.pending > 0)
  if (metric === 'month-due') return dueRows.filter((row) => inPeriod(row.dueDate))
  if (metric === 'today-due') return dueRows.filter((row) => row.dueDate === periodEnd)
  if (metric === 'overdue') return dueRows.filter((row) => row.dueDate && row.dueDate < today)
  if (metric === 'due-students') return [...new Map(dueRows.map((row) => [row.studentId, row])).values()]
  return []
}

const configs = {
  branches: ['Total Branches', ['branch', 'students', 'collected', 'outstanding', 'status']], students: ['Total Students', ['student', 'studentId', 'branch', 'course', 'batch', 'status']], admissions: ['Admissions', ['student', 'branch', 'course', 'faculty', 'enrollmentType', 'admissionDate']],
  'total-payment': ['Total Payment Collected', ['student', 'studentId', 'branch', 'amount', 'date', 'mode']], 'month-payment': ['This Month Payment', ['student', 'studentId', 'branch', 'amount', 'date', 'mode']], 'today-collection': ["Today's Collection", ['student', 'studentId', 'branch', 'amount', 'date', 'mode']],
  outstanding: ['Total Outstanding', ['student', 'studentId', 'branch', 'total', 'paid', 'outstanding']], 'month-due': ['This Month Due', ['student', 'studentId', 'branch', 'installment', 'dueDate', 'pending']], 'today-due': ["Today's Due", ['student', 'studentId', 'branch', 'installment', 'dueDate', 'pending']], overdue: ['Overdue Amount', ['student', 'studentId', 'branch', 'installment', 'dueDate', 'pending']], 'due-students': ['Due Students', ['student', 'studentId', 'branch', 'installment', 'dueDate', 'pending']],
}

function label(key) { return ({ student: 'Student', studentId: 'Student ID', branch: 'Branch', course: 'Course', faculty: 'Faculty', batch: 'Batch', enrollmentType: 'Course Selection', status: 'Status', students: 'Students', collected: 'Collected', outstanding: 'Outstanding', admissionDate: 'Admission Date', amount: 'Amount', date: 'Payment Date', mode: 'Mode', receipt: 'Receipt', total: 'Total', paid: 'Paid', installment: 'Installment', dueDate: 'Due Date', pending: 'Pending' })[key] || key }
function enrollmentLabel(value) { const normalized = text(value).toUpperCase(); return normalized === 'SINGLE' ? 'Single course' : normalized === 'PARALLEL' ? 'Parallel courses' : normalized === 'SEQUENTIAL' ? 'Sequential courses' : value || '-' }
function displayDate(value) { const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})/); return match ? `${match[3]}-${match[2]}-${match[1]}` : value || '-' }
function rowMatchesSearch(row, query) {
  const needle = text(query).toLowerCase()
  if (!needle) return true
  return [row.student, row.studentId, row.branch, row.course, row.faculty, row.batch]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .some((value) => text(value).toLowerCase().includes(needle))
}

export function SuperAdminMetricDetailPage({ metric, students = [], branches = [], isLoading = false, onBack, startDate = '', endDate = '' }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [title, columns] = configs[metric] || configs.students
  const rows = useMemo(() => buildRows(metric, students, branches, { startDate, endDate }), [metric, students, branches, startDate, endDate])
  const filtered = rows.filter((row) => rowMatchesSearch(row, query) && (status === 'all' || text(row.status).toLowerCase() === status) && (branchFilter === 'all' || text(row.branch).toLowerCase() === text(branchFilter).toLowerCase()))
  const filteredAmount = filtered.reduce((sum, row) => sum + (Number(String(row.amount || '').replace(/[^0-9.-]/g, '')) || 0), 0)
  const filteredOutstanding = filtered.reduce((sum, row) => sum + (Number(String(row.outstanding || '').replace(/[^0-9.-]/g, '')) || 0), 0)
  const highlightedColumn = ['month-payment', 'today-collection'].includes(metric) ? 'amount' : metric === 'outstanding' ? 'outstanding' : ''
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleRows = filtered.slice((Math.min(page, pageCount) - 1) * PAGE_SIZE, Math.min(page, pageCount) * PAGE_SIZE)
  return <section className="super-admin-metric-detail">
    <div className="super-admin-global-header"><div><button type="button" className="super-admin-detail-back" onClick={onBack}><ArrowLeft size={16} /> Back to dashboard</button><p className="branch-management-kicker">Dashboard details</p><h1>{title}</h1><p>Real-time records from all active branches.</p></div><div className="super-admin-global-header-actions"><label className="super-admin-student-search"><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search details" aria-label="Search details" /></label>{branchFilterMetrics.has(metric) ? <select className="super-admin-detail-status super-admin-detail-branch-filter" value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setPage(1) }} aria-label="Filter by branch"><option value="all">All branches</option>{branches.map((branch) => <option key={branch.id || branch.branchId} value={branch.branchName || branch.name}>{branch.branchName || branch.name || branch.branchId}</option>)}</select> : null}{['students', 'branches'].includes(metric) ? <select className="super-admin-detail-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></select> : null}{['month-payment', 'today-collection', 'outstanding'].includes(metric) ? <span className="super-admin-detail-total">Total: {money(metric === 'outstanding' ? filteredOutstanding : filteredAmount)}</span> : null}<span className="super-admin-global-count">{filtered.length} {metric === 'admissions' ? 'admissions' : 'records'}</span></div></div>
    <div className="super-admin-detail-card">{isLoading ? <div className="super-admin-detail-empty">Loading real data…</div> : !visibleRows.length ? <div className="super-admin-detail-empty">No records found.</div> : <><div className="super-admin-detail-table-wrap"><table className="super-admin-detail-table"><thead><tr>{columns.map((column) => <th key={column} className={column === highlightedColumn ? 'is-highlighted-amount' : ''}>{label(column)}</th>)}</tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id || JSON.stringify(row)}>{columns.map((column) => { const value = row[column]; const currency = column === 'pending' || column === 'amount' || column === 'paid' || column === 'total'; return <td key={column} className={column === highlightedColumn ? 'is-highlighted-amount' : ''}>{(column === 'course' || column === 'faculty' || column === 'student') && Array.isArray(value) ? <div className="super-admin-detail-multiline">{value.map((item, itemIndex) => <span key={`${item}-${itemIndex}`}>{item}</span>)}</div> : column === 'enrollmentType' ? enrollmentLabel(value) : column === 'admissionDate' || column === 'dueDate' || column === 'date' ? displayDate(value) : currency ? (typeof value === 'string' && value.startsWith('₹') ? value : money(value)) : value || '-'}</td> })}</tr>)}</tbody></table></div>{filtered.length > PAGE_SIZE ? <PaginationBar className="super-admin-pagination" currentPage={Math.min(page, pageCount)} totalPages={pageCount} onPageChange={setPage} label="Detail pagination" previousLabel="Prev" nextLabel="Next" visiblePageCount={3} /> : null}</>}</div>
  </section>
}
