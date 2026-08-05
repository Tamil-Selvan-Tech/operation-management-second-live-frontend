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
  X,
} from 'lucide-react'

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

  return createPortal(
    <div className="fixed inset-0 z-[1210] flex items-stretch justify-end bg-slate-950/50 px-0 backdrop-blur-[6px]" role="presentation">
      <div
        className={`flex h-[calc(100dvh-12px)] w-full min-w-0 flex-col overflow-hidden bg-white shadow-[-24px_0_90px_rgba(15,23,42,0.28)] sm:h-[calc(100vh-24px)] sm:w-[400px] md:w-[420px] lg:h-[calc(100vh-36px)] lg:w-[440px] xl:h-[calc(100vh-40px)] xl:w-[460px] 2xl:h-[calc(100vh-44px)] 2xl:w-[500px] min-[1440px]:h-[calc(100vh-48px)] min-[1600px]:h-[calc(100vh-54px)] min-[1920px]:h-[calc(100vh-58px)] min-[2560px]:h-[calc(100vh-64px)] sm:flex-none sm:rounded-l-[28px] sm:border sm:border-slate-200 sm:border-r-0 ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative min-h-[78px] overflow-hidden bg-[linear-gradient(135deg,#0e1632_0%,#0f2f73_48%,#0d77df_100%)] sm:min-h-[96px] md:min-h-[104px] xl:min-h-[110px] 2xl:min-h-[116px] min-[1440px]:min-h-[104px] min-[1600px]:min-h-[100px] min-[1920px]:min-h-[96px] min-[2560px]:min-h-[92px]">
          <button
            type="button"
            className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.14)] transition-colors hover:bg-slate-50 hover:text-blue-700"
            onClick={onClose}
            aria-label="Close profile card"
          >
            <X size={18} strokeWidth={2.5} aria-hidden="true" focusable="false" />
          </button>

          <div className="absolute left-4 top-4 grid grid-cols-5 gap-x-2 gap-y-2 opacity-30" aria-hidden="true">
            {Array.from({ length: 15 }, (_, index) => (
              <span key={`profile-dot-${index}`} className="h-1 w-1 rounded-full bg-white" />
            ))}
          </div>

          <svg
            className="absolute inset-x-[-2%] bottom-[-1px] h-[78px] w-[104%] text-white sm:h-[84px] min-[1440px]:h-[76px] min-[1600px]:h-[72px] min-[1920px]:h-[68px] min-[2560px]:h-[64px]"
            viewBox="0 0 100 34"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 34 C18 7 82 7 100 34 L100 34 L0 34 Z" fill="currentColor" />
          </svg>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center -mt-3 overflow-y-auto px-4 pb-4 pt-7 text-center [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:-mt-5 sm:px-5 sm:pb-4 sm:pt-7 xl:-mt-4 xl:px-6 xl:pt-7 2xl:-mt-6 2xl:px-7 2xl:pb-4 2xl:pt-7 min-[1440px]:pb-3 min-[1600px]:pb-3 min-[1920px]:pb-2 min-[2560px]:pb-2">
          <p className="text-[clamp(0.7rem,0.75vw,0.78rem)] font-black uppercase tracking-[0.14em] text-blue-700 2xl:text-[0.82rem]">
            Profile
          </p>
          <h3 id={ariaLabelledBy} className="mt-1.5 text-[clamp(1.15rem,1.7vw,1.55rem)] font-bold leading-tight tracking-[-0.03em] text-slate-900 sm:mt-2 2xl:text-[1.65rem]">
            {title}
          </h3>
          <p className="mt-1.5 max-w-[34ch] text-[clamp(0.8rem,1vw,0.95rem)] leading-5 text-slate-500 sm:mt-2 sm:leading-6 2xl:max-w-[40ch] 2xl:text-[1rem]">
            {email}
          </p>

          <div className="mt-2.5 grid w-full grid-cols-1 gap-2 sm:mt-3 sm:grid-cols-2 sm:gap-2.5 lg:gap-3 2xl:mt-3.5 2xl:gap-3.5 min-[1440px]:mt-2.5 min-[1600px]:mt-2.5 min-[1920px]:mt-2 min-[2560px]:mt-2">
            {statTiles.map((tile) => {
              const Icon = tile.icon
              return <ProfileStatTile key={`${tile.label}-${tile.value}`} icon={Icon} tone={tile.tone} label={tile.label} value={tile.value} />
            })}
          </div>

          <div className="mt-2.5 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 text-left shadow-sm sm:mt-3 2xl:mt-3.5 min-[1440px]:mt-2.5 min-[1600px]:mt-2.5 min-[1920px]:mt-2 min-[2560px]:mt-2">
            {detailRows.map((row) => {
              const Icon = row.icon
              return <ProfileDetailRow key={`${row.label}-${row.value}`} icon={Icon} label={row.label} value={row.value} />
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
