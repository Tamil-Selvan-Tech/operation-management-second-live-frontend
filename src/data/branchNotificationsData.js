import { BadgeCheck, Bell, CheckCircle2, UsersRound, Mail } from 'lucide-react'
import { loadNotifications } from '../lib/notificationStore'

function formatNotificationTime(createdAt) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} mins ago`
  if (diffHours < 24) return `${diffHours} hrs ago`
  if (diffDays < 7) return `${diffDays} days ago`

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function getNotificationIcon(kind) {
  switch (kind) {
    case 'branch-created':
      return BadgeCheck
    case 'branch-mail':
      return Mail
    case 'branch-login':
      return CheckCircle2
    case 'branch-course-edit-request':
    case 'branch-course-edit-accepted':
    case 'branch-course-edit-updated':
      return Bell
    case 'branch-faculty-login':
    case 'faculty-login':
      return UsersRound
    default:
      return Bell
  }
}

export function normalizeBranchNotification(notification = {}) {
  const kind = String(notification.kind || '').trim()
  const title = String(notification.title || '').trim()
  const message = String(notification.message || '').trim()
  const createdAt = String(notification.createdAt || '').trim()
  const isFacultyLogin = kind === 'branch-faculty-login' || kind === 'faculty-login'
  const isCourseEditRequest = kind === 'branch-course-edit-request'
  const isCourseEditAccepted = kind === 'branch-course-edit-accepted'
  const isCourseEditUpdated = kind === 'branch-course-edit-updated'

  return {
    id: String(notification.id || '').trim(),
    kind: kind || 'general',
    tone:
      String(notification.tone || (isCourseEditAccepted ? 'green' : isCourseEditUpdated ? 'amber' : isFacultyLogin ? 'green' : 'blue'))
        .trim() || 'blue',
    title:
      title ||
      (isFacultyLogin
        ? `${notification.facultyName || notification.facultyEmail || 'Faculty'} logged in`
        : isCourseEditRequest
          ? `${notification.courseName || 'Course'} edit request`
          : isCourseEditAccepted
            ? `${notification.courseName || 'Course'} edit approved`
            : isCourseEditUpdated
              ? `${notification.courseName || 'Course'} updated`
        : 'Notification'),
    message:
      message ||
      (isFacultyLogin
        ? `${notification.facultyName || 'Faculty'} signed in with ${notification.facultyEmail || 'their account'}.`
        : isCourseEditRequest
          ? `${notification.facultyName || 'Faculty'} requested changes for ${notification.courseName || 'the course'}.`
          : isCourseEditAccepted
            ? `Open Edit is now available for ${notification.courseName || 'the course'}.`
            : isCourseEditUpdated
              ? `${notification.facultyName || 'Faculty'} saved module and submodule changes for ${notification.courseName || 'the course'}.`
        : ''),
    time: formatNotificationTime(createdAt),
    categoryLabel:
      String(notification.actionLabel || '').trim() ||
      (isCourseEditRequest
        ? 'Accept request'
        : isCourseEditAccepted
          ? 'Accepted'
          : isCourseEditUpdated
            ? 'Updated'
            : isFacultyLogin
              ? 'Faculty'
              : 'View'),
    unread: !notification.read,
    dropdownViewed: Boolean(notification.dropdownViewed),
    icon: getNotificationIcon(kind),
    targetSection:
      String(notification.targetSection || '').trim() ||
      (isCourseEditRequest || isCourseEditAccepted || isCourseEditUpdated
        ? 'courses'
        : isFacultyLogin
          ? 'faculty'
          : 'batches'),
    facultyName: String(notification.facultyName || '').trim(),
    facultyEmail: String(notification.facultyEmail || '').trim(),
    targetBranchName: String(notification.targetBranchName || '').trim(),
    courseId: String(notification.courseId || '').trim(),
    courseCode: String(notification.courseCode || '').trim(),
    courseName: String(notification.courseName || '').trim(),
    requestId: String(notification.requestId || '').trim(),
    requestStatus: String(notification.requestStatus || '').trim(),
    requestedChanges: String(notification.requestedChanges || '').trim(),
  }
}

export function groupByDate(notifications = []) {
  const groups = new Map()

  notifications
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .forEach((notification) => {
      const date = new Date(notification.createdAt)
      if (Number.isNaN(date.getTime())) return

      const today = new Date()
      const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`

      const label =
        dateKey === todayKey
          ? 'Today'
          : dateKey === yesterdayKey
            ? 'Yesterday'
            : new Intl.DateTimeFormat('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }).format(date)

      if (!groups.has(label)) {
        groups.set(label, [])
      }

      groups.get(label).push(notification)
    })

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }))
}

export function getBranchNotificationSections({ hideViewed = false } = {}) {
  const branchNotifications = loadNotifications()
    .map(normalizeBranchNotification)
    .filter((notification) => !hideViewed || !notification.dropdownViewed)

  if (branchNotifications.length) {
    return groupByDate(branchNotifications)
  }

  return []
}

export function getBranchNotificationItems(options = {}) {
  return getBranchNotificationSections(options).flatMap((section) => section.items)
}

export function getBranchUnreadNotificationCount({ hideViewed = false } = {}) {
  return getBranchNotificationItems({ hideViewed }).filter((item) => item.unread).length
}
