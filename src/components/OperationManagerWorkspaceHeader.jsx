import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BadgeCheck,
  Building2,
  Bell,
  Clock3,
  Globe,
  LockKeyhole,
  RefreshCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { getNotificationItems } from '../data/notificationsData'
import { HeaderIdentityChip } from './HeaderIdentityChip'

function buildProfileDetails({ profileTitle, email, initials, eyebrow }) {
  const isBusinessOwner = eyebrow === 'Business Owner'

  return {
    role: profileTitle,
    status: 'Active',
    workspace: 'Cispro Ops',
    accessLevel: isBusinessOwner ? 'Business Owner' : 'Operation Manager',
    joinedOn: isBusinessOwner ? '12 March 2024' : '16 March 2023',
    primaryEmail: email,
    contactNumber: '+91 98765 43210',
    location: isBusinessOwner ? 'Chennai, Tamil Nadu, India' : 'Coimbatore, Tamil Nadu, India',
    passwordMasked: 'ChangeMe123!',
    resetPasswordText: 'Send Reset Link',
    lastLogin: 'Today, 10:25 AM',
    initials,
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

  useEffect(() => {
    if (!isProfileOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isProfileOpen])

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

      {isProfileOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="profile-drawer-backdrop" role="presentation">
              <div
                className="profile-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="profile-modal-cover profile-drawer-cover">
                  <button
                    type="button"
                    className="course-modal-close profile-modal-close"
                    onClick={() => setIsProfileOpen(false)}
                    aria-label="Close profile card"
                  >
                    <X size={18} strokeWidth={2.5} aria-hidden="true" focusable="false" />
                  </button>

                  <div className="profile-modal-cover-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>

                  <div className="profile-modal-avatar-wrap">
                    <div className="profile-modal-avatar" aria-hidden="true">
                      {profileDetails.initials}
                    </div>
                    <span className="profile-modal-status-dot" aria-hidden="true" />
                  </div>
                </div>

                <div className="profile-modal-body profile-drawer-body">
                  <p className="profile-modal-eyebrow">Profile</p>
                  <h3 id="profile-modal-title">{profileTitle}</h3>
                  <p className="profile-modal-email">{email}</p>

                  <div className="profile-modal-grid">
                    <div className="profile-modal-stat tone-blue">
                      <span className="profile-modal-stat-icon" aria-hidden="true">
                        <BadgeCheck size={16} />
                      </span>
                      <div>
                        <span>Role</span>
                        <strong>{profileDetails.role}</strong>
                      </div>
                    </div>
                    <div className="profile-modal-stat tone-green">
                      <span className="profile-modal-stat-icon" aria-hidden="true">
                        <ShieldCheck size={16} />
                      </span>
                      <div>
                        <span>Status</span>
                        <strong>{profileDetails.status}</strong>
                      </div>
                    </div>
                    <div className="profile-modal-stat tone-violet">
                      <span className="profile-modal-stat-icon" aria-hidden="true">
                        <Building2 size={16} />
                      </span>
                      <div>
                        <span>Workspace</span>
                        <strong>{profileDetails.workspace}</strong>
                      </div>
                    </div>
                    <div className="profile-modal-stat tone-amber">
                      <span className="profile-modal-stat-icon" aria-hidden="true">
                        <Globe size={16} />
                      </span>
                      <div>
                        <span>Access Level</span>
                        <strong>{profileDetails.accessLevel}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="profile-modal-info-list">
                    <div className="profile-modal-info-row">
                      <span className="profile-modal-info-label">
                        <LockKeyhole size={15} />
                        Password
                      </span>
                      <strong>{profileDetails.passwordMasked}</strong>
                    </div>
                    <div className="profile-modal-info-row">
                      <span className="profile-modal-info-label">
                        <RefreshCcw size={15} />
                        Reset Password
                      </span>
                      <strong>{profileDetails.resetPasswordText}</strong>
                    </div>
                    <div className="profile-modal-info-row">
                      <span className="profile-modal-info-label">
                        <Clock3 size={15} />
                        Last Login
                      </span>
                      <strong>{profileDetails.lastLogin}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
