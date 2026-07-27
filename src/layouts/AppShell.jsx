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
  const isCoursesPath =
    location.pathname.startsWith('/courses') ||
    location.pathname.startsWith('/dashboard/operation-manager/courses')
  const isStudentManagementPath =
    location.pathname.startsWith('/student-management') ||
    location.pathname.startsWith('/dashboard/operation-manager/student-management')
  const isFacultyManagementPath =
    location.pathname.startsWith('/faculty-management') ||
    location.pathname.startsWith('/dashboard/operation-manager/faculty-management')
  const isFacultyBatchesPath = location.pathname.startsWith('/dashboard/faculty/my-batches')
  let activeNav = 'dashboard'
  if (isCoursesPath) {
    activeNav = 'courses'
  } else if (isStudentManagementPath) {
    activeNav = 'student-management'
  } else if (isFacultyManagementPath) {
    activeNav = 'faculty-management'
  } else if (isFacultyBatchesPath) {
    activeNav = 'my-batches'
  } else if (location.pathname.startsWith('/notifications')) {
    activeNav = 'notifications'
  }
  const isOperationManagerDashboard = location.pathname === '/dashboard/operation-manager'
  const isBusinessOwnerDashboard = location.pathname === '/dashboard/business-owner'
  const isPremiumDashboard = isBusinessOwnerDashboard || isOperationManagerDashboard
  const isFacultyDashboard = location.pathname === '/dashboard/faculty'
  const isFlatMainArea =
    isOperationManagerDashboard ||
    isBusinessOwnerDashboard ||
    isFacultyDashboard ||
    isFacultyBatchesPath ||
    location.pathname === '/notifications' ||
    isStudentManagementPath ||
    isFacultyManagementPath ||
    isCoursesPath ||
    forceFlatMainArea
  const isStudentPage = location.pathname === '/dashboard/student'
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false)

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
      <div
        className={`app-shell has-fixed-sidebar ${isStudentPage ? 'is-student-page' : ''} ${
          isPremiumDashboard ? 'business-owner-shell' : ''
        }`.trim()}
      >
        <div
          className={`sidebar-backdrop ${isMobileSidebarOpen ? 'is-open' : ''}`.trim()}
          role="presentation"
          onClick={closeMobileSidebar}
        />
        <AppSidebar
          activeNav={activeNav}
          user={user}
          isBusinessOwner={isPremiumDashboard}
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
          } ${isPremiumDashboard ? 'business-owner-main' : ''}`}
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
