import { useLocation } from 'react-router-dom'
import { AppBreadcrumbs } from '../components/AppBreadcrumbs'
import { AppHeader } from '../components/AppHeader'
import { AppSidebar } from '../components/AppSidebar'

export function AppShell({
  dashboard,
  onNavigateDashboard,
  onNavigateCourses,
  onNavigateStudentManagement,
  onLogout,
  showCoursesNav = true,
  showStudentManagementNav = true,
  showChrome = true,
  children,
}) {
  const location = useLocation()
  const activeNav = location.pathname.startsWith('/courses')
    ? 'courses'
    : location.pathname.startsWith('/student-management')
      ? 'student-management'
      : 'dashboard'
  const isOperationManagerDashboard = location.pathname === '/dashboard/operation-manager'
  const isBusinessOwnerDashboard = location.pathname === '/dashboard/business-owner'
  const isFlatMainArea =
    isOperationManagerDashboard ||
    isBusinessOwnerDashboard ||
    location.pathname === '/student-management' ||
    location.pathname === '/courses'

  return (
    <div className="app-shell">
      <AppSidebar
        activeNav={activeNav}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateCourses={onNavigateCourses}
        onNavigateStudentManagement={onNavigateStudentManagement}
        onLogout={onLogout}
        showCoursesNav={showCoursesNav}
        showStudentManagementNav={showStudentManagementNav}
      />

      <div
        className={`main-area ${showChrome ? '' : 'main-area-compact'} ${
          isFlatMainArea ? 'main-area-flat' : ''
        } ${isBusinessOwnerDashboard ? 'business-owner-main' : ''}`}
      >
        {showChrome ? (
          <>
            <AppHeader dashboard={dashboard} />
            <AppBreadcrumbs crumbs={['Home', dashboard?.title || 'Workspace']} />
          </>
        ) : null}
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
