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

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

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
  const otherItems = uniqueItems.filter((item) => item.label !== 'Last Login')

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
        className="fixed inset-0 z-[1210] bg-slate-950/10 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        role="presentation"
      >
        <div
          className={`fixed top-[74px] right-4 left-4 z-[1220] flex w-auto max-w-[calc(100vw-32px)] sm:left-auto sm:right-6 sm:w-[380px] flex-col rounded-[10px] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] border border-slate-100/80 profile-card-animate ${className}`.trim()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
          onClick={(event) => event.stopPropagation()}
        >
          {/* Search Applications Input */}
          <div className="relative mb-4 flex items-center h-10 w-full rounded-full border border-slate-200/80 px-3.5 bg-slate-50/50 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search Applications"
              className="w-full h-full pl-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent border-none p-0"
              readOnly
            />
          </div>

          {/* User Profile Header */}
          <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3 text-left">
            User Profile
          </div>

          {/* User Info (Avatar, Name, Email) */}
          <div className="flex items-center gap-3.5 mb-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#5275F6] text-white">
              <User className="h-7 w-7 text-white/95" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <h4 className="text-[15px] font-bold text-slate-900 leading-snug">{title}</h4>
              <p className="text-[13px] text-slate-500 mt-0.5 truncate leading-none">{email}</p>
            </div>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          {/* Profile Details List */}
          <div className="flex flex-col">
            {otherItems.map((item, index) => {
              const Icon = item.icon
              const isResetPassword = item.label === 'Reset Password'

              return (
                <div key={`${item.label}-${item.value}`}>
                  <div className="flex items-center gap-3.5 py-3">
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
                        <span className="mt-1 block text-[13px] font-semibold text-blue-600 hover:underline cursor-pointer">
                          {item.value}
                        </span>
                      ) : (
                        <strong className="mt-1 block text-[13px] font-semibold text-slate-800 break-words leading-tight">
                          {item.value}
                        </strong>
                      )}
                    </div>
                  </div>
                  {index < otherItems.length - 1 && <div className="h-px bg-slate-100" />}
                </div>
              )
            })}
          </div>

          {/* Last Login Section (Blue Box) */}
          {lastLoginItem && (
            <div className="mt-2.5 flex items-center gap-3.5 rounded-xl bg-blue-50/40 border border-blue-100/30 p-3">
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

