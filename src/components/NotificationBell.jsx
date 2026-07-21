import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { getNotificationItems, getUnreadNotificationCount } from '../data/notificationsData'

export function NotificationBell() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  const notificationItems = getNotificationItems(role)
  const visibleItems = notificationItems.slice(0, 2)
  const unreadCount = getUnreadNotificationCount(role)

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div
      ref={menuRef}
      className="notification-menu"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => {
        setIsOpen(false)
      }}
      onFocusCapture={() => setIsOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
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
        <b>{unreadCount}</b>
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
                <button
                  type="button"
                  key={`${item.title}-${item.time}`}
                  className={`notification-dropdown-item ${item.featured ? 'is-highlighted' : ''}`.trim()}
                  onClick={() => {
                    setIsOpen(false)
                    navigate('/notifications')
                  }}
                >
                  <span className={`notification-badge ${item.tone}`} aria-hidden="true">
                    <Icon size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                  </span>
                  <div className="notification-copy">
                    <p>{item.title}</p>
                    <span>{item.message}</span>
                    <small>{item.time}</small>
                  </div>
                </button>
              )
            })}
          </div>

          <button
            className="notification-dropdown-footer"
            type="button"
            onClick={() => {
              setIsOpen(false)
              navigate('/notifications')
            }}
          >
            View all notifications
          </button>
        </div>
      ) : null}
    </div>
  )
}
