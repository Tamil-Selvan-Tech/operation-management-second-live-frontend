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
}) {
  return (
    <header className={`business-topbar operation-manager-header ${className}`.trim()}>
      <div>
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
