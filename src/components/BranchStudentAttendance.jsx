import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { BranchAttendanceChart } from './BranchAttendanceChart'
import { getBranchAttendanceOverview } from '../services/attendanceService'
import { FACULTY_ATTENDANCE_SYNC_EVENT } from '../lib/facultyAttendanceStore'
import { attendanceToday } from '../lib/branchAttendanceSummary'
import '../styles/BranchStudentAttendance.css'

export function BranchStudentAttendance({ branchId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!branchId) return undefined
    let active = true
    let pending = false
    async function load() {
      if (pending) return
      pending = true
      setLoading(true)
      try {
        const result = await getBranchAttendanceOverview(attendanceToday())
        if (String(result.branchId) !== String(branchId)) throw new Error('Attendance branch does not match the current dashboard.')
        if (active) { setData(result); setError('') }
      } catch (err) {
        if (active) { setData(null); setError(err.message || 'Unable to load attendance. Please retry.') }
      } finally {
        pending = false
        if (active) setLoading(false)
      }
    }
    load()
    const reload = () => { if (document.visibilityState === 'visible') load() }
    const timer = window.setInterval(reload, 60000)
    window.addEventListener('focus', reload)
    window.addEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, reload)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', reload)
      window.removeEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, reload)
    }
  }, [branchId])
  const hasData = data && data.date === attendanceToday() && String(data.branchId) === String(branchId)
  return <section className="branch-attendance" aria-label="Branch student attendance" aria-busy={loading}>
    <div className="branch-attendance-heading"><div className="attendance-title"><span className="attendance-title-icon"><CalendarDays size={22} /></span><div><h2>Attendance</h2></div></div></div>
    {error ? <p role="alert" className="branch-attendance-error">{error}</p> : null}
    {!hasData && !error ? <p role="status">Loading attendance from the server…</p> : null}
    {hasData ? <BranchAttendanceChart data={data} /> : null}
  </section>
}
