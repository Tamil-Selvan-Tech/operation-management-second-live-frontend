export function AppBreadcrumbs({ crumbs }) {
  return (
    <div className="breadcrumbs flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-500">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb}-${index}`} className="min-w-0 [overflow-wrap:anywhere]">
          {index > 0 ? <span className="breadcrumb-separator mx-1 text-slate-300">/</span> : null}
          {crumb}
        </span>
      ))}
    </div>
  )
}
