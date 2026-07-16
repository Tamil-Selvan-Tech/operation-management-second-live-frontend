import { useState } from 'react'
import { AlertTriangle, Bell, CalendarDays, CreditCard, ReceiptText } from 'lucide-react'

const notificationItems = [
  {
    tone: 'red',
    icon: ReceiptText,
    title: 'Student fee payment updated',
    message: 'Varsha\'s full payment has been saved and marked as completed.',
    time: '5 mins ago',
    featured: false,
  },
  {
    tone: 'yellow',
    icon: CreditCard,
    title: 'Installment payment received',
    message: 'A pending installment for the Next.js course has been collected successfully.',
    time: '15 mins ago',
    featured: true,
  },
  {
    tone: 'amber',
    icon: AlertTriangle,
    title: 'Overdue fee reminder',
    message: 'Three student fee payments are still overdue and need review today.',
    time: '1 hour ago',
    featured: false,
  },
  {
    tone: 'blue',
    icon: CalendarDays,
    title: 'Admission update',
    message: 'A new student admission has been added to the dashboard successfully.',
    time: 'Today',
    featured: false,
  },
]

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const visibleItems = showAll ? notificationItems : notificationItems.slice(0, 2)

  return (
    <div
      className="notification-menu"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => {
        setIsOpen(false)
        setShowAll(false)
      }}
    >
      <button
        className="icon-chip notification-chip"
        type="button"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Bell size={20} strokeWidth={2.2} aria-hidden="true" focusable="false" />
        <b>{notificationItems.length}</b>
      </button>

      {isOpen ? (
        <div className="notification-dropdown" role="menu" aria-label="Notifications">
          <div className="notification-dropdown-head">
            <strong>Notifications</strong>
            <button type="button" className="notification-mark-read">
              Mark all as read
            </button>
          </div>

          <div className="notification-dropdown-list">
            {visibleItems.map((item) => {
              const Icon = item.icon
              return (
                <article
                  key={`${item.title}-${item.time}`}
                  className={`notification-dropdown-item ${item.featured ? 'is-highlighted' : ''}`.trim()}
                >
                  <span className={`notification-badge ${item.tone}`} aria-hidden="true">
                    <Icon size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                  </span>
                  <div className="notification-copy">
                    <p>{item.title}</p>
                    <span>{item.message}</span>
                    <small>{item.time}</small>
                  </div>
                </article>
              )
            })}
          </div>

          <button
            className="notification-dropdown-footer"
            type="button"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? 'Show less' : 'View all notifications'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
