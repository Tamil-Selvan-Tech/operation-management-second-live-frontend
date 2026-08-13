import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FormField } from '../components/FormField'
import { findBranchByEmail, updateBranchRecordByEmail } from '../lib/branchAuth'
import { clearPendingLoginEmail, savePendingLoginEmail } from '../lib/session'
import { changePassword, resetPassword } from '../services/apiClient'
import '../styles/LoginPage.css'

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3.5 19 6.6v5.2c0 4.4-2.9 8.4-7 9.9-4.1-1.5-7-5.5-7-9.9V6.6L12 3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m9.5 12.1 1.8 1.8 3.9-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="m12 4 9 16H3L12 4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 9.2v4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.5" r="1.1" fill="currentColor" />
    </svg>
  )
}

function SuccessIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m8.5 12.4 2.4 2.5 4.9-5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const isExpiredStatus = (searchParams, token) => {
  const status = String(searchParams.get('status') || '').trim().toLowerCase()
  const expired = String(searchParams.get('expired') || '').trim() === '1'
  return !token || status === 'expired' || status === 'invalid' || expired
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, role, session, setSession } = useAuth()
  const token = String(searchParams.get('token') || '').trim()
  const isBranchResetParam = String(searchParams.get('branchReset') || '').trim() === '1'
  const authenticatedBranchEmail = String(session?.user?.email || '').trim().toLowerCase()
  const registryBranch = findBranchByEmail(authenticatedBranchEmail)
  const isBranchResetFlow = Boolean(
    (isBranchResetParam ||
      (isAuthenticated && role === 'branch-admin')) &&
      (session?.user?.mustResetPassword || registryBranch?.mustResetPassword),
  )
  const redirectTo =
    String(searchParams.get('redirect') || '').trim() ||
    (isBranchResetFlow ? '/login' : '/login')
  const expired = useMemo(
    () => isExpiredStatus(searchParams, token) && !isBranchResetFlow,
    [searchParams, token, isBranchResetFlow],
  )
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdated, setIsUpdated] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)

  const goToLogin = () => navigate(redirectTo)
  const requestNewLink = () => navigate('/forgot-password')

  const onSubmit = (event) => {
    event.preventDefault()

    if (expired) {
      setErrorMessage('This reset link has already expired. Please request a new link.')
      return
    }

    setErrorMessage('')

    const nextPassword = password.trim()
    const nextConfirmPassword = confirmPassword.trim()

    if (!nextPassword || !nextConfirmPassword) {
      setErrorMessage('Both password fields are required.')
      return
    }

    if (nextPassword !== nextConfirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    if (isBranchResetFlow) {
      setIsSubmitting(true)

      changePassword(nextPassword)
        .then(() => {
          if (authenticatedBranchEmail) {
            updateBranchRecordByEmail(authenticatedBranchEmail, (branch) => ({
              ...branch,
              mustResetPassword: false,
              tempPassword: '',
            }))
            savePendingLoginEmail(authenticatedBranchEmail)
          } else {
            clearPendingLoginEmail()
          }
          setSession(null)
          setPassword('')
          setConfirmPassword('')
          navigate('/login', { replace: true })
        })
        .catch((error) => {
          const message =
            error?.body?.message ||
            error?.message ||
            'Unable to update password right now. Please try again.'
          setErrorMessage(message)
        })
        .finally(() => {
          setIsSubmitting(false)
        })
      return
    }

    clearPendingLoginEmail()
    setIsSubmitting(true)

    resetPassword({ token, password: nextPassword })
      .then(() => {
        setIsUpdated(true)
        setPassword('')
        setConfirmPassword('')
      })
      .catch((error) => {
        const message =
          error?.body?.message ||
          error?.message ||
          'Unable to update password right now. Please try again.'
        setErrorMessage(message)
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }

  if (expired) {
    return (
      <Card className="panel reset-password-shell reset-password-state">
        <div className="reset-password-badge reset-password-badge-warn" aria-hidden="true">
          <WarningIcon />
        </div>
        <p className="eyebrow">Password reset</p>
        <h2>Reset Link Expired</h2>
        <p>Your password reset link has expired.</p>
        <div className="reset-password-actions">
          <Button type="button" onClick={requestNewLink}>
            Request New Link
          </Button>
          <Link to={redirectTo} className="button button-ghost reset-password-link">
            Back to Login
          </Link>
        </div>
      </Card>
    )
  }

  if (isUpdated) {
    return (
      <Card className="panel reset-password-shell reset-password-state">
        <div className="reset-password-badge reset-password-badge-success" aria-hidden="true">
          <SuccessIcon />
        </div>
        <p className="eyebrow">Security</p>
        <h2>Password Updated Successfully</h2>
        <p>Your password has been changed successfully.</p>
        <div className="reset-password-actions">
          <Button type="button" onClick={goToLogin}>
            Go to Login
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="panel reset-password-shell">
      <div className="reset-password-header">
        <div className="reset-password-badge" aria-hidden="true">
          <ShieldIcon />
        </div>
        <div className="reset-password-copy">
          <p className="eyebrow">Security</p>
          <h2>Reset password</h2>
          <p>
            {isBranchResetFlow
              ? 'You are still using your temporary password. Create a new password now to continue using your branch dashboard safely.'
              : 'Create a new password below and use it the next time you sign in.'}
          </p>
        </div>
      </div>

      <form className="form compact reset-password-form" onSubmit={onSubmit} autoComplete="off">
        <input type="hidden" name="token" value={token} />

        {errorMessage ? (
          <div className="form-message form-message-error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <FormField label="New password" hint="Minimum 8 characters">
          <div className="reset-password-input-wrap">
            <input
              name="newPassword"
              type={isPasswordVisible ? 'text' : 'password'}
              placeholder="Enter new password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="reset-password-visibility-toggle"
              onClick={() => setIsPasswordVisible((current) => !current)}
              aria-label={isPasswordVisible ? 'Hide new password' : 'Show new password'}
              disabled={isSubmitting}
            >
              {isPasswordVisible ? <Eye size={20} strokeWidth={2.1} /> : <EyeOff size={20} strokeWidth={2.1} />}
            </button>
          </div>
        </FormField>

        <FormField label="Confirm password" hint="Type the same password again">
          <div className="reset-password-input-wrap">
            <input
              name="confirmNewPassword"
              type={isConfirmPasswordVisible ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="reset-password-visibility-toggle"
              onClick={() => setIsConfirmPasswordVisible((current) => !current)}
              aria-label={isConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'}
              disabled={isSubmitting}
            >
              {isConfirmPasswordVisible ? <Eye size={20} strokeWidth={2.1} /> : <EyeOff size={20} strokeWidth={2.1} />}
            </button>
          </div>
        </FormField>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Updating...' : 'Update Password'}
        </Button>

        <Link to={redirectTo} className="text-link reset-password-back-link">
          Back to Login
        </Link>
      </form>
    </Card>
  )
}
