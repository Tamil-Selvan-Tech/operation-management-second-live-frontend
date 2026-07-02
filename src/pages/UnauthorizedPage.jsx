export function UnauthorizedPage({ onGoLogin, onGoDashboard }) {
  return (
    <section className="panel panel-center">
      <p className="eyebrow">Access denied</p>
      <h2>Unauthorized</h2>
      <p>You do not have permission to open this view.</p>
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
