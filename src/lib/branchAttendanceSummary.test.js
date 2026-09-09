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
  assert.equal(attendancePercentage(result.totals.daily), '50.0%')
  assert.equal(attendancePercentage(result.totals.weekly), '75.0%')
  assert.equal(attendancePercentage(result.totals.monthly), '66.7%')
  assert.equal(attendancePercentage(result.students[2].daily), '—')
})

test('deduplicates student-day records and preserves zero percent for absence', () => {
  const result = summarizeBranchAttendance({ date: '2026-09-02', weekStart: '2026-08-31', monthStart: '2026-09-01', students: [{ id: '1', records: [
    { attendanceDate: '2026-09-02', status: 'PRESENT' },
    { attendanceDate: '2026-09-02', status: 'ABSENT' },
  ] }] })
  assert.equal(result.totals.daily.marked, 1)
  assert.equal(attendancePercentage(result.totals.daily), '0.0%')
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
  assert.equal(weekly.length, 4)
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

test('four weekly buckets cover every day of short, leap and long months exactly once', () => {
  for (const date of ['2026-02-28', '2028-02-29', '2026-09-30', '2026-01-31']) {
    const days = Number(date.slice(-2))
    const records = Array.from({ length: days }, (_, index) => ({ attendanceDate: `${date.slice(0, 8)}${String(index + 1).padStart(2, '0')}`, status: 'PRESENT' }))
    const buckets = buildAttendanceChart({ date, students: [{ records }] }, 'weekly')
    assert.deepEqual(buckets.map((item) => item.marked), [7, 7, 7, days - 21])
    assert.equal(buckets[3].to, date)
  }
})
