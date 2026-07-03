import { useState } from 'react'

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

function LoginHeroArt() {
  return (
    <svg className="login-hero-image" viewBox="0 0 900 380" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="heroGlow" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="screenFill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f9fbff" />
          <stop offset="100%" stopColor="#dfeafb" />
        </linearGradient>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#04244e" floodOpacity="0.22" />
        </filter>
      </defs>

      <circle cx="146" cy="314" r="122" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="2" />
      <circle cx="112" cy="301" r="178" fill="none" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="2" />
      <circle cx="698" cy="74" r="150" fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />

      <rect x="18" y="235" width="132" height="98" rx="18" transform="rotate(-11 18 235)" fill="#1f93f3" opacity="0.9" filter="url(#softShadow)" />
      <rect
        x="556"
        y="84"
        width="274"
        height="288"
        rx="28"
        transform="rotate(-15 556 84)"
        fill="#ffffff"
        fillOpacity="0.1"
        stroke="#ffffff"
        strokeOpacity="0.16"
      />
      <rect x="584" y="118" width="214" height="148" rx="22" transform="rotate(-15 584 118)" fill="url(#screenFill)" filter="url(#softShadow)" />
      <rect x="588" y="267" width="54" height="44" rx="14" transform="rotate(-15 588 267)" fill="#ffffff" opacity="0.82" />
      <rect x="744" y="278" width="126" height="78" rx="18" transform="rotate(14 744 278)" fill="#ffffff" filter="url(#softShadow)" />
      <rect x="64" y="70" width="172" height="108" rx="22" transform="rotate(-10 64 70)" fill="url(#heroGlow)" opacity="0.5" />
      <rect x="66" y="70" width="126" height="84" rx="18" fill="#ffffff" opacity="0.06" />
    </svg>
  )
}

export function LoginPage({ form, setForm, onSubmit, errorMessage, isSubmitting = false }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <Card className="auth-card login-shell">
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
          <h2 >Manage.</h2>
          <h2>Succeed.</h2>
          <p>
            A complete management solution for Business Owner, Operation Manager, HR, Faculty,
            and Students.
          </p>
        </div>

        <div className="login-hero-art" aria-hidden="true">
          <LoginHeroArt />
        </div>
      </aside>

      <section className="login-panel">
        <div className="login-panel-top">
          <div className="login-shield" aria-hidden="true">
            <img className="login-logo-image login-logo-image-small" src="/logo.png" alt="" />
          </div>
          <h2>Welcome Back!</h2>
          <p>Log in to continue to your account</p>
        </div>

        <form className="form login-form" onSubmit={onSubmit}>
          <FormField label="Email ">
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
                type="text"
                autoComplete="username"
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
                autoComplete="current-password"
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

          <div className="login-meta">
            <label className="remember-me">
              <input type="checkbox" defaultChecked />
              <span className="checkmark"></span>
              <span className="remember-text">Remember me</span>
            </label>

            <a href="/forgot-password" className="text-link">
              Forgot Password?
            </a>
          </div>

          <Button type="submit" className="login-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </section>
    </Card>
  )
}
