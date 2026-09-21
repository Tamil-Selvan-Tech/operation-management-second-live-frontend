import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Wallet,
} from 'lucide-react'

import './Student360Page.css'

function displayValue(value, fallback = '-') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return displayValue(value)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) return '-'
  return `₹${amount.toLocaleString('en-IN')}`
}

function getStudentKeys(student = {}) {
  return [student.id, student._id, student.studentId, student.recordId]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
}

function getPaymentSchedule(student = {}) {
  if (Array.isArray(student.installmentSchedule) && student.installmentSchedule.length) {
    return student.installmentSchedule
  }

  if (Array.isArray(student.paymentPlan?.installments) && student.paymentPlan.installments.length) {
    return student.paymentPlan.installments
  }

  return [1, 2, 3, 4]
    .map((number) => ({
      number,
      amount: student[`installment${number}`],
      dueDate: number === 1 ? student.firstInstallmentDate : student[`${number === 2 ? 'secondDueDate' : number === 3 ? 'thirdDueDate' : 'fourthDueDate'}`],
      status: student[`${number === 1 ? 'first' : number === 2 ? 'second' : number === 3 ? 'third' : 'fourth'}InstallmentStatus`] || 'Pending',
    }))
    .filter((item) => item.amount || item.dueDate)
}

function getAttendanceEntries(student = {}) {
  const entries = []
  const sources = [student.attendanceRecords, student.records, student.attendanceHistory]
  sources.forEach((source) => {
    if (!Array.isArray(source)) return
    source.forEach((entry) => entries.push(entry))
  })

  ;[student.attendanceByDate, student.calendarAttendance].forEach((source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return
    Object.entries(source).forEach(([date, value]) => {
      entries.push({ date, status: typeof value === 'string' ? value : value?.status || value?.attendanceStatus })
    })
  })

  const byDate = new Map()
  entries.forEach((entry) => {
    const date = String(entry?.attendanceDate || entry?.dateKey || entry?.date || entry?.day || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    const rawStatus = String(entry?.status || entry?.attendanceStatus || entry?.result || '').trim().toLowerCase()
    const status = rawStatus === 'present'
      ? 'present'
      : rawStatus === 'absent'
        ? 'absent'
        : ['leave', 'excused', 'holiday'].includes(rawStatus)
          ? 'excused'
          : ''
    if (status) byDate.set(date, { date, status })
  })
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
}

function getCurrentMonthAttendanceCells(attendanceEntries = []) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const statusByDate = new Map(attendanceEntries.map((entry) => [entry.date, entry.status]))

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { date, day, status: statusByDate.get(date) || 'unmarked' }
  })
}

function DetailItem({ label, value, icon: Icon }) {
  return (
    <div className="student360-detail-item">
      {Icon ? <span className="student360-detail-icon"><Icon size={16} strokeWidth={2} aria-hidden="true" /></span> : null}
      <div>
        <span>{label}</span>
        <strong>{displayValue(value)}</strong>
      </div>
    </div>
  )
}

function SectionCard({ title, description, children, className = '', id }) {
  return (
    <section id={id} className={`student360-card ${className}`.trim()}>
      <div className="student360-card-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

export function Student360Page({
  student = null,
  branch = null,
  paymentHistory = [],
  onBack,
  onEdit,
  onViewCalendar,
  onDownloadPaymentReceipt,
}) {
  if (!student) {
    return (
      <section className="student360-page student360-empty-state">
        <button type="button" className="student360-back-button" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" /> Back to Students
        </button>
        <div className="student360-empty-card">
          <UserRound size={28} aria-hidden="true" />
          <h1>Student profile unavailable</h1>
          <p>The selected student could not be found in this branch.</p>
        </div>
      </section>
    )
  }

  const studentName = displayValue(student.studentName, 'Student')
  const studentKeys = getStudentKeys(student)
  const schedule = getPaymentSchedule(student)
  const attendanceEntries = getAttendanceEntries(student)
  const attendanceCells = getCurrentMonthAttendanceCells(attendanceEntries)
  const totalFee = Number(student.finalFee ?? student.courseAmount ?? student.totalAmount ?? student.afterDiscount ?? 0)
  const paidAmount = schedule.length
    ? schedule.reduce((sum, item) => sum + Number(item.paidAmount ?? item.amountPaid ?? 0), 0)
    : Number(student.paidAmount ?? student.totalPaid ?? student.amountPaid ?? 0)
  const feeProgress = totalFee > 0 ? Math.min(100, Math.max(0, (paidAmount / totalFee) * 100)) : 0
  const studentPayments = paymentHistory.filter((payment) => {
    const paymentKeys = getStudentKeys({ studentId: payment.studentId })
    return paymentKeys.some((key) => studentKeys.includes(key))
  })
  const ledgerEntries = studentPayments.length
    ? studentPayments
    : schedule
      .filter((item) => Number(item.paidAmount ?? item.amountPaid ?? 0) > 0 || String(item.status || '').toLowerCase() === 'paid')
      .map((item, index) => ({
        id: item.id || `installment-${index + 1}`,
        amount: item.paidAmount ?? item.amountPaid ?? item.amount,
        date: item.paidDate || item.paymentDate || item.date,
        paymentMode: item.paymentMode || item.mode,
        installmentNumber: item.installmentNumber || item.number || index + 1,
      }))
  const attendanceSummary = attendanceEntries.reduce((summary, entry) => {
    summary[entry.status] += 1
    return summary
  }, { present: 0, absent: 0, excused: 0 })
  const attendanceMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const initials = studentName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const status = displayValue(student.status || student.currentStatus, 'Active')

  return (
    <main className="student360-page">
      <div className="student360-page-toolbar">
        <button type="button" className="student360-back-button" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" /> Back to Students
        </button>
        <span className="student360-breadcrumb">Students / Student 360°</span>
      </div>

      <section className="student360-profile-card">
        <div className="student360-avatar" aria-hidden="true">{initials || 'ST'}</div>
        <div className="student360-profile-main">
          <div className="student360-eyebrow">STUDENT 360° PROFILE</div>
          <div className="student360-title-row">
            <div>
              <h1>{studentName}</h1>
              <p>{displayValue(student.studentId)} · {displayValue(student.courseInterested || student.courseName, 'Course not assigned')}</p>
            </div>
            <span className="student360-status"><span />{status}</span>
          </div>
          <div className="student360-meta-row">
            <span><BookOpen size={15} aria-hidden="true" />{displayValue(student.courseInterested || student.courseName, 'Course not assigned')}</span>
            <span><GraduationCap size={15} aria-hidden="true" />{displayValue(student.batchName || student.batch, 'Batch not assigned')}</span>
            <span><UserRound size={15} aria-hidden="true" />{displayValue(student.facultyName, 'Faculty not assigned')}</span>
            <span><MapPin size={15} aria-hidden="true" />{displayValue(branch?.branchName || branch?.name, 'Current branch')}</span>
          </div>
        </div>
        <div className="student360-profile-actions">
          <button type="button" className="student360-secondary-button" onClick={() => onViewCalendar?.(student)}><CalendarDays size={16} /> Calendar</button>
          <button type="button" className="student360-secondary-button" onClick={() => onDownloadAttendance?.(student)}><Download size={16} /> Attendance</button>
          <button type="button" className="student360-primary-button" onClick={() => onEdit?.(student)}><Edit3 size={16} /> Edit Student</button>
        </div>
      </section>

      <div className="student360-tab-strip" role="tablist" aria-label="Student profile sections">
        <a href="#overview" className="is-active" role="tab">Overview</a>
        <a href="#personal" role="tab">Personal</a>
        <a href="#enrollment" role="tab">Enrollment</a>
        <a href="#payments" role="tab">Fees & Payments</a>
      </div>

      <section id="overview" className="student360-summary-grid">
        <article className="student360-summary-card"><span className="student360-summary-icon blue"><BookOpen size={19} /></span><div><span>Course</span><strong>{displayValue(student.courseInterested || student.courseName)}</strong><small>{displayValue(student.courseMode, 'Mode not set')}</small></div></article>
        <article className="student360-summary-card"><span className="student360-summary-icon cyan"><GraduationCap size={19} /></span><div><span>Batch</span><strong>{displayValue(student.batchName || student.batch)}</strong><small>{displayValue(student.batchTiming || student.classSchedule, 'Schedule not set')}</small></div></article>
        <article className="student360-summary-card"><span className="student360-summary-icon indigo"><UserRound size={19} /></span><div><span>Faculty</span><strong>{displayValue(student.facultyName)}</strong><small>Assigned faculty</small></div></article>
        <article className="student360-summary-card"><span className="student360-summary-icon green"><CheckCircle2 size={19} /></span><div><span>Admission Date</span><strong>{formatDate(student.admissionDate)}</strong><small>{displayValue(student.source, 'Source not set')}</small></div></article>
      </section>

      <div className="student360-content-grid">
        <div className="student360-main-column">
          <SectionCard title="Attendance & Lab Engagement Heatmap" description={`${attendanceMonthLabel} attendance overview.`}>
            <div className="student360-attendance-legend">
              <span className="present"><i />Present ({attendanceSummary.present})</span>
              <span className="absent"><i />Absent ({attendanceSummary.absent})</span>
              <span className="excused"><i />Excused / Leave ({attendanceSummary.excused})</span>
            </div>
            <div className="student360-attendance-grid">{attendanceCells.map((entry) => <div className={`student360-attendance-cell ${entry.status}`} key={entry.date} title={`${entry.date} · ${entry.status}`}><strong>{entry.day}</strong><small>{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })}</small></div>)}</div>
            <div className="student360-attendance-actions"><button type="button" className="student360-secondary-button" onClick={() => onViewCalendar?.(student)}><CalendarDays size={15} /> View All</button></div>
          </SectionCard>
          <SectionCard title="Personal Information" description="Contact and identity details recorded for this student." className="student360-anchor-card" id="personal">
            <div className="student360-detail-grid">
              <DetailItem label="Student ID" value={student.studentId} />
              <DetailItem label="Email Address" value={student.emailAddress} icon={Mail} />
              <DetailItem label="Mobile Number" value={student.mobileNumber} icon={Phone} />
              <DetailItem label="Parent / Spouse Number" value={student.parentSpouseNumber} icon={Phone} />
              <DetailItem label="Country" value={student.country} icon={MapPin} />
              <DetailItem label="Location" value={student.location || [student.city, student.state].filter(Boolean).join(', ')} icon={MapPin} />
            </div>
          </SectionCard>

          <SectionCard title="Education & Enrollment" description="Academic background and current learning assignment." className="student360-anchor-card" id="enrollment">
            <div className="student360-detail-grid">
              <DetailItem label="Qualification" value={student.qualification} icon={GraduationCap} />
              <DetailItem label="Passed Out Year" value={student.passedOutYear} />
              <DetailItem label="Designation" value={student.designation} />
              <DetailItem label="Course Start Date" value={formatDate(student.courseStartDate)} icon={CalendarDays} />
              <DetailItem label="Course End Date" value={formatDate(student.courseEndDate)} icon={CalendarDays} />
              <DetailItem label="Class Schedule" value={student.classSchedule || student.courseSchedule} />
            </div>
          </SectionCard>
        </div>

        <aside className="student360-side-column">
          <SectionCard title="Fee & Payment Overview" description="Existing payment information for this student." className="student360-anchor-card">
            <div className="student360-fee-total"><span>Total Fee</span><strong>{formatCurrency(totalFee)}</strong></div>
            <div className="student360-fee-stats"><div><span>Paid</span><strong>{formatCurrency(paidAmount)}</strong></div><div><span>Balance</span><strong>{formatCurrency(Math.max(totalFee - paidAmount, 0))}</strong></div></div>
            <div className="student360-progress-label"><span>Fee Progress</span><strong>{Math.round(feeProgress)}%</strong></div>
            <div className="student360-progress-track"><span style={{ width: `${feeProgress}%` }} /></div>
            <div className="student360-fee-status"><Wallet size={15} /> {displayValue(student.paymentMode, 'Installment')} · {totalFee > 0 && paidAmount >= totalFee ? 'Completed' : 'Pending'}</div>
          </SectionCard>

          <SectionCard title="Installment Schedule" description="Due dates and current status." className="student360-anchor-card">
            {schedule.length ? <div className="student360-installment-list">{schedule.map((item, index) => <div className="student360-installment-row" key={`${item.id || item.number || index}`}><div><strong>Installment {item.installmentNumber || item.number || index + 1}</strong><span>{formatDate(item.dueDate || item.date)}</span></div><strong>{formatCurrency(item.amount ?? item.installmentAmount)}</strong><span className={`student360-payment-status ${String(item.status || 'Pending').toLowerCase()}`}>{item.status || 'Pending'}</span></div>)}</div> : <div className="student360-no-data">No installment schedule found.</div>}
          </SectionCard>

          <SectionCard title="Fee Ledger & Invoices" description="Recorded payments and downloadable receipts." className="student360-fee-ledger-card" id="payments">
            <div className="student360-ledger-heading"><div><span>Total: {formatCurrency(totalFee)} ({feeProgress >= 100 ? '100% Cleared' : `${Math.round(feeProgress)}% Cleared`})</span><strong>{feeProgress >= 100 ? 'Paid in Full' : 'Payment in Progress'}</strong></div><span className={`student360-ledger-pill ${feeProgress >= 100 ? 'is-paid' : ''}`}>{feeProgress >= 100 ? 'Paid in Full' : 'Pending'}</span></div>
            {ledgerEntries.length ? <div className="student360-payment-list">{ledgerEntries.slice(0, 6).map((payment, index) => <div className="student360-payment-row student360-ledger-row" key={payment.id || `${payment.date}-${payment.amount}`}><div className="student360-ledger-number">{payment.installmentNumber || index + 1}</div><div><strong>{formatDate(payment.dateRaw || payment.date)}</strong><span>{displayValue(payment.paymentMode || payment.mode, 'Payment')}</span></div><strong>{formatCurrency(payment.amount)} <b className="student360-payment-check">✓</b></strong><button type="button" className="student360-receipt-icon" title="Download receipt" aria-label="Download receipt" onClick={() => onDownloadPaymentReceipt?.(payment, student)}><Download size={15} /></button></div>)}</div> : <div className="student360-no-data">No payment history found.</div>}
            {ledgerEntries.length ? <button type="button" className="student360-invoice-button" onClick={() => onDownloadPaymentReceipt?.(ledgerEntries[0], student)}><FileText size={16} /> Download Tax Invoice Receipts</button> : null}
          </SectionCard>
        </aside>
      </div>
    </main>
  )
}
