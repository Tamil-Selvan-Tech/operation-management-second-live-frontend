import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  CircleUserRound,
  FileText,
  FileSpreadsheet,
  GraduationCap,
  Headset,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  Shield,
  UserRound,
  Users,
} from 'lucide-react'

function getSection(search) {
  return new URLSearchParams(search).get('section') || 'dashboard'
}

function getView(search) {
  return new URLSearchParams(search).get('view') || ''
}

function isActiveBranch(branch) {
  return String(branch?.status || '').trim().toLowerCase() !== 'inactive'
}

function isSelectedEntry(activeSection, activeView, entry) {
  // Sales CRM and User & Role Management share the sales-admin section;
  // their views are intentionally kept mutually exclusive in the sidebar.
  if (entry.id === 'sales-admin' && ['leads', 'admissions'].includes(activeView)) return false
  if (entry.id === 'branch-reports' && activeSection === 'reports' && activeView !== 'lead-monthly') return true
  if (entry.section && activeSection !== entry.section) return false
  if (entry.view && activeView !== entry.view) return false
  return Boolean(entry.section || entry.id === activeSection)
}

export function SuperAdminSidebarNav({ branches = [], isSidebarCollapsed, onCloseMobile, onOpenBranch, onNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const activeSection = getSection(location.search)
  const activeView = getView(location.search)
  const isNotifications = location.pathname.endsWith('/notifications')
  const activeBranches = useMemo(() => branches.filter(isActiveBranch), [branches])
  const defaultExpandedGroups = { salesCrm: true, userRole: true, academic: true, leaveManagement: true, reports: true, helpdesk: false }
  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('cispro.super-admin-sidebar-expanded-groups') || '{}')
      return { ...defaultExpandedGroups, ...(saved && typeof saved === 'object' ? saved : {}) }
    } catch {
      return defaultExpandedGroups
    }
  })
  const [isBranchExpanded, setIsBranchExpanded] = useState(false)
  const [isFlyoutDismissed, setIsFlyoutDismissed] = useState(false)

  useEffect(() => {
    try { window.localStorage.setItem('cispro.super-admin-sidebar-expanded-groups', JSON.stringify(expandedGroups)) } catch { /* storage may be unavailable */ }
  }, [expandedGroups])

  const go = (path) => {
    if (path === '/dashboard/super-admin' || path === '/dashboard/super-admin/notifications') setIsBranchExpanded(false)
    onNavigate?.()
    onCloseMobile?.()
    navigate(path)
  }

  const goToEntry = (entry) => {
    const params = new URLSearchParams()
    params.set('section', entry.section || entry.id)
    if (entry.view) params.set('view', entry.view)
    go(`/dashboard/super-admin?${params.toString()}`)
  }

  const openBranch = (branch) => {
    setIsFlyoutDismissed(true)
    onCloseMobile?.()
    if (onOpenBranch) {
      onOpenBranch(branch)
      return
    }
    navigate(`/dashboard/super-admin?section=branch-admin&branch=${encodeURIComponent(branch.id || branch.branchId || '')}`)
  }

  const groupDefinitions = [
    {
      id: 'salesCrm', label: 'Sales & CRM', icon: BriefcaseBusiness,
      children: [
        { id: 'sales-leads', label: 'Lead Management', icon: Users, section: 'sales-admin', view: 'leads' },
        { id: 'sales-admissions', label: 'Admission Management', icon: GraduationCap, section: 'sales-admin', view: 'admissions' },
      ],
    },
    {
      id: 'userRole', label: 'User & Role Management', icon: Users,
      children: [
        { id: 'branch-admin', label: 'Branch Admin', icon: Shield, section: 'branch-admin' },
        { id: 'sales-admin', label: 'Sales Admin', icon: BriefcaseBusiness, section: 'sales-admin' },
        { id: 'faculty', label: 'Faculty', icon: UserRound, section: 'faculty' },
      ],
    },
    {
      id: 'academic', label: 'Academic Operations', icon: LayoutGrid,
      children: [
        { id: 'students', label: 'Student Management', icon: Users, section: 'students' },
        { id: 'exams-results', label: 'Exams and Result', icon: FileText, section: 'exams-results' },
        {
          id: 'leaveManagement', label: 'Leave Management', icon: CalendarDays,
          children: [
            { id: 'faculty-leave', label: 'Faculty Leave', icon: CalendarDays, section: 'faculty-leave' },
            { id: 'institute-leave', label: 'Institute Leave', icon: CalendarDays, section: 'leave-management', view: 'institute' },
            { id: 'sales-admin-leave', label: 'Sales Admin Leave', icon: BriefcaseBusiness, section: 'sales-admin-leave' },
            { id: 'discontinuations', label: 'Student Discontinuation', icon: FileText, section: 'discontinuations' },
          ],
        },
      ],
    },
    {
      id: 'reports', label: 'Reports & Analytics', icon: ChartNoAxesCombined,
      children: [
        { id: 'sales-crm-reports', label: 'Lead Monthly Report', icon: FileText, section: 'reports', view: 'lead-monthly' },
        { id: 'branch-reports', label: 'Report Downloads', icon: FileSpreadsheet, section: 'reports', view: 'downloads' },
      ],
    },
    {
      id: 'helpdesk', label: 'Helpdesk & Support', icon: Headset,
      children: [],
    },
  ]

  const isEntryActive = (entry) => entry.children?.length
    ? entry.children.some(isEntryActive)
    : !isNotifications && isSelectedEntry(activeSection, activeView, entry)

  const renderEntry = (entry, mode = 'inline') => {
    const Icon = entry.icon
    const selected = !isNotifications && isSelectedEntry(activeSection, activeView, entry)
    return (
      <button key={entry.id} type="button" role={mode === 'flyout' ? 'menuitem' : undefined} className={`super-admin-sidebar-subitem ${selected ? 'is-active' : ''}`.trim()} onClick={() => goToEntry(entry)}>
        <span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><Icon size={15} strokeWidth={2.1} /></span>
        <span>{entry.label}</span>
      </button>
    )
  }

  const renderNestedEntry = (entry, mode = 'inline') => {
    const Icon = entry.icon
    const active = isEntryActive(entry)
    const expanded = expandedGroups[entry.id] ?? active
    return (
      <div key={entry.id} className={`super-admin-sidebar-nested-group ${active ? 'is-active' : ''}`.trim()}>
        <button type="button" role={mode === 'flyout' ? 'menuitem' : undefined} className={`super-admin-sidebar-subitem super-admin-sidebar-nested-toggle ${active ? 'is-active' : ''}`.trim()} aria-expanded={expanded} onClick={() => setExpandedGroups((current) => ({ ...current, [entry.id]: !current[entry.id] }))}>
          <span className="super-admin-sidebar-subitem-icon" aria-hidden="true"><Icon size={15} strokeWidth={2.1} /></span>
          <span>{entry.label}</span>
          <ChevronDown size={14} strokeWidth={2.2} className={expanded ? 'is-expanded' : ''} aria-hidden="true" />
        </button>
        {expanded ? <div className="super-admin-sidebar-nested-submenu">{entry.children.map((child) => renderEntry(child, mode))}</div> : null}
      </div>
    )
  }

  const renderChild = (entry, mode = 'inline') => entry.children?.length ? renderNestedEntry(entry, mode) : renderEntry(entry, mode)

  const renderGroup = (group) => {
    const Icon = group.icon
    if (!group.children?.length) {
      const isActive = !isNotifications && activeSection === group.id
      return (
        <div key={group.id} className="super-admin-sidebar-section">
          <button type="button" className={`super-admin-sidebar-item ${isActive ? 'is-active' : ''}`.trim()} data-tooltip={group.label} onClick={() => go(`/dashboard/super-admin?section=${encodeURIComponent(group.id)}`)}>
            <span className="super-admin-sidebar-icon"><Icon size={18} strokeWidth={2.2} aria-hidden="true" /></span>
            <span>{group.label}</span>
          </button>
        </div>
      )
    }
    const groupActive = group.children.some(isEntryActive)
    const expanded = expandedGroups[group.id] ?? groupActive
    return (
      <div key={group.id} className={`super-admin-sidebar-section super-admin-sidebar-group ${groupActive ? 'is-active' : ''}`.trim()}>
        <div className={`super-admin-sidebar-collapsed-group ${isFlyoutDismissed ? 'is-flyout-dismissed' : ''}`.trim()} onMouseEnter={() => setIsFlyoutDismissed(false)} onMouseLeave={() => setIsFlyoutDismissed(true)}>
          <button type="button" className="super-admin-sidebar-collapsed-group-trigger" data-tooltip={group.label} aria-label={group.label} onClick={() => setExpandedGroups((current) => ({ ...current, [group.id]: !current[group.id] }))}><Icon size={18} strokeWidth={2.2} aria-hidden="true" /></button>
          <div className="super-admin-sidebar-collapsed-group-flyout" role="menu" aria-label={`${group.label} submenu`}>
            <div className="super-admin-sidebar-collapsed-group-title">{group.label}</div>
            {group.children.map((entry) => renderChild(entry, 'flyout'))}
          </div>
        </div>
        <button type="button" className={`super-admin-sidebar-section-toggle ${groupActive ? 'is-active' : ''}`.trim()} aria-expanded={expanded || isSidebarCollapsed} onClick={() => setExpandedGroups((current) => ({ ...current, [group.id]: !current[group.id] }))}>
          <span className="super-admin-sidebar-section-toggle-label"><Icon size={16} strokeWidth={2.2} aria-hidden="true" /><span>{group.label}</span></span>
          <ChevronDown size={15} strokeWidth={2.4} className={expanded ? 'is-expanded' : ''} aria-hidden="true" />
        </button>
        {(expanded || isSidebarCollapsed) ? <div className="super-admin-sidebar-submenu">{group.children.map((entry) => renderChild(entry))}</div> : null}
      </div>
    )
  }

  return (
    <nav className="super-admin-sidebar-nav">
      <div className="super-admin-sidebar-section">
        <button type="button" className={`super-admin-sidebar-item ${!isNotifications && activeSection === 'dashboard' ? 'is-active' : ''}`.trim()} data-tooltip="Dashboard" onClick={() => go('/dashboard/super-admin')}><span className="super-admin-sidebar-icon" aria-hidden="true"><LayoutDashboard size={18} strokeWidth={2.2} /></span><span>Dashboard</span></button>
      </div>

      <div className="super-admin-sidebar-section">
        <div className={`super-admin-sidebar-branch-nav ${isFlyoutDismissed ? 'is-flyout-dismissed' : ''}`.trim()} onMouseLeave={() => setIsFlyoutDismissed(false)}>
          <div className={`super-admin-sidebar-item ${!isNotifications && activeSection === 'branches' ? 'is-active' : ''}`.trim()} data-tooltip="Branch Management">
            <button type="button" className="super-admin-sidebar-branch-link" onClick={() => { if (activeSection !== 'branches') go('/dashboard/super-admin?section=branches'); else setIsBranchExpanded((current) => !current) }}><span className="super-admin-sidebar-icon" aria-hidden="true"><Shield size={18} strokeWidth={2.2} /></span><span>Branch Management</span></button>
            <button type="button" className="super-admin-sidebar-branch-toggle" aria-label={`${isBranchExpanded ? 'Collapse' : 'Expand'} branch management`} aria-expanded={isBranchExpanded} onClick={() => setIsBranchExpanded((current) => !current)}><ChevronDown size={16} strokeWidth={2.3} className={isBranchExpanded ? 'is-expanded' : ''} aria-hidden="true" /></button>
          </div>
          {(isBranchExpanded || isSidebarCollapsed) ? <div className="super-admin-sidebar-branch-list" aria-label="Active branches"><div className="super-admin-sidebar-branch-list-title">Branch Management</div>{activeBranches.map((branch) => <button key={branch.id || branch.branchId} type="button" className="super-admin-sidebar-branch-name" onClick={() => openBranch(branch)}><span className="super-admin-sidebar-branch-dot" aria-hidden="true" /><span>{branch.branchName || branch.branchId || 'Active branch'}</span></button>)}{!activeBranches.length ? <span className="super-admin-sidebar-branch-empty">No active branches</span> : null}</div> : null}
        </div>
      </div>

      {groupDefinitions.map(renderGroup)}

      <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${isNotifications ? 'is-active' : ''}`.trim()} data-tooltip="Notifications" onClick={() => go('/dashboard/super-admin/notifications')}><span className="super-admin-sidebar-icon" aria-hidden="true"><Bell size={18} strokeWidth={2.2} /></span><span>Notifications</span></button></div>
      <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${!isNotifications && activeSection === 'settings' ? 'is-active' : ''}`.trim()} data-tooltip="Settings" onClick={() => go('/dashboard/super-admin?section=settings')}><span className="super-admin-sidebar-icon" aria-hidden="true"><Settings size={18} strokeWidth={2.2} /></span><span>Settings</span></button></div>
      <div className="super-admin-sidebar-section"><button type="button" className={`super-admin-sidebar-item ${!isNotifications && activeSection === 'profile' ? 'is-active' : ''}`.trim()} data-tooltip="Profile" onClick={() => go('/dashboard/super-admin?section=profile')}><span className="super-admin-sidebar-icon" aria-hidden="true"><CircleUserRound size={18} strokeWidth={2.2} /></span><span>Profile</span></button></div>
    </nav>
  )
}
