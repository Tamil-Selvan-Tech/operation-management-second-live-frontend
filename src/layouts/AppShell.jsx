import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BookOpen, Ellipsis, GraduationCap, LayoutDashboard, UsersRound } from 'lucide-react'
import { AppBreadcrumbs } from '../components/AppBreadcrumbs'
import { AppHeader } from '../components/AppHeader'
import { AppSidebar } from '../components/AppSidebar'
import { MobileMenuContext } from './mobileMenuContext'

export function AppShell({
  dashboard,
  onNavigateDashboard,
  onNavigateCourses,
  onNavigateStudentManagement,
  onNavigateFacultyManagement,
  onLogout,
  showCoursesNav = true,
  showStudentManagementNav = true,
  showFacultyManagementNav = true,
  showChrome = true,
  children,
}) {
  const location = useLocation()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const activeNav = location.pathname.startsWith('/courses')
    ? 'courses'
    : location.pathname.startsWith('/student-management')
      ? 'student-management'
      : location.pathname.startsWith('/faculty-management')
        ? 'faculty-management'
      : 'dashboard'
  const isOperationManagerDashboard = location.pathname === '/dashboard/operation-manager'
  const isBusinessOwnerDashboard = location.pathname === '/dashboard/business-owner'
  const isFlatMainArea =
    isOperationManagerDashboard ||
    isBusinessOwnerDashboard ||
    location.pathname.startsWith('/student-management') ||
    location.pathname.startsWith('/faculty-management') ||
    location.pathname.startsWith('/courses')

  const bottomNavItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, onClick: onNavigateDashboard },
    { key: 'courses', label: 'Courses', icon: BookOpen, onClick: onNavigateCourses, hidden: !showCoursesNav },
    {
      key: 'student-management',
      label: 'Students',
      icon: UsersRound,
      onClick: onNavigateStudentManagement,
      hidden: !showStudentManagementNav,
    },
    {
      key: 'faculty-management',
      label: 'Faculty',
      icon: GraduationCap,
      onClick: onNavigateFacultyManagement,
      hidden: !showFacultyManagementNav,
    },
  ]

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    document.body.classList.toggle('sidebar-menu-open', isMobileSidebarOpen)

    return () => {
      document.body.classList.remove('sidebar-menu-open')
    }
  }, [isMobileSidebarOpen])

  return (
    <MobileMenuContext.Provider value={() => setIsMobileSidebarOpen(true)}>
      <div className="app-shell">
        <div
          className={`sidebar-backdrop ${isMobileSidebarOpen ? 'is-open' : ''}`.trim()}
          role="presentation"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
        <AppSidebar
          activeNav={activeNav}
          onNavigateDashboard={onNavigateDashboard}
          onNavigateCourses={onNavigateCourses}
          onNavigateStudentManagement={onNavigateStudentManagement}
          onNavigateFacultyManagement={onNavigateFacultyManagement}
          onLogout={onLogout}
          onClose={() => setIsMobileSidebarOpen(false)}
          isMobileOpen={isMobileSidebarOpen}
          showCoursesNav={showCoursesNav}
          showStudentManagementNav={showStudentManagementNav}
          showFacultyManagementNav={showFacultyManagementNav}
        />

        <div
          className={`main-area ${showChrome ? '' : 'main-area-compact'} ${
            isFlatMainArea ? 'main-area-flat' : ''
          } ${isBusinessOwnerDashboard ? 'business-owner-main' : ''}`}
        >
          {showChrome ? (
            <>
              <AppHeader dashboard={dashboard} onOpenMenu={() => setIsMobileSidebarOpen(true)} />
              <AppBreadcrumbs crumbs={['Home', dashboard?.title || 'Workspace']} />
            </>
          ) : null}
          <main className="content">{children}</main>
          <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
            {bottomNavItems
              .filter((item) => !item.hidden)
              .map((item) => {
                const Icon = item.icon
                const isActive = activeNav === item.key

                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`mobile-bottom-nav-item ${isActive ? 'is-active' : ''}`.trim()}
                    onClick={item.onClick}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            <button
              type="button"
              className="mobile-bottom-nav-item mobile-bottom-nav-more"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="More options"
            >
              <Ellipsis />
              <span>More</span>
            </button>
          </nav>
        </div>
      </div>
    </MobileMenuContext.Provider>
  )
}
