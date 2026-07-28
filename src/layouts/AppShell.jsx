import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BookOpen, CalendarDays, Ellipsis, GraduationCap, LayoutDashboard, UsersRound } from 'lucide-react'
import { AppBreadcrumbs } from '../components/AppBreadcrumbs'
import { AppHeader } from '../components/AppHeader'
import { AppSidebar } from '../components/AppSidebar'
import { MobileMenuContext } from './mobileMenuContext'

export function AppShell({
  dashboard,
  user,
  onNavigateDashboard,
  onNavigateFacultyBatches,
  onNavigateCourses,
  onNavigateStudentManagement,
  onNavigateFacultyManagement,
  onNavigateNotifications,
  onLogout,
  showCoursesNav = true,
  showFacultyBatchesNav = false,
  showStudentManagementNav = true,
  showFacultyManagementNav = true,
  showChrome = true,
  forceFlatMainArea = false,
  children,
}) {
  const location = useLocation()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const userRole = user?.role
  const isBusinessOwnerRole = userRole === 'business-owner'
  const isOperationManagerRole = userRole === 'operation-manager'
  const isDashboardWorkspace = location.pathname.startsWith('/dashboard')
  const isBusinessOwnerWorkspace = location.pathname.startsWith('/dashboard/business-owner')
  const isOperationManagerWorkspace = location.pathname.startsWith('/dashboard/operation-manager')
  const isCoursesWorkspace =
    location.pathname === '/courses' || location.pathname === '/dashboard/operation-manager/courses'
  const isStudentManagementWorkspace =
    location.pathname === '/student-management' ||
    location.pathname === '/dashboard/operation-manager/student-management'
  const isFacultyManagementWorkspace =
    location.pathname === '/faculty-management' ||
    location.pathname.startsWith('/faculty-management/') ||
    location.pathname === '/dashboard/operation-manager/faculty-management' ||
    location.pathname.startsWith('/dashboard/operation-manager/faculty-management/')
  const isFacultyFlowWhiteWorkspace = isFacultyManagementWorkspace
  const isNotificationsWorkspace = location.pathname === '/notifications'
  const useDashboardShell = isDashboardWorkspace && !isBusinessOwnerWorkspace && !isOperationManagerWorkspace
  const isPremiumSidebarWorkspace =
    isDashboardWorkspace ||
    isBusinessOwnerWorkspace ||
    isOperationManagerWorkspace ||
    (isBusinessOwnerRole &&
      (isCoursesWorkspace || isStudentManagementWorkspace || isFacultyManagementWorkspace || isNotificationsWorkspace)) ||
    (isOperationManagerRole &&
      (isCoursesWorkspace || isStudentManagementWorkspace || isFacultyManagementWorkspace || isNotificationsWorkspace))
  const isSidebarPremium = isPremiumSidebarWorkspace
  const isFacultyBatchesPath = location.pathname.startsWith('/dashboard/faculty/my-batches')
  let activeNav = 'dashboard'
  if (isCoursesWorkspace) {
    activeNav = 'courses'
  } else if (isStudentManagementWorkspace) {
    activeNav = 'student-management'
  } else if (isFacultyManagementWorkspace) {
    activeNav = 'faculty-management'
  } else if (isFacultyBatchesPath) {
    activeNav = 'my-batches'
  } else if (isNotificationsWorkspace) {
    activeNav = 'notifications'
  }
  const isBusinessOwnerDashboard = isBusinessOwnerWorkspace
  const isOperationManagerDashboard = isOperationManagerWorkspace
  const isPremiumDashboard = isBusinessOwnerDashboard || isOperationManagerDashboard
  const isFacultyDashboard = location.pathname === '/dashboard/faculty'
  const isFlatMainArea =
    isOperationManagerDashboard ||
    isBusinessOwnerDashboard ||
    isFacultyDashboard ||
    isFacultyBatchesPath ||
    location.pathname === '/notifications' ||
    isStudentManagementWorkspace ||
    isFacultyManagementWorkspace ||
    isCoursesWorkspace ||
    isNotificationsWorkspace ||
    forceFlatMainArea
  const isStudentPage = location.pathname === '/dashboard/student'
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false)
  const shellClassName = [
    'app-shell has-fixed-sidebar',
    isStudentPage ? 'is-student-page' : '',
    isBusinessOwnerWorkspace || (isBusinessOwnerRole && isPremiumSidebarWorkspace) ? 'business-owner-shell' : '',
    isOperationManagerWorkspace || (isOperationManagerRole && isPremiumSidebarWorkspace) ? 'operation-manager-shell' : '',
    useDashboardShell ? 'dashboard-shell' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const bottomNavItems = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      onClick: () => {
        closeMobileSidebar()
        onNavigateDashboard?.()
      },
    },
    {
      key: 'my-batches',
      label: 'My Batches',
      icon: CalendarDays,
      onClick: () => {
        closeMobileSidebar()
        onNavigateFacultyBatches?.()
      },
      hidden: !showFacultyBatchesNav,
    },
    {
      key: 'courses',
      label: 'Courses',
      icon: BookOpen,
      onClick: () => {
        closeMobileSidebar()
        onNavigateCourses?.()
      },
      hidden: !showCoursesNav,
    },
    {
      key: 'student-management',
      label: 'Students',
      icon: UsersRound,
      onClick: () => {
        closeMobileSidebar()
        onNavigateStudentManagement?.()
      },
      hidden: !showStudentManagementNav,
    },
    {
      key: 'faculty-management',
      label: 'Faculty',
      icon: GraduationCap,
      onClick: () => {
        closeMobileSidebar()
        onNavigateFacultyManagement?.()
      },
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
      <div className={shellClassName}>
        <div
          className={`sidebar-backdrop ${isMobileSidebarOpen ? 'is-open' : ''}`.trim()}
          role="presentation"
          onClick={closeMobileSidebar}
        />
        <AppSidebar
          activeNav={activeNav}
          user={user}
          isBusinessOwner={isSidebarPremium}
          onNavigateDashboard={onNavigateDashboard}
          onNavigateFacultyBatches={onNavigateFacultyBatches}
          onNavigateCourses={onNavigateCourses}
          onNavigateStudentManagement={onNavigateStudentManagement}
          onNavigateFacultyManagement={onNavigateFacultyManagement}
          onNavigateNotifications={onNavigateNotifications}
          onLogout={onLogout}
          onClose={() => setIsMobileSidebarOpen(false)}
          isMobileOpen={isMobileSidebarOpen}
          showCoursesNav={showCoursesNav}
          showFacultyBatchesNav={showFacultyBatchesNav}
          showStudentManagementNav={showStudentManagementNav}
          showFacultyManagementNav={showFacultyManagementNav}
        />

        <div
          className={`main-area ${showChrome ? '' : 'main-area-compact'} ${
            isFlatMainArea ? 'main-area-flat' : ''
          } ${isPremiumDashboard ? 'business-owner-main' : ''} ${
            isFacultyFlowWhiteWorkspace ? 'faculty-flow-white-main' : ''
          }`}
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
