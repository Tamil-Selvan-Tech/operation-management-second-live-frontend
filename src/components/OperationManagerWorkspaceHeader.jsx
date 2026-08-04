import { useMemo, useState } from 'react'
import {
  BadgeCheck,
  Bell,
  Search,
  ShieldCheck,
  Building2,
  Globe,
  Clock3,
  LockKeyhole,
  RefreshCcw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { getNotificationItems } from '../data/notificationsData'
import { HeaderIdentityChip } from './HeaderIdentityChip'
import { ProfileDrawer } from './ProfileDrawer'

function buildProfileDetails({ profileTitle, email, initials, eyebrow }) {
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

function WorkspaceNotificationBell() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const notificationItems = useMemo(() => getNotificationItems(role), [role])
  const visibleItems = showAll ? notificationItems : notificationItems.slice(0, 2)

  return (
    <div
      className="notification-menu"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => {
        setIsOpen(false)
        setShowAll(false)
      }}
    >
      <button
        className="icon-chip notification-chip"
        type="button"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Bell size={20} strokeWidth={2.2} aria-hidden="true" focusable="false" />
        <b>{notificationItems.length}</b>
      </button>

      {isOpen ? (
        <div className="notification-dropdown" role="menu" aria-label="Notifications">
          <div className="notification-dropdown-head">
            <strong>Notifications</strong>
            <button type="button" className="notification-mark-read">
              Mark all as read
            </button>
          </div>

          <div className="notification-dropdown-list">
            {visibleItems.map((item) => {
              const Icon = item.icon

              return (
                <article
                  key={`${item.title}-${item.time}`}
                  className={`notification-dropdown-item ${item.featured ? 'is-highlighted' : ''}`.trim()}
                >
                  <span className={`notification-badge ${item.tone}`} aria-hidden="true">
                    <Icon size={16} strokeWidth={2.2} aria-hidden="true" focusable="false" />
                  </span>
                  <div className="notification-copy">
                    <p>{item.title}</p>
                    <span>{item.message}</span>
                    <small>{item.time}</small>
                  </div>
                </article>
              )
            })}
          </div>

          <button
            className="notification-dropdown-footer"
            type="button"
            onClick={() => {
              setIsOpen(false)
              setShowAll(false)
              navigate('/notifications')
            }}
          >
            {showAll ? 'Show less' : 'View all notifications'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function OperationManagerWorkspaceHeader({
  title = 'Operation Manager Dashboard',
  summary = "Welcome back! Here's what's happening with your business today.",
  eyebrow = 'Operation Manager',
  initials = 'OM',
  profileTitle = 'Operation Manager',
  email = 'operation.manager@cispro.com',
  className = '',
  onOpenMenu,
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileDetails = buildProfileDetails({ profileTitle, email, initials, eyebrow })
  const isBusinessOwner = eyebrow === 'Business Owner'
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
      <header className={`business-topbar ${className}`.trim()}>
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
          {summary ? <p>{summary}</p> : null}
        </div>

        <div className="business-topbar-actions">
          <label className="dashboard-search">
            <Search size={18} strokeWidth={2.2} aria-hidden="true" focusable="false" />
            <input type="search" placeholder="Search..." aria-label="Search dashboard" />
          </label>
          <WorkspaceNotificationBell />
          <HeaderIdentityChip
            initials={initials}
            title={profileTitle}
            email={email}
            className="operation-manager-profile-chip"
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
