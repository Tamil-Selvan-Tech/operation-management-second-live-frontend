import { loadNotifications, saveNotifications } from './notificationStore'

const PROGRESS_STATUS_CONFIG = {
  courseAhead: {
    statusLabel: 'Course Progress Ahead',
    tone: 'red',
    iconLabel: 'Course progress ahead',
    title: 'Payment Due Alert',
  },
  matched: {
    statusLabel: 'Progress Matched',
    tone: 'green',
    iconLabel: 'Progress matched',
    title: 'Progress Matched',
  },
  paidAhead: {
    statusLabel: 'Paid Progress Ahead',
    tone: 'amber',
    iconLabel: 'Paid progress ahead',
    title: 'Progress Alert',
  },
}

const PROGRESS_NOTIFICATION_PREFIX_BY_AUDIENCE = {
  faculty: 'faculty-progress-status',
  branch: 'branch-progress-status',
}

function normalizeProgressValue(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return Math.min(100, Math.max(0, numeric))
}

export function formatProgressPercentage(value) {
  const normalized = normalizeProgressValue(value)
  if (normalized === null) return '-'

  const rounded = Math.round(normalized * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '')
}

export function getProgressComparisonState(courseProgress, paidProgress) {
  const normalizedCourseProgress = normalizeProgressValue(courseProgress)
  const normalizedPaidProgress = normalizeProgressValue(paidProgress)

  if (normalizedCourseProgress === null || normalizedPaidProgress === null) {
    return null
  }

  if (normalizedCourseProgress > normalizedPaidProgress) {
    return 'courseAhead'
  }

  if (normalizedCourseProgress === normalizedPaidProgress) {
    return 'matched'
  }

  if (normalizedPaidProgress > normalizedCourseProgress && (normalizedPaidProgress - normalizedCourseProgress) <= 5) {
    return 'paidAhead'
  }

  return null
}

function buildSummaryText(state, studentName, courseProgress, paidProgress) {
  const name = String(studentName || 'the student').trim() || 'the student'
  const courseValue = formatProgressPercentage(courseProgress)
  const differenceValue = formatProgressPercentage(Math.abs(Number(courseProgress) - Number(paidProgress)))

  if (state === 'courseAhead') {
    return `Course progress is ${differenceValue}% ahead of the paid progress. The next installment payment should be followed up.`
  }

  if (state === 'matched') {
    return `Course progress and paid progress are currently matched at ${courseValue}%. The next installment payment should be completed before starting the next module/submodule.`
  }

  if (state === 'paidAhead') {
    return `Paid progress is only ${differenceValue}% ahead of the course progress. Since the course progress is close to the paid progress, the student only needs to be informed.`
  }

  return `${name}'s course progress and paid progress do not require an alert right now.`
}

export function buildProgressComparisonNotification({
  studentName = '',
  studentId = '',
  courseProgress,
  paidProgress,
  recipientLabel = 'Faculty Dashboard',
  audience = 'faculty',
  createdAt = new Date().toISOString(),
} = {}) {
  const state = getProgressComparisonState(courseProgress, paidProgress)
  if (!state) return null

  const config = PROGRESS_STATUS_CONFIG[state]
  if (!config) return null

  const safeStudentName = String(studentName || 'Student').trim() || 'Student'
  const safeStudentId = String(studentId || '-').trim() || '-'
  const normalizedAudience = String(audience || 'faculty').trim().toLowerCase() === 'branch' ? 'branch' : 'faculty'
  const notificationPrefix = PROGRESS_NOTIFICATION_PREFIX_BY_AUDIENCE[normalizedAudience]
  const courseProgressLabel = formatProgressPercentage(courseProgress)
  const paidProgressLabel = formatProgressPercentage(paidProgress)
  const notificationId = `${notificationPrefix}-${safeStudentId}-${state}-${courseProgressLabel}-${paidProgressLabel}`.replace(
    /[^a-zA-Z0-9._-]/g,
    '-',
  )

  return {
    id: notificationId,
    kind: `${notificationPrefix}`,
    tone: config.tone,
    title: config.title,
    message: buildSummaryText(state, safeStudentName, courseProgress, paidProgress),
    summary: buildSummaryText(state, safeStudentName, courseProgress, paidProgress),
    statusKey: state,
    statusLabel: config.statusLabel,
    studentName: safeStudentName,
    studentId: safeStudentId,
    courseProgress: courseProgressLabel,
    paidProgress: paidProgressLabel,
    recipientLabel,
    createdAt,
    time: 'Just now',
    targetSection: 'students',
  }
}

export function syncProgressComparisonNotifications(notifications = [], audience = 'faculty') {
  const normalizedAudience = String(audience || 'faculty').trim().toLowerCase() === 'branch' ? 'branch' : 'faculty'
  const currentNotifications = (Array.isArray(notifications) ? notifications : [])
    .map((notification) => buildProgressComparisonNotification({
      ...notification,
      audience: normalizedAudience,
    }))
    .filter(Boolean)

  const existingNotifications = loadNotifications()
  const nextNotifications = [...existingNotifications]
  const existingIds = new Set(existingNotifications.map((notification) => String(notification.id || '').trim()))

  currentNotifications.forEach((notification) => {
    const normalizedId = String(notification.id || '').trim()
    if (!normalizedId || existingIds.has(normalizedId)) {
      return
    }

    nextNotifications.unshift(notification)
    existingIds.add(normalizedId)
  })

  const shouldWrite =
    nextNotifications.length !== existingNotifications.length ||
    nextNotifications.some((notification, index) => {
      const previous = existingNotifications[index]
      if (!previous) return true
      return (
        String(previous.id || '') !== String(notification.id || '') ||
        String(previous.kind || '') !== String(notification.kind || '') ||
        String(previous.title || '') !== String(notification.title || '') ||
        String(previous.message || '') !== String(notification.message || '') ||
        String(previous.statusKey || '') !== String(notification.statusKey || '') ||
        String(previous.statusLabel || '') !== String(notification.statusLabel || '')
      )
    })

  if (shouldWrite) {
    saveNotifications(nextNotifications)
  }

  return currentNotifications
}
