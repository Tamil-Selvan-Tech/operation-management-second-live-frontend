import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Search, X } from 'lucide-react'
import { downloadBranchCourses } from '../services/courseImportService'
import './CourseExcelExport.css'

const PAGE_SIZE = 20
const courseCode = (course) => String(course?.courseCode || '').trim()

export function CourseExcelExport({ courses = [] }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('all')
  const [selected, setSelected] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !busy) setOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, busy])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return courses
    return courses.filter((course) => [courseCode(course), course.name, course.courseType].some((value) => String(value || '').toLocaleLowerCase().includes(query)))
  }, [courses, search])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedCourses = useMemo(() => courses.filter((course) => selected.has(String(course.id))), [courses, selected])
  const exportCourses = mode === 'all' ? courses : selectedCourses
  const selectedVisibleCount = visible.filter((course) => selected.has(String(course.id))).length

  function toggleCourse(id) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleVisible() {
    const everyVisibleSelected = visible.length > 0 && visible.every((course) => selected.has(String(course.id)))
    setSelected((current) => {
      const next = new Set(current)
      visible.forEach((course) => everyVisibleSelected ? next.delete(String(course.id)) : next.add(String(course.id)))
      return next
    })
  }

  function openDialog() {
    setMode('all')
    setSelected(new Set())
    setSearch('')
    setPage(1)
    setError('')
    setOpen(true)
  }

  async function startDownload() {
    if (busy || !exportCourses.length) return
    if (mode === 'selected' && !selectedCourses.length) {
      setError('Select at least one course to download.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await downloadBranchCourses(mode === 'all' ? null : selectedCourses.map((course) => String(course.id)))
      setOpen(false)
    } catch (failure) {
      setError(failure?.message || 'Could not download the course workbook. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button type="button" className="course-export-trigger" onClick={openDialog} disabled={busy}>
      <Download size={16} aria-hidden="true" /> Download Courses
    </button>
    {open ? createPortal(
      <div className="course-export-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false) }}>
        <section className="course-export-dialog" role="dialog" aria-modal="true" aria-labelledby="course-export-title" aria-busy={busy}>
          <header className="course-export-header">
            <span className="course-export-icon"><FileSpreadsheet size={22} /></span>
            <div><p>COURSE MANAGEMENT</p><h2 id="course-export-title">Download course workbook</h2><span>Export courses in the same four-sheet format used for course uploads.</span></div>
            <button type="button" className="course-export-close" aria-label="Close" disabled={busy} onClick={() => setOpen(false)}><X size={20} /></button>
          </header>
          <div className="course-export-body">
            {error ? <div className="course-export-error" role="alert">{error}</div> : null}
            <div className="course-export-modes" role="radiogroup" aria-label="Courses to download">
              <button type="button" role="radio" aria-checked={mode === 'all'} className={mode === 'all' ? 'is-selected' : ''} onClick={() => { setMode('all'); setError('') }}>
                <span className="course-export-radio" /> <span><strong>All courses</strong><small>Download every course in this branch</small></span><b>{courses.length}</b>
              </button>
              <button type="button" role="radio" aria-checked={mode === 'selected'} className={mode === 'selected' ? 'is-selected' : ''} onClick={() => { setMode('selected'); setError('') }}>
                <span className="course-export-radio" /> <span><strong>Select courses</strong><small>Choose specific courses to include</small></span><b>{selected.size}</b>
              </button>
            </div>
            {mode === 'selected' ? <div className="course-export-picker">
              <label className="course-export-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search course name or ID" aria-label="Search courses" /></label>
              <div className="course-export-picker-head"><button type="button" onClick={toggleVisible} disabled={!visible.length}>{visible.length > 0 && selectedVisibleCount === visible.length ? 'Clear visible' : 'Select visible'}</button><span>{selected.size} selected · {filtered.length} matches</span></div>
              <div className="course-export-course-list">{visible.length ? visible.map((course) => {
                const id = String(course.id)
                const checked = selected.has(id)
                return <label key={id} className={checked ? 'is-checked' : ''}><input type="checkbox" checked={checked} onChange={() => toggleCourse(id)} /><span className="course-export-check">{checked ? <Check size={13} /> : null}</span><span className="course-export-course-copy"><strong>{course.name || 'Unnamed course'}</strong><small>{courseCode(course) || 'No course ID'}{course.courseType ? ` · ${course.courseType}` : ''}</small></span></label>
              }) : <p className="course-export-empty">{courses.length ? 'No courses match that search.' : 'There are no courses in this branch yet.'}</p>}</div>
              {pageCount > 1 ? <div className="course-export-pagination"><button type="button" aria-label="Previous course page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={17} /></button><span>Page {page} of {pageCount}</span><button type="button" aria-label="Next course page" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight size={17} /></button></div> : null}
            </div> : null}
            <div className="course-export-preview"><div><strong>Workbook preview</strong><span>{exportCourses.length} course{exportCourses.length === 1 ? '' : 's'} · Courses, Course Modules, Course Submodules, Payment Plans</span></div>{exportCourses.length ? <ul>{exportCourses.slice(0, 5).map((course) => <li key={course.id}><strong>{course.name}</strong><code>{courseCode(course)}</code></li>)}</ul> : <p>{courses.length ? 'Select a course to preview the export.' : 'There are no courses in this branch yet.'}</p>}{exportCourses.length > 5 ? <small>and {exportCourses.length - 5} more</small> : null}</div>
          </div>
          <footer className="course-export-footer"><span>Course data will be exported for this branch only.</span><div><button type="button" className="course-export-cancel" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button type="button" className="course-export-download" disabled={busy || !exportCourses.length} onClick={() => void startDownload()}>{busy ? <span className="course-export-spinner" /> : <Download size={16} />} {busy ? 'Preparing workbook…' : 'Download Excel'}</button></div></footer>
        </section>
      </div>, document.body,
    ) : null}
  </>
}