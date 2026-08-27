const PROGRESS_STATUS_CONFIG = {
  courseAhead: {
    statusLabel: 'Course Progress Ahead',
    tone: 'red',
    iconLabel: 'Course progress ahead',
  },
  matched: {
    statusLabel: 'Progress Matched',
    tone: 'green',
    iconLabel: 'Progress matched',
  },
  paidAhead: {
    statusLabel: 'Paid Progress Ahead',
    tone: 'amber',
    iconLabel: 'Paid progress ahead',
  },
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
  const courseLabel = formatProgressPercentage(courseProgress)
  const paidLabel = formatProgressPercentage(paidProgress)

  if (state === 'courseAhead') {
    return `The student has completed ${courseLabel}% of the course, while only ${paidLabel}% of the course fee has been paid. Course progress has moved ahead of paid progress, so the next installment payment should be followed up.`
  }

  if (state === 'matched') {
    return `The student's course progress and paid progress are both at ${courseLabel}%. Both are currently in sync.`
  }

  if (state === 'paidAhead') {
    return `The student has completed ${courseLabel}% of the course, while ${paidLabel}% of the course fee has been paid. Paid progress is currently ahead of course progress by ${formatProgressPercentage(Number(paidProgress) - Number(courseProgress))}%, and the student is approaching the next course progress milestone.`
  }

  return `${name}'s course progress and paid progress do not require an alert right now.`
}

export function buildProgressComparisonNotification({
  studentName = '',
  studentId = '',
  courseProgress,
  paidProgress,
  recipientLabel = 'Faculty Dashboard',
  createdAt = new Date().toISOString(),
} = {}) {
  const state = getProgressComparisonState(courseProgress, paidProgress)
  if (!state) return null

  const config = PROGRESS_STATUS_CONFIG[state]
  if (!config) return null

  const safeStudentName = String(studentName || 'Student').trim() || 'Student'
  const safeStudentId = String(studentId || '-').trim() || '-'

  return {
    id: `progress-status-${safeStudentId}-${state}`,
    kind: 'progress-status-notification',
    tone: config.tone,
    title: 'Progress Status Notification',
    message: buildSummaryText(state, safeStudentName, courseProgress, paidProgress),
    summary: buildSummaryText(state, safeStudentName, courseProgress, paidProgress),
    statusKey: state,
    statusLabel: config.statusLabel,
    studentName: safeStudentName,
    studentId: safeStudentId,
    courseProgress: formatProgressPercentage(courseProgress),
    paidProgress: formatProgressPercentage(paidProgress),
    recipientLabel,
    createdAt,
    time: 'Just now',
  }
}

