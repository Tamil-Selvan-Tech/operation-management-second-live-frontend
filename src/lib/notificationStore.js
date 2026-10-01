const NOTIFICATION_STORAGE_KEY = 'cispro.super-admin.notifications'
const NOTIFICATION_EVENT_NAME = 'cispro:super-admin-notifications-changed'
// Notifications are a browser cache, not the source of truth. Keep the cache
// bounded so repeated progress synchronisation cannot exhaust localStorage.
const MAX_STORED_NOTIFICATIONS = 250

const isFacultyLoginNotification = (notification = {}) => {
  const kind = String(notification.kind || '').trim().toLowerCase()
  return kind === 'faculty-login' || kind === 'branch-faculty-login'
}

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const readJSON = (key) => {
  if (!isBrowser()) return null

  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

const writeJSON = (key, value) => {
  if (!isBrowser()) return

  const serialized = JSON.stringify(value)

  try {
    window.localStorage.setItem(key, serialized)
    return true
  } catch (error) {
    // A user may already have an oversized value from an older build, or
    // another localStorage entry may be consuming the available quota. Do not
    // let a storage problem take down the React tree. Callers that write an
    // array can retry with a smaller cache below.
    if (error?.name !== 'QuotaExceededError' && error?.code !== 22) {
      return false
    }

    return false
  }
}

const limitStoredNotifications = (notifications = []) =>
  (Array.isArray(notifications) ? notifications : []).slice(0, MAX_STORED_NOTIFICATIONS)

const writeNotifications = (notifications = []) => {
  const boundedNotifications = limitStoredNotifications(notifications)
  const retrySizes = [
    boundedNotifications.length,
    Math.min(100, boundedNotifications.length),
    Math.min(50, boundedNotifications.length),
    Math.min(25, boundedNotifications.length),
    0,
  ].filter((size, index, sizes) => sizes.indexOf(size) === index)

  for (const size of retrySizes) {
    if (writeJSON(NOTIFICATION_STORAGE_KEY, boundedNotifications.slice(0, size))) {
      return boundedNotifications.slice(0, size)
    }
  }

  return []
}

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const normalizeNotificationTitle = (title = '') => {
  return String(title || '')
    .replace(/^🔔\s*/u, '')
    .trim()
}

const normalizeCreatedAt = (notification = {}) => {
  const createdAt = String(notification.createdAt || '').trim()
  if (createdAt) return createdAt

  const updatedAt = String(notification.updatedAt || '').trim()
  if (updatedAt) return updatedAt

  return new Date().toISOString()
}

const normalizeNotification = (notification = {}) => {
  const createdAt = normalizeCreatedAt(notification)
  const kind = String(notification.kind || 'general').trim() || 'general'
  const tone = String(notification.tone || 'blue').trim() || 'blue'

  return {
    id: String(notification.id || createId()),
    kind,
    tone,
    title: normalizeNotificationTitle(notification.title),
    message: String(notification.message || '').trim(),
    summary: String(notification.summary || '').trim(),
    actionLabel: String(notification.actionLabel || '').trim(),
    branchId: String(notification.branchId || '').trim(),
    targetBranchId: String(notification.targetBranchId || '').trim(),
    targetBranchEmail: String(notification.targetBranchEmail || '').trim().toLowerCase(),
    targetBranchName: String(notification.targetBranchName || '').trim(),
    facultyId: String(notification.facultyId || '').trim(),
    facultyEmail: String(notification.facultyEmail || '').trim().toLowerCase(),
    facultyName: String(notification.facultyName || '').trim(),
    targetSection: String(notification.targetSection || '').trim(),
    courseId: String(notification.courseId || '').trim(),
    courseCode: String(notification.courseCode || '').trim(),
    courseName: String(notification.courseName || '').trim(),
    requestId: String(notification.requestId || '').trim(),
    requestStatus: String(notification.requestStatus || '').trim(),
    requestTitle: String(notification.requestTitle || '').trim(),
    requestReason: String(notification.requestReason || '').trim(),
    requestDescription: String(notification.requestDescription || '').trim(),
    requestedChanges: String(notification.requestedChanges || '').trim(),
    sourceNotificationId: String(notification.sourceNotificationId || '').trim(),
    changeSummary: String(notification.changeSummary || '').trim(),
    changeSet: notification.changeSet && typeof notification.changeSet === 'object' ? notification.changeSet : null,
    studentId: String(notification.studentId || '').trim(),
    studentName: String(notification.studentName || '').trim(),
    courseProgress: String(notification.courseProgress || '').trim(),
    paidProgress: String(notification.paidProgress || '').trim(),
    statusKey: String(notification.statusKey || '').trim(),
    statusLabel: String(notification.statusLabel || '').trim(),
    recipientLabel: String(notification.recipientLabel || '').trim(),
    createdAt,
    read: Boolean(notification.read),
    dropdownViewed: Boolean(notification.dropdownViewed),
  }
}

export function loadNotifications() {
  const stored = readJSON(NOTIFICATION_STORAGE_KEY)
  if (!Array.isArray(stored)) return []

  let needsBackfill = false
  const nextNotifications = stored
    .map((notification) => {
      const normalizedNotification = normalizeNotification(notification)
      const rawCreatedAt = String(notification?.createdAt || '').trim()
      const rawUpdatedAt = String(notification?.updatedAt || '').trim()
      const rawTitle = String(notification?.title || '').trim()
      const normalizedCreatedAt = String(normalizedNotification.createdAt || '').trim()
      const normalizedTitle = String(normalizedNotification.title || '').trim()

      if (!rawCreatedAt && normalizedCreatedAt) {
        needsBackfill = true
      } else if (!rawCreatedAt && rawUpdatedAt && normalizedCreatedAt === rawUpdatedAt) {
        needsBackfill = true
      }

      if (rawTitle !== normalizedTitle) {
        needsBackfill = true
      }

      return normalizedNotification
    })
    .filter((notification) =>
      !isFacultyLoginNotification(notification) &&
      (
        String(notification.kind || '').startsWith('branch-') ||
        String(notification.kind || '').startsWith('faculty-') ||
        String(notification.kind || '').startsWith('course-edit-') ||
        String(notification.kind || '').startsWith('faculty-progress-status') ||
        String(notification.kind || '').startsWith('branch-progress-status')
      ),
    )

  const boundedNotifications = limitStoredNotifications(nextNotifications)

  if (boundedNotifications.length !== stored.length || needsBackfill) {
    saveNotifications(boundedNotifications, { emit: false })
  }

  return boundedNotifications
}

export function saveNotifications(notifications = [], options = {}) {
  const normalizedNotifications = notifications
    .filter((notification) => !isFacultyLoginNotification(notification))
    .map(normalizeNotification)
  writeNotifications(normalizedNotifications)
  if (options?.emit === false) {
    return notifications
  }

  emitNotificationChange()
  return notifications
}

export function mergeNotificationsWithStoredState(notifications = []) {
  const storedNotifications = loadNotifications()
  const readStateById = new Map(storedNotifications.map((notification) => [String(notification.id), Boolean(notification.read)]))
  const viewedStateById = new Map(
    storedNotifications.map((notification) => [String(notification.id), Boolean(notification.dropdownViewed)]),
  )

  return (Array.isArray(notifications) ? notifications : [])
    .filter((notification) => !isFacultyLoginNotification(notification))
    .map((notification) => {
    const normalizedNotification = normalizeNotification(notification)
    const storedReadState = readStateById.get(String(normalizedNotification.id))
    const storedViewedState = viewedStateById.get(String(normalizedNotification.id))

    return {
      ...normalizedNotification,
      read: Boolean(storedReadState ?? normalizedNotification.read),
      dropdownViewed: Boolean(storedViewedState ?? normalizedNotification.dropdownViewed),
    }
    })
}

function emitNotificationChange() {
  if (!isBrowser()) return

  window.dispatchEvent(new Event(NOTIFICATION_EVENT_NAME))
}

export function subscribeNotifications(listener) {
  if (!isBrowser()) return () => {}

  const handleStorage = (event) => {
    if (event.key === NOTIFICATION_STORAGE_KEY) {
      listener()
    }
  }

  const handleCustomEvent = () => {
    listener()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(NOTIFICATION_EVENT_NAME, handleCustomEvent)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(NOTIFICATION_EVENT_NAME, handleCustomEvent)
  }
}

export function addNotification(notification = {}) {
  const nextNotification = normalizeNotification(notification)
  const nextNotifications = [nextNotification, ...loadNotifications()]
  saveNotifications(nextNotifications)
  return nextNotification
}

export function updateNotification(notificationId = '', updates = {}) {
  const normalizedId = String(notificationId || '').trim()
  if (!normalizedId) return null

  let updatedNotification = null
  const nextNotifications = loadNotifications().map((notification) => {
    if (String(notification.id || '').trim() !== normalizedId) {
      return notification
    }

    updatedNotification = normalizeNotification({
      ...notification,
      ...updates,
      id: notification.id,
    })

    return updatedNotification
  })

  if (!updatedNotification) return null

  saveNotifications(nextNotifications)
  emitNotificationChange()
  return updatedNotification
}

export function markNotificationsAsRead(notificationIds = null) {
  const normalizedIds =
    Array.isArray(notificationIds) && notificationIds.length
      ? new Set(notificationIds.map((id) => String(id)))
      : null

  const nextNotifications = loadNotifications().map((notification) => {
    if (!normalizedIds) {
      return { ...notification, read: true, dropdownViewed: true }
    }

    return normalizedIds.has(String(notification.id))
      ? { ...notification, read: true, dropdownViewed: true }
      : notification
  })

  saveNotifications(nextNotifications)
  return nextNotifications
}

export function markNotificationsAsDropdownViewed(notificationIds = null) {
  const normalizedIds =
    Array.isArray(notificationIds) && notificationIds.length
      ? new Set(notificationIds.map((id) => String(id)))
      : null

  const nextNotifications = loadNotifications().map((notification) => {
    if (!normalizedIds) {
      return { ...notification, dropdownViewed: true }
    }

    return normalizedIds.has(String(notification.id))
      ? { ...notification, dropdownViewed: true }
      : notification
  })

  saveNotifications(nextNotifications)
  return nextNotifications
}

export function getUnreadNotificationsCount() {
  return loadNotifications().filter((notification) => !notification.read).length
}

export function hasBranchNotification(kind, branch = {}) {
  const normalizedKind = String(kind || '').trim()
  const normalizedBranchId = String(branch.id || branch.branchId || '').trim()
  const normalizedBranchEmail = String(branch.branchEmail || '').trim().toLowerCase()

  if (!normalizedKind) return false

  return loadNotifications().some((notification) => {
    if (notification.kind !== normalizedKind) return false
    if (normalizedBranchId && String(notification.targetBranchId || '').trim() === normalizedBranchId) {
      return true
    }
    if (
      normalizedBranchEmail &&
      String(notification.targetBranchEmail || '').trim().toLowerCase() === normalizedBranchEmail
    ) {
      return true
    }
    return false
  })
}

export function addBranchCreatedNotification(branch = {}) {
  return addNotification({
    kind: 'branch-created',
    tone: 'blue',
    title: `${branch.branchName || branch.branchId || 'Branch'} created`,
    message: `Invitation sent to ${branch.branchEmail || 'the registered email address'}.`,
    actionLabel: 'Created',
    targetBranchId: branch.id || branch.branchId || '',
    targetBranchEmail: branch.branchEmail || '',
    targetBranchName: branch.branchName || '',
  })
}

export function addBranchInvitationResentNotification(branch = {}) {
  return addNotification({
    kind: 'branch-mail',
    tone: 'amber',
    title: `Invitation active for ${branch.branchName || branch.branchId || 'Branch'}`,
    message: `Branch invitation is now active for ${branch.branchEmail || 'the registered email address'}.`,
    actionLabel: 'Mail sent',
    targetBranchId: branch.id || branch.branchId || '',
    targetBranchEmail: branch.branchEmail || '',
    targetBranchName: branch.branchName || '',
  })
}

export function addBranchLoginNotification(branch = {}) {
  return addNotification({
    kind: 'branch-login',
    tone: 'green',
    title: `${branch.branchName || branch.branchId || 'Branch'} is active`,
    message: `${branch.branchAdminName || 'Branch admin'} logged in with ${branch.branchEmail || 'their branch account'}.`,
    actionLabel: 'Logged in',
    targetBranchId: branch.id || branch.branchId || '',
    targetBranchEmail: branch.branchEmail || '',
    targetBranchName: branch.branchName || '',
  })
}
