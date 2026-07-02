export function FormField({ label, hint, children }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}
