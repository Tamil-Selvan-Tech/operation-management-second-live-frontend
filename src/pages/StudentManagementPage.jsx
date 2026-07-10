import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { listCourses } from '../services/courseService'

const STORAGE_KEY = 'cispro.student-management.records'
const statusOptions = ['Student', 'Employee', 'Other']
const sourceOptions = ['Justdial', 'Sulekha', 'Website', 'Poster', 'Others']
const studentWizardSteps = [
  {
    key: 'basic',
    title: 'Basic Information',
    description: 'Tell us who the student is and how to reach them.',
  },
  {
    key: 'education',
    title: 'Education Details',
    description: 'Choose the course and academic background.',
  },
  {
    key: 'admission',
    title: 'Admission Details',
    description: 'Complete the fee and admission setup before submitting.',
  },
]

function getTodayValue() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createEmptyForm() {
  return {
    courseId: '',
    studentName: '',
    mobileNumber: '',
    emailAddress: '',
    courseInterested: '',
    facultyName: '',
    batch: '',
    qualification: '',
    passedOutYear: '',
    currentStatus: '',
    designation: '',
    location: '',
    source: '',
    actualFees: '',
    registrationFees: '',
    discount: '',
    afterDiscount: '',
    installment1: '',
    installment2: '',
    installment3: '',
    remarks: '',
    parentSpouseNumber: '',
    admissionDate: getTodayValue(),
  }
}

function loadSavedStudents() {
  try {
    if (typeof window === 'undefined') return []
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function formatCurrency(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function addOneMonth(value) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''

  const dueDate = new Date(date)
  dueDate.setMonth(dueDate.getMonth() + 1)

  return dueDate.toISOString().slice(0, 10)
}

function diffInDays(a, b) {
  const start = new Date(`${a}T00:00:00`)
  const end = new Date(`${b}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const ms = 24 * 60 * 60 * 1000
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / ms))
}

function findCourseForForm(courseOptions, form) {
  return (
    courseOptions.find((course) => course.id === form.courseId) ||
    courseOptions.find((course) => course.name === form.courseInterested) ||
    null
  )
}

function mapCourseToForm(current, course) {
  if (!course) {
    return {
      ...current,
      courseId: '',
      courseInterested: '',
      actualFees: '',
      registrationFees: '',
      discount: '',
      afterDiscount: '',
      installment1: '',
      installment2: '',
      installment3: '',
      facultyName: current.facultyName || '',
      batch: current.batch || '',
    }
  }

  const actualFees = String(course.actualFees ?? '')
  const discount = String(course.discount ?? '')
  const afterDiscount =
    String(course.afterDiscount ?? '') ||
    (actualFees !== '' && discount !== '' ? String(Math.max(Number(actualFees) - Number(discount), 0)) : '')

  return {
    ...current,
    courseId: course.id,
    courseInterested: course.name,
    facultyName: current.facultyName,
    batch: current.batch,
    actualFees,
    registrationFees: String(course.registrationFees ?? ''),
    discount,
    afterDiscount,
    installment1: String(course.installment1 ?? ''),
    installment2: String(course.installment2 ?? ''),
    installment3: String(course.installment3 ?? ''),
  }
}

function validateForm(form) {
  const errors = {}
  const currentYear = new Date().getFullYear()

  if (!form.studentName.trim()) errors.studentName = 'Student name is required.'

  if (!/^\d{10}$/.test(form.mobileNumber.trim())) {
    errors.mobileNumber = 'Enter a valid 10-digit mobile number.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailAddress.trim())) {
    errors.emailAddress = 'Enter a valid email address.'
  }

  if (!form.qualification.trim()) errors.qualification = 'Qualification is required.'

  const passedOutYear = Number(form.passedOutYear)
  if (!/^\d{4}$/.test(String(form.passedOutYear).trim()) || passedOutYear < 1950 || passedOutYear > currentYear + 1) {
    errors.passedOutYear = 'Enter a valid passed out year.'
  }

  if (!form.currentStatus) errors.currentStatus = 'Please select the current status.'

  if (form.currentStatus === 'Employee' && !form.designation.trim()) {
    errors.designation = 'Designation is required for employees.'
  }

  if (!form.location.trim()) errors.location = 'Location is required.'
  if (!form.source) errors.source = 'Please select a source.'

  if (!form.courseId) errors.courseInterested = 'Please select a course.'
  if (!form.facultyName.trim()) errors.facultyName = 'Faculty name is required.'
  if (!form.batch.trim()) errors.batch = 'Batch is required.'
  if (!form.actualFees && form.courseId) errors.actualFees = 'Course fee details are missing.'
  if (!form.registrationFees && form.courseId) errors.registrationFees = 'Registration fee is missing.'
  if (!form.discount && form.courseId) errors.discount = 'Discount is missing.'
  if (!form.afterDiscount && form.courseId) errors.afterDiscount = 'After discount value is missing.'
  if (!form.installment1 && form.courseId) errors.installment1 = 'Installment 1 is missing.'
  if (!form.installment2 && form.courseId) errors.installment2 = 'Installment 2 is missing.'
  if (form.remarks.trim() && form.remarks.trim().length < 5) {
    errors.remarks = 'Add a short remark with at least 5 characters.'
  }

  if (!/^\d{10}$/.test(form.parentSpouseNumber.trim())) {
    errors.parentSpouseNumber = 'Enter a valid 10-digit contact number.'
  }

  if (!form.admissionDate) errors.admissionDate = 'Admission date is required.'

  return errors
}

function validateStep(form, stepIndex) {
  const errors = validateForm(form)
  const stepFields = {
    0: ['studentName', 'mobileNumber', 'emailAddress', 'parentSpouseNumber', 'location'],
    1: ['courseInterested', 'facultyName', 'batch', 'qualification', 'passedOutYear', 'currentStatus', 'designation', 'source'],
    2: ['actualFees', 'registrationFees', 'discount', 'afterDiscount', 'installment1', 'installment2', 'admissionDate'],
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => stepFields[stepIndex]?.includes(field)),
  )
}

function Field({ label, required = false, hint, error, className = '', children }) {
  return (
    <label className={`course-field student-field ${className}`.trim()}>
      <span>
        {label}
        {required ? <b>*</b> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <small className="student-field-error">{error}</small> : null}
    </label>
  )
}

function PaymentStatusBadge({ student }) {
  const dueDate = student.secondDueDate || addOneMonth(student.admissionDate)
  const paidLate =
    student.secondInstallmentStatus === 'Paid' &&
    student.secondInstallmentPaidAt &&
    student.secondInstallmentPaidAt > dueDate
  const isOverdue = student.secondInstallmentStatus !== 'Paid' && diffInDays(dueDate, getTodayValue()) > 0
  const status = paidLate ? 'Overdue' : student.secondInstallmentStatus === 'Paid' ? 'Complete' : isOverdue ? 'Overdue' : 'Pending'
  const className =
    status === 'Complete' ? 'student-badge employee' : status === 'Overdue' ? 'student-badge other' : 'student-badge student'

  return <span className={className}>{status}</span>
}

function DetailItem({ label, value, fullWidth = false }) {
  return (
    <div className={`student-detail-item ${fullWidth ? 'student-detail-item-full' : ''}`.trim()}>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  )
}

function ViewIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4a2.1 2.1 0 0 0-3 0L3 14.5V20h1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m13.5 6.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 7l1 12.5A1.5 1.5 0 0 0 9 21h6a1.5 1.5 0 0 0 1.5-1.5L17.5 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function DangerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3 1.8 20h20.4L12 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 8.5v5M12 17.2h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function StudentManagementPage() {
  const { user } = useAuth()
  const [students, setStudents] = useState(() => loadSavedStudents())
  const [courseOptions, setCourseOptions] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isCoursesLoading, setIsCoursesLoading] = useState(true)
  const [form, setForm] = useState(createEmptyForm)
  const [submitted, setSubmitted] = useState(false)
  const [fieldFocus, setFieldFocus] = useState({})
  const [editingStudentId, setEditingStudentId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)

  const errors = useMemo(() => validateForm(form), [form])
  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [selectedStudentId, students],
  )
  const totalStudents = students.length
  const latestStudent = students[0]
  const counselorName = user?.name || user?.email || 'Counselor'

  const saveStudents = (nextStudents) => {
    setStudents(nextStudents)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStudents))
    } catch {
      // ignore storage failures
    }
  }

  const openModal = () => {
    setForm(createEmptyForm())
    setFieldFocus({})
    setSubmitted(false)
    setEditingStudentId('')
    setCurrentStep(0)
    setIsModalOpen(true)
  }

  const openEditModal = (student) => {
    setForm({
      ...createEmptyForm(),
      courseId: student.courseId || '',
      studentName: student.studentName || '',
      mobileNumber: student.mobileNumber || '',
      emailAddress: student.emailAddress || '',
      courseInterested: student.courseInterested || '',
      facultyName: student.facultyName || '',
      batch: student.batch || '',
      qualification: student.qualification || '',
      passedOutYear: student.passedOutYear || '',
      currentStatus: student.currentStatus || '',
      designation: student.designation || '',
      location: student.location || '',
      source: student.source || '',
      actualFees: student.actualFees || '',
      registrationFees: student.registrationFees || '',
      discount: student.discount || '',
      afterDiscount: student.afterDiscount || '',
      installment1: student.installment1 || '',
      installment2: student.installment2 || '',
      installment3: student.installment3 || '',
      remarks: student.remarks || '',
      parentSpouseNumber: student.parentSpouseNumber || '',
      admissionDate: student.admissionDate || getTodayValue(),
      firstInstallmentPaidAt: student.firstInstallmentPaidAt || student.admissionDate || '',
      secondInstallmentPaidAt: student.secondInstallmentPaidAt || '',
    })
    setFieldFocus({})
    setSubmitted(false)
    setEditingStudentId(student.id)
    setCurrentStep(0)
    setIsModalOpen(true)
  }

  const openDrawer = (student) => {
    setSelectedStudentId(student.id)
    setIsDrawerOpen(true)
  }

  const openDeleteModal = (student) => {
    setDeleteTarget(student)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingStudentId('')
    setCurrentStep(0)
  }

  useEffect(() => {
    if (!isModalOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeModal()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isModalOpen])

  useEffect(() => {
    if (!isDrawerOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeDrawer()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDrawerOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(students))
    } catch {
      // ignore storage failures
    }
  }, [students])

  useEffect(() => {
    let isActive = true

    const loadCourseOptions = async () => {
      setIsCoursesLoading(true)

      try {
        const result = await listCourses({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
        if (!isActive) return

        const uniqueCourseOptions = Array.from(
          new Map(
            (result.data || [])
              .map((course) => {
                const id = String(course?.id || '').trim()
                const name = String(course?.name || '').trim()
                if (!id || !name) return null
                return [
                  id,
                  {
                    id,
                    name,
                    actualFees: course?.actualFees ?? '',
                    registrationFees: course?.registrationFees ?? '',
                    discount: course?.discount ?? '',
                    afterDiscount: course?.afterDiscount ?? '',
                    installment1: course?.installment1 ?? '',
                    installment2: course?.installment2 ?? '',
                    installment3: course?.installment3 ?? '',
                  },
                ]
              })
              .filter(Boolean),
          ).values(),
        )

        setCourseOptions(uniqueCourseOptions)
      } catch {
        if (isActive) {
          setCourseOptions([])
        }
      } finally {
        if (isActive) {
          setIsCoursesLoading(false)
        }
      }
    }

    void loadCourseOptions()

    return () => {
      isActive = false
    }
  }, [])

  const updateField = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const applyCourseDetails = (courseId) => {
    const course = courseOptions.find((item) => item.id === courseId) || null
    setForm((current) => ({
      ...mapCourseToForm(current, course),
    }))
  }

  const markTouched = (name) => {
    setFieldFocus((current) => ({
      ...current,
      [name]: true,
    }))
  }

  const shouldShowError = (name) => submitted || fieldFocus[name]

  const goToNextStep = () => {
    const stepErrors = validateStep(form, currentStep)
    if (Object.keys(stepErrors).length > 0) {
      setSubmitted(true)
      return
    }

    setSubmitted(false)
    setCurrentStep((value) => Math.min(value + 1, studentWizardSteps.length - 1))
  }

  const goToPreviousStep = () => {
    setSubmitted(false)
    setCurrentStep((value) => Math.max(value - 1, 0))
  }

  const handleSubmit = () => {
    setSubmitted(true)

    const nextErrors = validateForm(form)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const course = findCourseForForm(courseOptions, form)
    const record = {
      id: editingStudentId || (globalThis.crypto?.randomUUID?.() || `student-${Date.now()}`).toString(),
      ...form,
      courseId: form.courseId || course?.id || '',
      courseInterested: form.courseInterested || course?.name || '',
      facultyName: form.facultyName || '',
      batch: form.batch || '',
      counselorName,
      totalAmount: form.afterDiscount || '',
      firstInstallmentAmount: form.installment1 || '',
      firstInstallmentDate: form.admissionDate,
      firstInstallmentStatus: 'Paid',
      firstInstallmentPaidAt: form.admissionDate,
      secondInstallmentAmount: form.installment2 || '',
      secondDueDate: addOneMonth(form.admissionDate),
      secondInstallmentStatus: 'Pending',
      secondInstallmentPaidAt: '',
      overdueDays: 0,
      addedAt: editingStudentId
        ? students.find((student) => student.id === editingStudentId)?.addedAt || new Date().toISOString()
        : new Date().toISOString(),
    }

    record.overdueDays =
      record.secondInstallmentStatus === 'Paid' ? 0 : diffInDays(record.secondDueDate, getTodayValue())

    const nextStudents = editingStudentId
      ? students.map((student) => (student.id === editingStudentId ? { ...student, ...record } : student))
      : [record, ...students]

    saveStudents(nextStudents)

    setIsModalOpen(false)
    setForm(createEmptyForm())
    setFieldFocus({})
    setSubmitted(false)
    setEditingStudentId('')
  }

  const handleFormSubmit = (event) => {
    event.preventDefault()
  }

  const handleDelete = (studentId) => {
    const nextStudents = students.filter((student) => student.id !== studentId)
    saveStudents(nextStudents)

    if (selectedStudentId === studentId) {
      closeDrawer()
    }
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    handleDelete(deleteTarget.id)
    closeDeleteModal()
  }

  const toggleInstallmentStatus = (studentId, installmentField, paidAtField) => {
    const nextStudents = students.map((student) => {
      if (student.id !== studentId) return student

      const nextStatus = student[installmentField] === 'Paid' ? 'Pending' : 'Paid'

      return {
        ...student,
        [installmentField]: nextStatus,
        [paidAtField]: nextStatus === 'Paid' ? getTodayValue() : '',
      }
    })

    saveStudents(nextStudents)
  }

  return (
    <section className="student-management-page">
      <article className="panel-card student-management-hero">
        <div>
          <p className="eyebrow">Student Management</p>
          
          <p>Capture admissions details with a quick popup form and keep new leads organized in one place.</p>
        </div>

        <div className="student-management-actions">
          <div className="student-management-stat">
            <span>Total Students</span>
            <strong>{totalStudents}</strong>
          </div>
          <Button type="button" className="student-add-button" onClick={openModal}>
            + Add Student
          </Button>
        </div>
      </article>

      <article className="panel-card student-list-card">
        <div className="student-list-header">
          <div>
            <h3>Student List</h3>
            <p>Newly added records appear here immediately.</p>
          </div>
          {latestStudent ? (
            <div className="student-latest-chip">
              Latest: <strong>{latestStudent.studentName}</strong>
            </div>
          ) : null}
        </div>

        {students.length ? (
          <div className="student-table-wrap">
            <table className="student-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Phone</th>
                  <th>Course</th>
                  <th>Total Amount</th>
                  <th>Admission Date</th>
                  <th>1st Installment</th>
                  <th>2nd Installment</th>
                  <th>2nd Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                 const dueDate = student.secondDueDate || addOneMonth(student.admissionDate)
                  const overdueDays =
                    student.secondInstallmentStatus === 'Paid' ? 0 : diffInDays(dueDate, getTodayValue())

                  return (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.studentName}</strong>
                        <small>{student.emailAddress}</small>
                      </td>
                      <td>{student.mobileNumber}</td>
                      <td>{student.courseInterested}</td>
                      <td>{formatCurrency(student.totalAmount || student.afterDiscount)}</td>
                      <td>{formatDate(student.admissionDate)}</td>
                      <td>
  <label className="installment-check">
    <input
      type="checkbox"
      checked={student.firstInstallmentStatus === 'Paid'}
      onChange={() => toggleInstallmentStatus(student.id, 'firstInstallmentStatus', 'firstInstallmentPaidAt')}
    />
    <strong>{formatCurrency(student.firstInstallmentAmount)}</strong>
    <small>{student.firstInstallmentStatus}</small>
  </label>
</td>
  <td>
  <label className="installment-check">
    <input
      type="checkbox"
      checked={student.secondInstallmentStatus === 'Paid'}
      onChange={() => toggleInstallmentStatus(student.id, 'secondInstallmentStatus', 'secondInstallmentPaidAt')}
    />
    <strong>{formatCurrency(student.secondInstallmentAmount)}</strong>
    <small>{student.secondInstallmentStatus}</small>
  </label>
</td>
                      <td className="student-date-single-line">
                        <strong>{formatDate(dueDate)}</strong>
                        <small>{overdueDays > 0 ? `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue` : 'On schedule'}</small>
                      </td>
                      <td>
                        <PaymentStatusBadge student={student} />
                      </td>
                      <td>
                        <div className="student-action-group">
                          <button
                            type="button"
                            className="student-row-button student-row-button-view"
                            onClick={() => openDrawer(student)}
                            aria-label="View student"
                            title="View"
                          >
                            <ViewIcon />
                          </button>
                          <button
                            type="button"
                            className="student-row-button student-row-button-edit"
                            onClick={() => openEditModal(student)}
                            aria-label="Edit student"
                            title="Edit"
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="student-row-button student-row-button-delete"
                            onClick={() => openDeleteModal(student)}
                            aria-label="Delete student"
                            title="Delete"
                          >
                            <DeleteIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="student-empty-state">
            <strong>No students added yet</strong>
            <p>Use the Add Student button to create the first record.</p>
          </div>
        )}
      </article>

      {isModalOpen ? (
        <div className="course-modal-backdrop student-modal-backdrop" role="presentation" onClick={closeModal}>
          <form className="course-modal panel-card student-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} onSubmit={handleFormSubmit}>
            <button type="button" className="course-modal-close" onClick={closeModal} aria-label="Close student form">
              X
            </button>

            <div className="course-modal-header student-modal-header">
              <div>
                <p className="section-kicker">Students</p>
                <h3>{editingStudentId ? 'Edit Student' : 'Add New Student'}</h3>
                <p>{studentWizardSteps[currentStep].description}</p>
              </div>
            </div>

            <div className="student-stepper">
              {studentWizardSteps.map((step, index) => (
                <div key={step.key} className={`student-stepper-item ${currentStep === index ? 'active' : ''} ${currentStep > index ? 'done' : ''}`.trim()}>
                  <span>{index + 1}</span>
                  <strong>{step.title}</strong>
                </div>
              ))}
            </div>

            <div className="student-step-panel">
              {currentStep === 0 ? (
                <div className="student-step-section">
                  <div className="student-step-section-head">
                    <p>Step 1 of 3</p>
                    <h4>Basic Information</h4>
                  </div>
                <div className="course-form-grid student-form-grid">
                  <Field label="Student Name" required error={shouldShowError('studentName') ? errors.studentName : ''}>
                    <input
                      type="text"
                      value={form.studentName}
                      onChange={(event) => updateField('studentName', event.target.value)}
                      onBlur={() => markTouched('studentName')}
                      placeholder="Enter student name"
                    />
                  </Field>

                  <Field label="Mobile Number" required error={shouldShowError('mobileNumber') ? errors.mobileNumber : ''}>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.mobileNumber}
                      onChange={(event) => updateField('mobileNumber', event.target.value.replace(/\D/g, '').slice(0, 10))}
                      onBlur={() => markTouched('mobileNumber')}
                      placeholder="10-digit mobile number"
                    />
                  </Field>

                  <Field label="Email Address" required error={shouldShowError('emailAddress') ? errors.emailAddress : ''}>
                    <input
                      type="email"
                      value={form.emailAddress}
                      onChange={(event) => updateField('emailAddress', event.target.value)}
                      onBlur={() => markTouched('emailAddress')}
                      placeholder="name@example.com"
                    />
                  </Field>

                  <Field label="Parent / Spouse Number" required error={shouldShowError('parentSpouseNumber') ? errors.parentSpouseNumber : ''}>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.parentSpouseNumber}
                      onChange={(event) => updateField('parentSpouseNumber', event.target.value.replace(/\D/g, '').slice(0, 10))}
                      onBlur={() => markTouched('parentSpouseNumber')}
                      placeholder="10-digit contact number"
                    />
                  </Field>

                  <Field label="Location" required error={shouldShowError('location') ? errors.location : ''}>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(event) => updateField('location', event.target.value)}
                      onBlur={() => markTouched('location')}
                      placeholder="Current city or location"
                    />
                  </Field>
                </div>
                </div>
              ) : null}

              {currentStep === 1 ? (
                <div className="student-step-section">
                  <div className="student-step-section-head">
                    <p>Step 2 of 3</p>
                    <h4>Education Details</h4>
                  </div>
                <div className="course-form-grid student-form-grid">
                  <Field label="Course Interested" required error={shouldShowError('courseInterested') ? errors.courseInterested : ''}>
                    <select
                      value={form.courseId}
                      onChange={(event) => applyCourseDetails(event.target.value)}
                      onBlur={() => markTouched('courseInterested')}
                      disabled={isCoursesLoading}
                    >
                      <option value="">{isCoursesLoading ? 'Loading courses...' : 'Select course'}</option>
                      {courseOptions.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                      {!isCoursesLoading && !courseOptions.length ? <option value="" disabled>No courses available</option> : null}
                    </select>
                  </Field>

                  <Field label="Faculty Name" required error={shouldShowError('facultyName') ? errors.facultyName : ''}>
                    <input
                      type="text"
                      value={form.facultyName}
                      onChange={(event) => updateField('facultyName', event.target.value)}
                      onBlur={() => markTouched('facultyName')}
                      placeholder="Enter faculty name"
                    />
                  </Field>

                  <Field label="Batch" required error={shouldShowError('batch') ? errors.batch : ''}>
                    <input
                      type="text"
                      value={form.batch}
                      onChange={(event) => updateField('batch', event.target.value)}
                      onBlur={() => markTouched('batch')}
                      placeholder="Enter batch"
                    />
                  </Field>

                  <Field label="Qualification" required error={shouldShowError('qualification') ? errors.qualification : ''}>
                    <input
                      type="text"
                      value={form.qualification}
                      onChange={(event) => updateField('qualification', event.target.value)}
                      onBlur={() => markTouched('qualification')}
                      placeholder="Highest qualification"
                    />
                  </Field>

                  <Field label="Passed Out Year" required error={shouldShowError('passedOutYear') ? errors.passedOutYear : ''}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1950"
                      max={new Date().getFullYear() + 1}
                      value={form.passedOutYear}
                      onChange={(event) => updateField('passedOutYear', event.target.value)}
                      onBlur={() => markTouched('passedOutYear')}
                      placeholder="2024"
                    />
                  </Field>

                  <Field label="Current Status" required error={shouldShowError('currentStatus') ? errors.currentStatus : ''}>
                    <select
                      value={form.currentStatus}
                      onChange={(event) => updateField('currentStatus', event.target.value)}
                      onBlur={() => markTouched('currentStatus')}
                    >
                      <option value="">Select status</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="Designation"
                    hint="Required when the current status is Employee."
                    error={shouldShowError('designation') ? errors.designation : ''}
                  >
                    <input
                      type="text"
                      value={form.designation}
                      onChange={(event) => updateField('designation', event.target.value)}
                      onBlur={() => markTouched('designation')}
                      placeholder="Job title or designation"
                    />
                  </Field>

                  <Field
                    label="How did you know about our Institute?"
                    required
                    error={shouldShowError('source') ? errors.source : ''}
                  >
                    <select value={form.source} onChange={(event) => updateField('source', event.target.value)} onBlur={() => markTouched('source')}>
                      <option value="">Select source</option>
                      {sourceOptions.map((source) => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                </div>
              ) : null}

              {currentStep === 2 ? (
                <div className="student-step-section">
                  <div className="student-step-section-head">
                    <p>Step 3 of 3</p>
                    <h4>Admission Details</h4>
                  </div>
                <div className="course-form-grid student-form-grid">
                  <Field label="Actual Fees" required error={shouldShowError('actualFees') ? errors.actualFees : ''}>
                    <input type="text" value={form.actualFees} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Registration Fees" required error={shouldShowError('registrationFees') ? errors.registrationFees : ''}>
                    <input type="text" value={form.registrationFees} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Discount" required error={shouldShowError('discount') ? errors.discount : ''}>
                    <input type="text" value={form.discount} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="After Discount" required error={shouldShowError('afterDiscount') ? errors.afterDiscount : ''}>
                    <input type="text" value={form.afterDiscount} readOnly placeholder="Auto calculated" />
                  </Field>

                  <Field label="Installment 1" required error={shouldShowError('installment1') ? errors.installment1 : ''}>
                    <input type="text" value={form.installment1} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Installment 2" required error={shouldShowError('installment2') ? errors.installment2 : ''}>
                    <input type="text" value={form.installment2} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Installment 3" error={shouldShowError('installment3') ? errors.installment3 : ''}>
                    <input type="text" value={form.installment3} readOnly placeholder="Auto filled from course" />
                  </Field>

                  <Field label="Admission Date" required error={shouldShowError('admissionDate') ? errors.admissionDate : ''}>
                    <input
                      type="date"
                      value={form.admissionDate}
                      onChange={(event) => updateField('admissionDate', event.target.value)}
                      onBlur={() => markTouched('admissionDate')}
                    />
                  </Field>

                  <Field
                    label="Remarks"
                    hint="Optional notes can help the counselor follow up later."
                    error={shouldShowError('remarks') ? errors.remarks : ''}
                    className="student-field--full"
                  >
                    <textarea
                      value={form.remarks}
                      onChange={(event) => updateField('remarks', event.target.value)}
                      onBlur={() => markTouched('remarks')}
                      placeholder="Additional notes or counselor remarks"
                    />
                  </Field>
                </div>
                </div>
              ) : null}
            </div>

            <div className="course-validation-note student-validation-note">
              {Object.keys(validateStep(form, currentStep)).length
                ? 'Please review the highlighted fields before continuing.'
                : currentStep === 2
                  ? 'All required details should be entered accurately.'
                  : 'Complete this section to move to the next step.'}
            </div>

            <div className="course-form-actions">
              <Button type="button" variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              {currentStep > 0 ? (
                <Button type="button" variant="ghost" onClick={goToPreviousStep}>
                  Back
                </Button>
              ) : null}
              {currentStep < studentWizardSteps.length - 1 ? (
                <Button type="button" onClick={goToNextStep}>
                  Next
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit}>
                  {editingStudentId ? 'Update Student' : 'Submit'}
                </Button>
              )}
            </div>
          </form>
        </div>
      ) : null}

      {isDrawerOpen && selectedStudent ? (
        <div className="student-drawer-backdrop" role="presentation" onClick={closeDrawer}>
          <aside className="student-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="student-drawer-header">
              <div>
                <p className="section-kicker">Student Details</p>
                <h3>{selectedStudent.studentName}</h3>
                <p>{selectedStudent.courseInterested}</p>
              </div>
              <button type="button" className="student-drawer-close" onClick={closeDrawer} aria-label="Close student details">
                X
              </button>
            </div>

            <div className="student-drawer-section">
              <h4>Basic Information</h4>
              <div className="student-detail-grid">
                <DetailItem label="Student Name" value={selectedStudent.studentName} />
                <DetailItem label="Mobile Number" value={selectedStudent.mobileNumber} />
                <DetailItem label="Email Address" value={selectedStudent.emailAddress} />
                <DetailItem label="Parent / Spouse Number" value={selectedStudent.parentSpouseNumber} />
                <DetailItem label="Location" value={selectedStudent.location} />
              </div>
            </div>

            <div className="student-drawer-section">
              <h4>Education Details</h4>
              <div className="student-detail-grid">
                <DetailItem label="Course Interested" value={selectedStudent.courseInterested} />
                <DetailItem label="Faculty Name" value={selectedStudent.facultyName} />
                <DetailItem label="Batch" value={selectedStudent.batch} />
                <DetailItem label="Qualification" value={selectedStudent.qualification} />
                <DetailItem label="Passed Out Year" value={selectedStudent.passedOutYear} />
                <DetailItem label="Current Status" value={selectedStudent.currentStatus} />
                <DetailItem label="Designation" value={selectedStudent.designation || '-'} />
              </div>
            </div>

            <div className="student-drawer-section">
              <h4>Admission Details</h4>
              <div className="student-detail-grid">
                <DetailItem label="Admission Date" value={formatDate(selectedStudent.admissionDate)} />
                <DetailItem label="Total Course Fee" value={formatCurrency(selectedStudent.totalAmount || selectedStudent.afterDiscount)} />
                <DetailItem label="Discount" value={formatCurrency(selectedStudent.discount)} />
                <DetailItem label="Final Fee" value={formatCurrency(selectedStudent.afterDiscount)} />
              </div>
            </div>

            <div className="student-drawer-section">
              <h4>Installment Details</h4>
              <div className="student-installment-grid">
                <DetailItem label="1st Installment Amount" value={formatCurrency(selectedStudent.firstInstallmentAmount || selectedStudent.installment1)} />
                <DetailItem label="1st Installment Date" value={formatDate(selectedStudent.firstInstallmentDate || selectedStudent.admissionDate)} />
                <DetailItem label="1st Installment Status" value={selectedStudent.firstInstallmentStatus || 'Paid'} />
                <DetailItem label="2nd Installment Amount" value={formatCurrency(selectedStudent.secondInstallmentAmount || selectedStudent.installment2)} />
                <DetailItem label="2nd Due Date" value={formatDate(selectedStudent.secondDueDate || addOneMonth(selectedStudent.admissionDate))} />
                <DetailItem
                  label="2nd Installment Status"
                  value={selectedStudent.secondInstallmentStatus || 'Pending'}
                />
                <DetailItem
                  label="Overdue Days"
                  value={
                    (selectedStudent.secondInstallmentStatus || 'Pending') === 'Paid'
                      ? 'No overdue'
                      : `${diffInDays(selectedStudent.secondDueDate || addOneMonth(selectedStudent.admissionDate), getTodayValue())} Days`
                  }
                />
              </div>
            </div>

            <div className="student-drawer-section">
              <h4>Lead Information</h4>
              <div className="student-detail-grid">
                <DetailItem label="How did you know about our Institute?" value={selectedStudent.source} />
                <DetailItem label="Remarks" value={selectedStudent.remarks || '-'} fullWidth />
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="course-modal-backdrop" role="presentation" onClick={closeDeleteModal}>
          <div
            className="course-modal panel-card course-delete-modal student-delete-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="course-delete-icon" aria-hidden="true">
              <DangerIcon />
            </div>
            <div className="course-modal-header">
              <div>
                <h3>Delete student</h3>
              </div>
            </div>

            <p className="course-delete-text">
              Are you sure you want to delete <strong>{deleteTarget.studentName}</strong>? This action cannot be undone.
            </p>

            <div className="course-form-actions">
              <button type="button" className="button button-ghost" onClick={closeDeleteModal}>
                Cancel
              </button>
              <button type="button" className="button button-solid course-delete-confirm" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}


