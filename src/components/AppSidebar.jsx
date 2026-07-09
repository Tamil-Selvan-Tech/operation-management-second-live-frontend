export function AppSidebar({
  currentRole,
  email,
  roleLabel,
  activeNav,
  onNavigateDashboard,
  onNavigateCourses,
  onLogout,
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="brand-logo" src="/logo.png" alt="Cispro Ops logo" />
        <div>
          <strong>Cispro Ops</strong>
          <p>Role-aware workspace</p>
        </div>
      </div>

      <nav className="menu">
        <button type="button" className={activeNav === 'dashboard' ? 'active' : ''} onClick={onNavigateDashboard}>
          Dashboard
        </button>
        <button type="button" className={activeNav === 'courses' ? 'active' : ''} onClick={onNavigateCourses}>
          Courses
        </button>
        <button type="button" onClick={onLogout}>
          Logout
        </button>
      </nav>

      <div className="role-card">
        <span>Signed in as</span>
        <strong>{roleLabel}</strong>
        <p>{email}</p>
        <p className="role-card-note">Role: {currentRole}</p>
      </div>
    </aside>
  )
}
