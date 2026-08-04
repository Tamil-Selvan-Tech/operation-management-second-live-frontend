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
  showNotificationsNav = true,
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
  const useDashboardShell =
    (isDashboardWorkspace && !isBusinessOwnerWorkspace && !isOperationManagerWorkspace) ||
    (isNotificationsWorkspace && !isBusinessOwnerRole && !isOperationManagerRole)
  const isPremiumSidebarWorkspace =
    isDashboardWorkspace ||
    isBusinessOwnerWorkspace ||
    isOperationManagerWorkspace ||
    (isBusinessOwnerRole &&
      (isCoursesWorkspace || isStudentManagementWorkspace || isFacultyManagementWorkspace || isNotificationsWorkspace)) ||
    (isOperationManagerRole &&
      (isCoursesWorkspace || isStudentManagementWorkspace || isFacultyManagementWorkspace || isNotificationsWorkspace))
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
  const usePremiumLayout =
    isBusinessOwnerDashboard ||
    isOperationManagerDashboard ||
    (isBusinessOwnerRole && isPremiumSidebarWorkspace) ||
    (isOperationManagerRole && isPremiumSidebarWorkspace)
  const isFacultyDashboard = location.pathname === '/dashboard/faculty'
  const isInsetSidebarDividerWorkspace =
    isFacultyDashboard || isFacultyBatchesPath || location.pathname === '/dashboard/student'
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
    usePremiumLayout
      ? 'app-shell has-fixed-sidebar relative !min-h-screen !min-w-0 !grid !grid-cols-1 !gap-3 !p-3 md:!h-screen md:!grid-cols-[280px_minmax(0,1fr)] md:!gap-0 md:!border md:!border-slate-200 md:!bg-white md:!p-0 md:!shadow-none md:!rounded-none md:!overflow-hidden xl:!grid-cols-[300px_minmax(0,1fr)]'
      : 'app-shell has-fixed-sidebar',
    isStudentPage ? 'is-student-page' : '',
    isInsetSidebarDividerWorkspace ? 'is-inset-sidebar-divider' : '',
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
          className={`sidebar-backdrop fixed inset-0 z-[1100] bg-slate-950/20 transition-opacity duration-200 md:hidden ${
            isMobileSidebarOpen ? 'opacity-100 visible' : 'pointer-events-none opacity-0 invisible'
          }`}
          role="presentation"
          onClick={closeMobileSidebar}
        />
        <AppSidebar
          activeNav={activeNav}
          user={user}
          isBusinessOwner={isPremiumSidebarWorkspace && isBusinessOwnerRole}
          usePremiumLayout={usePremiumLayout}
          useDashboardShell={useDashboardShell}
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
          showNotificationsNav={showNotificationsNav}
        />

        <div
          className={
            usePremiumLayout
              ? `main-area !flex !min-w-0 !flex-1 !flex-col !overflow-hidden !rounded-none !bg-white !shadow-none md:!h-screen md:!overflow-y-auto ${
                  showChrome ? '' : 'main-area-compact'
                } ${
                  isFlatMainArea ? 'main-area-flat' : ''
                } ${isPremiumDashboard ? 'business-owner-main' : ''} ${
                  isFacultyFlowWhiteWorkspace ? 'faculty-flow-white-main' : ''
                }`
              : `main-area ${showChrome ? '' : 'main-area-compact'} ${
                  isFlatMainArea ? 'main-area-flat' : ''
                } ${isPremiumDashboard ? 'business-owner-main' : ''} ${
                  isFacultyFlowWhiteWorkspace ? 'faculty-flow-white-main' : ''
                }`
          }
        >
          {showChrome ? (
            <div
              className={
                usePremiumLayout
                  ? '!flex !min-w-0 !flex-col !gap-2 !border-b !border-slate-200/80 !px-4 !py-4 sm:!px-5 sm:!py-5 lg:!px-6 lg:!py-6'
                  : 'flex min-w-0 flex-col gap-2 border-b border-slate-200/80 px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6'
              }
            >
              <AppHeader dashboard={dashboard} onOpenMenu={() => setIsMobileSidebarOpen(true)} />
              <AppBreadcrumbs crumbs={['Home', dashboard?.title || 'Workspace']} />
            </div>
          ) : null}
          <main
            className={
              usePremiumLayout
                ? 'content !min-w-0 !flex-1 !px-4 !py-4 sm:!px-5 sm:!py-5 lg:!px-6 lg:!py-6'
                : 'content min-w-0 flex-1 px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6'
            }
          >
            {children}
          </main>
          <nav
            className={
              usePremiumLayout
                ? 'mobile-bottom-nav !fixed !inset-x-3 !bottom-3 !z-[1150] !flex items-center justify-between gap-1 rounded-[24px] border border-slate-200 bg-white/95 px-2 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur md:!hidden'
                : 'mobile-bottom-nav hidden'
            }
            aria-label="Mobile navigation"
          >
            {bottomNavItems
              .filter((item) => !item.hidden)
              .map((item) => {
                const Icon = item.icon
                const isActive = activeNav === item.key

                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`mobile-bottom-nav-item flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[14px] px-2 py-2 text-[0.62rem] font-semibold leading-none text-slate-600 transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
                    }`}
                    onClick={item.onClick}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                  >
                    <Icon size={20} strokeWidth={2.2} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            <button
              type="button"
              className="mobile-bottom-nav-item mobile-bottom-nav-more flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[14px] px-2 py-2 text-[0.62rem] font-semibold leading-none text-slate-600 hover:bg-slate-50"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="More options"
            >
              <Ellipsis size={20} strokeWidth={2.2} />
              <span>More</span>
            </button>
          </nav>
        </div>
      </div>
    </MobileMenuContext.Provider>
  )
}
