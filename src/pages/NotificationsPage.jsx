import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bell, CheckCheck, ChevronDown, CircleAlert, Filter, MoreVertical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { dashboardPathByRole, roleLabels } from '../data/authData'
import { getNotificationSections } from '../data/notificationsData'
import { OperationManagerHeader } from '../components/OperationManagerHeader'
import { useMobileMenu } from '../layouts/mobileMenuContext'

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
                <span className="notifications-item-dot" aria-hidden="true" />
              </span>

              <div className="notifications-item-copy">
                <div className="notifications-item-title-row">
                  <h3>{item.title}</h3>
                  <small>{item.time}</small>
                </div>
                <p>{item.message}</p>
              </div>

              <div className="notifications-item-meta">
                <span className={`notifications-item-chip tone-${item.tone}`}>
                  {item.categoryLabel || item.actionLabel || 'View'}
                </span>
                <button type="button" className="notifications-item-kebab" aria-label="More actions">
                  <MoreVertical size={16} strokeWidth={2.3} aria-hidden="true" focusable="false" />
                </button>
              </div>
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
  const openMenu = useMobileMenu()
  const filterMenuRef = useRef(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const sections = useMemo(() => getNotificationSections(role), [role])
  const visibleSections = useMemo(() => {
    if (activeFilter === 'all') return sections

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (activeFilter === 'unread') return Boolean(item.unread)
          if (activeFilter === 'read') return !item.unread
          return true
        }),
      }))
      .filter((section) => section.items.length)
  }, [activeFilter, sections])
  const totalCount = useMemo(
    () => sections.reduce((count, section) => count + section.items.length, 0),
    [sections],
  )
  const unreadCount = useMemo(
    () => sections.reduce((count, section) => count + section.items.filter((item) => item.unread).length, 0),
    [sections],
  )
  const roleLabel = roleLabels[role] || 'Workspace'
  const isBusinessOwner = role === 'business-owner'
  const headerTitle = isBusinessOwner ? 'Business Owner Dashboard' : 'Operation Manager Dashboard'
  const headerEyebrow = isBusinessOwner ? 'Business Owner' : 'Operation Manager'
  const headerSummary = isBusinessOwner ? '' : 'Notifications, approvals, and team updates.'
  const headerInitials = isBusinessOwner ? 'BW' : 'OM'
  const headerProfileTitle = isBusinessOwner ? 'Business Head' : 'Operation Manager'
  const headerEmail = isBusinessOwner ? 'business.owner@cispro.com' : 'operation.manager@cispro.com'
  const activeFilterLabel =
    activeFilter === 'all' ? 'Filter' : activeFilter === 'unread' ? 'Unread' : 'Read'

  useEffect(() => {
    if (!isFilterMenuOpen) return undefined

    const handlePointerDown = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setIsFilterMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsFilterMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFilterMenuOpen])

  const markAllAsRead = () => {
    setActiveFilter('all')
    setIsFilterMenuOpen(false)
  }

  return (
    <section className="notifications-page">
      <OperationManagerHeader
        className="notifications-page-top-header"
        eyebrow={headerEyebrow}
        title={headerTitle}
        summary={headerSummary}
        initials={headerInitials}
        profileTitle={headerProfileTitle}
        email={headerEmail}
        onOpenMenu={openMenu}
      />

      <header className="notifications-page-header">
        <div className="notifications-page-copy">
          <p className="eyebrow">Notifications</p>
          <h2>Notifications</h2>
          <p>
            You have <strong>{totalCount}</strong> notifications to go through
            {unreadCount ? <span> and {unreadCount} unread items</span> : null} for {roleLabel}.
          </p>
        </div>

        <div className="notifications-page-actions">
          <button
            type="button"
            className="notifications-back-button"
            onClick={() => navigate(dashboardPathByRole[role] || '/dashboard')}
          >
            <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            Back to dashboard
          </button>

          <button type="button" className="notifications-mark-read" onClick={markAllAsRead}>
            <CheckCheck size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            Mark all as read
          </button>

          <div ref={filterMenuRef} className="notifications-filter-menu">
            <button
              type="button"
              className="notifications-filter-button"
              onClick={() => setIsFilterMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={isFilterMenuOpen}
            >
              <Filter size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
              {activeFilterLabel}
              <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            </button>

            {isFilterMenuOpen ? (
              <div className="notifications-filter-dropdown" role="menu" aria-label="Notification filters">
                {[
                  { key: 'all', label: 'All notifications', icon: Bell },
                  { key: 'unread', label: 'Unread only', icon: CircleAlert },
                  { key: 'read', label: 'Read only', icon: CheckCheck },
                ].map((option) => {
                  const Icon = option.icon

                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`notifications-filter-option ${activeFilter === option.key ? 'is-active' : ''}`.trim()}
                      onClick={() => {
                        setActiveFilter(option.key)
                        setIsFilterMenuOpen(false)
                      }}
                      role="menuitem"
                    >
                      <Icon size={15} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                      <span>{option.label}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="notifications-feed">
        {visibleSections.map((section) => (
          <NotificationGroup key={section.label} label={section.label} items={section.items} />
        ))}
      </div>
    </section>
  )
}
