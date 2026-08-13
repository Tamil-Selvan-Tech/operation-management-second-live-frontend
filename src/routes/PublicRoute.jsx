import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { dashboardPathByRole } from '../data/authData'

export function PublicRoute() {
  const { isAuthenticated, role } = useAuth()
  const location = useLocation()
  const pathname = location.pathname || ''

  const allowsAuthenticatedAccess =
    pathname === '/forgot-password' || pathname === '/reset-password'

  if (isAuthenticated && !allowsAuthenticatedAccess) {
    return <Navigate to={dashboardPathByRole[role] || '/dashboard'} replace />
  }

  return <Outlet />
}
