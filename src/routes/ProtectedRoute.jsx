import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { dashboardPathByRole } from '../data/authData'

export function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, role, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user?.mustResetPassword) {
    return <Navigate to="/reset-password?firstLogin=1" replace />
  }
  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}

export function RoleDashboardRedirect() {
  const { role } = useAuth()

  return <Navigate to={dashboardPathByRole[role] || '/login'} replace />
}
