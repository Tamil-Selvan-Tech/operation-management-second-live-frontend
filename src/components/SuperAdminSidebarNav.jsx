import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  LayoutGrid,
  Shield,
  UserRound,
  Users,
} from 'lucide-react'

function getSection(search) {
  return new URLSearchParams(search).get('section') || 'dashboard'
}

function isActiveBranch(branch) {
  return String(branch?.status || '').trim().toLowerCase() !== 'inactive'
}

export function SuperAdminSidebarNav({ branches = [], isSidebarCollapsed, onCloseMobile, onOpenBranch }) {
  const navigate = useNavigate()
  const location = useLocation()
  const activeSection = getSection(location.search)
  const isNotifications = location.pathname.endsWith('/notifications')
  const [isBranchExpanded, setIsBranchExpanded] = useState(false)
  const [isUserRoleExpanded, setIsUserRoleExpanded] = useState(false)
  const [isAcademicExpanded, setIsAcademicExpanded] = useState(false)
  const [isLeaveExpanded, setIsLeaveExpanded] = useState(false)
  const [isFlyoutDismissed, setIsFlyoutDismissed] = useState(false)

  const go = (path) => {
    if (path === '/dashboard/super-admin' || path === '/dashboard/super-admin/notifications') {
      setIsBranchExpanded(false)
      setIsUserRoleExpanded(false)
      setIsAcademicExpanded(false)
      setIsLeaveExpanded(false)
    }
    onCloseMobile?.()
    navigate(path)
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

  const activeBranches = branches.filter(isActiveBranch)

  return (
    <nav className="super-admin-sidebar-nav">
      <div className="super-admin-sidebar-section">
        <button type="button" className={`super-admin-sidebar-item ${!isNotifications && activeSection === 'dashboard' ? 'is-active' : ''}`.trim()} data-tooltip="Dashboard" onClick={() => go('/dashboard/super-admin')}>
          <span className="super-admin-sidebar-icon" aria-hidden="true"><LayoutDashboard size={18} strokeWidth={2.2} /></span>
          <span>Dashboard</span>
        </button>
      </div>

      <div className="super-admin-sidebar-section">
        <div className={`super-admin-sidebar-branch-nav ${isFlyoutDismissed ? 'is-flyout-dismissed' : ''}`.trim()} onMouseLeave={() => setIsFlyoutDismissed(false)}>
          <div className={`super-admin-sidebar-item ${!isNotifications && activeSection === 'branches' ? 'is-active' : ''}`.trim()} data-tooltip="Branch Management">
            <button type="button" className="super-admin-sidebar-branch-link" onClick={() => { if (activeSection !== 'branches') go('/dashboard/super-admin?section=branches'); else setIsBranchExpanded((current) => !current) }}>
              <span className="super-admin-sidebar-icon" aria-hidden="true"><Shield size={18} strokeWidth={2.2} /></span>
              <span>Branch Management</span>
            </button>
            <button type="button" className="super-admin-sidebar-branch-toggle" aria-label={`${isBranchExpanded ? 'Collapse' : 'Expand'} branch management`} aria-expanded={isBranchExpanded} onClick={() => setIsBranchExpanded((current) => !current)}>
              <ChevronDown size={16} strokeWidth={2.3} className={isBranchExpanded ? 'is-expanded' : ''} aria-hidden="true" />
            </button>
          </div>
          {(isBranchExpanded || isSidebarCollapsed) ? <div className="super-admin-sidebar-branch-list" aria-label="Active branches">
            <div className="super-admin-sidebar-branch-list-title">Branch Management</div>
            {activeBranches.map((branch) => <button key={branch.id || branch.branchId} type="button" className="super-admin-sidebar-branch-name" onClick={() => openBranch(branch)}><span className="super-admin-sidebar-branch-dot" aria-hidden="true" /><span>{branch.branchName || branch.branchId || 'Active branch'}</span></button>)}
            {!activeBranches.length ? <span className="super-admin-sidebar-branch-empty">No active branches</span> : null}
          </div> : null}
        </div>
      </div>

      <div className="super-admin-sidebar-section super-admin-sidebar-section-user-role">
        <div className={`super-admin-sidebar-collapsed-group ${isFlyoutDismissed ? 'is-flyout-dismissed' : ''}`.trim()} onMouseEnter={() => setIsFlyoutDismissed(false)} onMouseLeave={() => setIsFlyoutDismissed(true)}>
          <button type="button" className="super-admin-sidebar-collapsed-group-trigger" data-tooltip="User & Role Management" aria-label="User & Role Management"><Users size={18} strokeWidth={2.2} aria-hidden="true" /></button>
          <div className="super-admin-sidebar-collapsed-group-flyout">
            <div className="super-admin-sidebar-collapsed-group-title">User &amp; Role Management</div>
            <button type="button" className="super-admin-sidebar-subitem" onClick={() => go('/dashboard/super-admin?section=branch-admin')}><span className="super-admin-sidebar-subitem-icon"><Shield size={15} /></span><span>Branch Admin</span></button>
            <button type="button" className="super-admin-sidebar-subitem" onClick={() => go('/dashboard/super-admin?section=faculty')}><span className="super-admin-sidebar-subitem-icon"><UserRound size={15} /></span><span>Faculty Management</span></button>
          </div>
        </div>
        <button type="button" className={`super-admin-sidebar-section-toggle ${!isNotifications && ['branch-admin', 'faculty'].includes(activeSection) ? 'is-active' : ''}`.trim()} aria-expanded={isUserRoleExpanded} onClick={() => setIsUserRoleExpanded((current) => !current)}>
          <span className="super-admin-sidebar-section-toggle-label"><Users size={16} strokeWidth={2.2} aria-hidden="true" /><span>User &amp; Role Management</span></span>
          <ChevronDown size={15} strokeWidth={2.4} className={isUserRoleExpanded ? 'is-expanded' : ''} aria-hidden="true" />
        </button>
        {(isUserRoleExpanded || isSidebarCollapsed) ? <>
          <button type="button" className={`super-admin-sidebar-item ${!isNotifications && activeSection === 'branch-admin' ? 'is-active' : ''}`.trim()} data-tooltip="Branch Admin" onClick={() => go('/dashboard/super-admin?section=branch-admin')}><span className="super-admin-sidebar-icon" aria-hidden="true"><Shield size={18} strokeWidth={2.2} /></span><span>Branch Admin</span></button>
          <button type="button" className={`super-admin-sidebar-item ${!isNotifications && activeSection === 'faculty' ? 'is-active' : ''}`.trim()} data-tooltip="Faculty Management" onClick={() => go('/dashboard/super-admin?section=faculty')}><span className="super-admin-sidebar-icon" aria-hidden="true"><UserRound size={18} strokeWidth={2.2} /></span><span>Faculty Management</span></button>
        </> : null}
      </div>

      <div className="super-admin-sidebar-section super-admin-sidebar-section-academic">
        <div className={`super-admin-sidebar-collapsed-group ${isFlyoutDismissed ? 'is-flyout-dismissed' : ''}`.trim()} onMouseEnter={() => setIsFlyoutDismissed(false)} onMouseLeave={() => setIsFlyoutDismissed(true)}>
          <button type="button" className="super-admin-sidebar-collapsed-group-trigger" data-tooltip="Academic Operations" aria-label="Academic Operations"><LayoutGrid size={18} strokeWidth={2.2} aria-hidden="true" /></button>
          <div className="super-admin-sidebar-collapsed-group-flyout">
            <div className="super-admin-sidebar-collapsed-group-title">Academic Operations</div>
            <button type="button" className="super-admin-sidebar-subitem" onClick={() => go('/dashboard/super-admin?section=students')}><span className="super-admin-sidebar-subitem-icon"><Users size={15} /></span><span>Student Management</span></button>
            <button type="button" className="super-admin-sidebar-subitem super-admin-sidebar-collapsed-group-nested-toggle" aria-expanded={isLeaveExpanded} onClick={() => setIsLeaveExpanded((current) => !current)}><span className="super-admin-sidebar-subitem-icon"><CalendarDays size={15} /></span><span>Leave Management</span><ChevronDown size={14} className={isLeaveExpanded ? 'is-expanded' : ''} /></button>
            {isLeaveExpanded ? <div className="super-admin-sidebar-collapsed-group-nested-items"><button type="button" className="super-admin-sidebar-branch-name" onClick={() => go('/dashboard/super-admin?section=faculty-leave')}><span className="super-admin-sidebar-branch-dot" /><span>Faculty Leave Request</span></button></div> : null}
          </div>
        </div>
        <button type="button" className={`super-admin-sidebar-section-toggle ${!isNotifications && ['students', 'faculty-leave'].includes(activeSection) ? 'is-active' : ''}`.trim()} aria-expanded={isAcademicExpanded} onClick={() => setIsAcademicExpanded((current) => !current)}>
          <span className="super-admin-sidebar-section-toggle-label"><LayoutGrid size={16} strokeWidth={2.2} aria-hidden="true" /><span>Academic Operations</span></span>
          <ChevronDown size={15} strokeWidth={2.4} className={isAcademicExpanded ? 'is-expanded' : ''} aria-hidden="true" />
        </button>
        {(isAcademicExpanded || isSidebarCollapsed) ? <>
          <button type="button" className={`super-admin-sidebar-item ${!isNotifications && activeSection === 'students' ? 'is-active' : ''}`.trim()} data-tooltip="Student Management" onClick={() => go('/dashboard/super-admin?section=students')}><span className="super-admin-sidebar-icon" aria-hidden="true"><Users size={18} strokeWidth={2.2} /></span><span>Student Management</span></button>
          <div className={`super-admin-sidebar-branch-nav ${isFlyoutDismissed ? 'is-flyout-dismissed' : ''}`.trim()} onMouseLeave={() => setIsFlyoutDismissed(false)}>
            <div className={`super-admin-sidebar-item ${!isNotifications && activeSection === 'faculty-leave' ? 'is-active' : ''}`.trim()} data-tooltip="Leave Management">
              <button type="button" className="super-admin-sidebar-branch-link" onClick={() => setIsLeaveExpanded((current) => !current)}><span className="super-admin-sidebar-icon" aria-hidden="true"><CalendarDays size={18} strokeWidth={2.2} /></span><span>Leave Management</span></button>
              <button type="button" className="super-admin-sidebar-branch-toggle" aria-label="Toggle leave management" aria-expanded={isLeaveExpanded} onClick={() => setIsLeaveExpanded((current) => !current)}><ChevronDown size={16} strokeWidth={2.3} className={isLeaveExpanded ? 'is-expanded' : ''} aria-hidden="true" /></button>
            </div>
            {isLeaveExpanded || isSidebarCollapsed ? <div className="super-admin-sidebar-branch-list" aria-label="Leave management"><div className="super-admin-sidebar-branch-list-title">Leave Management</div><button type="button" className="super-admin-sidebar-branch-name" onClick={() => go('/dashboard/super-admin?section=faculty-leave')}><span className="super-admin-sidebar-branch-dot" /><span>Faculty Leave Request</span></button></div> : null}
          </div>
        </> : null}
      </div>

      <div className="super-admin-sidebar-section">
        <button type="button" className={`super-admin-sidebar-item ${isNotifications ? 'is-active' : ''}`.trim()} data-tooltip="Notifications" onClick={() => go('/dashboard/super-admin/notifications')}><span className="super-admin-sidebar-icon" aria-hidden="true"><Bell size={18} strokeWidth={2.2} /></span><span>Notifications</span></button>
      </div>
    </nav>
  )
}
