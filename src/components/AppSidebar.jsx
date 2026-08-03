import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  CalendarDays,
  GraduationCap,
  Home,
  LayoutGrid,
  LogOut,
  X,
  UserRound,
  UsersRound,
} from 'lucide-react'

import { roleLabels } from '../data/authData'
import { getUnreadNotificationCount } from '../data/notificationsData'

const defaultAvatarSrc =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%230f7bda'/%3E%3Cstop offset='1' stop-color='%234da3ff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='40' cy='40' r='40' fill='url(%23g)'/%3E%3Ccircle cx='40' cy='30' r='12' fill='white' fill-opacity='.95'/%3E%3Cpath d='M18 64c4-12 15-18 22-18s18 6 22 18' fill='white' fill-opacity='.95'/%3E%3C/svg%3E"

function SidebarItem({ icon: Icon, label, active = false, onClick, disabled = false, badge = null }) {
  return (
    <button
      type="button"
      className={`sidebar-menu-item ${active ? 'is-active' : ''}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      title={disabled ? `${label} coming soon` : undefined}
    >
      <span className="sidebar-menu-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2.1} focusable="false" />
      </span>
      <span className="sidebar-menu-label">{label}</span>
      {badge ? <span className="sidebar-menu-badge">{badge}</span> : null}
    </button>
  )
}

function createNavHandler(onClose, onNavigate) {
  return () => {
    onNavigate?.()
    window.setTimeout(() => onClose?.(), 0)
  }
}

export function AppSidebar({
  activeNav,
  user,
  isBusinessOwner = false,
  onNavigateDashboard,
  onNavigateFacultyBatches,
  onNavigateCourses,
  onNavigateStudentManagement,
  onNavigateFacultyManagement,
  onNavigateNotifications,
  onLogout,
  onClose,
  isMobileOpen = false,
  showCoursesNav = true,
  showFacultyBatchesNav = false,
  showStudentManagementNav = true,
  showFacultyManagementNav = true,
  showNotificationsNav = true,
}) {
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const userRoleLabel = roleLabels[user?.role] || 'Cispro User'
  const userName = user?.name && !/^\s*user\s*$/i.test(user.name) ? user.name : userRoleLabel
  const profileEmail = user?.email || (isBusinessOwner ? 'business.owner@cispro.com' : '')
  const avatarSrc = user?.avatarUrl || defaultAvatarSrc
  const unreadNotificationCount = useMemo(() => getUnreadNotificationCount(user?.role), [user?.role])

  useEffect(() => {
    if (!isLogoutConfirmOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsLogoutConfirmOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isLogoutConfirmOpen])

  const confirmLogout = async () => {
    setIsLogoutConfirmOpen(false)
    await onLogout?.()
  }

  const mainMenuItems = [
    {
      icon: isBusinessOwner ? LayoutGrid : Home,
      label: 'Dashboard',
      active: activeNav === 'dashboard',
      onClick: createNavHandler(onClose, onNavigateDashboard),
    },
    showFacultyBatchesNav
      ? {
          icon: CalendarDays,
          label: 'My Batches',
          active: activeNav === 'my-batches',
          onClick: createNavHandler(onClose, onNavigateFacultyBatches),
        }
      : null,
    showCoursesNav
      ? {
          icon: GraduationCap,
          label: 'Courses',
          active: activeNav === 'courses',
          onClick: createNavHandler(onClose, onNavigateCourses),
        }
      : null,
    showStudentManagementNav
      ? {
          icon: UsersRound,
          label: 'Student Management',
          active: activeNav === 'student-management',
          onClick: createNavHandler(onClose, onNavigateStudentManagement),
        }
      : null,
    showFacultyManagementNav
      ? {
          icon: UserRound,
          label: 'Faculty Management',
          active: activeNav === 'faculty-management',
          onClick: createNavHandler(onClose, onNavigateFacultyManagement),
        }
      : null,
  ].filter(Boolean)

  const otherMenuItems = [
    showNotificationsNav
      ? {
          icon: Bell,
          label: 'Notifications',
          active: activeNav === 'notifications',
          onClick: createNavHandler(onClose, onNavigateNotifications),
          badge: unreadNotificationCount || null,
        }
      : null,
  ].filter(Boolean)

  return (
    <aside className={`sidebar ${isMobileOpen ? 'is-open' : ''} ${isBusinessOwner ? 'is-business-owner-sidebar' : ''}`.trim()}>
      <button
        type="button"
        className="sidebar-close-button"
        onClick={onClose}
        aria-label="Close sidebar"
      >
        <X size={20} strokeWidth={2.4} aria-hidden="true" focusable="false" />
      </button>

      <div className="sidebar-head">
        <div className="brand">
          <img className="brand-logo" src="/logo1.png" alt="Cispro Ops logo" />
          <div>
            <strong>Cispro Ops</strong>
          </div>
        </div>
      </div>

      <div className="sidebar-divider" aria-hidden="true" />

      <div className="sidebar-menu-scroll">
        <nav className="menu" aria-label="Sidebar navigation">
          <div className="menu-section">
            <p className="menu-section-label">{isBusinessOwner ? 'Main Navigation' : 'Main Menu'}</p>
            <div className="menu-group">
              {mainMenuItems.map((item) => (
                <SidebarItem key={item.label} {...item} />
              ))}
            </div>
          </div>

          <div className="menu-section">
            <p className="menu-section-label">Other</p>
            <div className="menu-group">
              {otherMenuItems.map((item) => (
                <SidebarItem key={item.label} {...item} />
              ))}
            </div>
          </div>
        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-profile-card">
          <span className="sidebar-profile-avatar-wrap" aria-hidden="true">
            <img className="sidebar-profile-avatar" src={avatarSrc} alt="" aria-hidden="true" />
            <span className="sidebar-profile-status" />
          </span>
          <span className="sidebar-profile-copy">
            <strong>{userName}</strong>
            {profileEmail ? <small className="sidebar-profile-email">{profileEmail}</small> : null}
          </span>
          <button
            type="button"
            className="sidebar-profile-logout-icon"
            onClick={() => setIsLogoutConfirmOpen(true)}
            aria-label="Logout"
          >
            <LogOut size={22} strokeWidth={2} focusable="false" />
          </button>
        </div>
      </div>

      {isLogoutConfirmOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="logout-modal-backdrop" role="presentation" onClick={() => setIsLogoutConfirmOpen(false)}>
              <div
                className="logout-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="logout-modal-title"
                aria-describedby="logout-modal-description"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="course-modal-close logout-modal-close"
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  aria-label="Close logout confirmation"
                >
                  ×
                </button>
                <h3 id="logout-modal-title">Are you sure you want to logout?</h3>
                <div className="logout-modal-actions">
                  <button type="button" className="button-ghost" onClick={() => setIsLogoutConfirmOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button-solid"
                    onClick={async () => {
                      onClose?.()
                      await confirmLogout()
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </aside>
  )
}
