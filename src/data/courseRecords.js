export const COURSE_STORAGE_KEY = 'cispro.course-management.records'
export const COURSE_RECORD_SYNC_EVENT = 'cispro:courses-changed'

function normalizeCourseRecord(record = {}, index = 0) {
  return {
    ...record,
    id: String(record.id || record.courseCode || record.name || `course-${index + 1}`),
    courseCode: String(record.courseCode || '').trim(),
    name: String(record.name || '').trim(),
    mode: String(record.mode || '').trim(),
    duration: String(record.duration ?? '').trim(),
    hours: String(record.hours ?? '').trim(),
    actualFees: String(record.actualFees ?? '').trim(),
    registrationFees: String(record.registrationFees ?? '').trim(),
    discount: String(record.discount ?? '').trim(),
    status: String(record.status || 'Active').trim(),
  }
}

function readStoredCourseRecords() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(COURSE_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(Boolean).map((record, index) => normalizeCourseRecord(record, index))
  } catch {
    return []
  }
}

export function loadCourseRecords() {
  return readStoredCourseRecords()
}

export function saveCourseRecords(records) {
  const nextRecords = Array.isArray(records)
    ? records.filter(Boolean).map((record, index) => normalizeCourseRecord(record, index))
    : []

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(nextRecords))
    window.dispatchEvent(new CustomEvent(COURSE_RECORD_SYNC_EVENT))
  }

  return nextRecords
}
