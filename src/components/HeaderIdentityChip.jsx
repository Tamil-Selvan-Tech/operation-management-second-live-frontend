export function HeaderIdentityChip({
  initials,
  title,
  email,
  className = '',
  onClick,
  ariaLabel,
  ...restProps
}) {
  const Component = onClick ? 'button' : 'div'
  const interactiveProps = onClick
    ? {
        type: 'button',
        onClick,
        'aria-label': ariaLabel,
      }
    : {}

  return (
    <Component
      className={`profile-chip ${onClick ? 'profile-chip-button' : ''} ${className}`.trim()}
      {...interactiveProps}
      {...restProps}
    >
      <div className="profile-avatar">{initials}</div>
      <div>
        <strong>{title}</strong>
        <span className="profile-chip-email">{email}</span>
      </div>
    </Component>
  )
}
