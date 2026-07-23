import { useEffect, useState } from 'react'

import { loadStudentRecords } from '../data/studentRecords'
import { getCurrentStudentProfile } from '../services/studentService'

export function formatCurrency(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function getStudentInitials(name) {
  const value = String(name || '').trim()
  if (!value) return 'ST'
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2)
}

function addOneMonth(value, months = 1) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''

  const dueDate = new Date(date)
  dueDate.setMonth(dueDate.getMonth() + months)

  return dueDate.toISOString().slice(0, 10)
}

function diffInDays(a, b) {
  const start = new Date(`${a}T00:00:00`)
  const end = new Date(`${b}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const ms = 24 * 60 * 60 * 1000
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / ms))
}

function getTodayValue() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function hasThirdInstallment(student) {
  return Boolean(
    String(student?.course?.installmentCount ?? '') === '3' ||
      student?.installment3 ||
      student?.thirdInstallmentAmount ||
      student?.thirdDueDate,
  )
}

export function getSecondDueDate(student) {
  return student?.secondDueDate || addOneMonth(student?.admissionDate)
}

export function getThirdDueDate(student) {
  if (!hasThirdInstallment(student)) return ''
  return student?.thirdDueDate || addOneMonth(getSecondDueDate(student))
}

export function getStudentStatus(student) {
  const dueDate = hasThirdInstallment(student) ? getThirdDueDate(student) || getSecondDueDate(student) : getSecondDueDate(student)
  const secondPaid = String(student?.secondInstallmentStatus || 'Pending') === 'Paid'
  const thirdPaid = hasThirdInstallment(student) ? String(student?.thirdInstallmentStatus || 'Pending') === 'Paid' : true
  const firstPaid = String(student?.firstInstallmentStatus || 'Pending') === 'Paid'
  const overdueDays = (hasThirdInstallment(student) ? thirdPaid : secondPaid) ? 0 : diffInDays(dueDate, getTodayValue())

  if (firstPaid && secondPaid && thirdPaid) return { label: 'Complete', tone: 'success' }
  if (overdueDays > 0) return { label: `Overdue · ${overdueDays} Days`, tone: 'danger' }
  if (firstPaid) return { label: 'Pending', tone: 'warning' }

  return { label: 'Pending', tone: 'warning' }
}

export function getPaidAmount(student) {
  const first = String(student?.firstInstallmentStatus || 'Pending') === 'Paid' ? Number(student?.installment1 || student?.firstInstallmentAmount || 0) : 0
  const second = String(student?.secondInstallmentStatus || 'Pending') === 'Paid' ? Number(student?.installment2 || student?.secondInstallmentAmount || 0) : 0
  const third =
    hasThirdInstallment(student) && String(student?.thirdInstallmentStatus || 'Pending') === 'Paid'
      ? Number(student?.thirdInstallmentAmount || student?.installment3 || 0)
      : 0
  return first + second + third
}

export function StudentInfoItem({ label, value, fullWidth = false, valueClassName = '' }) {
  return (
    <div className={`student-dashboard-info-item ${fullWidth ? 'student-dashboard-info-item-full' : ''}`.trim()}>
      <span>{label}</span>
      <strong className={valueClassName}>{value || '-'}</strong>
    </div>
  )
}

export function StudentSectionCard({ title, subtitle, kicker = 'Student Data', children }) {
  return (
    <article className="student-section-card">
      <div className="student-section-card-head">
        <div>
          <p className="section-kicker">{kicker}</p>
          <h3>{title}</h3>
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </article>
  )
}

export function useCurrentStudentProfile() {
  const [student, setStudent] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const result = await getCurrentStudentProfile()
        if (!active) return
        setStudent(result)
      } catch {
        if (!active) return
        setStudent(loadStudentRecords()[0] || null)
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [])

  return { student, isLoading }
}
