export function AppBreadcrumbs({ crumbs }) {
  return (
    <div className="breadcrumbs">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb}-${index}`}>
          {index > 0 ? <span className="breadcrumb-separator">/</span> : null}
          {crumb}
        </span>
      ))}
    </div>
  )
}
