export function NotFoundPage({ onGoLogin, onGoDashboard }) {
  return (
    <section className="panel panel-center">
      <p className="eyebrow">404</p>
      <h2>Page not found</h2>
      <p>The route you opened does not exist in this frontend scaffold.</p>
      <div className="button-row">
        {onGoDashboard ? (
          <button type="button" onClick={onGoDashboard}>
            Go to dashboard
          </button>
        ) : null}
        <button type="button" onClick={onGoLogin}>
          Back to login
        </button>
      </div>
    </section>
  )
}
