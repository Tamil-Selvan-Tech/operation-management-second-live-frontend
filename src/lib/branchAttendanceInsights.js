const WEEKDAY_NUMBERS = new Set([1, 2, 3, 4, 5])
const WEEKEND_NUMBERS = new Set([0, 6])
const DAY_NUMBERS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function isApplicableDate(student, date, data, holidays, leaves) {
  if (student.courseStartDate && date < student.courseStartDate) return false
  if (student.courseEndDate && date > student.courseEndDate) return false
  if (holidays.has(date)) return false
  if (leaves.some((leave) => leave.leaveDate === date && (!leave.batchId || leave.batchId === student.batchId))) return false
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  const schedule = String(student.classSchedule || '').trim().toUpperCase()
  if (schedule.includes('WEEKEND') && !WEEKEND_NUMBERS.has(day)) return false
  if (schedule.includes('WEEKDAY') && !WEEKDAY_NUMBERS.has(day)) return false
  const weeklyOffDay = String(student.weeklyOffDay || '').trim().toLowerCase()
  return weeklyOffDay && DAY_NUMBERS[weeklyOffDay] !== undefined ? DAY_NUMBERS[weeklyOffDay] !== day : true
}

function recordBelongsToStudent(record, student) {
  return record && (!record.batchId || record.batchId === student.batchId) && (!record.courseId || record.courseId === student.courseId)
}

// Missing marks remain unmarked and break an absence streak. Holidays, leave,
// week-offs and non-class days are excluded from the applicable day sequence.
export function buildAttendanceInsights(data, threshold = 5) {
  const holidays = new Set(data.exclusions?.holidays || [])
  const leaves = Array.isArray(data.exclusions?.leaves) ? data.exclusions.leaves : []
  const uniqueStudents = new Map()
  for (const student of (Array.isArray(data.students) ? data.students : [])) {
    if (!uniqueStudents.has(student.id)) uniqueStudents.set(student.id, student)
  }
  const students = [...uniqueStudents.values()].map((student) => ({
    ...student,
    recordsByDate: new Map((student.records || []).filter((record) => record.attendanceDate <= data.date && ['PRESENT', 'ABSENT'].includes(record.status) && recordBelongsToStudent(record, student)).map((record) => [record.attendanceDate, record])),
  }))
  const applicableToday = students.filter((student) => isApplicableDate(student, data.date, data, holidays, leaves))
  const present = [], absent = [], unmarked = [], yesterdayAbsent = [], longAbsent = []
  let previousApplicableDateLabel = addDays(data.date, -1)

  for (const student of applicableToday) {
    const todayStatus = student.recordsByDate.get(data.date)?.status
    if (todayStatus === 'PRESENT') present.push(student)
    else if (todayStatus === 'ABSENT') absent.push(student)
    else unmarked.push(student)

    let previousApplicableDate = ''
    for (let offset = 1; offset <= 370; offset += 1) {
      const candidate = addDays(data.date, -offset)
      if (isApplicableDate(student, candidate, data, holidays, leaves)) {
        previousApplicableDate = candidate
        if (previousApplicableDateLabel === addDays(data.date, -1)) previousApplicableDateLabel = candidate
        break
      }
    }
    if (previousApplicableDate && student.recordsByDate.get(previousApplicableDate)?.status === 'ABSENT') yesterdayAbsent.push(student)

    let streak = 0
    for (let offset = 0; offset <= 370; offset += 1) {
      const candidate = addDays(data.date, -offset)
      if (!isApplicableDate(student, candidate, data, holidays, leaves)) continue
      if (student.recordsByDate.get(candidate)?.status !== 'ABSENT') break
      streak += 1
    }
    if (streak >= threshold) longAbsent.push({ ...student, streak, lastMarkedDate: data.date })
  }

  longAbsent.sort((a, b) => b.streak - a.streak || a.studentName.localeCompare(b.studentName))
  return { total: applicableToday.length, present, absent, unmarked, yesterdayAbsent, longAbsent, yesterday: previousApplicableDateLabel, threshold }
}
