import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { FormField } from '../components/FormField'

export function LoginPage({ form, setForm, onSubmit }) {
  return (
    <Card className="auth-card login-shell">
      <aside className="login-hero">
        <div className="login-brand">
          <div className="login-brand-mark">
            <span>C</span>
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
            <span />
          </div>
          <h2>Welcome Back!</h2>
          <p>Sign in to continue to your account</p>
        </div>

        <form className="form login-form" onSubmit={onSubmit}>
          <FormField label="Email / Employee ID">
            <input
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              type="email"
              placeholder="Enter your email or employee ID"
            />
          </FormField>

          <FormField label="Password">
            <input
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              type="password"
              placeholder="Enter your password"
            />
          </FormField>

          <div className="login-meta">
            <label className="remember-me">
              <input type="checkbox" defaultChecked />
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
