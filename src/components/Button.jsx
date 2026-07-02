export function Button({ variant = 'solid', className = '', ...props }) {
  const classes = ['button', variant === 'ghost' ? 'button-ghost' : 'button-solid', className]
    .filter(Boolean)
    .join(' ')

  return <button className={classes} {...props} />
}
