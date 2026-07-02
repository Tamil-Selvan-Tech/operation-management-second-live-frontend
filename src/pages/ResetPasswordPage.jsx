import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FormField } from '../components/FormField'

export function ResetPasswordPage({ onSubmit }) {
  return (
    <Card className="auth-panel">
      <p className="eyebrow">Security</p>
      <h2>Reset password</h2>
      <p>This screen is ready for token-based reset flow integration.</p>
      <form className="form compact" onSubmit={onSubmit}>
        <FormField label="New password">
          <input type="password" placeholder="Create a new password" />
        </FormField>
        <FormField label="Confirm password">
          <input type="password" placeholder="Confirm password" />
        </FormField>
        <Button type="submit">Update password</Button>
        <a href="/login" className="text-link">
          Back to login
        </a>
      </form>
    </Card>
  )
}
