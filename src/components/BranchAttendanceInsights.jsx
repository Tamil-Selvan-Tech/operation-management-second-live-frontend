import { useMemo } from 'react'
import { Check, X, History, Users, Minus } from 'lucide-react'
import { buildAttendanceInsights } from '../lib/branchAttendanceInsights'
import { attendancePercentage } from '../lib/branchAttendanceSummary'

function normalizeAttendanceInsightsData(data) {
  const source = data?.data && typeof data.data === 'object' ? data.data : (data || {})
  const sourceBatches = Array.isArray(source.batches) ? source.batches : []
  const batchStudents = sourceBatches.flatMap((batch) => (
    (Array.isArray(batch?.students) ? batch.students : []).map((student) => ({
      ...student,
      batchId: student?.batchId || batch?.batchId || batch?.id || '',
      batchName: student?.batchName || batch?.batchName || '',
    }))
  ))
  const sourceStudents = Array.isArray(source.students) ? source.students : []
  const students = [...sourceStudents, ...batchStudents]
    .reduce((unique, student) => {
      const id = String(student?.id || student?.studentId || student?.studentCode || '').trim()
      if (!id) return unique
      const existingIndex = unique.findIndex((item) => String(item?.id || item?.studentId || item?.studentCode || '').trim() === id)
      if (existingIndex === -1) {
        unique.push(student)
      } else {
        unique[existingIndex] = {
          ...unique[existingIndex],
          ...student,
          records: [...(unique[existingIndex].records || []), ...(student.records || [])],
        }
      }
      return unique
    }, [])
    .map((student) => {
      const status = String(student?.attendanceStatus || student?.status || '').trim().toUpperCase()
      const records = Array.isArray(student?.records) ? [...student.records] : []
      const date = String(source.date || source.attendanceDate || '').trim()
      if (date && ['PRESENT', 'ABSENT'].includes(status) && !records.some((record) => record?.attendanceDate === date)) {
        records.push({ attendanceDate: date, status, batchId: student?.batchId || '', courseId: student?.courseId || '' })
      }
      return { ...student, id: student?.id || student?.studentId || student?.studentCode, records }
    })

  return { ...source, students }
}

export function BranchAttendanceInsights({ data }) {
  const info = useMemo(() => buildAttendanceInsights(normalizeAttendanceInsightsData(data)), [data])
  const segments = [
    { key: 'present', label: 'Present', color: '#0db369', students: info.present },
    { key: 'absent', label: 'Absent', color: '#1686f8', students: info.absent },
    { key: 'unmarked', label: 'Not marked', color: '#cbd5e1', students: info.unmarked },
  ]
  const rows = [
    { key: 'present', label: 'Today Present', Icon: Check, students: info.present },
    { key: 'absent', label: 'Today Absent', Icon: X, students: info.absent },
    { key: 'unmarked', label: 'Today Not Marked', Icon: Minus, students: info.unmarked },
    { key: 'yesterday', label: 'Yesterday Absent', Icon: History, students: info.yesterdayAbsent },
  ]
  return <aside className="attendance-insights" aria-label="Today's attendance and absence details">
    <h3>Today's Attendance</h3>
    <div className="attendance-donut-layout">
      <svg className="attendance-insights-donut" viewBox="0 0 200 200" role="img" aria-label={`Today: ${info.total} students, ${info.present.length} present, ${info.absent.length} absent, ${info.unmarked.length} not marked`}>
        <circle cx="100" cy="100" r="76" fill="none" stroke="#edf1f6" strokeWidth="30" />
        {segments.map((segment, index) => {
          const share = info.total ? segment.students.length / info.total * 100 : 0
          const offset = info.total ? segments.slice(0, index).reduce((sum, item) => sum + item.students.length, 0) / info.total * 100 : 0
          return share ? <circle key={segment.key} cx="100" cy="100" r="76" fill="none" stroke={segment.color} strokeWidth="30" pathLength="100" strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-offset} transform="rotate(-90 100 100)"><title>{segment.label}: {segment.students.length} ({attendancePercentage({ present: segment.students.length, marked: info.total })})</title></circle> : null
        })}
        <text x="100" y="81" textAnchor="middle">Today</text><text className="attendance-donut-total" x="100" y="107" textAnchor="middle">{info.total}</text><text x="100" y="129" textAnchor="middle">Total Students</text>
      </svg>
      <div className="attendance-donut-legend">{segments.map((segment) => <div key={segment.key}><span><i style={{ background: segment.color }} />{segment.label}</span><b>{segment.students.length}</b><small>{attendancePercentage({ present: segment.students.length, marked: info.total })}</small></div>)}</div>
    </div>
    <div className="attendance-insight-rows">{rows.map(({ key, label, Icon, students }) => <details key={key} className={`attendance-insight-row tone-${key}`}><summary><span className="attendance-insight-icon"><Icon size={16} /></span><span>{label}</span><b>{students.length}{['present', 'absent', 'unmarked'].includes(key) ? <small>{attendancePercentage({ present: students.length, marked: info.total })}</small> : null}</b></summary><div className="attendance-insight-detail">{key === 'yesterday' ? <small>{info.yesterday}</small> : null}{students.length ? <ul>{students.map((student) => <li key={student.id}><span>{student.studentName}<small>{student.studentId} · {student.batchName || 'Unassigned'}</small></span></li>)}</ul> : <p>{key === 'unmarked' ? 'No unmarked students.' : 'No recorded students in this category.'}</p>}</div></details>)}
      <div className="attendance-insight-row tone-long"><div className="attendance-long-heading"><span className="attendance-insight-icon"><Users size={16} /></span><span>Long Absent</span><b>{info.longAbsent.length}</b></div><div className="attendance-insight-detail"><small>{info.threshold}+ consecutive batch attendance days</small>{info.longAbsent.length ? <ul>{info.longAbsent.map((student) => <li key={student.id}><span>{student.studentName}<small>{student.studentId} · {student.batchName || 'Unassigned'}</small><small>Last marked: {student.lastMarkedDate}</small></span><b>{student.streak} days</b></li>)}</ul> : <p>No students match this rule.</p>}</div></div>
    </div>
  </aside>
}
