const NOTIFICATION_STORAGE_KEY = 'cispro.super-admin.notifications'
const NOTIFICATION_EVENT_NAME = 'cispro:super-admin-notifications-changed'

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
  window.localStorage.setItem(key, JSON.stringify(value))
}

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const normalizeNotification = (notification = {}) => {
  const createdAt = String(notification.createdAt || '').trim() || new Date().toISOString()
  const kind = String(notification.kind || 'general').trim() || 'general'
  const tone = String(notification.tone || 'blue').trim() || 'blue'

  return {
    id: String(notification.id || createId()),
    kind,
    tone,
    title: String(notification.title || '').trim(),
    message: String(notification.message || '').trim(),
    actionLabel: String(notification.actionLabel || '').trim(),
    targetBranchId: String(notification.targetBranchId || '').trim(),
    targetBranchEmail: String(notification.targetBranchEmail || '').trim().toLowerCase(),
    targetBranchName: String(notification.targetBranchName || '').trim(),
    createdAt,
    read: Boolean(notification.read),
  }
}

export function loadNotifications() {
  const stored = readJSON(NOTIFICATION_STORAGE_KEY)
  if (!Array.isArray(stored)) return []

  const nextNotifications = stored
    .map(normalizeNotification)
    .filter((notification) => String(notification.kind || '').startsWith('branch-'))

  if (nextNotifications.length !== stored.length) {
    saveNotifications(nextNotifications)
  }

  return nextNotifications
}

export function saveNotifications(notifications = []) {
  writeJSON(NOTIFICATION_STORAGE_KEY, notifications.map(normalizeNotification))
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
  emitNotificationChange()
  return nextNotification
}

export function markNotificationsAsRead(notificationIds = null) {
  const normalizedIds =
    Array.isArray(notificationIds) && notificationIds.length
      ? new Set(notificationIds.map((id) => String(id)))
      : null

  const nextNotifications = loadNotifications().map((notification) => {
    if (!normalizedIds) {
      return { ...notification, read: true }
    }

    return normalizedIds.has(String(notification.id))
      ? { ...notification, read: true }
      : notification
  })

  saveNotifications(nextNotifications)
  emitNotificationChange()
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
