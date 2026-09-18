export const COURSE_STATUS = Object.freeze({
  COMPLETED: 'COMPLETED',
  IN_PROGRESS: 'IN_PROGRESS',
  NOT_STARTED: 'NOT_STARTED',
})

export function getCourseStatusFromProgress(progress) {
  const value = Number(progress)

  if (!Number.isFinite(value) || value <= 0) return COURSE_STATUS.NOT_STARTED
  if (value >= 100) return COURSE_STATUS.COMPLETED
  return COURSE_STATUS.IN_PROGRESS
}

export function getCourseStatusLabel(status) {
  if (status === COURSE_STATUS.COMPLETED) return 'Completed'
  if (status === COURSE_STATUS.IN_PROGRESS) return 'In Progress'
  return 'Not Started'
}
