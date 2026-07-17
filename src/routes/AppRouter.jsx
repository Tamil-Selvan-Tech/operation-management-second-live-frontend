import { useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { AuthShell } from '../layouts/AuthShell'
import { AppShell } from '../layouts/AppShell'
import { useAuth } from '../auth/useAuth'
import { courseAccessRoles, roleDashboards, dashboardPathByRole } from '../data/authData'
import { DashboardPage } from '../pages/DashboardPage'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { LoadingPage } from '../pages/LoadingPage'
import { CoursesPage } from '../pages/CoursesPage'
import { FacultyDetailsPage } from '../pages/FacultyDetailsPage'
import { FacultyManagementPage } from '../pages/FacultyManagementPage'
import { BatchStudentsPage } from '../pages/BatchStudentsPage'
import { CourseBatchesPage } from '../pages/CourseBatchesPage'
import { StudentManagementPage } from '../pages/StudentManagementPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { SessionExpiredPage } from '../pages/SessionExpiredPage'
import { UnauthorizedPage } from '../pages/UnauthorizedPage'
import { requestPasswordReset, resetPassword } from '../services/apiClient'
import { ProtectedRoute, RoleDashboardRedirect } from './ProtectedRoute'
import { PublicRoute } from './PublicRoute'

function LoginScreen() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    rememberMe: false,
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
  const { role, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const dashboard = role ? roleDashboards[role] : null
  const canAccessCourses = courseAccessRoles.includes(role)
  const canAccessStudentManagement = courseAccessRoles.includes(role)
  const canAccessFacultyManagement = courseAccessRoles.includes(role)
  const showChrome =
    location.pathname !== '/dashboard/business-owner' &&
    location.pathname !== '/dashboard/operation-manager' &&
    location.pathname !== '/dashboard/student' &&
    location.pathname !== '/courses' &&
    location.pathname !== '/student-management' &&
    location.pathname !== '/faculty-management' &&
    !location.pathname.startsWith('/faculty-management/')

  return (
    <AppShell
      dashboard={dashboard}
      onNavigateDashboard={() => navigate(dashboardPathByRole[role])}
      onNavigateCourses={() => navigate('/courses')}
      onNavigateStudentManagement={() => navigate('/student-management')}
      onNavigateFacultyManagement={() => navigate('/faculty-management')}
      onLogout={async () => {
        await signOut()
        navigate('/login')
      }}
      showCoursesNav={canAccessCourses}
      showStudentManagementNav={canAccessStudentManagement}
      showFacultyManagementNav={canAccessFacultyManagement}
      showChrome={showChrome}
    >
      <Outlet />
    </AppShell>
  )
}

function LoginResetRoute({ title }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const token = searchParams.get('token') || ''
  const temporaryPassword = searchParams.get('temporaryPassword') || ''

  const returnToLogin = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setIsSubmitting(true)

    try {
      const formData = new FormData(event.currentTarget)

      if (title === 'forgot') {
        const email = String(formData.get('email') || '').trim()
        if (!email) {
          throw new Error('Email is required')
        }

        const result = await requestPasswordReset(email)
        setSuccessMessage(result?.message || 'Reset link sent successfully.')
        event.currentTarget.reset()
        return
      }

      const password = String(formData.get('password') || '')
      const confirmPassword = String(formData.get('confirmPassword') || '')
      const resetToken = String(formData.get('token') || token || '').trim()

      if (!resetToken) {
        throw new Error('Reset token is missing')
      }

      if (!password || !confirmPassword) {
        throw new Error('Both password fields are required')
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      const result = await resetPassword({ token: resetToken, password })
      setSuccessMessage(result?.message || 'Password updated successfully.')
      setTimeout(() => {
        navigate('/login')
      }, 800)
    } catch (error) {
      setErrorMessage(error?.body?.message || error?.message || 'Unable to process request right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (title === 'forgot') {
    return (
      <ForgotPasswordPage
        onSubmit={returnToLogin}
        errorMessage={errorMessage}
        successMessage={successMessage}
        isSubmitting={isSubmitting}
      />
    )
  }

  return (
    <ResetPasswordPage
      onSubmit={returnToLogin}
      errorMessage={errorMessage}
      successMessage={successMessage}
      isSubmitting={isSubmitting}
      token={token}
      temporaryPassword={temporaryPassword}
    />
  )
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
            <Route path="/faculty-management" element={<FacultyManagementPage />} />
            <Route path="/faculty-management/:facultyId" element={<FacultyDetailsPage />} />
            <Route path="/faculty-management/:facultyId/courses/:courseId" element={<CourseBatchesPage />} />
            <Route path="/faculty-management/:facultyId/courses/:courseId/batches/:batchId" element={<BatchStudentsPage />} />
          </Route>
            <Route path="/profile" element={<ProfileRedirectRoute />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundRoute />} />
      </Routes>
    </BrowserRouter>
  )
}
