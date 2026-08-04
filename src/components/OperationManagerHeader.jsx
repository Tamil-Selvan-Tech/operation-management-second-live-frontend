import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  Globe,
  Clock3,
  LockKeyhole,
  RefreshCcw,
  Search,
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
    passwordMasked: 'ChangeMe123!',
    resetPasswordText: 'Send Reset Link',
    lastLogin: 'Today, 10:25 AM',
    initials,
  }
}

function ProfileStatTile({ icon: Icon, tone, label, value }) {
  const toneStyles = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  }

  return (
    <div className="grid min-h-[72px] grid-cols-[28px_minmax(0,1fr)] gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 text-left shadow-sm sm:min-h-[84px] sm:grid-cols-[32px_minmax(0,1fr)] sm:gap-2.5 sm:p-3.5 lg:min-h-[88px] xl:min-h-[92px] 2xl:min-h-[96px] 2xl:p-4">
      <span className={`grid h-7 w-7 place-items-center rounded-full ${toneStyles[tone] || toneStyles.blue}`} aria-hidden="true">
        <Icon size={14} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <span className="block text-[0.64rem] font-bold uppercase tracking-[0.08em] text-slate-500 sm:text-[0.7rem] 2xl:text-[0.72rem]">
          {label}
        </span>
        <strong className="mt-0.5 block min-w-0 break-words text-[0.84rem] font-extrabold leading-[1.18] tracking-[-0.03em] text-slate-900 sm:mt-1 sm:text-[0.95rem] 2xl:text-[1rem]">
          {value}
        </strong>
      </div>
    </div>
  )
}

function ProfileDetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-slate-200 px-3.5 py-2 first:border-t-0 first:pt-3 first:last:pb-3 sm:px-5 sm:py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-[0.82rem] font-medium text-slate-500 sm:text-sm 2xl:text-[0.95rem]">
        <Icon size={14} strokeWidth={2.2} className="shrink-0 text-blue-600" aria-hidden="true" />
        <span className="min-w-0">{label}</span>
      </span>
      <strong className="max-w-[55%] break-words text-right text-[0.82rem] font-semibold tracking-[-0.02em] text-slate-900 sm:max-w-[60%] sm:text-sm 2xl:text-[0.95rem]">
        {value}
      </strong>
    </div>
  )
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

      {isProfileOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="profile-drawer-backdrop"
              role="presentation"
            >
            <div
              className="profile-drawer operation-manager-profile-card"
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

                  <div className="profile-modal-info-list">
                    <div className="profile-modal-info-row">
                      <span className="profile-modal-info-label">
                        <BadgeCheck size={15} />
                        Role
                      </span>
                      <strong>{profileDetails.role}</strong>
                    </div>
                    <div className="profile-modal-info-row">
                      <span className="profile-modal-info-label">
                        <ShieldCheck size={15} />
                        Status
                      </span>
                      <strong>{profileDetails.status}</strong>
                    </div>
                    <div className="profile-modal-info-row">
                      <span className="profile-modal-info-label">
                        <Building2 size={15} />
                        Workspace
                      </span>
                      <strong>{profileDetails.workspace}</strong>
                    </div>
                    <div className="profile-modal-info-row">
                      <span className="profile-modal-info-label">
                        <Globe size={15} />
                        Access Level
                      </span>
                      <strong>{profileDetails.accessLevel}</strong>
                    </div>
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
