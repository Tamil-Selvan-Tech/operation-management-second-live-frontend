import { useState } from 'react'
import {
  BadgeCheck,
  Building2,
  Clock3,
  Globe,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { HeaderIdentityChip } from './HeaderIdentityChip'
import { ProfileDrawer } from './ProfileDrawer'

function buildProfileDetails({ eyebrow, profileTitle, email, initials }) {
  const isBusinessOwner = eyebrow === 'Business Owner'

  return {
    role: profileTitle,
    status: 'Active',
    workspace: 'Cispro Ops',
    accessLevel: isBusinessOwner ? 'Business Owner' : 'Operation Manager',
    passwordMasked: 'ChangeMe123!',
    resetPasswordText: 'Send Reset Link',
    lastLogin: 'Today, 10:25 AM',
    initials,
    primaryEmail: email,
  }
}

export function OperationManagerHeader({
  title = 'Operation Manager Dashboard',
  summary = '',
  eyebrow = 'Operation Manager',
  initials = 'OM',
  profileTitle = 'Operation Manager',
  email = 'operation.manager@cispro.com',
  className = '',
  onOpenMenu,
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const isBusinessOwner = eyebrow === 'Business Owner'
  const profileDetails = buildProfileDetails({ eyebrow, profileTitle, email, initials })
  const profileStatTiles = isBusinessOwner
    ? [
        { icon: BadgeCheck, tone: 'blue', label: 'Status', value: profileDetails.status },
        { icon: Building2, tone: 'green', label: 'Workspace', value: profileDetails.workspace },
        { icon: ShieldCheck, tone: 'violet', label: 'Access Level', value: profileDetails.accessLevel },
        { icon: Clock3, tone: 'amber', label: 'Last Login', value: profileDetails.lastLogin },
      ]
    : [
        { icon: BadgeCheck, tone: 'blue', label: 'Role', value: profileDetails.role },
        { icon: ShieldCheck, tone: 'green', label: 'Status', value: profileDetails.status },
        { icon: Building2, tone: 'violet', label: 'Workspace', value: profileDetails.workspace },
        { icon: Globe, tone: 'amber', label: 'Access Level', value: profileDetails.accessLevel },
      ]
  const profileDetailRows = [
    { icon: LockKeyhole, label: 'Password', value: profileDetails.passwordMasked },
    { icon: RefreshCcw, label: 'Reset Password', value: profileDetails.resetPasswordText },
    { icon: Clock3, label: 'Last Login', value: profileDetails.lastLogin },
  ]

  return (
    <>
      <header className={`business-topbar operation-manager-header ${isBusinessOwner ? 'is-business-owner-header' : ''} ${className}`.trim()}>
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
          <img className="operation-manager-mobile-brand-logo" src="/logo1.png" alt="" />
          <div className="operation-manager-mobile-brand-copy">
            <strong>Cispro Ops</strong>
          </div>
        </div>

        <div className="business-topbar-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {summary ? <p>{summary}</p> : isBusinessOwner ? <p className="business-header-subtitle">Welcome back! Here&apos;s what&apos;s happening with your business today.</p> : null}
        </div>

        <div className="business-topbar-actions operation-manager-header-actions">
          <NotificationBell />
          <HeaderIdentityChip
            initials={initials}
            title={profileTitle}
            email={email}
            className="operation-manager-profile-chip"
            onMouseDown={() => setIsProfileOpen(true)}
            onPointerDown={() => setIsProfileOpen(true)}
            onClick={() => setIsProfileOpen(true)}
            ariaLabel={`Open ${profileTitle} profile`}
          />
        </div>
      </header>
      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title={profileTitle}
        email={email}
        initials={profileDetails.initials}
        statTiles={profileStatTiles}
        detailRows={profileDetailRows}
        ariaLabelledBy="profile-modal-title"
      />
    </>
  )
}
