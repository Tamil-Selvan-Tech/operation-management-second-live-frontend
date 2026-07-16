import { useLocation } from 'react-router-dom'
import { AppBreadcrumbs } from '../components/AppBreadcrumbs'
import { AppHeader } from '../components/AppHeader'
import { AppSidebar } from '../components/AppSidebar'

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
    location.pathname === '/student-management' ||
    location.pathname === '/faculty-management' ||
    location.pathname === '/courses'

  return (
    <div className="app-shell">
      <AppSidebar
        activeNav={activeNav}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateCourses={onNavigateCourses}
        onNavigateStudentManagement={onNavigateStudentManagement}
        onNavigateFacultyManagement={onNavigateFacultyManagement}
        onLogout={onLogout}
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
            <AppHeader dashboard={dashboard} />
            <AppBreadcrumbs crumbs={['Home', dashboard?.title || 'Workspace']} />
          </>
        ) : null}
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
