export function attendanceToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Calcutta' }).format(new Date())
}

export function attendancePercentage(count) {
  return count.marked ? `${Number(((count.present / count.marked) * 100).toFixed(2))}%` : '—'
}

export function buildAttendanceChart(data, mode = 'daily') {
  const end = new Date(`${data.date}T00:00:00Z`)
  const key = (value) => value.toISOString().slice(0, 10)
  const shortDate = (value) => value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
  const daysInCurrentMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  const buckets = Array.from({ length: mode === 'daily' ? 7 : mode === 'weekly' ? Math.ceil(daysInCurrentMonth / 7) : 6 }, (_, index) => {
    const start = new Date(end)
    let finish
    if (mode === 'monthly') {
      const augustYear = end.getUTCFullYear() - (end.getUTCMonth() < 7 ? 1 : 0)
      start.setUTCFullYear(augustYear, 7 + index, 1)
      finish = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
    } else if (mode === 'weekly') {
      start.setUTCDate(index * 7 + 1)
      finish = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), Math.min((index + 1) * 7, daysInCurrentMonth)))
    } else {
      start.setUTCDate(start.getUTCDate() - start.getUTCDay() + index)
      finish = new Date(start)
    }
    return {
      from: key(start), to: key(finish),
      upcoming: key(start) > data.date,
      label: mode === 'monthly' ? start.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : mode === 'weekly' ? `Week ${index + 1}` : shortDate(start),
      detail: mode === 'daily' ? start.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }) : '',
      present: 0, absent: 0, marked: 0,
      totalStudentDays: data.students.length * (mode === 'daily' ? 1 : mode === 'weekly' ? 7 : finish.getUTCDate()),
    }
  })
  for (const student of data.students) {
    for (const record of new Map(student.records.map((item) => [item.attendanceDate, item])).values()) {
      if (!['PRESENT', 'ABSENT'].includes(record.status) || record.attendanceDate > data.date) continue
      const bucket = buckets.find((item) => record.attendanceDate >= item.from && record.attendanceDate <= item.to)
      if (!bucket) continue
      bucket[record.status === 'PRESENT' ? 'present' : 'absent'] += 1
      bucket.marked += 1
    }
  }
  return buckets.map((bucket) => ({
    ...bucket,
    unmarked: bucket.totalStudentDays - bucket.present - bucket.absent,
  }))
}

export function summarizeBranchAttendance(data) {
  const empty = () => ({ present: 0, absent: 0, marked: 0 })
  const totals = { daily: empty(), weekly: empty(), monthly: empty() }
  const batches = new Map()
  const students = data.students.map((student) => {
    const periods = { daily: empty(), weekly: empty(), monthly: empty() }
    const records = new Map(student.records.map((record) => [record.attendanceDate, record]))
    for (const record of records.values()) {
      if (!['PRESENT', 'ABSENT'].includes(record.status) || record.attendanceDate > data.date) continue
      for (const [period, start] of Object.entries({ daily: data.date, weekly: data.weekStart, monthly: data.monthStart })) {
        if (record.attendanceDate < start) continue
        periods[period].marked += 1
        periods[period][record.status === 'PRESENT' ? 'present' : 'absent'] += 1
      }
    }
    const batchKey = JSON.stringify([student.courseId || '', student.batchId || ''])
    if (!batches.has(batchKey)) batches.set(batchKey, { key: batchKey, name: student.batchName || student.batchId || 'Unassigned', course: student.courseName || '', total: 0, daily: empty(), weekly: empty(), monthly: empty() })
    const batch = batches.get(batchKey)
    batch.total += 1
    for (const period of ['daily', 'weekly', 'monthly']) {
      for (const field of ['present', 'absent', 'marked']) {
        totals[period][field] += periods[period][field]
        batch[period][field] += periods[period][field]
      }
    }
    return { ...student, ...periods, batchKey }
  })
  return { totals, batches: [...batches.values()], students }
}
