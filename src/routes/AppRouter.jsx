import { useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../layouts/AuthShell'
import { AppShell } from '../layouts/AppShell'
import { useAuth } from '../auth/useAuth'
import { courseAccessRoles, roleDashboards, roleLabels, dashboardPathByRole } from '../data/authData'
import { DashboardPage } from '../pages/DashboardPage'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { LoadingPage } from '../pages/LoadingPage'
import { CoursesPage } from '../pages/CoursesPage'
import { StudentManagementPage } from '../pages/StudentManagementPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { SessionExpiredPage } from '../pages/SessionExpiredPage'
import { UnauthorizedPage } from '../pages/UnauthorizedPage'
import { ProtectedRoute, RoleDashboardRedirect } from './ProtectedRoute'
import { PublicRoute } from './PublicRoute'

function LoginScreen() {
  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const updateForm = (updater) => {
    setErrorMessage('')
    setForm(updater)
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const target = await signIn(form)
      navigate(target)
    } catch (error) {
      const status = error?.status
      const message =
        status === 400 || status === 401 || status === 403 || status === 422
          ? 'Invalid Email or Password'
          : typeof error?.message === 'string' && /invalid/i.test(error.message)
            ? 'Invalid Email or Password'
            : error?.message || 'Unable to sign in right now. Please try again.'

      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <LoginPage
      form={form}
      setForm={updateForm}
      onSubmit={onSubmit}
      errorMessage={errorMessage}
      isSubmitting={isSubmitting}
    />
  )
}

function AuthLayout() {
  return (
    <AuthShell>
      <Outlet />
    </AuthShell>
  )
}

function AppLayout() {
  const { role, user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const dashboard = role ? roleDashboards[role] : null
  const roleLabel = role ? roleLabels[role] : 'Guest'
  const canAccessCourses = courseAccessRoles.includes(role)
  const canAccessStudentManagement = courseAccessRoles.includes(role)
  const showChrome =
    location.pathname !== '/dashboard/business-owner' &&
    location.pathname !== '/dashboard/operation-manager'

  return (
    <AppShell
      currentRole={role}
      email={user?.email}
      roleLabel={roleLabel}
      dashboard={dashboard}
      onNavigateDashboard={() => navigate(dashboardPathByRole[role])}
      onNavigateCourses={() => navigate('/courses')}
      onNavigateStudentManagement={() => navigate('/student-management')}
      onLogout={() => {
        signOut()
        navigate('/login')
      }}
      showCoursesNav={canAccessCourses}
      showStudentManagementNav={canAccessStudentManagement}
      showChrome={showChrome}
    >
      <Outlet />
    </AppShell>
  )
}

function LoginResetRoute({ title }) {
  const navigate = useNavigate()
  const returnToLogin = async (event) => {
    event.preventDefault()
    navigate('/login')
  }

  if (title === 'forgot') {
    return <ForgotPasswordPage onSubmit={returnToLogin} />
  }

  return <ResetPasswordPage onSubmit={returnToLogin} />
}

function RootRoute() {
  const { isReady, isAuthenticated, role } = useAuth()

  if (!isReady) {
    return <LoadingPage />
  }

  if (isAuthenticated) {
    return <Navigate to={dashboardPathByRole[role] || '/dashboard'} replace />
  }

  return <Navigate to="/login" replace />
}

function StatusRoute({ kind }) {
  const navigate = useNavigate()

  if (kind === 'unauthorized') {
    return <UnauthorizedPage onGoLogin={() => navigate('/login')} />
  }

  if (kind === 'session-expired') {
    return <SessionExpiredPage onGoLogin={() => navigate('/login')} />
  }

  return null
}

function NotFoundRoute() {
  const navigate = useNavigate()
  const { role } = useAuth()

  return (
    <NotFoundPage
      onGoLogin={() => navigate('/login')}
      onGoDashboard={() => navigate(dashboardPathByRole[role] || '/login')}
    />
  )
}

function ProfileRedirectRoute() {
  const { role } = useAuth()

  return <Navigate to={dashboardPathByRole[role] || '/dashboard'} replace />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route element={<PublicRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/forgot-password" element={<LoginResetRoute title="forgot" />} />
            <Route path="/reset-password" element={<LoginResetRoute title="reset" />} />
          </Route>
        </Route>

        <Route path="/unauthorized" element={<StatusRoute kind="unauthorized" />} />
        <Route path="/session-expired" element={<StatusRoute kind="session-expired" />} />

        <Route element={<ProtectedRoute allowedRoles={['business-owner', 'operation-manager', 'hr', 'faculty', 'student']} />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<RoleDashboardRedirect />} />
            <Route path="/dashboard/business-owner" element={<DashboardPage role="business-owner" />} />
            <Route path="/dashboard/operation-manager" element={<DashboardPage role="operation-manager" />} />
            <Route path="/dashboard/hr" element={<DashboardPage role="hr" />} />
            <Route path="/dashboard/faculty" element={<DashboardPage role="faculty" />} />
            <Route path="/dashboard/student" element={<DashboardPage role="student" />} />
            <Route element={<ProtectedRoute allowedRoles={courseAccessRoles} />}>
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/student-management" element={<StudentManagementPage />} />
            </Route>
            <Route path="/profile" element={<ProfileRedirectRoute />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundRoute />} />
      </Routes>
    </BrowserRouter>
  )
}
