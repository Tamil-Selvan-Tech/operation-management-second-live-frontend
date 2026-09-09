import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attendancePercentage, buildAttendanceChart, summarizeBranchAttendance } from './branchAttendanceSummary.js'

test('uses weighted marked days, ignores future/unmarked records and keeps all students', () => {
  const result = summarizeBranchAttendance({
    date: '2026-09-02', weekStart: '2026-08-31', monthStart: '2026-09-01', students: [
      { id: '1', courseId: 'a', batchId: 'same', records: [
        { attendanceDate: '2026-08-31', status: 'PRESENT' },
        { attendanceDate: '2026-09-01', status: 'PRESENT' },
        { attendanceDate: '2026-09-02', status: 'ABSENT' },
        { attendanceDate: '2026-09-03', status: 'PRESENT' },
      ] },
      { id: '2', courseId: 'a', batchId: 'same', records: [{ attendanceDate: '2026-09-02', status: 'PRESENT' }] },
      { id: '3', courseId: 'b', batchId: 'same', records: [{ attendanceDate: '2026-09-02', status: 'UNMARKED' }] },
    ],
  })
  assert.equal(result.students.length, 3)
  assert.equal(result.batches.length, 2)
  assert.equal(attendancePercentage(result.totals.daily), '50%')
  assert.equal(attendancePercentage(result.totals.weekly), '75%')
  assert.equal(attendancePercentage(result.totals.monthly), '66.67%')
  assert.equal(attendancePercentage(result.students[2].daily), '—')
})

test('deduplicates student-day records and preserves zero percent for absence', () => {
  const result = summarizeBranchAttendance({ date: '2026-09-02', weekStart: '2026-08-31', monthStart: '2026-09-01', students: [{ id: '1', records: [
    { attendanceDate: '2026-09-02', status: 'PRESENT' },
    { attendanceDate: '2026-09-02', status: 'ABSENT' },
  ] }] })
  assert.equal(result.totals.daily.marked, 1)
  assert.equal(attendancePercentage(result.totals.daily), '0%')
})

test('chart groups real counts across week, month and year boundaries', () => {
  const data = { date: '2026-01-02', students: [{ records: [
    { attendanceDate: '2025-12-28', status: 'PRESENT' },
    { attendanceDate: '2025-12-29', status: 'ABSENT' },
    { attendanceDate: '2026-01-01', status: 'PRESENT' },
    { attendanceDate: '2026-01-02', status: 'UNMARKED' },
    { attendanceDate: '2026-01-03', status: 'ABSENT' },
  ] }] }
  const daily = buildAttendanceChart(data, 'daily')
  assert.equal(daily.length, 7)
  assert.equal(daily[0].from, '2025-12-28')
  assert.deepEqual(daily.map((item) => item.detail), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
  assert.equal(daily[6].to, '2026-01-03')
  assert.equal(daily[6].upcoming, true)
  assert.equal(daily[6].marked, 0)
  const weekly = buildAttendanceChart(data, 'weekly')
  assert.equal(weekly.length, 5)
  assert.equal(weekly[0].from, '2026-01-01')
  assert.equal(weekly[0].to, '2026-01-07')
  assert.equal(weekly[0].present, 1)
  assert.equal(weekly[0].absent, 0)
  const monthly = buildAttendanceChart(data, 'monthly')
  assert.equal(monthly[0].from, '2025-08-01')
  assert.equal(monthly[4].marked, 2)
  assert.equal(monthly[5].present, 1)
  assert.equal(monthly[5].absent, 0)
})

test('daily chart keeps Sunday and Saturday in the same calendar week', () => {
  for (const date of ['2026-09-06', '2026-09-09', '2026-09-12']) {
    const buckets = buildAttendanceChart({ date, students: [] }, 'daily')
    assert.equal(buckets[0].from, '2026-09-06')
    assert.equal(buckets[6].to, '2026-09-12')
  }
})

test('monthly chart always shows August through January and excludes future attendance', () => {
  for (const date of ['2026-09-09', '2027-01-15', '2027-07-15']) {
    const buckets = buildAttendanceChart({ date, students: [{ records: [
      { attendanceDate: '2026-08-10', status: 'PRESENT' },
      { attendanceDate: '2027-01-31', status: 'ABSENT' },
    ] }] }, 'monthly')
    assert.deepEqual(buckets.map((item) => item.from.slice(5, 7)), ['08', '09', '10', '11', '12', '01'])
    assert.equal(buckets[0].from, '2026-08-01')
    assert.equal(buckets[5].to, '2027-01-31')
    assert.equal(buckets[0].present, 1)
    assert.equal(buckets[5].absent, date < '2027-01-31' ? 0 : 1)
  }
})

test('seven-day weekly buckets cover every month date exactly once', () => {
  for (const date of ['2026-02-28', '2028-02-29', '2026-09-30', '2026-01-31']) {
    const days = Number(date.slice(-2))
    const records = Array.from({ length: days }, (_, index) => ({ attendanceDate: `${date.slice(0, 8)}${String(index + 1).padStart(2, '0')}`, status: 'PRESENT' }))
    const buckets = buildAttendanceChart({ date, students: [{ records }] }, 'weekly')
    assert.deepEqual(buckets.map((item) => item.marked), days === 28 ? [7, 7, 7, 7] : [7, 7, 7, 7, days - 28])
    assert.equal(buckets[buckets.length - 1].to, date)
  }
})

test('percentages use the full weekly or monthly base, including unmarked dates', () => {
  const students = Array.from({ length: 12 }, (_, index) => ({ records: [
    ...(index < 11 ? [{ attendanceDate: '2026-09-08', status: 'PRESENT' }] : []),
    ...(index < 4 ? [{ attendanceDate: '2026-09-09', status: index < 3 ? 'PRESENT' : 'ABSENT' }] : []),
  ] }))
  const data = { date: '2026-09-09', students }
  const daily = buildAttendanceChart(data, 'daily').find(item => item.from === data.date)
  assert.equal(daily.totalStudentDays, 12)
  assert.equal(attendancePercentage({ present: daily.present, marked: daily.totalStudentDays }), '25%')
  assert.equal(attendancePercentage({ present: daily.absent, marked: daily.totalStudentDays }), '8.33%')
  for (const mode of ['weekly', 'monthly']) {
    const bucket = buildAttendanceChart(data, mode).find(item => item.marked)
    assert.equal(bucket.totalStudentDays, mode === 'weekly' ? 84 : 360)
    assert.equal(attendancePercentage({ present: bucket.present, marked: bucket.totalStudentDays }), mode === 'weekly' ? '16.67%' : '3.89%')
    assert.equal(bucket.unmarked, mode === 'weekly' ? 69 : 345)
    assert.equal(attendancePercentage({ present: bucket.absent, marked: bucket.totalStudentDays }), mode === 'weekly' ? '1.19%' : '0.28%')
    assert.equal(attendancePercentage({ present: bucket.unmarked, marked: bucket.totalStudentDays }), mode === 'weekly' ? '82.14%' : '95.83%')
  }
})

test('unmarked days retain the full base and percentages never exceed 100', () => {
  for (const date of ['2026-09-30', '2028-02-29', '2026-02-28', '2026-01-31']) {
    const days = Number(date.slice(-2))
    const students = [{ records: Array.from({ length: days }, (_, index) => ({ attendanceDate: `${date.slice(0, 8)}${String(index + 1).padStart(2, '0')}`, status: 'PRESENT' })) }]
    for (const mode of ['daily', 'weekly', 'monthly']) {
      for (const bucket of buildAttendanceChart({ date, students }, mode)) {
        assert.equal(bucket.present + bucket.absent + bucket.unmarked, bucket.totalStudentDays)
        assert.ok(bucket.present <= bucket.totalStudentDays)
        assert.ok(bucket.unmarked >= 0)
      }
    }
  }
  const blank = buildAttendanceChart({ date: '2026-09-09', students: [{ records: [] }] }, 'monthly')[1]
  assert.equal(blank.totalStudentDays, 30)
  assert.equal(blank.unmarked, 30)
  assert.equal(attendancePercentage({ present: blank.unmarked, marked: blank.totalStudentDays }), '100%')
})
