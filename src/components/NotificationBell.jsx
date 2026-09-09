import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { getNotificationItems, getUnreadNotificationCount } from '../data/notificationsData'
import { request } from '../services/apiClient'

export function NotificationBell() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  const [remoteItems, setRemoteItems] = useState([])
  const [remoteCount, setRemoteCount] = useState(0)
  const [error, setError] = useState('')
  const isStudent = String(role).toUpperCase() === 'STUDENT'
  const notificationItems = isStudent ? remoteItems : getNotificationItems(role)
  const visibleItems = notificationItems.slice(0, isStudent ? 20 : 2)
  const unreadCount = isStudent ? remoteCount : getUnreadNotificationCount(role)

  useEffect(() => {
    if (!isStudent) return undefined
    let active = true
    const load = async () => {
      try {
        const response = await request('/notifications?limit=20&page=1')
        const body = response?.data?.data ? response.data : response
        if (active) {
          setRemoteItems((body.data || []).map(item => ({ ...item, icon: Bell, time: new Date(item.createdAt).toLocaleString(), featured: !item.read })))
          setRemoteCount(body.meta?.unreadCount ?? 0); setError('')
        }
      } catch (err) { if (active) setError(err.message) }
    }
    void load()
    const timer = setInterval(load, 30000)
    window.addEventListener('focus', load)
    window.addEventListener('institute-leave-updated', load)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('institute-leave-updated', load) }
  }, [isStudent])
  const markRead = async () => {
    if (!isStudent) return
    try {
      await request('/notifications/mark-read', { method: 'PATCH', body: JSON.stringify({ notificationIds: remoteItems.map(item => item.id) }) })
      window.dispatchEvent(new Event('institute-leave-updated'))
    } catch (err) { setError(err.message) }
  }

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
        onClick={() => setIsOpen(true)}
      >
        <Bell size={20} strokeWidth={2.2} aria-hidden="true" focusable="false" />
        <b>{unreadCount}</b>
      </button>

      {isOpen ? (
        <div className="notification-dropdown" role="menu" aria-label="Notifications">
          <div className="notification-dropdown-head">
            <strong>Notifications</strong>
            <button type="button" className="notification-mark-read" onClick={markRead}>
              Mark all as read
            </button>
          </div>

          <div className="notification-dropdown-list">
            {error ? <p role="alert">{error}</p> : null}
            {isStudent && !visibleItems.length ? <p>No notifications yet.</p> : null}
            {visibleItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  type="button"
                  key={`${item.title}-${item.time}`}
                  className={`notification-dropdown-item ${item.featured ? 'is-highlighted' : ''}`.trim()}
                  onClick={() => {
                    setIsOpen(false)
                    if (isStudent) { void markRead() } else navigate('/notifications')
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

          {!isStudent ? <button
            className="notification-dropdown-footer"
            type="button"
            onClick={() => {
              setIsOpen(false)
              navigate('/notifications')
            }}
          >
            View all notifications
          </button> : null}
        </div>
      ) : null}
    </div>
  )
}
