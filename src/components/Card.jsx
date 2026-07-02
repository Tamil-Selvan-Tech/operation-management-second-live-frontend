export function Card({ className = '', children, ...props }) {
  const classes = ['panel', className].filter(Boolean).join(' ')

  return (
    <section className={classes} {...props}>
      {children}
    </section>
  )
}
