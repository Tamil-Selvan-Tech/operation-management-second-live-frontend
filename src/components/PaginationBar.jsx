import { ChevronLeft, ChevronRight } from 'lucide-react'

function buildPageList(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = [1]
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) pages.push('left-ellipsis')
  for (let page = start; page <= end; page += 1) pages.push(page)
  if (end < totalPages - 1) pages.push('right-ellipsis')
  pages.push(totalPages)
  return pages
}

export function PaginationBar({ currentPage, totalPages, pageList: pageListProp, onPageChange, className = '', label = 'Pagination' }) {
  const safeTotalPages = Math.max(1, Number(totalPages) || 1)
  const safeCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), safeTotalPages)
  const pageList = Array.isArray(pageListProp) && pageListProp.length ? pageListProp : buildPageList(safeTotalPages, safeCurrentPage)

  if (safeTotalPages <= 1) return null

  return (
    <div className={`pagination-bar ${className}`.trim()} aria-label={label}>
      <button
        type="button"
        className="pagination-bar-button"
        onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
        disabled={safeCurrentPage <= 1}
      >
        <ChevronLeft size={18} />
        <span>Back</span>
      </button>

      <div className="pagination-bar-pages">
        {pageList.map((page, index) =>
          typeof page === 'number' ? (
            <button
              key={page}
              type="button"
              className={`pagination-bar-page ${safeCurrentPage === page ? 'active' : ''}`.trim()}
              aria-current={safeCurrentPage === page ? 'page' : undefined}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ) : (
            <span key={`${page}-${index}`} className="pagination-bar-dots">
              ...
            </span>
          ),
        )}
      </div>

      <button
        type="button"
        className="pagination-bar-button"
        onClick={() => onPageChange(Math.min(safeTotalPages, safeCurrentPage + 1))}
        disabled={safeCurrentPage >= safeTotalPages}
      >
        <span>Next</span>
        <ChevronRight size={18} />
      </button>

      <div className="pagination-bar-summary" aria-hidden="true">
        {safeCurrentPage} of {safeTotalPages}
      </div>
    </div>
  )
}
