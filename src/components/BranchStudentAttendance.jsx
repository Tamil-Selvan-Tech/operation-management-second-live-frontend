import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { BranchAttendanceChart } from './BranchAttendanceChart'
import { BranchAttendanceInsights } from './BranchAttendanceInsights'
import { getBranchAttendanceOverview } from '../services/attendanceService'
import { FACULTY_ATTENDANCE_SYNC_EVENT } from '../lib/facultyAttendanceStore'
import { attendanceToday } from '../lib/branchAttendanceSummary'
import '../styles/BranchStudentAttendance.css'

export function BranchStudentAttendance({ branchId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const lastLoadedAtRef = useRef(0)
  useEffect(() => {
    if (!branchId) {
      setLoading(false)
      setData(null)
      setError('Branch context is not available yet.')
      return undefined
    }
    let active = true
    let pending = false
    async function load(force = false) {
      if (pending) return
      if (!force && lastLoadedAtRef.current && Date.now() - lastLoadedAtRef.current < 30000) return
      pending = true
      setLoading(true)
      try {
        const result = await getBranchAttendanceOverview(attendanceToday(), branchId)
        if (String(result.branchId) !== String(branchId)) throw new Error('Attendance branch does not match the current dashboard.')
        lastLoadedAtRef.current = Date.now()
        if (active) { setData(result); setError('') }
      } catch (err) {
        if (active) { setData(null); setError(err.message || 'Unable to load attendance. Please retry.') }
      } finally {
        pending = false
        if (active) setLoading(false)
      }
    }
    load(true)
    const reload = (force = false) => { if (document.visibilityState === 'visible') load(force) }
    const timer = window.setInterval(reload, 60000)
    const reloadOnFocus = () => reload(false)
    window.addEventListener('focus', reloadOnFocus)
    const forceReload = () => reload(true)
    window.addEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, forceReload)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', reloadOnFocus)
      window.removeEventListener(FACULTY_ATTENDANCE_SYNC_EVENT, forceReload)
    }
  }, [branchId])
  const hasData = data && data.date === attendanceToday() && String(data.branchId) === String(branchId)
  return <section className="branch-attendance" aria-label="Branch student attendance" aria-busy={loading}>
    <div className="branch-attendance-heading"><div className="attendance-title"><span className="attendance-title-icon"><CalendarDays size={22} /></span><div><h2>Attendance</h2></div></div></div>
    {error ? <p role="alert" className="branch-attendance-error">{error}</p> : null}
    {!hasData && !error ? <p role="status">Loading attendance from the server…</p> : null}
    {hasData ? <div className="attendance-dashboard-layout"><BranchAttendanceChart data={data} /><BranchAttendanceInsights data={data} /></div> : null}
  </section>
}
