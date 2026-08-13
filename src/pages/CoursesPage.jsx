import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { roleDashboards } from '../data/authData'
import { OperationManagerHeader } from '../components/OperationManagerHeader'
import { OperationManagerWorkspaceHeader } from '../components/OperationManagerWorkspaceHeader'
import { SearchBar } from '../components/SearchBar'
import { PaginationBar } from '../components/PaginationBar'
import { createCourse, deleteCourse, listCourses, peekCourseList, updateCourse } from '../services/courseService'
import { saveCourseRecords } from '../data/courseRecords'
import { useMobileMenu } from '../layouts/mobileMenuContext'
import { Eye, MoreVertical, PencilLine, Trash2 } from 'lucide-react'

function Field({ label, hint, error, children, required = false }) {
  return (
    <label className="course-field">
      <span>
        {label}
        {required ? <b>*</b> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <small className="course-field-error">{error}</small> : null}
    </label>
  )
}

function StatusPill({ status }) {
  const normalizedStatus = String(status || 'Active')
  return <span className={`status-pill ${normalizedStatus.toLowerCase()}`}>{normalizedStatus}</span>
}

function formatDuration(value) {
  if (value === '' || value == null) return '-'
  const normalized = String(value).trim()
  return `${normalized} ${normalized === '1' ? 'month' : 'months'}`
}

function formatHours(value) {
  if (value === '' || value == null) return '-'
  const normalized = String(value).trim()
  return `${normalized} ${normalized === '1' ? 'hour' : 'hours'}`
}

const requiredFieldLabels = {
  name: 'Course Name',
  mode: 'Mode',
  duration: 'Duration (Months)',
  hours: 'Hours',
  actualFees: 'Actual Fees',
  registrationFees: 'Registration Fees',
  discount: 'Discount',
  installmentCount: 'Installment Count',
  customInstallmentCount: 'Custom Installment Count',
  status: 'Status',
}

const MAX_INSTALLMENT_FIELDS = 12
const DEFAULT_COURSE_LIST_QUERY = Object.freeze({
  page: 1,
  limit: 5,
  sortBy: 'createdAt',
  sortOrder: 'desc',
})
const DEFAULT_COURSE_LIST_QUERY = Object.freeze({
  page: 1,
  limit: 5,
  sortBy: 'createdAt',
  sortOrder: 'desc',
})

function normalizeInstallmentCount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 1) return 0
  return Math.floor(amount)
}

function getEffectiveInstallmentCount(form) {
  if (form.installmentCount === 'custom') {
    return normalizeInstallmentCount(form.customInstallmentCount)
  }

  return normalizeInstallmentCount(form.installmentCount)
}

function getInstallmentValue(form, index) {
  if (index === 1) return form.installment1 ?? ''
  if (index === 2) return form.installment2 ?? ''
  if (index === 3) return form.installment3 ?? ''
  return form.extraInstallments?.[index - 4] ?? ''
}

function setInstallmentValue(form, index, value) {
  if (index === 1) return { ...form, installment1: value }
  if (index === 2) return { ...form, installment2: value }
  if (index === 3) return { ...form, installment3: value }

  const extraIndex = index - 4
  const extraInstallments = [...(form.extraInstallments || [])]
  extraInstallments[extraIndex] = value
  return { ...form, extraInstallments }
}

function buildInstallmentsFromCourse(course, count) {
  const storedInstallments = Array.isArray(course?.installments) ? course.installments : []
  if (storedInstallments.length) {
    return Array.from({ length: count }, (_, index) => String(storedInstallments[index] ?? ''))
  }

  const installments = []
  for (let index = 1; index <= count; index += 1) {
    installments.push(String(course?.[`installment${index}`] ?? ''))
  }
  return installments
}

function getCourseInstallments(course) {
  const storedInstallments = Array.isArray(course?.installments) ? course.installments : []

  if (storedInstallments.length) {
    return storedInstallments.map((value) => String(value ?? '').trim()).filter((value) => value !== '')
  }

  const explicitCount = normalizeInstallmentCount(course?.installmentCount)
  const fallbackCount = explicitCount > 0 ? Math.min(explicitCount, MAX_INSTALLMENT_FIELDS) : MAX_INSTALLMENT_FIELDS

  return Array.from({ length: fallbackCount }, (_, index) => String(course?.[`installment${index + 1}`] ?? '').trim()).filter(
    (value) => value !== '',
  )
}

function buildCourseFormFromCourse(course) {
  const installmentCount = normalizeInstallmentCount(course?.installmentCount ?? 2)
  const isCustomCount = installmentCount > 3
  const installments = buildInstallmentsFromCourse(course, Math.max(installmentCount, 3))

  return {
    name: course?.name || '',
    mode: course?.mode || '',
    duration: course?.duration ?? '',
    hours: course?.hours ?? '',
    actualFees: course?.actualFees ?? '',
    registrationFees: course?.registrationFees ?? '',
    discount: course?.discount ?? '',
    installmentCount: isCustomCount ? 'custom' : String(installmentCount || 2),
    customInstallmentCount: isCustomCount ? String(installmentCount) : '',
    installment1: installments[0] ?? '',
    installment2: installments[1] ?? '',
    installment3: installments[2] ?? '',
    extraInstallments: installments.slice(3),
    status: course?.status || 'Active',
  }
}

function normalizeCourseFormForSave(courseForm) {
  const nextForm = { ...courseForm }
  const effectiveInstallmentCount = getEffectiveInstallmentCount(nextForm)
  if (!effectiveInstallmentCount) return nextForm

  const actualFees = Number(nextForm.actualFees || 0)
  const discount = Number(nextForm.discount || 0)
  const discountedFee = Math.max(actualFees - discount, 0)
  const installmentValues = Array.from({ length: effectiveInstallmentCount }, (_, index) => Number(getInstallmentValue(nextForm, index + 1) || 0))
  const leadingTotal = installmentValues.slice(0, Math.max(0, effectiveInstallmentCount - 1)).reduce((total, amount) => total + amount, 0)
  const lastInstallment = Math.max(discountedFee - leadingTotal, 0)

  return setInstallmentValue(nextForm, effectiveInstallmentCount, String(lastInstallment))
}

function apiErrorMessage(error, fallback) {
  return error?.body?.message || error?.body?.error || error?.message || fallback
}

function isDuplicateCourseError(error) {
  const message = String(apiErrorMessage(error, '') || '').toLowerCase()
  return error?.status === 409 || message.includes('already exists') || message.includes('duplicate')
}

export function CoursesPage() {
  const { role } = useAuth()
  const openMenu = useMobileMenu()
  const initialCourseList = peekCourseList(DEFAULT_COURSE_LIST_QUERY)
  const initialCourseList = peekCourseList(DEFAULT_COURSE_LIST_QUERY)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [courses, setCourses] = useState(() => initialCourseList?.data || [])
  const [pagination, setPagination] = useState(() => initialCourseList?.meta || {
  const [courses, setCourses] = useState(() => initialCourseList?.data || [])
  const [pagination, setPagination] = useState(() => initialCourseList?.meta || {
    page: 1,
    limit: 5,
    total: initialCourseList?.data?.length || 0,
    total: initialCourseList?.data?.length || 0,
    totalPages: 1,
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [isCourseInlineEditing, setIsCourseInlineEditing] = useState(false)
  const [openActionMenuId, setOpenActionMenuId] = useState(null)
  const [openActionMenuPlacement, setOpenActionMenuPlacement] = useState('bottom')
  const [openActionMenuPosition, setOpenActionMenuPosition] = useState({ top: 0, right: 0 })
  const [openActionMenuMode, setOpenActionMenuMode] = useState('')
  const actionMenuCloseTimerRef = useRef(null)
  const [form, setForm] = useState({
    name: '',
    mode: '',
    duration: '',
    hours: '',
    actualFees: '',
    registrationFees: '',
    discount: '',
    installmentCount: '2',
    customInstallmentCount: '',
    installment1: '',
    installment2: '',
    installment3: '',
    extraInstallments: [],
    status: 'Active',
  })
  const [touched, setTouched] = useState({})
  const [saveError, setSaveError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(() => !initialCourseList)
  const [isLoading, setIsLoading] = useState(() => !initialCourseList)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [duplicateNameError, setDuplicateNameError] = useState('')
  const requestIdRef = useRef(0)
  const duplicateCheckRequestRef = useRef(0)
  const actionMenuButtonRefs = useRef(new Map())

  const pageSize = 5

  const markTouched = (field) => {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }))
  }

  const afterDiscount = useMemo(() => {
    const actualFees = Number(form.actualFees || 0)
    const discount = Number(form.discount || 0)
    if (Number.isNaN(actualFees) || Number.isNaN(discount)) return ''
    return String(Math.max(actualFees - discount, 0))
  }, [form.actualFees, form.discount])

  const validationErrors = useMemo(() => {
    const errors = {}

    if (!form.name.trim()) errors.name = `${requiredFieldLabels.name} is required.`
    if (duplicateNameError) errors.name = duplicateNameError
    if (!form.mode) errors.mode = `${requiredFieldLabels.mode} is required.`
    if (!form.duration) errors.duration = `${requiredFieldLabels.duration} is required.`
    if (form.duration && Number(form.duration) <= 0) errors.duration = 'Duration must be greater than zero.'
    if (!form.hours) errors.hours = `${requiredFieldLabels.hours} is required.`
    if (form.hours && Number(form.hours) <= 0) errors.hours = 'Hours must be greater than zero.'
    if (!form.actualFees) errors.actualFees = `${requiredFieldLabels.actualFees} is required.`
    if (!form.registrationFees) errors.registrationFees = `${requiredFieldLabels.registrationFees} is required.`
    if (!form.discount) errors.discount = `${requiredFieldLabels.discount} is required.`
    if (!form.installmentCount) errors.installmentCount = `${requiredFieldLabels.installmentCount} is required.`
    if (!form.status) errors.status = `${requiredFieldLabels.status} is required.`

    const effectiveInstallmentCount = getEffectiveInstallmentCount(form)
    if (form.installmentCount === 'custom' && !effectiveInstallmentCount) {
      errors.customInstallmentCount = `${requiredFieldLabels.customInstallmentCount} is required.`
    }

    for (let index = 1; index <= effectiveInstallmentCount; index += 1) {
      if (!getInstallmentValue(form, index)) {
        errors[`installment${index}`] = `Installment ${index} is required.`
      }
    }

    if (form.actualFees && form.discount && Number(form.discount) > Number(form.actualFees)) {
      errors.discount = 'Discount must be less than or equal to actual fees.'
    }

    const allRequiredFilled =
      form.name.trim() &&
      form.mode &&
      form.duration &&
      form.hours &&
      form.actualFees &&
      form.registrationFees &&
      form.discount &&
      form.installmentCount &&
      form.status &&
      (form.installmentCount !== 'custom' || effectiveInstallmentCount > 0) &&
      Array.from({ length: effectiveInstallmentCount }, (_, index) => index + 1).every((index) => Boolean(getInstallmentValue(form, index)))

    if (allRequiredFilled) {
      const discountedFee = Number(form.actualFees) - Number(form.discount)
      const installmentTotal = Array.from({ length: effectiveInstallmentCount }, (_, index) => Number(getInstallmentValue(form, index + 1) || 0)).reduce(
        (total, amount) => total + amount,
        0,
      )

      if (!isCourseInlineEditing && installmentTotal !== discountedFee) {
        for (let index = 1; index <= effectiveInstallmentCount; index += 1) {
          errors[`installment${index}`] = `Installment total must match ${discountedFee}.`
        }
      }
    }

    return errors
  }, [duplicateNameError, form, isCourseInlineEditing])

  const totalPages = pagination.totalPages || 1
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const visibleCourses = courses
  const totalCourseCount = pagination.total || courses.length || 0
  const drawerInstallmentValues = useMemo(() => getCourseInstallments(viewTarget), [viewTarget])
  const drawerViewInstallmentCount = useMemo(() => {
    const explicitCount = normalizeInstallmentCount(viewTarget?.installmentCount)
    if (explicitCount > 0) return explicitCount
    return drawerInstallmentValues.length
  }, [drawerInstallmentValues.length, viewTarget?.installmentCount])
  const drawerInstallmentCount = useMemo(() => {
    const effectiveCount = isCourseInlineEditing
      ? getEffectiveInstallmentCount(form)
      : drawerViewInstallmentCount

    return Math.max(1, effectiveCount)
  }, [drawerViewInstallmentCount, form, isCourseInlineEditing])

  const loadCourses = useCallback(
    async ({ page = currentPage, search = searchTerm, filter = activeFilter } = {}) => {
      const requestId = ++requestIdRef.current
      const query = {
        page,
        limit: pageSize,
        search,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }
      const query = {
        page,
        limit: pageSize,
        search,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }

      if (filter === 'Active' || filter === 'Inactive') {
        query.status = filter
      }
      if (filter === 'Active' || filter === 'Inactive') {
        query.status = filter
      }

      if (filter === 'Online' || filter === 'Offline') {
        query.mode = filter
      }

      const cachedResult = peekCourseList(query)

      if (!cachedResult && !courses.length) {
        setIsLoading(true)
      }

      setLoadError('')

      try {
      if (filter === 'Online' || filter === 'Offline') {
        query.mode = filter
      }

      const cachedResult = peekCourseList(query)

      if (!cachedResult && !courses.length) {
        setIsLoading(true)
      }

      setLoadError('')

      try {

        const result = await listCourses(query)

        if (requestId !== requestIdRef.current) return

        const nextCourses = result.data || []
        setCourses(nextCourses)
        saveCourseRecords(nextCourses)
        setPagination(result.meta || { page, limit: pageSize, total: 0, totalPages: 1 })
        setCurrentPage((result.meta?.page || page) ?? 1)
      } catch (error) {
        if (requestId !== requestIdRef.current) return
        setCourses([])
        setPagination({
          page,
          limit: pageSize,
          total: 0,
          totalPages: 1,
        })
        setLoadError(error?.message || 'Unable to load courses right now.')
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [activeFilter, courses.length, currentPage, pageSize, searchTerm],
    [activeFilter, courses.length, currentPage, pageSize, searchTerm],
  )

  useEffect(() => {
    void loadCourses({ page: currentPage, search: searchTerm, filter: activeFilter })
  }, [activeFilter, currentPage, loadCourses, searchTerm])

  useEffect(() => {
    if (!isModalOpen) return undefined

    const { overflow: previousOverflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isModalOpen])

  const pageList = useMemo(() => {
    if (totalPages <= 8) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    if (safeCurrentPage <= 5) {
      return [1, 2, 3, 4, 5, 6, 7, 'right-ellipsis', totalPages]
    }

    if (safeCurrentPage >= totalPages - 4) {
      return [1, 'left-ellipsis', totalPages - 6, totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    const pages = [1, 'left-ellipsis']
    const start = safeCurrentPage - 2
    const end = safeCurrentPage + 2
    for (let page = start; page <= end; page += 1) pages.push(page)

    pages.push('right-ellipsis')
    pages.push(totalPages)
    return pages
  }, [safeCurrentPage, totalPages])

  const updateField = (field, value) => {
    if (saveError) setSaveError('')
    if (field === 'name' && duplicateNameError) setDuplicateNameError('')
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateNumericField = (field, value) => {
    updateField(field, value.replace(/[^\d]/g, ''))
  }

  const handleInstallmentCountChange = (value) => {
    if (saveError) setSaveError('')
    setForm((current) => ({
      ...current,
      installmentCount: value,
      customInstallmentCount: value === 'custom' ? current.customInstallmentCount : '',
      extraInstallments: value === 'custom' ? current.extraInstallments : [],
    }))
  }

  const handleCustomInstallmentCountChange = (value) => {
    if (saveError) setSaveError('')
    const nextDigits = value.replace(/[^\d]/g, '')
    setForm((current) => ({
      ...current,
      installmentCount: 'custom',
      customInstallmentCount: nextDigits,
    }))
  }

  const resetForm = () => {
    setForm({
      name: '',
      mode: '',
      duration: '',
      hours: '',
      actualFees: '',
      registrationFees: '',
      discount: '',
      installmentCount: '2',
      customInstallmentCount: '',
      installment1: '',
      installment2: '',
      installment3: '',
      extraInstallments: [],
      status: '',
    })
    setTouched({})
    setSaveError('')
    setDuplicateNameError('')
    setEditingCourseId(null)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setViewTarget(null)
    setIsCourseInlineEditing(false)
    setDuplicateNameError('')
  }

  const closeModalAfterSave = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
  }

  const closeViewModal = () => {
    setViewTarget(null)
    setIsCourseInlineEditing(false)
    setEditingCourseId(null)
    setTouched({})
    setSaveError('')
  }

  const openCreateModal = () => {
    resetForm()
    setViewTarget(null)
    setIsCourseInlineEditing(false)
    setIsModalOpen(true)
    setDuplicateNameError('')
    setOpenActionMenuId(null)
    setOpenActionMenuPlacement('bottom')
    setOpenActionMenuPosition({ top: 0, right: 0 })
    setOpenActionMenuMode('')
  }

  const openEditModal = (course) => {
    if (!course) return
    setEditingCourseId(course.id)
    setTouched({})
    setSaveError('')
    setForm(buildCourseFormFromCourse(course))
    setViewTarget(null)
    setIsCourseInlineEditing(false)
    setIsModalOpen(true)
    setDuplicateNameError('')
    setOpenActionMenuId(null)
    setOpenActionMenuPlacement('bottom')
    setOpenActionMenuPosition({ top: 0, right: 0 })
    setOpenActionMenuMode('')
  }

  const openDrawerInlineEdit = (course) => {
    if (!course) return
    setEditingCourseId(course.id)
    setTouched({})
    setSaveError('')
    setForm(buildCourseFormFromCourse(course))
    setViewTarget(course)
    setIsCourseInlineEditing(true)
    setIsModalOpen(false)
    setDuplicateNameError('')
    setOpenActionMenuId(null)
    setOpenActionMenuPlacement('bottom')
    setOpenActionMenuPosition({ top: 0, right: 0 })
    setOpenActionMenuMode('')
  }

  const openViewModal = (course) => {
    setIsModalOpen(false)
    setViewTarget(course)
    setIsCourseInlineEditing(false)
    setEditingCourseId(null)
    setTouched({})
    setSaveError('')
    setDuplicateNameError('')
    setOpenActionMenuId(null)
    setOpenActionMenuPlacement('bottom')
    setOpenActionMenuPosition({ top: 0, right: 0 })
    setOpenActionMenuMode('')
  }

  const cancelInlineEdit = () => {
    const sourceCourse = viewTarget || courses.find((course) => course.id === editingCourseId)
    if (sourceCourse) {
      setForm(buildCourseFormFromCourse(sourceCourse))
    } else {
      resetForm()
    }
    setIsCourseInlineEditing(false)
    setEditingCourseId(null)
    setTouched({})
    setSaveError('')
    setDuplicateNameError('')
  }

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const handleSearchChange = (value) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleFilterChange = (value) => {
    setActiveFilter(value)
    setCurrentPage(1)
  }

  useEffect(() => {
    if (!isModalOpen && !isCourseInlineEditing) return

    const trimmedName = String(form.name || '').trim()
    if (!trimmedName) {
      return
    }

    const requestId = ++duplicateCheckRequestRef.current
    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await listCourses({
          page: 1,
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        })
        if (requestId !== duplicateCheckRequestRef.current) return

        const duplicateCourse = findDuplicateCourse(result.data || [], trimmedName, editingCourseId)
        setDuplicateNameError(duplicateCourse ? 'Course already exists.' : '')
      } catch {
        if (requestId === duplicateCheckRequestRef.current) {
          setDuplicateNameError('')
        }
      }
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [editingCourseId, form.name, isCourseInlineEditing, isModalOpen])

  const isValid = Object.keys(validationErrors).length === 0
  const isBusinessOwner = role === 'business-owner'
  const headerTitle = isBusinessOwner ? 'Business Owner Dashboard' : 'Operation Manager Dashboard'
  const headerEyebrow = isBusinessOwner ? 'Business Owner' : 'Operation Manager'
  const headerSummary = isBusinessOwner ? '' : roleDashboards['operation-manager'].summary
  const headerInitials = isBusinessOwner ? 'BW' : 'OM'
  const headerProfileTitle = isBusinessOwner ? 'Business Head' : 'Operation Manager'
  const headerEmail = isBusinessOwner ? 'business.owner@cispro.com' : 'operation.manager@cispro.com'

  const shouldShowError = (field) => Boolean(touched[field] && validationErrors[field])

  const handleSave = async (event) => {
    event?.preventDefault()
    const effectiveInstallmentCount = getEffectiveInstallmentCount(form)
    const allTouched = Object.keys(requiredFieldLabels).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    if (form.installmentCount === 'custom') {
      allTouched.customInstallmentCount = true
    }
    for (let index = 1; index <= effectiveInstallmentCount; index += 1) {
      allTouched[`installment${index}`] = true
    }
    setTouched(allTouched)
    if (!isValid) {
      const firstError = Object.values(validationErrors)[0]
      setSaveError(firstError || 'Please fill all required fields before saving.')
      return
    }

    setSaveError('')
    setIsSaving(true)

    const saveForm = isCourseInlineEditing ? normalizeCourseFormForSave(form) : form
    const saveAfterDiscount = String(Math.max(Number(saveForm.actualFees || 0) - Number(saveForm.discount || 0), 0))
    const saveEffectiveInstallmentCount = getEffectiveInstallmentCount(saveForm)
    const installmentsPayload = Array.from({ length: saveEffectiveInstallmentCount }, (_, index) => getInstallmentValue(saveForm, index + 1))
    const duplicateCheckResult = findDuplicateCourse(courses, saveForm.name, editingCourseId)

    const payload = {
      name: saveForm.name.trim(),
      mode: saveForm.mode,
      duration: saveForm.duration,
      hours: saveForm.hours,
      actualFees: saveForm.actualFees,
      registrationFees: saveForm.registrationFees,
      discount: saveForm.discount,
      afterDiscount: saveAfterDiscount,
      installmentCount: String(saveEffectiveInstallmentCount),
      installments: installmentsPayload,
      status: saveForm.status,
    }

    installmentsPayload.forEach((amount, index) => {
      payload[`installment${index + 1}`] = amount
    })

    try {
      if (duplicateCheckResult) {
        throw new Error(`Course already exists: ${duplicateCheckResult.name || saveForm.name.trim()}`)
      }

      const allCoursesResult = await listCourses({
        page: 1,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      const duplicateCourse = findDuplicateCourse(allCoursesResult.data || [], saveForm.name, editingCourseId)
      if (duplicateCourse) {
        setDuplicateNameError('Course already exists.')
        setTouched((current) => ({ ...current, name: true }))
        setSaveError('')
        return
      }

      if (editingCourseId) {
        await updateCourse(editingCourseId, payload)
      } else {
        await createCourse(payload)
      }

      await loadCourses({ page: editingCourseId ? currentPage : 1, search: searchTerm, filter: activeFilter })

      if (isCourseInlineEditing) {
        setForm(saveForm)
        setViewTarget((current) =>
          current
            ? {
                ...current,
                ...payload,
                id: editingCourseId || current.id,
              }
            : current,
        )
        setIsCourseInlineEditing(false)
        setEditingCourseId(null)
        setTouched({})
        setSaveError('')
        return
      }

      closeModalAfterSave()
    } catch (error) {
      if (isDuplicateCourseError(error)) {
        setDuplicateNameError('Course already exists.')
        setTouched((current) => ({ ...current, name: true }))
        setSaveError('')
        return
      }

      setSaveError(apiErrorMessage(error, 'Unable to save course right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (courseId) => {
    setDeleteTarget(courses.find((course) => course.id === courseId) || null)
    setOpenActionMenuId(null)
    setOpenActionMenuPlacement('bottom')
    setOpenActionMenuPosition({ top: 0, right: 0 })
    setOpenActionMenuMode('')
  }

  const clearActionMenuCloseTimer = () => {
    if (!actionMenuCloseTimerRef.current) return
    window.clearTimeout(actionMenuCloseTimerRef.current)
    actionMenuCloseTimerRef.current = null
  }

  const scheduleActionMenuClose = () => {
    clearActionMenuCloseTimer()
    actionMenuCloseTimerRef.current = window.setTimeout(() => {
      setOpenActionMenuId(null)
      setOpenActionMenuPlacement('bottom')
      setOpenActionMenuPosition({ top: 0, right: 0 })
      setOpenActionMenuMode('')
      actionMenuCloseTimerRef.current = null
    }, 140)
  }

  const getAfterDiscountValue = (course) => {
    const actualFees = Number(course?.actualFees || 0)
    const discount = Number(course?.discount || 0)
    if (!Number.isFinite(actualFees) || !Number.isFinite(discount)) return course?.afterDiscount || '-'
    return String(Math.max(actualFees - discount, 0))
  }

  const syncOpenActionMenuPlacement = (buttonElement) => {
    if (!buttonElement) return

    const rect = buttonElement.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const estimatedMenuHeight = 180
    const nextPlacement = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'
    const nextTop =
      nextPlacement === 'top'
        ? Math.max(12, rect.top - estimatedMenuHeight - 10)
        : Math.min(window.innerHeight - estimatedMenuHeight - 12, rect.bottom + 10)
    const nextRight = Math.max(12, window.innerWidth - rect.right)

    setOpenActionMenuPlacement(nextPlacement)
    setOpenActionMenuPosition({ top: nextTop, right: nextRight })
  }

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!event.target.closest('.course-row-actions-wrap')) {
        setOpenActionMenuId(null)
        setOpenActionMenuPlacement('bottom')
        setOpenActionMenuPosition({ top: 0, right: 0 })
        setOpenActionMenuMode('')
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenActionMenuId(null)
        setOpenActionMenuPlacement('bottom')
        setOpenActionMenuPosition({ top: 0, right: 0 })
        setOpenActionMenuMode('')
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    try {
      await deleteCourse(deleteTarget.id)
      if (editingCourseId === deleteTarget.id) {
        closeModal()
      }

      closeDeleteModal()
      await loadCourses({ page: currentPage, search: searchTerm, filter: activeFilter })
    } catch (error) {
      setLoadError(error?.message || 'Unable to delete course right now.')
      closeDeleteModal()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="courses-page">
      {isBusinessOwner ? (
        <OperationManagerHeader
          eyebrow={headerEyebrow}
          title={headerTitle}
          summary={headerSummary}
          initials={headerInitials}
          profileTitle={headerProfileTitle}
          email={headerEmail}
          onOpenMenu={openMenu}
        />
      ) : (
        <div className="operation-manager-dashboard">
          <OperationManagerWorkspaceHeader
            eyebrow={headerEyebrow}
            title={headerTitle}
            summary={headerSummary}
            initials={headerInitials}
            profileTitle={headerProfileTitle}
            email={headerEmail}
            onOpenMenu={openMenu}
          />
        </div>
      )}

      <div className="courses-topbar">
        <div className="courses-topbar-copy">
          <p className="eyebrow">Courses</p>
          {/* <h2>Course Management</h2> */}
          <p>Create and manage course details with a clean enterprise workflow.</p>
        </div>

        <div className="course-count-pill" aria-label={`Total courses ${totalCourseCount}`}>
          <span>Total Courses</span>
          <strong>{totalCourseCount}</strong>
        </div>

        <div className="courses-topbar-actions">
          <button className="button button-solid course-add-button" type="button" onClick={openCreateModal}>
            + Add Course
          </button>
          <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search course..."
            ariaLabel="Search courses"
          />
        </div>
      </div>

      <div className="course-toolbar">
        {['All', 'Active', 'Inactive', 'Online', 'Offline'].map((item) => (
          <button
            key={item}
            type="button"
            className={`course-filter-chip ${activeFilter === item ? 'active' : ''}`}
            onClick={() => handleFilterChange(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="course-validation-note course-validation-error" style={{ marginBottom: '1rem', color: '#dc2626' }}>
          <span style={{ color: '#dc2626' }}>{loadError}</span>
        </div>
      ) : null}

      {saveError ? (
        <div className="course-validation-note course-validation-error" style={{ marginBottom: '1rem', color: '#dc2626' }}>
          <span style={{ color: '#dc2626' }}>{saveError}</span>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="course-modal-backdrop" role="presentation">
          <form className="course-modal panel-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} onSubmit={handleSave}>
            <div className="course-modal-header">
              <div>
                <p className="section-kicker">Course Entry</p>
                <h3>{editingCourseId ? 'Edit Course' : 'Add Course'}</h3>
              </div>
              <span className="detail-badge">Required fields marked *</span>
            </div>

            <div className="course-form-grid">
              <Field label="Enter Course Name" required hint="Required field" error={shouldShowError('name') ? validationErrors.name : ''}>
                <input
                  type="text"
                  placeholder="Enter Course Name"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  onBlur={() => markTouched('name')}
                  aria-invalid={Boolean(shouldShowError('name'))}
                />
              </Field>

              <Field label="Select Mode" required hint="Online / Offline / Hybrid" error={shouldShowError('mode') ? validationErrors.mode : ''}>
                <select
                  value={form.mode}
                  onChange={(event) => updateField('mode', event.target.value)}
                  onBlur={() => markTouched('mode')}
                  aria-invalid={Boolean(shouldShowError('mode'))}
                >
                  <option value="" disabled>
                    Select Mode
                  </option>
                  <option>Online</option>
                  <option>Offline</option>
                  <option>Hybrid</option>
                </select>
              </Field>

              <Field label="Enter Duration (Months)" required hint="Numbers only" error={shouldShowError('duration') ? validationErrors.duration : ''}>
                <div className="course-input-with-suffix">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.duration}
                    onChange={(event) => updateNumericField('duration', event.target.value)}
                    onBlur={() => markTouched('duration')}
                    aria-invalid={Boolean(shouldShowError('duration'))}
                  />
                  <span>{Number(form.duration) === 1 ? 'month' : 'months'}</span>
                </div>
              </Field>

              <Field label="Enter Hours" required hint="Numbers only" error={shouldShowError('hours') ? validationErrors.hours : ''}>
                <div className="course-input-with-suffix">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.hours}
                    onChange={(event) => updateNumericField('hours', event.target.value)}
                    onBlur={() => markTouched('hours')}
                    aria-invalid={Boolean(shouldShowError('hours'))}
                  />
                  <span>{Number(form.hours) === 1 ? 'hour' : 'hours'}</span>
                </div>
              </Field>

              <Field label="Enter Actual Fees" required hint="Numbers only" error={shouldShowError('actualFees') ? validationErrors.actualFees : ''}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.actualFees}
                    onChange={(event) => updateNumericField('actualFees', event.target.value)}
                    onBlur={() => markTouched('actualFees')}
                    aria-invalid={Boolean(shouldShowError('actualFees'))}
                />
              </Field>

              <Field label="Enter Registration Fees" required hint="Numbers only" error={shouldShowError('registrationFees') ? validationErrors.registrationFees : ''}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.registrationFees}
                    onChange={(event) => updateNumericField('registrationFees', event.target.value)}
                    onBlur={() => markTouched('registrationFees')}
                    aria-invalid={Boolean(shouldShowError('registrationFees'))}
                />
              </Field>

              <Field label="Enter Discount" required hint="Must be less than or equal to actual fees" error={shouldShowError('discount') ? validationErrors.discount : ''}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.discount}
                    onChange={(event) => updateNumericField('discount', event.target.value)}
                    onBlur={() => markTouched('discount')}
                    aria-invalid={Boolean(shouldShowError('discount'))}
                />
              </Field>

              <Field label="After Discount (Auto Calculated)" hint="Auto calculated from actual fees and discount">
                <input type="text" value={afterDiscount} readOnly />
              </Field>

              <Field label="Select Installment Count" required hint="Choose 2, 3, or Custom" error={shouldShowError('installmentCount') ? validationErrors.installmentCount : ''}>
                <select
                  value={form.installmentCount}
                  onChange={(event) => handleInstallmentCountChange(event.target.value)}
                  onBlur={() => markTouched('installmentCount')}
                  aria-invalid={Boolean(shouldShowError('installmentCount'))}
                >
                  <option value="2">2 Installments</option>
                  <option value="3">3 Installments</option>
                  <option value="custom">Custom Installment</option>
                </select>
              </Field>

              {form.installmentCount === 'custom' ? (
                <Field
                  label="Enter Custom Installment Count"
                  required
                  hint="Type how many installment fields you need"
                  error={shouldShowError('customInstallmentCount') ? validationErrors.customInstallmentCount : ''}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.customInstallmentCount}
                    onChange={(event) => handleCustomInstallmentCountChange(event.target.value)}
                    onBlur={() => markTouched('customInstallmentCount')}
                    aria-invalid={Boolean(shouldShowError('customInstallmentCount'))}
                  />
                </Field>
              ) : null}

              {Array.from({ length: getEffectiveInstallmentCount(form) }, (_, index) => index + 1).map((installmentNumber) => (
                <Field
                  key={installmentNumber}
                  label={`Enter Installment ${installmentNumber}`}
                  required
                  hint="Numbers only"
                  error={shouldShowError(`installment${installmentNumber}`) ? validationErrors[`installment${installmentNumber}`] : ''}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={getInstallmentValue(form, installmentNumber)}
                    onChange={(event) => {
                      const nextValue = event.target.value.replace(/[^\d]/g, '')
                      setForm((current) => {
                        if (saveError) setSaveError('')
                        return setInstallmentValue(current, installmentNumber, nextValue)
                      })
                    }}
                    onBlur={() => markTouched(`installment${installmentNumber}`)}
                    aria-invalid={Boolean(shouldShowError(`installment${installmentNumber}`))}
                  />
                </Field>
              ))}

              <Field label="Select Status" required hint="Active or Inactive" error={shouldShowError('status') ? validationErrors.status : ''}>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                  onBlur={() => markTouched('status')}
                  aria-invalid={Boolean(shouldShowError('status'))}
                >
                  <option value="Active">Active</option>
                  <option>Inactive</option>
                </select>
              </Field>
            </div>

            {Object.keys(touched).length > 0 && !isValid ? (
              <div className="course-validation-note course-validation-error" style={{ color: '#dc2626' }}>
                <span style={{ color: '#dc2626' }}>
                  {saveError || Object.values(validationErrors)[0] || 'Please fill all required fields before saving.'}
                </span>
              </div>
            ) : null}

            <div className="course-form-actions">
              <button type="button" className="button button-ghost" onClick={resetForm} disabled={isSaving}>
                Reset
              </button>
              <button type="submit" className="button button-solid" disabled={isSaving}>
                {editingCourseId ? 'Update Course' : 'Save Course'}
              </button>
            </div>

            <button type="button" className="course-modal-close" onClick={closeModal} aria-label="Close course form" disabled={isSaving}>
              X
            </button>
          </form>
        </div>
      ) : null}

      {viewTarget ? (
        <div className="student-drawer-backdrop" role="presentation">
          <aside className="student-drawer student-drawer-table-view" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="student-drawer-table-header course-drawer-table-header">
              <div>
                <p className="section-kicker">Course Details</p>
                <h3>{viewTarget.name || 'Course Details'}</h3>
              </div>
              <div className="student-drawer-table-actions">
                {isCourseInlineEditing ? (
                  <>
                    <button
                      type="button"
                      className="student-drawer-edit-button student-drawer-edit-button-ghost course-drawer-edit-button course-drawer-edit-button-ghost"
                      onClick={cancelInlineEdit}
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="student-drawer-edit-button course-drawer-edit-button"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="student-drawer-edit-button course-drawer-edit-button"
                    onClick={() => openDrawerInlineEdit(viewTarget)}
                  >
                    <PencilLine />
                    <span>Edit</span>
                  </button>
                )}
                <button type="button" className="student-drawer-close student-drawer-close-floating" onClick={closeViewModal} aria-label="Close course details">
                  X
                </button>
              </div>
            </div>

            {isCourseInlineEditing && (saveError || Object.values(validationErrors).find(Boolean)) ? (
              <div className="course-validation-note course-drawer-inline-note">
                {saveError || Object.values(validationErrors).find(Boolean)}
              </div>
            ) : null}

            <div
              className={`student-drawer-table-shell course-drawer-table-shell ${
                isCourseInlineEditing ? 'is-course-editing' : 'is-course-view'
              }`.trim()}
            >
              <table className="student-details-table course-details-table">
                <tbody>
                  <tr>
                    <th>Course Name</th>
                    <td>
                      {isCourseInlineEditing ? (
                        <input
                          className="student-drawer-inline-control"
                          type="text"
                          value={form.name}
                          onChange={(event) => updateField('name', event.target.value)}
                        />
                      ) : (
                        viewTarget.name || '-'
                      )}
                    </td>
                    <th>Mode</th>
                    <td>
                      {isCourseInlineEditing ? (
                        <select className="student-drawer-inline-control" value={form.mode} onChange={(event) => updateField('mode', event.target.value)}>
                          <option value="" disabled>
                            Select mode
                          </option>
                          <option>Online</option>
                          <option>Offline</option>
                          <option>Hybrid</option>
                        </select>
                      ) : (
                        viewTarget.mode || '-'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Duration</th>
                    <td>
                      {isCourseInlineEditing ? (
                        <input
                          className="student-drawer-inline-control"
                          type="text"
                          inputMode="numeric"
                          value={form.duration}
                          onChange={(event) => updateNumericField('duration', event.target.value)}
                        />
                      ) : (
                        formatDuration(viewTarget.duration)
                      )}
                    </td>
                    <th>Hours</th>
                    <td>
                      {isCourseInlineEditing ? (
                        <input
                          className="student-drawer-inline-control"
                          type="text"
                          inputMode="numeric"
                          value={form.hours}
                          onChange={(event) => updateNumericField('hours', event.target.value)}
                        />
                      ) : (
                        formatHours(viewTarget.hours)
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Actual Fees</th>
                    <td>
                      {isCourseInlineEditing ? (
                        <input
                          className="student-drawer-inline-control"
                          type="text"
                          inputMode="numeric"
                          value={form.actualFees}
                          onChange={(event) => updateNumericField('actualFees', event.target.value)}
                        />
                      ) : (
                        viewTarget.actualFees || '-'
                      )}
                    </td>
                    <th>Registration Fees</th>
                    <td>
                      {isCourseInlineEditing ? (
                        <input
                          className="student-drawer-inline-control"
                          type="text"
                          inputMode="numeric"
                          value={form.registrationFees}
                          onChange={(event) => updateNumericField('registrationFees', event.target.value)}
                        />
                      ) : (
                        viewTarget.registrationFees || '-'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Discount</th>
                    <td>
                      {isCourseInlineEditing ? (
                        <input
                          className="student-drawer-inline-control"
                          type="text"
                          inputMode="numeric"
                          value={form.discount}
                          onChange={(event) => updateNumericField('discount', event.target.value)}
                        />
                      ) : (
                        viewTarget.discount || '-'
                      )}
                    </td>
                    <th>After Discount</th>
                    <td>{getAfterDiscountValue(isCourseInlineEditing ? form : viewTarget)}</td>
                  </tr>
                  {Array.from({ length: Math.ceil(drawerInstallmentCount / 2) }, (_, rowIndex) => {
                    const leftNumber = rowIndex * 2 + 1
                    const rightNumber = leftNumber + 1
                    const leftFieldName = `installment${leftNumber}`
                    const rightFieldName = `installment${rightNumber}`
                    const leftValue = isCourseInlineEditing
                      ? getInstallmentValue(form, leftNumber)
                      : drawerInstallmentValues[leftNumber - 1] ?? viewTarget?.[leftFieldName] ?? '-'
                    const rightExists = rightNumber <= drawerInstallmentCount
                    const rightValue = rightExists
                      ? isCourseInlineEditing
                        ? getInstallmentValue(form, rightNumber)
                        : drawerInstallmentValues[rightNumber - 1] ?? viewTarget?.[rightFieldName] ?? '-'
                      : ''

                    return (
                      <tr key={`course-installment-row-${rowIndex}`}>
                        <th>{`Installment ${leftNumber}`}</th>
                        <td>
                          {isCourseInlineEditing ? (
                            <input
                              className="student-drawer-inline-control"
                              type="text"
                              inputMode="numeric"
                              value={leftValue}
                              onChange={(event) => {
                                const nextValue = event.target.value.replace(/[^\d]/g, '')
                                setForm((current) => setInstallmentValue(current, leftNumber, nextValue))
                              }}
                            />
                          ) : (
                            leftValue || '-'
                          )}
                        </td>
                        <th>{rightExists ? `Installment ${rightNumber}` : ''}</th>
                        <td>
                          {rightExists ? (
                            isCourseInlineEditing ? (
                              <input
                                className="student-drawer-inline-control"
                                type="text"
                                inputMode="numeric"
                                value={rightValue}
                                onChange={(event) => {
                                  const nextValue = event.target.value.replace(/[^\d]/g, '')
                                  setForm((current) => setInstallmentValue(current, rightNumber, nextValue))
                                }}
                              />
                            ) : (
                              rightValue || '-'
                            )
                          ) : (
                            ''
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr>
                    <th>Status</th>
                    <td colSpan={3}>
                      {isCourseInlineEditing ? (
                        <select className="student-drawer-inline-control" value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                          <option value="" disabled>
                            Select status
                          </option>
                          <option>Active</option>
                          <option>Inactive</option>
                        </select>
                      ) : (
                        <StatusPill status={viewTarget.status || 'Active'} />
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </aside>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="course-modal-backdrop" role="presentation" onClick={closeDeleteModal}>
          <div
            className="course-modal panel-card course-delete-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="course-delete-icon" aria-hidden="true">
              <span>!</span>
            </div>
            <div className="course-modal-header">
              <div>
                <h3>Delete course</h3>
              </div>
            </div>

            <p className="course-delete-text">
              Are you sure you want to delete this course? This action cannot be undone.
            </p>

            <div className="course-form-actions">
              <button type="button" className="button button-ghost" onClick={closeDeleteModal} disabled={isDeleting}>
                Cancel
              </button>
              <button type="button" className="button button-solid course-delete-confirm" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="courses-layout">
        <article className="course-table-card">
          <div className="section-head compact">
            <div>
              <p className="section-kicker course-list-kicker">Course List</p>
          
            </div>
          </div>

          <div className="table-wrap">
            <table className="course-table">
              <thead>
                <tr>
                  <th>Course Name</th>
                  <th>Mode</th>
                  <th>Duration</th>
                  <th>Actual Fees</th>
                  <th>Registration Fees</th>
                  <th>After Discount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="course-empty-state" colSpan={8}>Loading courses...</td>
                  </tr>
                ) : loadError && !visibleCourses.length ? (
                  <tr>
                    <td className="course-empty-state" colSpan={8}>{loadError}</td>
                  </tr>
                ) : visibleCourses.length ? (
                  visibleCourses.map((course, index) => {
                    const shouldOpenMenuUpwards = index >= Math.max(0, visibleCourses.length - 2)
                    const menuPlacement = shouldOpenMenuUpwards ? 'top' : openActionMenuPlacement

                    return (
                      <tr key={course.id || `${course.name}-${course.mode}`} className={openActionMenuId === course.id ? 'course-row-actions-open' : ''}>
                        <td><strong>{course.name}</strong></td>
                        <td>{course.mode}</td>
                        <td>{formatDuration(course.duration)}</td>
                        <td>{course.actualFees}</td>
                        <td>{course.registrationFees}</td>
                        <td>{getAfterDiscountValue(course)}</td>
                        <td>
                          <StatusPill status={course.status} />
                        </td>
                        <td className="course-actions-cell">
                          <div
                            className={`course-row-actions-wrap ${openActionMenuId === course.id ? 'is-open' : ''}`.trim()}
                            onMouseEnter={() => {
                              clearActionMenuCloseTimer()
                              setOpenActionMenuId(course.id)
                              setOpenActionMenuMode((current) => (current === 'click' && openActionMenuId === course.id ? 'click' : 'hover'))
                              syncOpenActionMenuPlacement(actionMenuButtonRefs.current.get(course.id))
                            }}
                            onMouseLeave={() => {
                              if (openActionMenuMode === 'hover') {
                                scheduleActionMenuClose()
                              }
                            }}
                          >
                            <button
                              ref={(node) => {
                                if (node) actionMenuButtonRefs.current.set(course.id, node)
                                else actionMenuButtonRefs.current.delete(course.id)
                              }}
                              type="button"
                              className={`course-row-action course-row-menu-trigger ${openActionMenuId === course.id ? 'is-open' : ''}`.trim()}
                              onMouseEnter={() => {
                                clearActionMenuCloseTimer()
                              }}
                              onClick={(event) => {
                                const nextIsOpen = openActionMenuId !== course.id || openActionMenuMode !== 'click'
                                if (!nextIsOpen) {
                                  setOpenActionMenuId(null)
                                  setOpenActionMenuPlacement('bottom')
                                  setOpenActionMenuPosition({ top: 0, right: 0 })
                                  setOpenActionMenuMode('')
                                  return
                                }

                                setOpenActionMenuId(course.id)
                                setOpenActionMenuMode('click')
                                syncOpenActionMenuPlacement(event.currentTarget)
                              }}
                              aria-label={`Open actions for ${course.name || 'course'}`}
                              aria-haspopup="menu"
                              aria-expanded={openActionMenuId === course.id}
                            >
                              <MoreVertical />
                            </button>
                            {openActionMenuId === course.id ? (
                              <div
                                className={`course-row-action-menu ${menuPlacement === 'top' ? 'course-row-action-menu-top' : 'course-row-action-menu-bottom'}`.trim()}
                                role="menu"
                                aria-label={`${course.name || 'course'} actions`}
                                style={{
                                  top: `${openActionMenuPosition.top}px`,
                                  right: `${openActionMenuPosition.right}px`,
                                  bottom: 'auto',
                                  left: 'auto',
                                }}
                                onMouseEnter={clearActionMenuCloseTimer}
                                onMouseLeave={() => {
                                  if (openActionMenuMode === 'hover') {
                                    scheduleActionMenuClose()
                                  }
                                }}
                              >
                                <button
                                  type="button"
                                  className="course-row-action-menu-item"
                                  onClick={() => {
                                    setOpenActionMenuId(null)
                                    setOpenActionMenuPlacement('bottom')
                                    setOpenActionMenuPosition({ top: 0, right: 0 })
                                    setOpenActionMenuMode('')
                                    openViewModal(course)
                                  }}
                                  role="menuitem"
                                >
                                  <Eye />
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  className="course-row-action-menu-item"
                                  onClick={() => {
                                    setOpenActionMenuId(null)
                                    setOpenActionMenuPlacement('bottom')
                                    setOpenActionMenuPosition({ top: 0, right: 0 })
                                    setOpenActionMenuMode('')
                                    openEditModal(course)
                                  }}
                                  role="menuitem"
                                >
                                  <PencilLine />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="course-row-action-menu-item danger"
                                  onClick={() => {
                                    setOpenActionMenuId(null)
                                    setOpenActionMenuPlacement('bottom')
                                    setOpenActionMenuPosition({ top: 0, right: 0 })
                                    setOpenActionMenuMode('')
                                    handleDelete(course.id)
                                  }}
                                  role="menuitem"
                                >
                                  <Trash2 />
                                  <span>Delete</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td className="course-empty-state" colSpan={8}>No courses found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PaginationBar
            className="app-pagination"
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            pageList={pageList}
            onPageChange={goToPage}
            label="Course pagination"
          />

          <div className="course-pagination">
            <button
              type="button"
              className="pagination-link"
              onClick={() => goToPage(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
            >
              <span aria-hidden="true">←</span>
              <span>Prev</span>
            </button>
            <div className="pagination-pages">
              {pageList.map((page, index) =>
                typeof page === 'number' ? (
                  <button
                    key={page}
                    type="button"
                    className={`pagination-page ${safeCurrentPage === page ? 'active' : ''}`}
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={`${page}-${index}`} className="pagination-dots">...</span>
                )
              )}
            </div>
            <button
              type="button"
              className="pagination-link"
              onClick={() => goToPage(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
            >
              <span>Next</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </article>
      </div>
    </section>
  )
}
