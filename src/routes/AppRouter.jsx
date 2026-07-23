import { lazy, Suspense, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { courseAccessRoles, roleDashboards, dashboardPathByRole } from '../data/authData'
import { LoadingPage } from '../pages/LoadingPage'
import { ProtectedRoute, RoleDashboardRedirect } from './ProtectedRoute'
import { PublicRoute } from './PublicRoute'
import {
  clearPendingLoginEmail,
  loadPendingLoginEmail,
} from '../lib/session'

const lazyNamed = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })))

const AuthShell = lazyNamed(() => import('../layouts/AuthShell'), 'AuthShell')
const AppShell = lazyNamed(() => import('../layouts/AppShell'), 'AppShell')
const DashboardPage = lazyNamed(() => import('../pages/DashboardPage'), 'DashboardPage')
const ForgotPasswordPage = lazyNamed(() => import('../pages/ForgotPasswordPage'), 'ForgotPasswordPage')
const LoginPage = lazyNamed(() => import('../pages/LoginPage'), 'LoginPage')
const NotFoundPage = lazyNamed(() => import('../pages/NotFoundPage'), 'NotFoundPage')
const CoursesPage = lazyNamed(() => import('../pages/CoursesPage'), 'CoursesPage')
const FacultyDetailsPage = lazyNamed(() => import('../pages/FacultyDetailsPage'), 'FacultyDetailsPage')
const FacultyManagementPage = lazyNamed(
  () => import('../pages/FacultyManagementPage'),
  'FacultyManagementPage',
)
const FacultyCourseCatalogPage = lazyNamed(
  () => import('../pages/FacultyCourseCatalogPage'),
  'FacultyCourseCatalogPage',
)
const FacultyCourseFacultyPage = lazyNamed(
  () => import('../pages/FacultyCourseFacultyPage'),
  'FacultyCourseFacultyPage',
)
const BatchStudentsPage = lazyNamed(() => import('../pages/BatchStudentsPage'), 'BatchStudentsPage')
const CourseBatchesPage = lazyNamed(() => import('../pages/CourseBatchesPage'), 'CourseBatchesPage')
const StudentManagementPage = lazyNamed(
  () => import('../pages/StudentManagementPage'),
  'StudentManagementPage',
)
const NotificationsPage = lazyNamed(() => import('../pages/NotificationsPage'), 'NotificationsPage')
const ResetPasswordPage = lazyNamed(() => import('../pages/ResetPasswordPage'), 'ResetPasswordPage')
const SessionExpiredPage = lazyNamed(() => import('../pages/SessionExpiredPage'), 'SessionExpiredPage')
const UnauthorizedPage = lazyNamed(() => import('../pages/UnauthorizedPage'), 'UnauthorizedPage')
const FacultyMyBatchesPage = lazyNamed(
  () => import('../pages/FacultyDashboardPage'),
  'FacultyMyBatchesPage',
)

const workspacePathsByRole = {
  'business-owner': {
    courses: '/courses',
    studentManagement: '/student-management',
    facultyManagement: '/faculty-management',
  },
  'operation-manager': {
    courses: '/dashboard/operation-manager/courses',
    studentManagement: '/dashboard/operation-manager/student-management',
    facultyManagement: '/dashboard/operation-manager/faculty-management',
  },
}

function LoginScreen() {
  const [form, setForm] = useState({
    email: loadPendingLoginEmail(),
    password: '',
    rememberMe: false,
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const updateForm = (updater) => {
    setErrorMessage('')
    setFieldErrors({ email: '', password: '' })
    setForm(updater)
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setFieldErrors({ email: '', password: '' })

    const nextFieldErrors = {
      email: form.email.trim() ? '' : 'Email is required',
      password: form.password.trim() ? '' : 'Password is required',
    }

    if (nextFieldErrors.email || nextFieldErrors.password) {
      setFieldErrors(nextFieldErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const target = await signIn(form)
      clearPendingLoginEmail()
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
      fieldErrors={fieldErrors}
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
  const { role, signOut, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const dashboard = role ? roleDashboards[role] : null
  const workspacePaths = workspacePathsByRole[role] || workspacePathsByRole['business-owner']
  const canAccessCourses = courseAccessRoles.includes(role)
  const canAccessFacultyBatches = role === 'faculty'
  const canAccessStudentManagement = courseAccessRoles.includes(role)
  const canAccessFacultyManagement = courseAccessRoles.includes(role)
  const showChrome =
    location.pathname !== '/dashboard/business-owner' &&
    location.pathname !== '/dashboard/operation-manager' &&
    location.pathname !== '/dashboard/operation-manager/courses' &&
    location.pathname !== '/dashboard/operation-manager/student-management' &&
    location.pathname !== '/dashboard/operation-manager/faculty-management' &&
    location.pathname !== '/dashboard/faculty' &&
    location.pathname !== '/dashboard/faculty/my-batches' &&
    location.pathname !== '/dashboard/student' &&
    location.pathname !== '/notifications' &&
    location.pathname !== '/courses' &&
    location.pathname !== '/student-management' &&
    location.pathname !== '/faculty-management' &&
    !location.pathname.startsWith('/faculty-management/')
  const isFlatMainArea = location.pathname === '/dashboard/student'

  return (
    <AppShell
      dashboard={dashboard}
      user={user}
      onNavigateDashboard={() => navigate(dashboardPathByRole[role])}
      onNavigateFacultyBatches={() => navigate('/dashboard/faculty/my-batches')}
      onNavigateCourses={() => navigate(workspacePaths.courses)}
      onNavigateStudentManagement={() => navigate(workspacePaths.studentManagement)}
      onNavigateFacultyManagement={() => navigate(workspacePaths.facultyManagement)}
      onNavigateNotifications={() => navigate('/notifications')}
      onLogout={async () => {
        await signOut()
        navigate('/login')
      }}
      showCoursesNav={canAccessCourses}
      showFacultyBatchesNav={canAccessFacultyBatches}
      showStudentManagementNav={canAccessStudentManagement}
      showFacultyManagementNav={canAccessFacultyManagement}
      showChrome={showChrome}
      forceFlatMainArea={isFlatMainArea}
    >
      <Outlet />
    </AppShell>
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
      <Suspense fallback={<LoadingPage />}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/loading" element={<LoadingPage />} />
          <Route element={<PublicRoute />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>
          </Route>

          <Route path="/unauthorized" element={<StatusRoute kind="unauthorized" />} />
          <Route path="/session-expired" element={<StatusRoute kind="session-expired" />} />

          <Route
            element={
              <ProtectedRoute
                allowedRoles={['business-owner', 'operation-manager', 'hr', 'faculty', 'student']}
              />
            }
          >
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<RoleDashboardRedirect />} />
              <Route path="/dashboard/business-owner" element={<DashboardPage role="business-owner" />} />
              <Route path="/dashboard/operation-manager" element={<DashboardPage role="operation-manager" />} />
              <Route path="/dashboard/operation-manager/courses" element={<CoursesPage />} />
              <Route
                path="/dashboard/operation-manager/student-management"
                element={<StudentManagementPage />}
              />
              <Route
                path="/dashboard/operation-manager/faculty-management"
                element={<FacultyManagementPage />}
              />
              <Route path="/dashboard/hr" element={<DashboardPage role="hr" />} />
              <Route path="/dashboard/faculty" element={<DashboardPage role="faculty" />} />
              <Route path="/dashboard/faculty/my-batches" element={<FacultyMyBatchesPage />} />
              <Route path="/dashboard/student" element={<DashboardPage role="student" />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route element={<ProtectedRoute allowedRoles={courseAccessRoles} />}>
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/student-management" element={<StudentManagementPage />} />
                <Route path="/faculty-management" element={<FacultyManagementPage />} />
                <Route path="/faculty-management/courses" element={<FacultyCourseCatalogPage />} />
                <Route
                  path="/faculty-management/course/:courseId"
                  element={<FacultyCourseFacultyPage />}
                />
                <Route
                  path="/faculty-management/course/:courseId/faculty/:facultyId/batches"
                  element={<CourseBatchesPage />}
                />
                <Route
                  path="/faculty-management/course/:courseId/faculty/:facultyId/batches/:batchId"
                  element={<BatchStudentsPage />}
                />
                <Route path="/faculty-management/:facultyId" element={<FacultyDetailsPage />} />
                <Route
                  path="/faculty-management/:facultyId/courses/:courseId"
                  element={<CourseBatchesPage />}
                />
                <Route
                  path="/faculty-management/:facultyId/courses/:courseId/batches/:batchId"
                  element={<BatchStudentsPage />}
                />
              </Route>
              <Route path="/profile" element={<ProfileRedirectRoute />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
