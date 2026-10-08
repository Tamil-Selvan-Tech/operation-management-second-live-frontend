import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildStudentCourseCalendar } from './studentCalendar.js'

test('sequential multi-course calendar hides each course outside its own dates', () => {
  const calendar = buildStudentCourseCalendar({
    arrangementType: 'SEQUENTIAL',
    scheduleSummary: {
      courses: [
        { courseId: 'mean-stack', courseName: 'Mean Stack', startDate: '2026-10-01', endDate: '2026-10-07', schedule: 'Weekday' },
        { courseId: 'business-analytics', courseName: 'Business Analytics', startDate: '2026-10-08', endDate: '2027-03-18', schedule: 'Weekday' },
      ],
    },
  })
  const days = new Map(calendar.months.flatMap((month) => month.days.filter((day) => day.dateKey).map((day) => [day.dateKey, day])))

  assert.deepEqual(days.get('2026-10-07').courseStatuses.map((course) => course.courseName), ['Mean Stack'])
  assert.deepEqual(days.get('2026-10-08').courseStatuses.map((course) => course.courseName), ['Business Analytics'])
  assert.deepEqual(days.get('2026-10-23').courseStatuses.map((course) => course.courseName), ['Business Analytics'])
  assert.deepEqual(calendar.months.map((month) => month.key), ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'])
  assert.deepEqual(days.get('2027-03-18').courseStatuses.map((course) => course.courseName), ['Business Analytics'])
})
