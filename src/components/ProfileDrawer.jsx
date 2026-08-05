import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  BadgeCheck,
  Building2,
  Clock3,
  Globe,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Search,
  User,
  X,
} from 'lucide-react'

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

export function ProfileDrawer({
  isOpen,
  onClose,
  title = 'Operation Manager',
  email = 'operation.manager@cispro.com',
  statTiles = defaultStatTiles,
  detailRows = defaultDetailRows,
  ariaLabelledBy = 'profile-modal-title',
  className = 'operation-manager-profile-card',
}) {
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
          className={`fixed top-[74px] right-4 left-4 z-[1220] flex w-[calc(100vw-32px)] max-w-[calc(100vw-32px)] sm:left-auto sm:right-0 sm:w-[390px] flex-col rounded-[10px] bg-white pt-[58px] px-6 pb-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)] border border-slate-100/80 profile-card-animate ${className}`.trim()}
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

          {/* Search Applications Input */}
          <div className="relative mb-2.5 flex h-12 w-full items-center overflow-hidden rounded-full border border-slate-200 bg-white px-5 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
            <div className="flex h-5 w-5 items-center justify-center text-slate-400 shrink-0">
              <Search size={18} strokeWidth={2.2} />
            </div>
            <input
              type="text"
              placeholder="Search Applications"
              className="flex-1 h-full ml-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none p-0 outline-none ring-0 focus:ring-0 rounded-full rounded-r-full"
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
          <div className="mb-3 text-left text-[12px] font-medium uppercase tracking-wider text-[#8B96A8]">
            User Profile
          </div>

          {/* User Info (Avatar, Name, Email) */}
          <div className="flex items-center gap-3.5 mb-[22px]">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#5275F6] text-white">
              <User className="h-7 w-7 text-white/95" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <h4 className="text-[15px] font-bold text-slate-900 leading-snug">{title}</h4>
              <p className="text-[13px] text-slate-500 mt-0.5 truncate leading-none">{email}</p>
            </div>
          </div>

          {/* Profile Details List */}
          <div className="flex flex-col gap-[22px]">
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
                  <div className="flex-1 text-left min-w-0">
                    <span className="block text-[11px] text-slate-400 font-medium leading-none">
                      {item.label}
                    </span>
                    {isResetPassword ? (
                      <span className="mt-1 block text-[13px] font-semibold text-blue-600 hover:underline cursor-pointer leading-tight">
                        {item.value}
                      </span>
                    ) : (
                      <strong className="mt-1 block text-[13px] font-semibold text-slate-800 break-words leading-tight">
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
            <div className="mt-[22px] flex items-center gap-3.5 rounded-xl border border-blue-100/30 bg-blue-50/40 px-3 py-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-blue-600" aria-hidden="true">
                <lastLoginItem.icon size={18} strokeWidth={1.8} />
              </span>
              <div className="flex-1 text-left min-w-0">
                <span className="block text-[11px] text-slate-400 font-medium leading-none">
                  {lastLoginItem.label}
                </span>
                <strong className="mt-1 block text-[13px] font-semibold text-slate-800 break-words leading-tight">
                  {lastLoginItem.value}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

