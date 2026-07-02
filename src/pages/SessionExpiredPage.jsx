export function SessionExpiredPage({ onGoLogin }) {
  return (
    <section className="panel panel-center">
      <p className="eyebrow">Session expired</p>
      <h2>Please sign in again</h2>
      <p>Your mock session has ended and needs a fresh login.</p>
      <button type="button" onClick={onGoLogin}>
        Return to login
      </button>
    </section>
  )
}
