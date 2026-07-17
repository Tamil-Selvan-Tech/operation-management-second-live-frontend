import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FormField } from '../components/FormField'

export function ResetPasswordPage({
  onSubmit,
  errorMessage = '',
  successMessage = '',
  isSubmitting = false,
  token = '',
  temporaryPassword = '',
}) {
  const visibleTemporaryPassword = temporaryPassword

  return (
    <Card className="auth-panel">
      <p className="eyebrow">Security</p>
      <h2>Reset password</h2>
      <p>Your reset link is already verified. Enter the temporary password and create a new password below.</p>
      <form className="form compact" onSubmit={onSubmit}>
        <input type="hidden" name="token" value={token} />

        {errorMessage ? (
          <div className="form-message form-message-error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="form-message form-message-success" role="status" aria-live="polite">
            {successMessage}
          </div>
        ) : null}

        <FormField label="Temporary password">
          <input
            name="temporaryPassword"
            type="text"
            value={visibleTemporaryPassword}
            readOnly
            disabled={isSubmitting}
            placeholder="Temporary password from email"
            aria-readonly="true"
          />
        </FormField>
        <FormField label="New password">
          <input name="password" type="password" placeholder="Create a new password" disabled={isSubmitting} />
        </FormField>
        <FormField label="Confirm password">
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm password"
            disabled={isSubmitting}
          />
        </FormField>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Updating...' : 'Update password'}
        </Button>
        <a href="/login" className="text-link">
          Back to login
        </a>
      </form>
    </Card>
  )
}
