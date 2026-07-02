export function LoadingScreen() {
  return (
    <section className="panel panel-center">
      <div className="spinner" aria-hidden="true" />
      <h2>Loading workspace</h2>
      <p>Preparing the app shell and checking the active session.</p>
    </section>
  )
}
