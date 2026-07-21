import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FormField } from '../components/FormField'
import '../styles/LoginPage.css'

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m4.5 8.5 7.5 5 7.5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ForgotPasswordPage({ onSubmit, errorMessage = '', successMessage = '', isSubmitting = false }) {
  return (
    <Card className="auth-card login-shell login-page forgot-page">
      <section className="login-form-panel forgot-form-panel">
        <div className="forgot-topbar">
          <img className="forgot-brand-logo" src="/logo1.JPG" alt="CISPRO logo" />
          <div className="forgot-brand-copy">
            {/* <strong>CISPRO</strong>
            <p>Operation Management System</p> */}
          </div>
        </div>

        <div className="login-copy forgot-copy">
          <p className="forgot-kicker">Recovery</p>
          <h2>Forgot password</h2>
          <p>
            Enter your registered email address and we&apos;ll send you a link to reset your
            password.
          </p>
        </div>

        <form className="form login-form forgot-form" onSubmit={onSubmit}>
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

          <FormField label="Email">
            <div className="field-with-icon">
              <span className="field-icon" aria-hidden="true">
                <EmailIcon />
              </span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                className="login-input"
                placeholder="name@company.com"
                disabled={isSubmitting}
              />
            </div>
          </FormField>

          <Button type="submit" className="login-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </Button>

          <a href="/login" className="text-link forgot-back-link">
            Back to login
          </a>
        </form>
      </section>

      <aside className="login-visual-panel forgot-visual-panel" aria-hidden="true">
        <img className="login-visual-image forgot-visual-image" src="/image copy 2.png" alt="" />
      </aside>
    </Card>
  )
}
