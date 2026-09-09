import { useId, useMemo, useState } from 'react'
import { attendancePercentage, buildAttendanceChart } from '../lib/branchAttendanceSummary'

export function BranchAttendanceChart({ data }) {
  const [mode, setMode] = useState('daily')
  const chartId = useId()
  const buckets = useMemo(() => buildAttendanceChart(data, mode), [data, mode])
  const title = `${mode.charAt(0).toUpperCase()}${mode.slice(1)} Attendance`
  const width = 1100
  const left = 75
  const top = 20
  const height = 120
  const groupWidth = (width - left - 20) / buckets.length
  const barWidth = Math.min(48, groupWidth * .29)
  return <div className="attendance-visual">

    <div className="attendance-chart-card">
      <div className="attendance-chart-heading"><div><h3>{title}</h3><p>Present vs Absent · Based on all {data.students.length} branch students</p></div><div className="attendance-chart-actions"><div className="attendance-mode-tabs" role="group" aria-label="Attendance chart period">{['daily', 'weekly', 'monthly'].map((item) => <button key={item} type="button" aria-pressed={mode === item} className={mode === item ? 'is-active' : ''} onClick={() => setMode(item)}>{item.charAt(0).toUpperCase() + item.slice(1)}</button>)}</div><div className="attendance-chart-legend"><span><i />Present</span><span><i />Absent</span></div></div></div>
      <div className="attendance-chart-scroll"><svg viewBox={`0 0 ${width} 200`} role="img" aria-labelledby={`${chartId}-title ${chartId}-description`}>
        <title id={`${chartId}-title`}>{title}: Present and absent attendance</title>
        <desc id={`${chartId}-description`}>{buckets.map((item) => `${item.from} to ${item.to}: ${attendancePercentage({ present: item.present, marked: item.totalStudentDays })} present, ${attendancePercentage({ present: item.absent, marked: item.totalStudentDays })} absent${item.upcoming ? ', upcoming' : item.marked ? '' : ', no marked attendance'}`).join('; ')}</desc>
        <defs><linearGradient id={`${chartId}-green`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#19bc6b" /><stop offset="1" stopColor="#0b9e60" /></linearGradient><linearGradient id={`${chartId}-blue`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#2495ff" /><stop offset="1" stopColor="#0876ed" /></linearGradient></defs>
        {Array.from({ length: 6 }, (_, index) => { const y = top + height - index * height / 5; return <g key={index}><line x1={left} x2={width - 20} y1={y} y2={y} stroke="#e3ebf4" /><text x={left - 16} y={y + 5} textAnchor="end">{index * 20}%</text></g> })}
        <text transform={`translate(19 ${top + height / 2}) rotate(-90)`} textAnchor="middle">Attendance (%)</text>
        {buckets.map((item, index) => { const center = left + groupWidth * (index + .5); return <g key={item.from}>
          {['present', 'absent'].map((status, bar) => { const h = item.totalStudentDays ? item[status] / item.totalStudentDays * height : 0; const x = center + (bar ? 4 : -barWidth - 4); return <g key={status}><rect x={x} y={top + height - h} width={barWidth} height={h} rx={5} fill={`url(#${chartId}-${bar ? 'blue' : 'green'})`}><title>{item.from} – {item.to}: {attendancePercentage({ present: item[status], marked: item.totalStudentDays })} {status}</title></rect>{item.marked ? <text className="attendance-bar-value" x={x + barWidth / 2} y={top + height - h - 9} textAnchor="middle">{attendancePercentage({ present: item[status], marked: item.totalStudentDays })}</text> : null}</g> })}
          {!item.marked ? <text x={center} y={top + height - 12} textAnchor="middle" className="attendance-no-records">{item.upcoming ? 'Upcoming' : 'No records'}</text> : null}
          <text x={center} y={top + height + 27} textAnchor="middle">{item.label}</text><text x={center} y={top + height + 48} textAnchor="middle">{item.detail}</text>
        </g> })}
      </svg></div>
    </div>
  </div>
}
