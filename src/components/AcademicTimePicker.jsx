const hours = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))

export default function AcademicTimePicker({ label, value = '10:00', onChange }) {
  const [rawHour, rawMinute] = String(value).split(':')
  const hour24 = Number(rawHour || 10)
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = String(hour24 % 12 || 12).padStart(2, '0')
  const update = (part, nextValue) => {
    let hour = Number(rawHour || 10)
    let minute = rawMinute || '00'
    const selectedPeriod = part === 'period' ? nextValue : period
    const selectedHour = part === 'hour' ? Number(nextValue) : Number(hour12)
    if (part === 'minute') minute = nextValue
    hour = selectedPeriod === 'PM' ? (selectedHour === 12 ? 12 : selectedHour + 12) : (selectedHour === 12 ? 0 : selectedHour)
    onChange(`${String(hour).padStart(2, '0')}:${minute}`)
  }
  return <label className="academic-test-time-picker"><span>{label}</span><div><select value={hour12} onChange={(event) => update('hour', event.target.value)}>{hours.map((hour) => <option key={hour} value={hour}>{hour}</option>)}</select><b>:</b><select value={rawMinute || '00'} onChange={(event) => update('minute', event.target.value)}>{minutes.map((minute) => <option key={minute} value={minute}>{minute}</option>)}</select><select value={period} onChange={(event) => update('period', event.target.value)}><option value="AM">AM</option><option value="PM">PM</option></select></div></label>
}
