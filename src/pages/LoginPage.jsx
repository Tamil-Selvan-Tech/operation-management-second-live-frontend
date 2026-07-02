import { useState } from 'react'

import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FormField } from '../components/FormField'

function LoginShieldIcon() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <path
        d="M48 9l26 8.5c4 1.3 6.7 5.1 6.7 9.3v20.4c0 19.1-11.6 29.5-32.7 39.1C27.9 76.2 16.3 65.8 16.3 46.7V26.8c0-4.2 2.7-8 6.7-9.3L48 9z"
        fill="#ffffff"
        stroke="#0078d4"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="48" cy="39" r="10" fill="#0078d4" />
      <path
        d="M30 67.5c4.4-9.2 11-13.7 18-13.7s13.6 4.5 18 13.7"
        fill="none"
        stroke="#0078d4"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  )
}

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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 10V8a5 5 0 0 1 10 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="4"
        y="10"
        width="16"
        height="10"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M12 14v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon({ hidden = false }) {
  if (hidden) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M3 3l18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M6.2 6.6A10.9 10.9 0 0 0 1.9 12c2.1 4.4 6.2 7.2 10.1 7.2 1.5 0 2.9-.3 4.2-.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.4 9.4A3 3 0 0 1 14.6 14.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function LoginPage({ form, setForm, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <Card className="auth-card login-shell">
      <aside className="login-hero">
        <div className="login-brand">
          <div className="login-brand-mark">
            <span>
              <LoginShieldIcon />
            </span>
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
          <div className="art-screen">
            <span />
            <span />
            <span />
          </div>
          <div className="art-book" />
          <div className="art-card" />
        </div>
      </aside>

      <section className="login-panel">
        <div className="login-panel-top">
          <div className="login-shield" aria-hidden="true">
            <LoginShieldIcon />
          </div>
          <h2>Welcome Back!</h2>
          <p>Sign in to continue to your account</p>
        </div>

        <form className="form login-form" onSubmit={onSubmit}>
          <FormField label="Email">
            <div className="field-with-icon">
              <span className="field-icon" aria-hidden="true">
                <EmailIcon />
              </span>
              <input
                className="login-input login-input-icon"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                type="email"
                placeholder="Enter your email or employee ID"
              />
            </div>
          </FormField>

          <FormField label="Password">
            <div className="field-with-icon">
              <span className="field-icon" aria-hidden="true">
                <LockIcon />
              </span>
              <input
                className="login-input login-input-icon login-input-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon hidden={!showPassword} />
              </button>
            </div>
          </FormField>

        <div className="login-meta">
  <label className="remember-me">
    <input
      type="checkbox"
      defaultChecked
      style={{
        width: "14px",
        height: "14px",
        cursor: "pointer",
      }}
    />
    <span>Remember me</span>
  </label>

  <a href="/forgot-password" className="text-link">
    Forgot Password?
  </a>
</div>

          <Button type="submit" className="login-primary">
            Login
          </Button>
        </form>
      </section>
    </Card>
  )
}
