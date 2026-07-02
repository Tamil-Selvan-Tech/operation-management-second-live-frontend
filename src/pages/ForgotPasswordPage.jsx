import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FormField } from '../components/FormField'

export function ForgotPasswordPage({ onSubmit }) {
  return (
    <Card className="auth-panel">
      <p className="eyebrow">Recovery</p>
      <h2>Forgot password</h2>
      <p>Front-end placeholder for the future password reset API.</p>
      <form className="form compact" onSubmit={onSubmit}>
        <FormField label="Email">
          <input type="email" placeholder="name@company.com" />
        </FormField>
        <Button type="submit">Send reset link</Button>
        <a href="/login" className="text-link">
          Back to login
        </a>
      </form>
    </Card>
  )
}
