import { useEffect, useRef, useState } from 'react'

import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FormField } from '../components/FormField'
import "../styles/LoginPage.css";

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

export function LoginPage({ form, setForm, onSubmit, errorMessage, isSubmitting = false }) {
  const [showPassword, setShowPassword] = useState(false)
  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)

  useEffect(() => {
    const syncAutofill = () => {
      const nextEmail = String(emailInputRef.current?.value || '').trim()
      const nextPassword = String(passwordInputRef.current?.value || '')

      if (nextEmail && !form.email) {
        setForm((current) => ({ ...current, email: nextEmail }))
      }

      if (nextPassword && !form.password) {
        setForm((current) => ({ ...current, password: nextPassword }))
      }
    }

    const timeoutId = window.setTimeout(syncAutofill, 150)
    const secondTimeoutId = window.setTimeout(syncAutofill, 500)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearTimeout(secondTimeoutId)
    }
  }, [form.email, form.password, setForm])

  return (
    <Card className="auth-card login-shell login-page">
      <section className="login-form-panel">
        <div className="login-topbar">
          <div className="login-brand-pill">
            <img className="login-brand-icon" src="/logo.png" alt="CISPRO logo" />
          </div>
        </div>

        <div className="login-copy">
          <h2>Welcome back</h2>
          <p>Sign in to continue to your operation dashboard.</p>
        </div>

        <form className="form login-form" onSubmit={onSubmit}>
          <FormField label="Email">
            <div className="field-with-icon">
              <span className="field-icon" aria-hidden="true">
                <EmailIcon />
              </span>
              <input
                ref={emailInputRef}
                className="login-input login-input-icon"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                name="email"
                placeholder="Enter your email"
              />
            </div>
          </FormField>

          <FormField label="Password">
            <div className="field-with-icon">
              <span className="field-icon" aria-hidden="true">
                <LockIcon />
              </span>
              <input
                ref={passwordInputRef}
                className="login-input login-input-icon login-input-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                name="password"
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
            {errorMessage ? (
              <small className="login-error" role="alert" aria-live="polite">
                {errorMessage}
              </small>
            ) : null}
          </FormField>

          <div className="login-footer-links">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={Boolean(form.rememberMe)}
                onChange={(event) =>
                  setForm((current) => ({ ...current, rememberMe: event.target.checked }))
                }
              />
              <span>Remember me</span>
            </label>

            <a href="/forgot-password" className="text-link">
              Forgot password?
            </a>
          </div>

          <Button type="submit" className="login-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </section>

      <aside className="login-visual-panel" aria-hidden="true">
        <img className="login-visual-image" src="/image copy 2.png" alt="" />
      </aside>
    </Card>
  )
}
