import '../styles/FacultyPageSkeleton.css'

export function FacultyCardsSkeleton({ count = 4 }) {
  return <div className="faculty-page-skeleton-cards" aria-hidden="true">{Array.from({ length: count }, (_, index) => <div className="faculty-page-skeleton-card" key={index}><i /><span /><strong /><small /></div>)}</div>
}

export function FacultyTableSkeleton({ columns = 7, rows = 6 }) {
  return <div className="faculty-page-skeleton-table" aria-label="Loading content" aria-busy="true"><div className="faculty-page-skeleton-table-head">{Array.from({ length: columns }, (_, index) => <span key={index} />)}</div>{Array.from({ length: rows }, (_, row) => <div className="faculty-page-skeleton-table-row" key={row}>{Array.from({ length: columns }, (_, column) => <span key={column} className={column === 0 ? 'is-short' : ''} />)}</div>)}</div>
}

export function FacultyCalendarSkeleton() {
  return <div className="faculty-page-skeleton-calendar" aria-label="Loading course calendar" aria-busy="true"><FacultyCardsSkeleton count={7} /><div className="faculty-page-skeleton-calendar-panel"><div className="faculty-page-skeleton-calendar-head"><span /><i /><i /></div><div className="faculty-page-skeleton-calendar-grid">{Array.from({ length: 35 }, (_, index) => <span key={index}><i /><b /></span>)}</div></div></div>
}

export function FacultyReportSkeleton() {
  return <div className="faculty-page-skeleton-report" aria-label="Loading report" aria-busy="true"><FacultyCardsSkeleton count={4} /><div className="faculty-page-skeleton-report-chart"><span /><span /><span /><span /><span /></div><FacultyTableSkeleton columns={7} rows={6} /></div>
}
