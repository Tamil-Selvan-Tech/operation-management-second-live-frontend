export function LoadingPage() {
  return (
    <section className="panel panel-center">
      <div className="spinner" aria-hidden="true" />
      <h2>Loading workspace</h2>
      <p>Checking saved session and preparing route guards.</p>
    </section>
  )
}
