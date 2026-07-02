export function AppSidebar({ currentRole, email, roleLabel, onNavigateDashboard, onNavigateProfile, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">CM</span>
        <div>
          <strong>Cispro Ops</strong>
          <p>Role-aware workspace</p>
        </div>
      </div>

      <nav className="menu">
        <button type="button" onClick={onNavigateDashboard}>
          Dashboard
        </button>
        <button type="button" onClick={onNavigateProfile}>
          Profile
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
