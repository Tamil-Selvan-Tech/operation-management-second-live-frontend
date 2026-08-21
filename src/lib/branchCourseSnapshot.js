import { normalizeBranchCourseList, normalizeBranchCourse } from '../services/branchCourseService'

const BRANCH_COURSE_SNAPSHOT_KEY = 'cispro.branch-course-management.snapshot'

function getStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
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
      return
    }

    storage.setItem(BRANCH_COURSE_SNAPSHOT_KEY, JSON.stringify(normalized))
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
      ...snapshotCourse,
      ...course,
      models: primaryModels.length ? primaryModels : snapshotModels,
      courseModels: primaryModels.length ? primaryModels : snapshotModels,
      modules: primaryModels.length ? primaryModels : snapshotModels,
    })
  })
}
