import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BadgeCheck,
  Building2,
  Globe,
  Clock3,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  X,
} from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { HeaderIdentityChip } from './HeaderIdentityChip'

function buildProfileDetails({ eyebrow, profileTitle, email, initials }) {
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
    passwordMasked: 'ChangeMe123',
    resetPasswordText: 'Send Reset Link',
    lastLogin: 'Today, 10:25 AM',
    initials,
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
  const profileDetails = buildProfileDetails({ eyebrow, profileTitle, email, initials })

  useEffect(() => {
    if (!isProfileOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isProfileOpen])

  return (
    <>
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
          {summary ? <p>{summary}</p> : null}
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

      {isProfileOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="profile-modal-backdrop"
              role="presentation"
              onClick={() => setIsProfileOpen(false)}
            >
              <div
                className="profile-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="profile-modal-cover">
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

                <div className="profile-modal-body">
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
