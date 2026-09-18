import { useMemo } from 'react'
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
    { key: 'long-absent', label: 'Long Absent', color: '#ef646b', students: info.longAbsent },
    { key: 'yesterday-absent', label: 'Yesterday Absent', color: '#8b70f5', students: info.yesterdayAbsent },
  ]
  return <aside className="attendance-insights" aria-label="Today's attendance and absence details">
    <h3>Today's Attendance</h3>
    <div className="attendance-donut-layout">
      <div className="attendance-bar-chart" role="img" aria-label={`Attendance: ${info.present.length} present, ${info.absent.length} absent, ${info.unmarked.length} not marked, ${info.longAbsent.length} long absent, ${info.yesterdayAbsent.length} yesterday absent`}>
        {segments.map((segment) => (
          <div className="attendance-bar-column" key={segment.key}>
            <b className="attendance-bar-value">{segment.students.length}</b>
            <div className="attendance-bar-track"><span title={`${segment.label}: ${segment.students.length} (${attendancePercentage({ present: segment.students.length, marked: info.total })})`} style={{ height: `${info.total ? (segment.students.length / info.total) * 100 : 0}%`, background: segment.color }} /></div>
            <small>{segment.label === 'Not marked' ? 'Not Marked' : segment.label}</small>
          </div>
        ))}
      </div>
    </div>
  </aside>
}
