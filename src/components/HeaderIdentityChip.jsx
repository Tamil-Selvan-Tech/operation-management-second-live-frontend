export function HeaderIdentityChip({ initials, title, email, className = '' }) {
  return (
    <div className={`profile-chip ${className}`.trim()}>
      <div className="profile-avatar">{initials}</div>
      <div>
        <strong>{title}</strong>
        <span className="profile-chip-email">{email}</span>
      </div>
    </div>
  )
}
