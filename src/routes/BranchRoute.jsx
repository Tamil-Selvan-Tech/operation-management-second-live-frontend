import { Navigate, Outlet } from 'react-router-dom'
import { loadBranchSession } from '../lib/branchAuth'

export function BranchProtectedRoute() {
  const session = loadBranchSession()

  if (!session) {
    return <Navigate to="/branch-login" replace />
  }

  return <Outlet />
}

export function BranchPublicRoute() {
  const session = loadBranchSession()

  if (session) {
    return <Navigate to="/branch-dashboard" replace />
  }

  return <Outlet />
}
