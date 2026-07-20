import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FormField } from '../components/FormField'

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
    <Card className="auth-card login-shell forgot-shell">
      <aside className="login-hero">
        <div className="login-brand">
          <div className="login-brand-mark">
            <img className="login-logo-image" src="/logo.png" alt="CISPRO logo" />
          </div>
          <div>
            <strong>CISPRO</strong>
            <p>Operation Management System</p>
          </div>
        </div>

        <div className="login-hero-copy">
          <p className="hero-rule" />
          <h2>Streamline.</h2>
          <h2 className="accent">Manage.</h2>
          <h2>Succeed.</h2>
          <p>
            A complete management solution for Business Owner, Operation Manager, HR, Faculty,
            and Students.
          </p>
        </div>

        <div className="login-hero-art" aria-hidden="true">
          <img className="login-hero-image" src="/image copy 2.png" alt="" />
        </div>
      </aside>

      <section className="login-panel forgot-panel">
        <div className="forgot-panel-top">
          {/* <div className="login-shield" aria-hidden="true">
            <img className="login-logo-image login-logo-image-small" src="/logo.png" alt="" />
          </div> */}
          <p className="eyebrow">Recovery</p>
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
    </Card>
  )
}
