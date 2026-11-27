export function positionCollapsedSidebarOverlays(event, isCollapsed) {
  if (!isCollapsed || typeof window === 'undefined') return

  const tooltipTarget = event.target?.closest?.('[data-tooltip]')
  if (tooltipTarget) {
    const bounds = tooltipTarget.getBoundingClientRect()
    tooltipTarget.style.setProperty('--sidebar-tooltip-top', `${bounds.top + bounds.height / 2}px`)
    tooltipTarget.style.setProperty('--sidebar-tooltip-left', `${bounds.right + 12}px`)
  }

  const group = event.target?.closest?.('.super-admin-sidebar-item-group')
  const submenu = group?.querySelector(':scope > .super-admin-sidebar-submenu')
  const flyoutGroup = event.target?.closest?.('.super-admin-sidebar-collapsed-group')
  const collapsedFlyout = flyoutGroup?.querySelector(':scope > .super-admin-sidebar-collapsed-group-flyout')
  const branchNav = event.target?.closest?.('.super-admin-sidebar-branch-nav')
  const branchFlyout = branchNav?.querySelector(':scope > .super-admin-sidebar-branch-list')
  const flyout = submenu || collapsedFlyout || branchFlyout
  const anchor = group || flyoutGroup || branchNav
  if (!flyout || !anchor) return

  const bounds = anchor.getBoundingClientRect()
  const height = flyout.scrollHeight || flyout.offsetHeight || 220
  const top = Math.max(8, Math.min(window.innerHeight - height - 8, bounds.top - 4))
  flyout.style.position = 'fixed'
  flyout.style.left = `${bounds.right + 8}px`
  flyout.style.top = `${top}px`
  flyout.style.right = 'auto'
  flyout.style.bottom = 'auto'
}
