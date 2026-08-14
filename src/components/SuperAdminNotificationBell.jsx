import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  Bell,
  CheckCircle2,
  Mail,
  Shield,
} from 'lucide-react'

import { request } from '../services/apiClient'

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
    case 'branch-login':
      return CheckCircle2
    case 'branch-mail':
      return Mail
    case 'branch-created':
      return BadgeCheck
    default:
      return Shield
  }
}

export function SuperAdminNotificationBell({ onOpenBranches }) {
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshNotifications = async () => {
    try {
      const response = await request('/notifications?limit=20&page=1', {
        method: 'GET',
      })
      const data = Array.isArray(response?.data) ? response.data : []
      setNotifications(data)
    } catch {
      setNotifications([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshNotifications()
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshNotifications()
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const handleFocus = () => {
      void refreshNotifications()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshNotifications()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

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

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const notificationCount = useMemo(() => notifications.length, [notifications])
  const visibleNotifications = useMemo(() => notifications.slice(0, 4), [notifications])

  const handleOpenNotification = (notification) => {
    setIsOpen(false)
    void request('/notifications/mark-read', {
      method: 'PATCH',
      body: JSON.stringify({ notificationIds: [notification.id] }),
    }).catch(() => {})

    if (notification.kind?.startsWith('branch-') && typeof onOpenBranches === 'function') {
      onOpenBranches(notification)
      return
    }

    navigate('/dashboard/super-admin')
  }

  const handleMarkAllAsRead = () => {
    void request('/notifications/mark-read', {
      method: 'PATCH',
      body: JSON.stringify({ notificationIds: [] }),
    })
      .catch(() => {})
      .finally(() => {
        void refreshNotifications()
      })
  }

  return (
    <div
      ref={menuRef}
      className="notification-menu super-admin-notification-menu"
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
        <b>{isLoading ? '...' : notificationCount}</b>
      </button>

      {isOpen ? (
        <div className="notification-dropdown" role="menu" aria-label="Notifications">
          <div className="notification-dropdown-head">
            <strong>Notifications</strong>
            <button type="button" className="notification-mark-read" onClick={handleMarkAllAsRead}>
              Mark all as read
            </button>
          </div>

          <div className="notification-dropdown-list">
            {visibleNotifications.length ? (
              visibleNotifications.map((notification) => {
                const Icon = getNotificationIcon(notification.kind)
                return (
                  <button
                    type="button"
                    key={notification.id}
                    className={`notification-dropdown-item ${notification.read ? 'is-muted' : 'is-highlighted'}`.trim()}
                    onClick={() => handleOpenNotification(notification)}
                  >
                    <span className={`notification-badge ${notification.tone}`} aria-hidden="true">
                      <Icon size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                    </span>
                    <div className="notification-copy">
                      <p>{notification.title}</p>
                      <span>{notification.message}</span>
                      <small>{formatNotificationTime(notification.createdAt)}</small>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="notification-dropdown-item is-muted" role="presentation">
                <span className="notification-badge blue" aria-hidden="true">
                  <Shield size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                </span>
                <div className="notification-copy">
                  <p>No notifications yet</p>
                  <span>Branch login and branch invitation alerts will appear here.</span>
                  <small>Waiting for activity</small>
                </div>
              </div>
            )}
          </div>

          <button
            className="notification-dropdown-footer"
            type="button"
            onClick={() => {
              setIsOpen(false)
              if (typeof onOpenBranches === 'function') {
                onOpenBranches()
              } else {
                navigate('/dashboard/super-admin')
              }
            }}
          >
            View branch activity
          </button>
        </div>
      ) : null}
    </div>
  )
}
