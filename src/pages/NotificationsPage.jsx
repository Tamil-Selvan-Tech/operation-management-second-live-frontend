import { useMemo } from 'react'
import { ArrowRight, Bell, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { dashboardPathByRole, roleLabels } from '../data/authData'
import { getNotificationSections } from '../data/notificationsData'

function NotificationGroup({ label, items }) {
  return (
    <section className="notifications-group">
      <p className="notifications-group-label">{label}</p>
      <div className="notifications-group-list">
        {items.map((item) => {
          const Icon = item.icon

          return (
            <article
              key={`${label}-${item.title}-${item.time}`}
              className={`notifications-item ${item.unread ? 'is-unread' : ''}`.trim()}
            >
              <span className={`notifications-item-icon tone-${item.tone}`} aria-hidden="true">
                <Icon size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
              </span>

              <div className="notifications-item-copy">
                <div className="notifications-item-title-row">
                  <h3>{item.title}</h3>
                  <small>{item.time}</small>
                </div>
                <p>{item.message}</p>
              </div>

              <button type="button" className="notifications-item-action">
                {item.actionLabel || 'View'}
                <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" focusable="false" />
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function NotificationsPage() {
  const { role } = useAuth()
  const navigate = useNavigate()

  const sections = useMemo(() => getNotificationSections(role), [role])
  const totalCount = useMemo(
    () => sections.reduce((count, section) => count + section.items.length, 0),
    [sections],
  )
  const unreadCount = useMemo(
    () => sections.reduce((count, section) => count + section.items.filter((item) => item.unread).length, 0),
    [sections],
  )
  const roleLabel = roleLabels[role] || 'Workspace'

  return (
    <section className="notifications-page">
      <article className="panel-card notifications-hero">
        <div className="notifications-hero-copy">
          <p className="eyebrow">Notifications</p>
          <h2>Notifications</h2>
          <p>
            You have <strong>{totalCount}</strong> notifications to go through
            {unreadCount ? <span> and {unreadCount} unread items</span> : null} for {roleLabel}.
          </p>
        </div>

        <div className="notifications-hero-actions">
          <button
            type="button"
            className="notifications-back-button"
            onClick={() => navigate(dashboardPathByRole[role] || '/dashboard')}
          >
            <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            Back to dashboard
          </button>

          <button type="button" className="notifications-mark-read">
            <Bell size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            Mark all as Read
          </button>
        </div>
      </article>

      <div className="notifications-feed">
        {sections.map((section) => (
          <NotificationGroup key={section.label} label={section.label} items={section.items} />
        ))}
      </div>
    </section>
  )
}
