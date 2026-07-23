import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FormField } from '../components/FormField'
import { loadPendingLoginEmail, savePendingLoginEmail } from '../lib/session'
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

function SuccessMailIllustration() {
  return (
    <svg viewBox="0 0 420 300" className="forgot-success-illustration" aria-hidden="true">
      <defs>
        <linearGradient id="envelopeBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dfeeff" />
          <stop offset="100%" stopColor="#9fc0ff" />
        </linearGradient>
        <linearGradient id="paperBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f4f8ff" />
        </linearGradient>
      </defs>
      <circle cx="210" cy="150" r="82" fill="#eef5ff" />
      <circle cx="210" cy="150" r="58" fill="#ffffff" opacity="0.8" />
      <path d="M108 156c0-55 45-100 102-100 42 0 78 24 95 59" fill="none" stroke="#b7d0ff" strokeWidth="2.4" strokeDasharray="5 10" />
      <path d="M272 58 315 45 300 84" fill="#4c8fff" />
      <path d="M272 58 302 83" fill="none" stroke="#4c8fff" strokeWidth="7" strokeLinecap="round" />
      <g transform="translate(118 82)">
        <rect x="42" y="24" width="140" height="128" rx="18" fill="url(#paperBlue)" filter="drop-shadow(0 14px 24px rgba(54, 86, 166, 0.14))" />
        <path d="M52 72 112 112 172 72" fill="none" stroke="#a9c3ff" strokeWidth="3" />
        <path d="M52 72 112 24 172 72" fill="url(#envelopeBlue)" opacity="0.9" />
        <path d="M52 72 112 118 172 72" fill="none" stroke="#8eb0f7" strokeWidth="3" />
        <circle cx="112" cy="88" r="20" fill="#39c45b" />
        <path d="m103 88 6 7 13-14" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle cx="98" cy="132" r="4" fill="#4f8cff" />
      <circle cx="86" cy="164" r="3" fill="#4f8cff" />
      <circle cx="84" cy="190" r="2.5" fill="#63d1f4" />
      <circle cx="326" cy="160" r="4" fill="#ffc94d" />
      <circle cx="332" cy="194" r="4" fill="#63d1f4" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M14 6 8 12l6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(loadPendingLoginEmail())
  const [sentEmail, setSentEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = (event) => {
    event.preventDefault()
    setErrorMessage('')

    const nextEmail = email.trim().toLowerCase()

    if (!isValidEmail(nextEmail)) {
      setErrorMessage('Please enter a valid email address.')
      return
    }

    setIsSubmitting(true)
    savePendingLoginEmail(nextEmail)

    window.setTimeout(() => {
      setSentEmail(nextEmail)
      setIsSubmitting(false)
    }, 450)
  }

  return (
    <Card className="auth-card login-shell login-page forgot-page">
      <section className={`login-form-panel forgot-form-panel ${sentEmail ? 'forgot-success-panel' : ''}`}>
        <div className="forgot-topbar">
          <img className="forgot-brand-logo" src="/logo1.JPG" alt="CISPRO logo" />
          <div className="forgot-brand-copy" />
        </div>

        {sentEmail ? (
          <div className="forgot-success-layout" role="status" aria-live="polite">
            <div className="forgot-success-illustration-wrap">
              <SuccessMailIllustration />
            </div>

            <div className="login-copy forgot-copy forgot-success-copy">
              <p className="forgot-kicker">Recovery</p>
              <h2>Check Your Email</h2>
              <p>A password reset link has been sent to the email address below.</p>
            </div>

            <div className="forgot-success-chip">{sentEmail}</div>

            <Button type="button" className="forgot-success-button" onClick={() => navigate('/login')}>
              <span className="forgot-success-button-icon" aria-hidden="true">
                <ArrowLeftIcon />
              </span>
              <span>Back to Login</span>
            </Button>
          </div>
        ) : (
          <>
            <div className="login-copy forgot-copy">
              <p className="forgot-kicker">Recovery</p>
              <h2>Forgot password</h2>
              <p>Enter your  email address and we&apos;ll send you a link to reset your password.</p>
            </div>

            <form className="form login-form forgot-form" onSubmit={onSubmit}>
              {errorMessage ? (
                <div className="form-message form-message-error" role="alert">
                  {errorMessage}
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
                    placeholder="hema@gmail.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </FormField>

              <Button type="submit" className="login-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <Link to="/login" className="text-link forgot-back-link">
                Back to Login
              </Link>
            </form>
          </>
        )}
      </section>

      {sentEmail ? (
        <aside className="login-visual-panel forgot-visual-panel forgot-success-visual-panel" aria-hidden="true">
          <img className="login-visual-image forgot-visual-image forgot-success-visual-image" src="/cispro.png" alt="" />
        </aside>
      ) : (
        <aside className="login-visual-panel forgot-visual-panel" aria-hidden="true">
          <img className="login-visual-image forgot-visual-image" src="/cispro.png" alt="" />
        </aside>
      )}
    </Card>
  )
}
