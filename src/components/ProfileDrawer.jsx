import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  Building2,
  Clock3,
  Bot,
  CalendarDays,
  Bell,
  Globe,
  LockKeyhole,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  Search,
  Settings2,
  MessageSquareMore,
  User,
  X,
  CircleHelp,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'

const defaultStatTiles = [
  { icon: BadgeCheck, tone: 'blue', label: 'Role', value: 'Operation Manager' },
  { icon: ShieldCheck, tone: 'green', label: 'Status', value: 'Active' },
  { icon: Building2, tone: 'violet', label: 'Workspace', value: 'Cispro Ops' },
  { icon: Globe, tone: 'amber', label: 'Access Level', value: 'Operation Manager' },
]

const defaultDetailRows = [
  { icon: LockKeyhole, label: 'Password', value: 'ChangeMe123!' },
  { icon: RefreshCcw, label: 'Reset Password', value: 'Send Reset Link' },
  { icon: Clock3, label: 'Last Login', value: 'Today, 10:25 AM' },
]

const defaultQuickActions = [
  { icon: Settings2, label: 'Profile & Settings' },
  { icon: CircleHelp, label: 'Help' },
  { icon: CalendarDays, label: 'Attendance' },
  { icon: Bell, label: 'Notifications' },
]

export function ProfileDrawer({
  isOpen,
  onClose,
  title = 'Operation Manager',
  email = 'operation.manager@cispro.com',
  statTiles = defaultStatTiles,
  detailRows = defaultDetailRows,
  quickActions = defaultQuickActions,
  ariaLabelledBy = 'profile-modal-title',
  className = 'operation-manager-profile-card',
}) {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  useEffect(() => {
    if (!isOpen) return undefined

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  // Combine and deduplicate items based on their labels
  const allItems = [...statTiles, ...detailRows]
  const uniqueItems = []
  const seenLabels = new Set()
  for (const item of allItems) {
    if (!seenLabels.has(item.label)) {
      seenLabels.add(item.label)
      uniqueItems.push(item)
    }
  }

  const lastLoginItem = uniqueItems.find((item) => item.label === 'Last Login')
  // Filter out the "Password" row completely
  const otherItems = uniqueItems.filter((item) => item.label !== 'Last Login' && item.label !== 'Password')

  const handleSignOut = async () => {
    try {
      await signOut?.()
    } finally {
      onClose?.()
      navigate('/login')
    }
  }

  const getIconColor = (tone, label) => {
    if (label === 'Role') return 'text-blue-500'
    if (label === 'Status') return 'text-emerald-500'
    if (label === 'Workspace') return 'text-blue-500'
    if (label === 'Access Level') return 'text-violet-500'
    if (label === 'Password') return 'text-violet-500'
    if (label === 'Reset Password') return 'text-blue-500'

    const map = {
      blue: 'text-blue-500',
      green: 'text-emerald-500',
      violet: 'text-violet-500',
      amber: 'text-purple-500',
    }
    return map[tone] || 'text-slate-400'
  }

  return createPortal(
    <>
      <style>{`
        @keyframes profileCardFadeIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .profile-card-animate {
          animation: profileCardFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <div
        className="fixed inset-0 z-[1210] bg-black/20 backdrop-blur-[6px] transition-opacity"
        role="presentation"
      >
        <div
          className={`fixed top-[56px] right-4 left-4 z-[1220] flex w-[calc(100vw-32px)] max-w-[calc(100vw-32px)] sm:left-auto sm:right-0 sm:w-[390px] flex-col rounded-none bg-white pt-[50px] px-6 pb-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] border border-slate-100/80 profile-card-animate ${className}`.trim()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
          onClick={(event) => event.stopPropagation()}
        >
          {/* Top Pointer Arrow */}
          <div className="absolute right-[18px] top-[-6px] h-3 w-3 rotate-45 border-l border-t border-slate-100 bg-white" />

          {/* Close (X) Icon */}
          <button
            type="button"
            className="absolute right-4 top-4 z-20 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer border-none bg-transparent p-0"
            onClick={onClose}
            aria-label="Close profile card"
          >
            <X size={16} strokeWidth={2.5} aria-hidden="true" focusable="false" />
          </button>

          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0">
              {/* Search Applications Input */}
              <div className="relative mb-2.5 flex h-12 w-full items-center overflow-hidden rounded-full border border-slate-200 bg-white px-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400">
                  <Search size={18} strokeWidth={2.2} />
                </div>
                <input
                  type="text"
                  placeholder="Search Applications"
                  className="ml-4 h-full flex-1 rounded-full rounded-r-full p-0 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none ring-0 focus:outline-none focus:ring-0"
                  style={{
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    background: 'transparent',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                  }}
                  readOnly
                />
              </div>

              {/* User Profile Header */}
              <div className="mb-2.5 text-left text-[12px] font-medium uppercase tracking-wider text-[#8B96A8]">
                User Profile
              </div>

              {/* User Info (Avatar, Name, Email) */}
              <div className="mb-4 flex items-center gap-3.5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#5275F6] text-white">
                  <User className="h-7 w-7 text-white/95" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h4 className="text-[15px] font-bold leading-snug text-slate-900">{title}</h4>
                  <p className="mt-0.5 truncate text-[13px] leading-none text-slate-500">{email}</p>
                </div>
              </div>

              {/* Profile Details List */}
              <div className="flex flex-col gap-4">
                {otherItems.map((item) => {
                  const Icon = item.icon
                  const isResetPassword = item.label === 'Reset Password'

                  return (
                    <div key={`${item.label}-${item.value}`} className="flex items-center gap-3.5">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center ${getIconColor(
                          item.tone,
                          item.label,
                        )}`}
                        aria-hidden="true"
                      >
                        <Icon size={18} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1 text-left">
                        <span className="block text-[11px] font-medium leading-none text-slate-400">
                          {item.label}
                        </span>
                        {isResetPassword ? (
                          <span className="mt-1 block cursor-pointer text-[13px] font-semibold leading-tight text-blue-600 hover:underline">
                            {item.value}
                          </span>
                        ) : (
                          <strong className="mt-1 block break-words text-[13px] font-semibold leading-tight text-slate-800">
                            {item.value}
                          </strong>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Last Login Section (Blue Box) */}
              {lastLoginItem && (
                <div className="mt-4 flex items-center gap-3.5 rounded-xl border border-blue-100/30 bg-blue-50/40 px-3 py-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-blue-600" aria-hidden="true">
                    <lastLoginItem.icon size={18} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block text-[11px] font-medium leading-none text-slate-400">
                      {lastLoginItem.label}
                    </span>
                    <strong className="mt-1 block break-words text-[13px] font-semibold leading-tight text-slate-800">
                      {lastLoginItem.value}
                    </strong>
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2.5 px-1">
                {quickActions.map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={item.label}
                      type="button"
                      className="flex items-center gap-2 rounded-none border-0 bg-transparent p-0 text-left text-[13px] font-medium leading-tight text-slate-700"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-500" aria-hidden="true">
                        <Icon size={15} strokeWidth={1.9} />
                      </span>
                      <span className="leading-tight">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-3 shrink-0 border-t border-slate-100/90 pt-3 pb-1">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 text-[14px] font-medium text-red-500 transition-colors hover:text-red-600"
              >
                <LogOut size={16} strokeWidth={2} aria-hidden="true" focusable="false" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}

