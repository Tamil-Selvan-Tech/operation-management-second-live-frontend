import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function AppSidebar({
  activeNav,
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

      <div className="role-card">
        <p className="role-card-note">End your current session from here.</p>
        <button type="button" className="logout-card-button" onClick={() => setIsLogoutConfirmOpen(true)}>
          Logout
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
                <p className="section-kicker">Confirm logout</p>
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
