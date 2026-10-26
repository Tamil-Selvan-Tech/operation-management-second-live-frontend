import { useEffect, useRef, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { getNotificationItems, getUnreadNotificationCount } from '../data/notificationsData'
import { request } from '../services/apiClient'
import { filterNotificationsForDisplay, isNotificationAvailable, unwrapNotifications } from '../services/notificationService'

export function NotificationBell() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  const [remoteItems, setRemoteItems] = useState([])
  const [remoteCount, setRemoteCount] = useState(0)
  const [error, setError] = useState('')
  const roleKey = String(role).toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  const isSalesAdmin = ['SALES_ADMIN', 'SALESADMIN'].includes(roleKey)
  const isRemoteNotifications = roleKey === 'STUDENT' || isSalesAdmin
  const isStudent = roleKey === 'STUDENT'
  const availableRemoteItems = isRemoteNotifications ? filterNotificationsForDisplay(remoteItems) : []
  const notificationItems = isRemoteNotifications ? availableRemoteItems : getNotificationItems(role)
  const visibleItems = (isSalesAdmin ? notificationItems.filter(item => !item.read) : notificationItems).slice(0, isRemoteNotifications ? 3 : 2)
  const deferredUnreadCount = isRemoteNotifications ? remoteItems.filter(item => !item.read && !isNotificationAvailable(item)).length : 0
  const unreadCount = isRemoteNotifications ? Math.max(0, remoteCount - deferredUnreadCount) : getUnreadNotificationCount(role)

  useEffect(() => {
    if (!isRemoteNotifications) return undefined
    let active = true
    const load = async () => {
      try {
        const response = await request('/notifications?limit=20&page=1')
        const body = unwrapNotifications(response)
        if (active) {
          setRemoteItems((body.data || []).map(item => ({ ...item, icon: Bell, time: new Date(item.createdAt).toLocaleString(), featured: !item.read })))
          setRemoteCount(body.meta?.unreadCount ?? 0); setError('')
        }
      } catch (err) { if (active) setError(err.message) }
    }
    void load()
    const timer = setInterval(load, 10000)
    window.addEventListener('focus', load)
    window.addEventListener('institute-leave-updated', load)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('institute-leave-updated', load) }
  }, [isRemoteNotifications])
  const markRead = async (notificationIds = null) => {
    if (!isRemoteNotifications) return
    const unreadIds = notificationIds?.length ? notificationIds : availableRemoteItems.filter(item => !item.read).map(item => item.id)
    if (!unreadIds.length) return
    try {
      await request('/notifications/mark-read', { method: 'PATCH', body: JSON.stringify({ notificationIds: unreadIds }) })
      setRemoteItems(current => current.map(item => unreadIds.includes(item.id) ? { ...item, read: true, featured: false } : item))
      setRemoteCount(current => Math.max(0, current - unreadIds.length))
      setError('')
      window.dispatchEvent(new Event('institute-leave-updated'))
    } catch (err) { setError(err.message) }
  }

  const openStudentNotification = (item) => {
    const kind = String(item?.kind || '').toUpperCase()
    const description = String(item?.requestDescription || '').toUpperCase()
    if (isStudent && (kind === 'STUDENT_DISCONTINUATION' || description.startsWith('DISCONTINUATION_'))) {
      navigate('/student-new-dashboard?section=profile&open=discontinuation')
      return true
    }
    if (isSalesAdmin && ['LEAD_FOLLOW_UP_DUE', 'LEAD_FOLLOW_UP_OVERDUE'].includes(kind)) {
      const leadId = description.split(':')[1]
      if (leadId) navigate('/dashboard/sales-admin/leads', { state: { leadId } })
      return true
    }
    if (isSalesAdmin && kind === 'SALES_CRM_MONTHLY_REPORT') {
      navigate('/dashboard/sales-admin/reports')
      return true
    }
    if (isSalesAdmin && kind === 'PENDING_STUDENT_ADMISSION_REMINDER') {
      navigate('/dashboard/sales-admin/admissions?status=PENDING_HOT')
      return true
    }
    if (isSalesAdmin && kind === 'SALES_CRM_BATCH_REQUEST_UPDATE') {
      navigate('/dashboard/sales-admin/admissions')
      return true
    }
    return false
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

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    document.body.classList.toggle('student-notification-menu-open', isOpen)
    return () => document.body.classList.remove('student-notification-menu-open')
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
            <div className="notification-dropdown-head-actions">
              <button type="button" className="notification-mark-read" onClick={markRead} disabled={isRemoteNotifications && unreadCount === 0}>
                {isRemoteNotifications && unreadCount === 0 ? 'All caught up' : 'Mark all as read'}
              </button>
              <button type="button" className="notification-dropdown-close" aria-label="Close notifications" onClick={() => setIsOpen(false)}>
                <X size={17} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="notification-dropdown-list">
            {error ? <p role="alert">{error}</p> : null}
            {isRemoteNotifications && !visibleItems.length ? <p>{isSalesAdmin ? 'No unread notifications.' : 'No notifications yet.'}</p> : null}
            {visibleItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  type="button"
                  key={`${item.title}-${item.time}`}
                  className={`notification-dropdown-item ${item.featured ? 'is-highlighted' : ''}`.trim()}
                  onClick={() => {
                    setIsOpen(false)
                    if (isRemoteNotifications) {
                      void markRead([item.id])
                      openStudentNotification(item)
                    } else navigate(isSalesAdmin ? '/dashboard/sales-admin/notifications' : '/notifications')
                  }}
                >
                  <span className={`notification-badge ${item.tone}`} aria-hidden="true">
                    <Icon size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                  </span>
                  <div className="notification-copy">
                    <p>{item.title}</p>
                    <span>{item.message}</span>
                    {String(item.kind || '').toUpperCase() === 'PENDING_STUDENT_ADMISSION_REMINDER' ? <small className="notification-dropdown-action">{item.actionLabel || 'View Pending Admissions'}</small> : null}
                    {String(item.kind || '').toUpperCase() === 'SALES_CRM_BATCH_REQUEST_UPDATE' ? <small className="notification-dropdown-action">{item.actionLabel || 'View Request Status'}</small> : null}
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
              navigate(isStudent ? '/student-new-dashboard/notifications' : isSalesAdmin ? '/dashboard/sales-admin/notifications' : '/notifications')
            }}
          >
            View all notifications
          </button>
        </div>
      ) : null}
    </div>
  )
}
