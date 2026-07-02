import { AppBreadcrumbs } from '../components/AppBreadcrumbs'
import { AppHeader } from '../components/AppHeader'
import { AppSidebar } from '../components/AppSidebar'

export function AppShell({
  currentRole,
  email,
  roleLabel,
  dashboard,
  onNavigateDashboard,
  onNavigateProfile,
  onLogout,
  children,
}) {
  return (
    <div className="app-shell">
      <AppSidebar
        currentRole={currentRole}
        email={email}
        roleLabel={roleLabel}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateProfile={onNavigateProfile}
        onLogout={onLogout}
      />

      <div className="main-area">
        <AppHeader title={dashboard?.title || 'Operations Dashboard'} accent={dashboard?.accent || 'Ready'} />

        <AppBreadcrumbs crumbs={['Home', dashboard?.title || 'Workspace']} />

        <main className="content">{children}</main>
      </div>
    </div>
  )
}
