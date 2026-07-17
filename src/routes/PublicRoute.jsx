import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function PublicRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const pathname = location.pathname || ''

  const allowsAuthenticatedAccess =
    pathname === '/forgot-password' || pathname === '/reset-password'

  if (isAuthenticated && !allowsAuthenticatedAccess) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
