import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAttendanceInsights } from './branchAttendanceInsights.js'

const student = (id, records, batchId = 'a') => ({ id, studentName: id, batchId, courseId: 'course', records: records.map(([attendanceDate, status]) => ({ attendanceDate, status, batchId, courseId: 'course' })) })

test('today partitions the full roster, yesterday uses the calendar date, future is excluded', () => {
  const info = buildAttendanceInsights({ date: '2026-09-09', students: [
    student('present', [['2026-09-09', 'PRESENT'], ['2026-09-08', 'ABSENT']]),
    student('absent', [['2026-09-09', 'ABSENT']]),
    student('unmarked', [['2026-09-10', 'PRESENT']]),
  ] })
  assert.equal(info.total, 3)
  assert.deepEqual(info.present.map(s => s.id), ['present'])
  assert.deepEqual(info.absent.map(s => s.id), ['absent'])
  assert.deepEqual(info.unmarked.map(s => s.id), ['unmarked'])
  assert.deepEqual(info.yesterdayAbsent.map(s => s.id), ['present'])
  assert.equal(info.yesterday, '2026-09-08')
})

test('long absence follows batch dates, breaks on missing/present marks and ignores other batches', () => {
  const three = [['2026-09-04', 'ABSENT'], ['2026-09-07', 'ABSENT'], ['2026-09-09', 'ABSENT']]
  const info = buildAttendanceInsights({ date: '2026-09-09', students: [
    student('long', three),
    student('gap', [three[0], three[2]]),
    student('returned', [...three.slice(0, 2), ['2026-09-09', 'PRESENT']]),
    student('other', [['2026-09-08', 'PRESENT']], 'b'),
  ] })
  assert.equal(info.longAbsent.length, 1)
  assert.equal(info.longAbsent[0].id, 'long')
  assert.equal(info.longAbsent[0].streak, 3)
  assert.equal(info.longAbsent[0].lastMarkedDate, '2026-09-09')
})

test('empty data and month boundary do not fabricate absence', () => {
  const info = buildAttendanceInsights({ date: '2026-09-01', students: [] })
  assert.equal(info.yesterday, '2026-08-31')
  assert.equal(info.total, 0)
  assert.equal(info.longAbsent.length, 0)
})
