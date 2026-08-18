import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, GraduationCap, KeyRound, Mail } from 'lucide-react'

import { loadBranchStudents } from '../lib/branchStudentStore'
import '../styles/StudentLoginPage.css'

function validateStudentCredentials(email, password) {
  const allStudents = loadBranchStudents()
  const normalizedEmail = email.trim().toLowerCase()

  const student = allStudents.find(
    (s) => String(s.emailAddress || '').trim().toLowerCase() === normalizedEmail
  )

  if (!student) {
    return { success: false, error: 'Invalid email or password.' }
  }

  const storedPassword = String(student.loginPassword || '').trim()
  if (!storedPassword || storedPassword !== password.trim()) {
    return { success: false, error: 'Invalid email or password.' }
  }

  return { success: true, student }
}

export function StudentLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [form, setForm] = useState({
    email: searchParams.get('email') || '',
    password: '',
  })

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam && !form.email) {
      setForm((current) => ({ ...current, email: emailParam }))
    }
  }, [searchParams])

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

  const handleSubmit = (event) => {
    event.preventDefault()
    setErrorMessage('')

    const email = form.email.trim()
    const password = form.password.trim()

    if (!email || !password) {
      setErrorMessage('Email and password are required.')
      return
    }

    setIsSubmitting(true)

    // Small delay for UX feedback
    setTimeout(() => {
      const result = validateStudentCredentials(email, password)

      if (result.success) {
        // Store student session
        try {
          sessionStorage.setItem(
            'cispro.student-session',
            JSON.stringify({
              studentId: result.student.studentId,
              studentName: result.student.studentName,
              emailAddress: result.student.emailAddress,
              mobileNumber: result.student.mobileNumber,
              admissionDate: result.student.admissionDate,
              qualification: result.student.qualification,
              branchId: result.student.branchId,
              loggedInAt: new Date().toISOString(),
            })
          )
        } catch {
          // ignore storage errors
        }

        navigate('/student-new-dashboard', { replace: true })
      } else {
        setErrorMessage(result.error)
      }

      setIsSubmitting(false)
    }, 400)
  }

  return (
    <div className="student-login-page">
      <div className="student-login-container">
        {/* Left Panel - Form */}
        <section className="student-login-form-panel">
          <div className="student-login-topbar">
            <div className="student-login-brand-pill">
              <img className="student-login-brand-logo" src="/logo1.JPG" alt="CISPRO logo" />
            </div>
          </div>

          <div className="student-login-copy">
            <p className="student-login-eyebrow">Student Portal</p>
            <h1>Welcome, Student!</h1>
            <p>Sign in with your registered credentials to access your dashboard.</p>
          </div>

          <form className="student-login-form" onSubmit={handleSubmit}>
            <label className="student-login-field">
              <span>Email</span>
              <div className="student-login-input-wrap">
                <span className="student-login-icon" aria-hidden="true">
                  <Mail size={18} />
                </span>
                <input
                  ref={emailInputRef}
                  className="student-login-input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={form.email}
                  onChange={(e) => {
                    setErrorMessage('')
                    setForm((current) => ({ ...current, email: e.target.value }))
                  }}
                />
              </div>
            </label>

            <label className="student-login-field">
              <span>Password</span>
              <div className="student-login-input-wrap student-login-password-wrap">
                <span className="student-login-icon" aria-hidden="true">
                  <KeyRound size={18} />
                </span>
                <input
                  ref={passwordInputRef}
                  className="student-login-input"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => {
                    setErrorMessage('')
                    setForm((current) => ({ ...current, password: e.target.value }))
                  }}
                />
                <button
                  type="button"
                  className="student-login-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </label>

            {errorMessage ? (
              <p className="student-login-error" role="alert" aria-live="polite">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              className="student-login-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="student-login-footer-note">
            <p>Your login credentials were provided during registration.</p>
          </div>
        </section>

        {/* Right Panel - Visual */}
        <aside className="student-login-visual-panel" aria-hidden="true">
          <div className="student-login-visual-content">
            <div className="student-login-visual-icon">
              <GraduationCap size={64} strokeWidth={1.5} />
            </div>
            <h2>Student Dashboard</h2>
            <p>Access your courses, attendance, payments, and performance — all in one place.</p>
            <div className="student-login-visual-features">
              <div className="student-login-visual-feature">
                <span>📚</span>
                <span>Track Courses</span>
              </div>
              <div className="student-login-visual-feature">
                <span>📊</span>
                <span>View Attendance</span>
              </div>
              <div className="student-login-visual-feature">
                <span>💳</span>
                <span>Fee Payments</span>
              </div>
              <div className="student-login-visual-feature">
                <span>📝</span>
                <span>Test Results</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
