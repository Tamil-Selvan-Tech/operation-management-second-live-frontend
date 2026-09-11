// A missing mark interrupts an absence streak; holidays/leave are already
// excluded by the API. Streaks follow the batch's recorded attendance dates.
export function buildAttendanceInsights(data, threshold = 5) {
  const yesterday = new Date(`${data.date}T00:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)
  const batchKey = (student) => JSON.stringify([student.courseId || '', student.batchId || ''])
  const batchDates = new Map()
  const students = data.students.map((student) => {
    const records = new Map(student.records.filter((record) => record.attendanceDate <= data.date && ['PRESENT', 'ABSENT'].includes(record.status)).map((record) => [record.attendanceDate, record]))
    const key = batchKey(student)
    if (!batchDates.has(key)) batchDates.set(key, new Set())
    for (const record of records.values()) {
      if (record.batchId === student.batchId && record.courseId === student.courseId) batchDates.get(key).add(record.attendanceDate)
    }
    return { ...student, recordsByDate: records }
  })
  const present = [], absent = [], unmarked = [], yesterdayAbsent = [], longAbsent = []
  for (const student of students) {
    const status = student.recordsByDate.get(data.date)?.status
    if (status === 'PRESENT') present.push(student)
    else if (status === 'ABSENT') absent.push(student)
    else unmarked.push(student)
    if (student.recordsByDate.get(yesterdayKey)?.status === 'ABSENT') yesterdayAbsent.push(student)
    const dates = [...batchDates.get(batchKey(student))].sort().reverse()
    let streak = 0
    for (const date of dates) {
      const record = student.recordsByDate.get(date)
      if (record?.status !== 'ABSENT' || record.batchId !== student.batchId || record.courseId !== student.courseId) break
      streak++
    }
    if (streak >= threshold) longAbsent.push({ ...student, streak, lastMarkedDate: dates[0] })
  }
  longAbsent.sort((a, b) => b.streak - a.streak || a.studentName.localeCompare(b.studentName))
  return { total: students.length, present, absent, unmarked, yesterdayAbsent, longAbsent, yesterday: yesterdayKey, threshold }
}
