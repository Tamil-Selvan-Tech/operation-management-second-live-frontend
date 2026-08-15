import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  CalendarDays,
  GraduationCap,
  Home,
  LayoutGrid,
  LogOut,
  X,
  UserRound,
  UsersRound,
} from 'lucide-react'

import { roleLabels } from '../data/authData'
import { getUnreadNotificationCount } from '../data/notificationsData'

const defaultAvatarSrc =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%230f7bda'/%3E%3Cstop offset='1' stop-color='%234da3ff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='40' cy='40' r='40' fill='url(%23g)'/%3E%3Ccircle cx='40' cy='30' r='12' fill='white' fill-opacity='.95'/%3E%3Cpath d='M18 64c4-12 15-18 22-18s18 6 22 18' fill='white' fill-opacity='.95'/%3E%3C/svg%3E"

function SidebarItem({
  icon: Icon,
  label,
  active = false,
  onClick,
  disabled = false,
  badge = null,
  usePremiumLayout = false,
  useDashboardShell = false,
}) {
  const usePlainSidebarItem = usePremiumLayout || useDashboardShell

  const itemClassName = usePlainSidebarItem
    ? `sidebar-menu-item group !flex w-full items-center gap-3 rounded-xl border-0 bg-transparent px-2 py-3 text-left text-slate-700 shadow-none transition-colors duration-150 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? 'is-active bg-slate-100 text-slate-950' : ''
      }`.trim()
    : `sidebar-menu-item group !flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? 'is-active border-transparent bg-gradient-to-r from-sky-500 to-sky-400 text-white shadow-lg shadow-sky-500/20' : ''
      }`.trim()

  const iconClassName = usePlainSidebarItem
    ? `sidebar-menu-icon !grid h-5 w-5 shrink-0 place-items-center rounded-none bg-transparent text-slate-500 transition-colors group-hover:text-slate-700 ${
        active ? 'text-slate-950 group-hover:text-slate-950' : ''
      }`
    : `sidebar-menu-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-white group-hover:text-sky-600 ${
        active ? 'bg-white/15 text-white group-hover:bg-white/15 group-hover:text-white' : ''
      }`

  return (
    <button
      type="button"
      className={itemClassName}
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      title={disabled ? `${label} coming soon` : undefined}
    >
      <span className={iconClassName} aria-hidden="true">
        <Icon size={usePremiumLayout ? 20 : 20} strokeWidth={usePremiumLayout ? 2.1 : 2.1} focusable="false" />
      </span>
      <span className="sidebar-menu-label min-w-0 flex-1 truncate text-[0.94rem] font-semibold">{label}</span>
      {badge ? (
        <span className="sidebar-menu-badge inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-sky-100 px-2 text-[0.7rem] font-bold text-sky-700">
          {badge}
        </span>
      ) : null}
    </button>
  )
}

function createNavHandler(onClose, onNavigate) {
  return () => {
    onNavigate?.()
    window.setTimeout(() => onClose?.(), 0)
  }
}

export function AppSidebar({
  activeNav,
  user,
  isBusinessOwner = false,
  usePremiumLayout = false,
  useDashboardShell = false,
  onNavigateDashboard,
  onNavigateFacultyBatches,
  onNavigateCourses,
  onNavigateStudentManagement,
  onNavigateFacultyManagement,
  onNavigateNotifications,
  onLogout,
  onClose,
  isMobileOpen = false,
  showCoursesNav = true,
  showFacultyBatchesNav = false,
  showStudentManagementNav = true,
  showFacultyManagementNav = true,
  showNotificationsNav = true,
}) {
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const userRoleLabel = roleLabels[user?.role] || 'Cispro User'
  const userName = user?.name && !/^\s*user\s*$/i.test(user.name) ? user.name : userRoleLabel
  const profileEmail = user?.email || (isBusinessOwner ? 'business.owner@cispro.com' : '')
  const avatarSrc = user?.avatarUrl || defaultAvatarSrc
  const unreadNotificationCount = useMemo(() => getUnreadNotificationCount(user?.role), [user?.role])

  useEffect(() => {
    if (!isLogoutConfirmOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsLogoutConfirmOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isLogoutConfirmOpen])

  const confirmLogout = async () => {
    setIsLogoutConfirmOpen(false)
    await onLogout?.()
  }

  const mainMenuItems = [
    {
      icon: isBusinessOwner ? LayoutGrid : Home,
      label: 'Dashboard',
      active: activeNav === 'dashboard',
      onClick: createNavHandler(onClose, onNavigateDashboard),
    },
    showFacultyBatchesNav
      ? {
          icon: CalendarDays,
          label: 'My Batches',
          active: activeNav === 'my-batches',
          onClick: createNavHandler(onClose, onNavigateFacultyBatches),
        }
      : null,
    showCoursesNav
      ? {
          icon: GraduationCap,
          label: 'Courses',
          active: activeNav === 'courses',
          onClick: createNavHandler(onClose, onNavigateCourses),
        }
      : null,
    showStudentManagementNav
      ? {
          icon: UsersRound,
          label: 'Student Management',
          active: activeNav === 'student-management',
          onClick: createNavHandler(onClose, onNavigateStudentManagement),
        }
      : null,
    showFacultyManagementNav
      ? {
          icon: UserRound,
          label: 'Faculty Management',
          active: activeNav === 'faculty-management',
          onClick: createNavHandler(onClose, onNavigateFacultyManagement),
        }
      : null,
  ].filter(Boolean)

  const otherMenuItems = [
    showNotificationsNav
      ? {
          icon: Bell,
          label: 'Notifications',
          active: activeNav === 'notifications',
          onClick: createNavHandler(onClose, onNavigateNotifications),
          badge: unreadNotificationCount || null,
        }
      : null,
  ].filter(Boolean)

  return (
    <aside
      className={
        usePremiumLayout
          ? `sidebar ${isMobileOpen ? 'is-open' : ''} ${isBusinessOwner ? 'is-business-owner-sidebar' : ''} !fixed !left-3 !top-3 !z-[1200] !flex !h-[calc(100vh-1.5rem)] !w-[min(20.75rem,calc(100vw-1.5rem))] !-translate-x-[110%] !flex-col !overflow-hidden !rounded-[20px] !border !border-slate-200 !bg-white/95 !p-4 !shadow-[0_18px_40px_rgba(15,23,42,0.12)] !backdrop-blur !transition-transform !duration-200 md:!sticky md:!left-auto md:!top-0 md:!h-screen md:!translate-x-0 md:!w-full md:!overflow-hidden md:!rounded-none md:!border-r md:!border-slate-200 md:!bg-white md:!shadow-none md:!backdrop-blur-0`.trim()
          : `sidebar ${isMobileOpen ? 'is-open' : ''} ${isBusinessOwner ? 'is-business-owner-sidebar' : ''}`.trim()
      }
    >
      <button
        type="button"
        className={usePremiumLayout ? 'sidebar-close-button !absolute !right-4 !top-4 !grid !h-9 !w-9 !place-items-center !rounded-xl !border !border-slate-200 !bg-white !text-slate-600 !shadow-sm md:!hidden' : 'sidebar-close-button'}
        onClick={onClose}
        aria-label="Close sidebar"
      >
        <X size={20} strokeWidth={2.4} aria-hidden="true" focusable="false" />
      </button>

      <div className={usePremiumLayout ? 'sidebar-head !flex items-start justify-between gap-3 pr-8 md:pr-0 md:pl-2' : 'sidebar-head'}>
        <div className={usePremiumLayout ? 'brand !flex items-center gap-3' : 'brand'}>
          <img className="brand-logo" src="/logo1.png" alt="Cispro Ops logo" />
          <div className="min-w-0">
            <strong className="block text-[1.15rem] font-semibold tracking-[-0.02em] text-slate-900">Cispro Ops</strong>
          </div>
        </div>
      </div>

      <div className={usePremiumLayout ? 'sidebar-divider !h-px !w-full !bg-slate-200/80' : 'sidebar-divider'} aria-hidden="true" />

      <div className={usePremiumLayout ? 'sidebar-menu-scroll !min-h-0 !flex-1 !overflow-hidden !overflow-x-hidden md:pl-2' : 'sidebar-menu-scroll'}>
        <nav className={usePremiumLayout ? 'menu !grid gap-3 md:pr-1' : 'menu'} aria-label="Sidebar navigation">
          <div className={usePremiumLayout ? 'menu-section !grid gap-1.5 md:pl-1' : 'menu-section'}>
            <p className="menu-section-label text-[0.72rem] font-bold uppercase tracking-[0.12em] text-slate-400">
              {isBusinessOwner ? 'Main Navigation' : 'Main Menu'}
            </p>
            <div className={usePremiumLayout ? 'menu-group !grid gap-2' : 'menu-group'}>
              {mainMenuItems.map((item) => (
                <SidebarItem
                  key={item.label}
                  {...item}
                  usePremiumLayout={usePremiumLayout}
                  useDashboardShell={useDashboardShell}
                />
              ))}
            </div>
          </div>

          <div className={usePremiumLayout ? 'menu-section !grid gap-1.5 md:pl-1' : 'menu-section'}>
            <p className="menu-section-label text-[0.72rem] font-bold uppercase tracking-[0.12em] text-slate-400">
              Other
            </p>
            <div className={usePremiumLayout ? 'menu-group !grid gap-2' : 'menu-group'}>
              {otherMenuItems.map((item) => (
                <SidebarItem
                  key={item.label}
                  {...item}
                  usePremiumLayout={usePremiumLayout}
                  useDashboardShell={useDashboardShell}
                />
              ))}
            </div>
          </div>
        </nav>
      </div>

      <div className={usePremiumLayout ? 'sidebar-footer !mt-auto !pt-2 md:pl-2' : 'sidebar-footer'}>
        <div className={usePremiumLayout ? 'sidebar-profile-card !grid grid-cols-[40px_minmax(0,1fr)_36px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm' : 'sidebar-profile-card'}>
          <span className={usePremiumLayout ? 'sidebar-profile-avatar-wrap !relative !block h-10 w-10' : 'sidebar-profile-avatar-wrap'} aria-hidden="true">
            <img className="sidebar-profile-avatar" src={avatarSrc} alt="" aria-hidden="true" />
            <span className={usePremiumLayout ? 'sidebar-profile-status !absolute !bottom-0 !right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500' : 'sidebar-profile-status'} />
          </span>
          <span className={usePremiumLayout ? 'sidebar-profile-copy !min-w-0' : 'sidebar-profile-copy'}>
            <strong className="block truncate text-sm font-extrabold tracking-[-0.02em] text-slate-900">{userName}</strong>
            {profileEmail ? <small className="sidebar-profile-email block truncate text-xs text-slate-500">{profileEmail}</small> : null}
          </span>
          <button
            type="button"
            className={usePremiumLayout ? 'sidebar-profile-logout-icon !grid !h-9 !w-9 !place-items-center rounded-full text-red-600 transition-colors hover:bg-red-50 hover:text-red-700' : 'sidebar-profile-logout-icon'}
            onClick={() => setIsLogoutConfirmOpen(true)}
            aria-label="Logout"
          >
            <LogOut size={22} strokeWidth={2} focusable="false" />
          </button>
        </div>
      </div>

      {isLogoutConfirmOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="logout-modal-backdrop" role="presentation">
              <div
                className="logout-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="logout-modal-title"
                aria-describedby="logout-modal-description"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="course-modal-close logout-modal-close"
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  aria-label="Close logout confirmation"
                >
                  ×
                </button>
                <h3 id="logout-modal-title">Are you sure you want to logout?</h3>
                <div className="logout-modal-actions">
                  <button type="button" className="button-ghost" onClick={() => setIsLogoutConfirmOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button-solid"
                    onClick={async () => {
                      onClose?.()
                      await confirmLogout()
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </aside>
  )
}
