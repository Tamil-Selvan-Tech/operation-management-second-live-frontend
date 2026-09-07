export const GOVERNMENT_HOLIDAY_CATALOG = [
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-09-14', name: 'Vinayagar Chathurthi' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-19', name: 'Ayutha Pooja' },
  { date: '2026-10-20', name: 'Vijaya Dasami' },
  { date: '2026-11-08', name: 'Deepavali' },
  { date: '2026-12-25', name: 'Christmas' },
  { date: '2027-01-01', name: 'New Year' },
  { date: '2027-01-15', name: 'Pongal / Thiruvalluvar Day' },
  { date: '2027-01-26', name: 'Republic Day' },
  { date: '2027-08-15', name: 'Independence Day' },
  { date: '2027-10-02', name: 'Gandhi Jayanti' },
  { date: '2027-12-25', name: 'Christmas Day' },
]

function normalizeDateKey(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }

  const raw = String(value || '').trim()
  if (!raw) return ''

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    return `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, '0')}-${String(isoMatch[3]).padStart(2, '0')}`
  }

  const slashMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (slashMatch) {
    return `${slashMatch[3]}-${String(slashMatch[2]).padStart(2, '0')}-${String(slashMatch[1]).padStart(2, '0')}`
  }

  const namedMatch = raw.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-](\d{4})/)
  if (namedMatch) {
    const parsed = new Date(`${namedMatch[1]} ${namedMatch[2]} ${namedMatch[3]} 00:00:00`)
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
    }
  }

  return ''
}

function parseDateKey(value) {
  const date = new Date(`${normalizeDateKey(value)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getGovernmentHolidaysForRange(startDate, endDate, extraHolidays = []) {
  const start = parseDateKey(startDate)
  const end = parseDateKey(endDate)
  if (!start || !end) return []

  const merged = [...GOVERNMENT_HOLIDAY_CATALOG]

  if (Array.isArray(extraHolidays)) {
    extraHolidays.forEach((item) => {
      const date = normalizeDateKey(item?.date || item?.holidayDate || item?.day)
      const name = String(item?.name || item?.title || item?.holidayName || 'Government Holiday').trim()
      if (date) {
        merged.push({ date, name: name || 'Government Holiday' })
      }
    })
  }

  const seen = new Map()

  merged.forEach((item) => {
    const date = normalizeDateKey(item.date)
    if (!date) return

    const parsed = parseDateKey(date)
    if (!parsed || parsed < start || parsed > end) return

    if (!seen.has(date)) {
      seen.set(date, {
        date,
        name: String(item.name || 'Government Holiday').trim() || 'Government Holiday',
      })
    }
  })

  return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date))
}
