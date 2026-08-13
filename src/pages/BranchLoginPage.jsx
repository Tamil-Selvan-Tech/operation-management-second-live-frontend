import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FormField } from '../components/FormField'
import '../styles/BranchAuthPage.css'

export function BranchLoginPage() {
  const navigate = useNavigate()
  const { signIn, isAuthenticated, role } = useAuth()
  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form, setForm] = useState({
    email: '',
    password: '',
  })

  useEffect(() => {
    if (isAuthenticated && role === 'branch-admin') {
      navigate('/branch-dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate, role])

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

    const timerOne = window.setTimeout(syncAutofill, 150)
    const timerTwo = window.setTimeout(syncAutofill, 500)

    return () => {
      window.clearTimeout(timerOne)
      window.clearTimeout(timerTwo)
    }
  }, [form.email, form.password])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    const email = form.email.trim().toLowerCase()
    const password = form.password.trim()

    if (!email || !password) {
      setErrorMessage('Email and temporary password are required.')
      return
    }

    setIsSubmitting(true)

    try {
      const target = await signIn({
        email,
        password,
      })
      navigate(target, { replace: true })
    } catch (error) {
      setErrorMessage(error?.message || 'Invalid email or temporary password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="panel branch-auth-shell">
      <section className="branch-auth-form-panel">
        <div className="branch-auth-topbar">
          <div className="branch-auth-brand-pill">
            <img className="branch-auth-brand-logo" src="/logo1.JPG" alt="CISPRO logo" />
          </div>
        </div>

        <div className="branch-auth-copy">
          <p className="branch-auth-eyebrow">Branch Login</p>
          <h1>Welcome to your branch dashboard</h1>
          <p>Use the invitation email credentials to sign in to your branch dashboard.</p>
        </div>

        <form className="branch-auth-form" onSubmit={handleSubmit}>
          <FormField label="Email">
            <div className="branch-auth-input-wrap">
              <span className="branch-auth-icon" aria-hidden="true">
                <Mail size={18} />
              </span>
              <input
                ref={emailInputRef}
                className="branch-auth-input"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Registered email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
          </FormField>

          <FormField label="Temporary Password">
            <div className="branch-auth-input-wrap branch-auth-password-wrap">
              <span className="branch-auth-icon" aria-hidden="true">
                <KeyRound size={18} />
              </span>
              <input
                ref={passwordInputRef}
                className="branch-auth-input"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="Temporary password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />
              <button
                type="button"
                className="branch-auth-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </FormField>

          {errorMessage ? (
            <p className="branch-auth-error" role="alert" aria-live="polite">
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" className="branch-auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Login'}
          </Button>
        </form>
      </section>

      <aside className="branch-auth-visual-panel" aria-hidden="true">
        <div className="branch-auth-visual-card">
          <img className="branch-auth-visual-image" src="/cispro.png" alt="" />
          <div className="branch-auth-visual-copy">
            <strong>Invitation based access</strong>
            <span>Use your branch invitation credentials to continue</span>
          </div>
        </div>
      </aside>
    </Card>
  )
}
