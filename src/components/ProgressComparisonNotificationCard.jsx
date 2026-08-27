import { AlertTriangle, Bell, CheckCircle2 } from 'lucide-react'

const ICON_BY_STATUS = {
  courseAhead: AlertTriangle,
  matched: CheckCircle2,
  paidAhead: Bell,
}

export function ProgressComparisonNotificationCard({ notification }) {
  if (!notification) return null

  const Icon = ICON_BY_STATUS[notification.statusKey] || Bell

  return (
    <article className={`notifications-item is-unread progress-comparison-notification ${notification.statusKey || ''}`.trim()}>
      <span className={`notifications-item-icon tone-${notification.tone || 'blue'}`} aria-hidden="true">
        <Icon size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
      </span>

      <div className="notifications-item-copy">
        <div className="notifications-item-title-row">
          <h3>{notification.title}</h3>
          <small>{notification.recipientLabel}</small>
        </div>

        <p><strong>Student Name:</strong> {notification.studentName}</p>
        <p><strong>Student ID:</strong> {notification.studentId}</p>
        <p><strong>Course Progress:</strong> {notification.courseProgress}%</p>
        <p><strong>Paid Progress:</strong> {notification.paidProgress}%</p>
        <p><strong>Status:</strong> {notification.statusLabel}</p>
        <p><strong>Summary:</strong> {notification.summary}</p>
      </div>

      <div className="notifications-item-meta">
        <span className={`notifications-item-chip tone-${notification.tone || 'blue'}`}>
          {notification.statusLabel}
        </span>
      </div>
    </article>
  )
}
