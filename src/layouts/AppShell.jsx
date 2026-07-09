import { useLocation } from 'react-router-dom'
import { AppBreadcrumbs } from '../components/AppBreadcrumbs'
import { AppHeader } from '../components/AppHeader'
import { AppSidebar } from '../components/AppSidebar'

export function AppShell({
  currentRole,
  email,
  roleLabel,
  dashboard,
  onNavigateDashboard,
  onNavigateCourses,
  onLogout,
  showChrome = true,
  children,
}) {
  const location = useLocation()
  const activeNav = location.pathname.startsWith('/courses') ? 'courses' : 'dashboard'

  return (
    <div className="app-shell">
      <AppSidebar
        currentRole={currentRole}
        email={email}
        roleLabel={roleLabel}
        activeNav={activeNav}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateCourses={onNavigateCourses}
        onLogout={onLogout}
      />

      <div className={`main-area ${showChrome ? '' : 'main-area-compact'}`}>
        {showChrome ? (
          <>
            <AppHeader title={dashboard?.title || 'Operations Dashboard'} accent={dashboard?.accent || 'Ready'} />
            <AppBreadcrumbs crumbs={['Home', dashboard?.title || 'Workspace']} />
          </>
        ) : null}

        <main className="content">{children}</main>
      </div>
    </div>
  )
}
