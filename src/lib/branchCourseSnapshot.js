import { normalizeBranchCourseList, normalizeBranchCourse } from '../services/branchCourseService'

const BRANCH_COURSE_SNAPSHOT_KEY = 'cispro.branch-course-management.snapshot'
const BRANCH_COURSE_SNAPSHOT_EVENT = 'cispro:branch-course-snapshot-changed'
const BRANCH_COURSE_SNAPSHOT_CHANNEL = 'cispro:branch-course-snapshot'

function getStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function emitBranchCourseSnapshotChange() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new Event(BRANCH_COURSE_SNAPSHOT_EVENT))

  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(BRANCH_COURSE_SNAPSHOT_CHANNEL)
      channel.postMessage({ type: 'changed', at: Date.now() })
      channel.close()
    } catch {
      // Ignore broadcast failures and fall back to storage/custom events.
    }
  }
}

function normalizeBranchCourseSnapshotRecord(record = {}) {
  return normalizeBranchCourse(record)
}

function normalizeCourseKey(value = '') {
  return String(value || '').trim().toLowerCase()
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

  const snapshotById = new Map()
  const snapshotByCode = new Map()
  const snapshotByName = new Map()

  snapshot.forEach((course) => {
    const idKey = normalizeCourseKey(course?.id)
    const codeKey = normalizeCourseKey(course?.courseCode)
    const nameKey = normalizeCourseKey(course?.name || course?.courseName)

    if (idKey && !snapshotById.has(idKey)) {
      snapshotById.set(idKey, course)
    }

    if (codeKey && !snapshotByCode.has(codeKey)) {
      snapshotByCode.set(codeKey, course)
    }

    if (nameKey && !snapshotByName.has(nameKey)) {
      snapshotByName.set(nameKey, course)
    }
  })

  return primary.map((course) => {
    const courseId = normalizeCourseKey(course?.id)
    const courseCode = normalizeCourseKey(course?.courseCode)
    const courseName = normalizeCourseKey(course?.name || course?.courseName)
    const snapshotCourse = snapshotById.get(courseId) || snapshotByCode.get(courseCode) || snapshotByName.get(courseName)
    if (!snapshotCourse) return course

    const primaryModels = Array.isArray(course?.models) ? course.models : []
    const snapshotModels = Array.isArray(snapshotCourse?.models) ? snapshotCourse.models : []

    return normalizeBranchCourseSnapshotRecord({
      ...snapshotCourse,
      ...course,
      id: course?.id || snapshotCourse?.id || '',
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

  const handleBroadcastMessage = () => {
    listener()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(BRANCH_COURSE_SNAPSHOT_EVENT, handleCustomEvent)

  let channel = null
  if ('BroadcastChannel' in window) {
    try {
      channel = new BroadcastChannel(BRANCH_COURSE_SNAPSHOT_CHANNEL)
      channel.addEventListener('message', handleBroadcastMessage)
    } catch {
      channel = null
    }
  }

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(BRANCH_COURSE_SNAPSHOT_EVENT, handleCustomEvent)

    if (channel) {
      channel.removeEventListener('message', handleBroadcastMessage)
      channel.close()
    }
  }
}
