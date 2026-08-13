import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { dashboardPathByRole } from '../data/authData'

export function BranchProtectedRoute() {
  const { isAuthenticated, role, isReady } = useAuth()

  if (!isReady) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (role !== 'branch-admin') {
    return <Navigate to={dashboardPathByRole[role] || '/unauthorized'} replace />
  }

  return <Outlet />
}

export function BranchPublicRoute() {
  const { isAuthenticated, role, isReady } = useAuth()

  if (!isReady) {
    return null
  }

  if (isAuthenticated) {
    return <Navigate to={dashboardPathByRole[role] || '/branch-dashboard'} replace />
  }

  return <Outlet />
}
