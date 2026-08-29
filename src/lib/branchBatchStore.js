const BRANCH_BATCH_GROUPS_KEY = 'cispro.branch-batch-groups'

function isBrowser() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function normalizeBranchScope(branchScope) {
  const values = []

  if (!branchScope) return values

  if (Array.isArray(branchScope)) {
    branchScope.forEach((value) => {
      values.push(...normalizeBranchScope(value))
    })
    return [...new Set(values)]
  }

  if (typeof branchScope === 'object') {
    values.push(branchScope.id, branchScope.branchId, branchScope.branchCode)
  } else {
    values.push(branchScope)
  }

  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function getRecordBranchKeys(record = {}) {
  return normalizeBranchScope([
    record.branchId,
    record.branchCode,
    record.branchKey,
  ])
}

function recordMatchesBranchScope(record, branchScope) {
  const scopeKeys = normalizeBranchScope(branchScope)
  if (!scopeKeys.length) return true

  const recordKeys = getRecordBranchKeys(record)
  return scopeKeys.some((scopeKey) => recordKeys.includes(scopeKey))
}

function readAll() {
  if (!isBrowser()) return []

  try {
    const raw = window.localStorage.getItem(BRANCH_BATCH_GROUPS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(records) {
  if (!isBrowser()) return

  try {
    window.localStorage.setItem(BRANCH_BATCH_GROUPS_KEY, JSON.stringify(records))
  } catch {
    // Ignore storage failures so the dashboard still renders.
  }
}

function dispatchChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cispro:branch-batch-groups-changed'))
  }
}

function normalizeStatus(value = '') {
  const text = String(value || '').trim()
  if (!text) return 'Active'

  const lower = text.toLowerCase()
  if (lower === 'active' || lower === 'open' || lower === 'full' || lower === 'inactive' || lower === 'closed') {
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }

  return text
}

function normalizeTimingValue(value = '') {
  return String(value || '').trim()
}

function normalizeSeatsValue(value = '') {
  const seats = Number(value)
  return Number.isFinite(seats) && seats > 0 ? seats : 0
}

function normalizeBatchRow(row = {}, index = 0) {
  const startTime = normalizeTimingValue(row.startTime || row.fromTime || '')
  const endTime = normalizeTimingValue(row.endTime || row.toTime || '')
  const totalSeats = normalizeSeatsValue(row.totalSeats || row.seatCount || row.seats || 0)
  const batchId = String(row.batchId || row.id || '').trim() || `BAT-${String(index + 1).padStart(3, '0')}`
  const batchName = String(row.batchName || row.name || '').trim()

  return {
    ...row,
    id: String(row.id || batchId || `batch-row-${index + 1}`).trim(),
    batchId,
    batchName,
    startTime,
    endTime,
    batchTiming: String(row.batchTiming || `${startTime}${startTime && endTime ? ' - ' : ''}${endTime}`).trim(),
    totalSeats,
    status: normalizeStatus(row.status || 'Active'),
    warning: String(row.warning || '').trim(),
  }
}

function normalizeBatchGroup(group = {}) {
  const batches = Array.isArray(group.batches) ? group.batches.map((row, index) => normalizeBatchRow(row, index)) : []
  const primaryBatchId = String(group.batchId || batches[0]?.batchId || '').trim()

  return {
    ...group,
    id: String(group.id || primaryBatchId || group.batchGroupId || `batch-group-${Date.now()}`).trim(),
    batchGroupId: String(group.batchGroupId || group.id || primaryBatchId || '').trim(),
    batchId: primaryBatchId,
    branchId: String(group.branchId || '').trim(),
    branchCode: String(group.branchCode || '').trim(),
    courseId: String(group.courseId || '').trim(),
    courseName: String(group.courseName || '').trim(),
    courseCode: String(group.courseCode || '').trim(),
    facultyId: String(group.facultyId || '').trim(),
    facultyName: String(group.facultyName || '').trim(),
    status: normalizeStatus(group.status || batches[0]?.status || 'Active'),
    batches,
    batchCount: Number(group.batchCount ?? batches.length) || batches.length,
    createdAt: String(group.createdAt || new Date().toISOString()).trim(),
    updatedAt: String(group.updatedAt || new Date().toISOString()).trim(),
  }
}

export function loadBranchBatchGroups(branchScope = '') {
  return readAll()
    .map(normalizeBatchGroup)
    .filter((record) => recordMatchesBranchScope(record, branchScope))
}

export function saveBranchBatchGroups(records = []) {
  const normalized = Array.isArray(records) ? records.map(normalizeBatchGroup) : []
  writeAll(normalized)
  dispatchChange()
  return normalized
}

export function upsertBranchBatchGroup(record = {}) {
  const nextRecord = normalizeBatchGroup({
    ...record,
    updatedAt: new Date().toISOString(),
  })

  const all = readAll().map(normalizeBatchGroup)
  const next = [
    nextRecord,
    ...all.filter((item) => {
      if (nextRecord.id && item.id === nextRecord.id) return false
      if (nextRecord.batchGroupId && item.batchGroupId === nextRecord.batchGroupId) return false
      if (nextRecord.batchId && item.batchId === nextRecord.batchId) return false
      return true
    }),
  ]

  writeAll(next)
  dispatchChange()
  return nextRecord
}

export function subscribeBranchBatchGroups(listener) {
  if (typeof window === 'undefined') return () => {}

  const handleStorage = (event) => {
    if (event.key === BRANCH_BATCH_GROUPS_KEY) {
      listener()
    }
  }

  const handleCustomEvent = () => {
    listener()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener('cispro:branch-batch-groups-changed', handleCustomEvent)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener('cispro:branch-batch-groups-changed', handleCustomEvent)
  }
}

export function getNextBatchSequenceNumber(groups = []) {
  const records = Array.isArray(groups) ? groups : []
  let maxSequence = 0

  records.forEach((group) => {
    const ids = [group?.batchId, ...(Array.isArray(group?.batches) ? group.batches.map((batch) => batch?.batchId) : [])]
    ids.forEach((id) => {
      const match = String(id || '').trim().match(/^BAT-(\d+)$/i)
      if (!match) return
      maxSequence = Math.max(maxSequence, Number(match[1]) || 0)
    })
  })

  return maxSequence + 1
}

export function makeBatchId(sequenceNumber = 1) {
  const safeSequence = Math.max(1, Number(sequenceNumber) || 1)
  return `BAT-${String(safeSequence).padStart(3, '0')}`
}

