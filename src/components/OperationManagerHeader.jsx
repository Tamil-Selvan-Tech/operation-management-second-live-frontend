import { NotificationBell } from './NotificationBell'
import { HeaderIdentityChip } from './HeaderIdentityChip'

export function OperationManagerHeader({
  title = 'Operation Manager Dashboard',
  summary = 'Operations oversight, approvals, and team health.',
  eyebrow = 'Operation Manager',
  initials = 'OM',
  profileTitle = 'Operation Manager',
  email = 'operation.manager@cispro.com',
  className = '',
  onOpenMenu,
}) {
  return (
    <header className={`business-topbar operation-manager-header ${className}`.trim()}>
      <button
        type="button"
        className="mobile-menu-button dashboard-mobile-menu-button"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 7h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M4 12h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="operation-manager-mobile-brand" aria-hidden="true">
        <img className="operation-manager-mobile-brand-logo" src="/logo.png" alt="" />
        <div className="operation-manager-mobile-brand-copy">
          <strong>Cispro Ops</strong>
          <p>Role-aware workspace</p>
        </div>
      </div>

      <div className="business-topbar-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{summary}</p>
      </div>

      <div className="business-topbar-actions operation-manager-header-actions">
        <NotificationBell />
        <HeaderIdentityChip
          initials={initials}
          title={profileTitle}
          email={email}
          className="operation-manager-profile-chip"
        />
      </div>
    </header>
  )
}
