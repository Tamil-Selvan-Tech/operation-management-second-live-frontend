import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { roleLabels } from '../data/authData'

const defaultAvatarSrc =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%230f7bda'/%3E%3Cstop offset='1' stop-color='%234da3ff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='40' cy='40' r='40' fill='url(%23g)'/%3E%3Ccircle cx='40' cy='30' r='12' fill='white' fill-opacity='.95'/%3E%3Cpath d='M18 64c4-12 15-18 22-18s18 6 22 18' fill='white' fill-opacity='.95'/%3E%3C/svg%3E"

export function AppSidebar({
  activeNav,
  user,
  onNavigateDashboard,
  onNavigateCourses,
  onNavigateStudentManagement,
  onNavigateFacultyManagement,
  onLogout,
  onClose,
  isMobileOpen = false,
  showCoursesNav = true,
  showStudentManagementNav = true,
  showFacultyManagementNav = true,
}) {
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const userRoleLabel = roleLabels[user?.role] || 'Cispro User'
  const userName =
    user?.name && !/^\s*user\s*$/i.test(user.name) ? user.name : userRoleLabel
  const userEmail = user?.email || 'user@cispro.local'
  const avatarSrc = user?.avatarUrl || defaultAvatarSrc

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

  return (
    <aside className={`sidebar ${isMobileOpen ? 'is-open' : ''}`.trim()}>
      <div className="sidebar-head">
        <div className="brand">
          <img className="brand-logo" src="/logo.png" alt="Cispro Ops logo" />
          <div>
            <strong>Cispro Ops</strong>
            <p>Role-aware workspace</p>
          </div>
        </div>

        <button type="button" className="sidebar-close-button" onClick={onClose} aria-label="Close navigation menu">
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <nav className="menu">
        <button
          type="button"
          className={activeNav === 'dashboard' ? 'active' : ''}
          onClick={() => {
            onClose?.()
            onNavigateDashboard?.()
          }}
        >
          Dashboard
        </button>
        {showCoursesNav ? (
          <button
            type="button"
            className={activeNav === 'courses' ? 'active' : ''}
            onClick={() => {
              onClose?.()
              onNavigateCourses?.()
            }}
          >
            Courses
          </button>
        ) : null}
        {showStudentManagementNav ? (
          <button
            type="button"
            className={activeNav === 'student-management' ? 'active' : ''}
            onClick={() => {
              onClose?.()
              onNavigateStudentManagement?.()
            }}
          >
            Student Management
          </button>
        ) : null}
        {showFacultyManagementNav ? (
          <button
            type="button"
            className={activeNav === 'faculty-management' ? 'active' : ''}
            onClick={() => {
              onClose?.()
              onNavigateFacultyManagement?.()
            }}
          >
            Faculty Management
          </button>
        ) : null}
      </nav>

      <div className="role-card sidebar-account-card">
        <button type="button" className="sidebar-account-button" onClick={() => setIsLogoutConfirmOpen(true)}>
          <img className="sidebar-account-avatar" src={avatarSrc} alt="" aria-hidden="true" />
          <span className="sidebar-account-copy">
            <strong>{userName}</strong>
          </span>
          <span className="sidebar-account-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path
                d="M10 7h-4a3 3 0 0 0-3 3v4a3 3 0 0 0 3 3h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13 12h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
              <path
                d="m17 8 4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
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
                <button type="button" className="course-modal-close logout-modal-close" onClick={() => setIsLogoutConfirmOpen(false)} aria-label="Close logout confirmation">
                  ×
                </button>
                <h3 id="logout-modal-title">Are you sure you want to logout?</h3>
                <p id="logout-modal-description">You will be sent back to the login page after signing out.</p>
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
