import { normalizeBranchCourseList, normalizeBranchCourse } from '../services/branchCourseService'

const BRANCH_COURSE_SNAPSHOT_KEY = 'cispro.branch-course-management.snapshot'
const BRANCH_COURSE_SNAPSHOT_EVENT = 'cispro:branch-course-snapshot-changed'

function getStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function emitBranchCourseSnapshotChange() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new Event(BRANCH_COURSE_SNAPSHOT_EVENT))
}

function normalizeBranchCourseSnapshotRecord(record = {}) {
  return normalizeBranchCourse(record)
}

export function loadBranchCourseSnapshot() {
  try {
    const storage = getStorage()
    if (!storage) return []

    const raw = storage.getItem(BRANCH_COURSE_SNAPSHOT_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return normalizeBranchCourseList(Array.isArray(parsed) ? parsed : [])
  } catch {
    return []
  }
}

export function saveBranchCourseSnapshot(records) {
  try {
    const storage = getStorage()
    if (!storage) return

    const normalized = normalizeBranchCourseList(Array.isArray(records) ? records : [])
    if (!normalized.length) {
      storage.removeItem(BRANCH_COURSE_SNAPSHOT_KEY)
      emitBranchCourseSnapshotChange()
      return
    }

    storage.setItem(BRANCH_COURSE_SNAPSHOT_KEY, JSON.stringify(normalized))
    emitBranchCourseSnapshotChange()
  } catch {
    // Ignore storage failures so dashboard rendering still works.
  }
}

export function mergeBranchCoursesWithSnapshot(records) {
  const primary = normalizeBranchCourseList(Array.isArray(records) ? records : [])
  const snapshot = loadBranchCourseSnapshot()

  if (!primary.length) return snapshot
  if (!snapshot.length) return primary

  const snapshotById = new Map(
    snapshot.map((course) => [String(course?.id || '').trim().toLowerCase(), course]).filter(([id]) => Boolean(id)),
  )

  return primary.map((course) => {
    const courseId = String(course?.id || '').trim().toLowerCase()
    const snapshotCourse = snapshotById.get(courseId)
    if (!snapshotCourse) return course

    const primaryModels = Array.isArray(course?.models) ? course.models : []
    const snapshotModels = Array.isArray(snapshotCourse?.models) ? snapshotCourse.models : []

    return normalizeBranchCourseSnapshotRecord({
      ...course,
      ...snapshotCourse,
      models: snapshotModels.length ? snapshotModels : primaryModels,
      courseModels: snapshotModels.length ? snapshotModels : primaryModels,
      modules: snapshotModels.length ? snapshotModels : primaryModels,
    })
  })
}

export function subscribeBranchCourseSnapshot(listener) {
  if (typeof window === 'undefined') return () => {}

  const handleStorage = (event) => {
    if (event.key === BRANCH_COURSE_SNAPSHOT_KEY) {
      listener()
    }
  }

  const handleCustomEvent = () => {
    listener()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(BRANCH_COURSE_SNAPSHOT_EVENT, handleCustomEvent)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(BRANCH_COURSE_SNAPSHOT_EVENT, handleCustomEvent)
  }
}
