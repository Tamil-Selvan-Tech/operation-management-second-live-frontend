import { useCallback, useEffect, useRef, useState } from 'react'
import { BarChart3, CalendarCheck2, CalendarClock, CalendarDays, MoreVertical, Plus, UsersRound, X } from 'lucide-react'
import { request } from '../services/apiClient'
import { listBranchBatches } from '../services/branchBatchService'
import '../styles/InstituteLeavePage.css'

const unwrap = response => response?.data ?? response

function formatClassTime(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return value || '-'
  const hour = Number(match[1])
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`
}

function normalizeFacultyLeaveDetail(value) {
  const detail = value?.data && typeof value.data === 'object' ? value.data : value && typeof value === 'object' ? value : {}
  const sessionSources = [detail.affectedSessions, detail.affectedClasses, detail.sessions, detail.classes, detail.batchSessions, detail.affectedBatches]
  const sessions = sessionSources.find(source => Array.isArray(source) && source.length) || sessionSources.find(Array.isArray) || []
  const batchSources = [detail.batches, detail.batchEntries, detail.assignedBatches]
  const batches = batchSources.find(source => Array.isArray(source) && source.length) || batchSources.find(Array.isArray) || []
  const expandedSessions = sessions.length ? sessions.flatMap(session => {
      const nested = session?.sessions || session?.classes || session?.scheduledClasses
      return Array.isArray(nested) ? nested.map(item => ({ ...session, ...item })) : [session]
    }) : batches.flatMap(batch => {
      const nested = batch?.sessions || batch?.classes || batch?.scheduledClasses
      return Array.isArray(nested) && nested.length ? nested.map(item => ({ ...batch, ...item })) : [batch]
    })
  const leaveDates = []
  const from = normalizeLeaveDateKey(detail.fromDate)
  const to = normalizeLeaveDateKey(detail.toDate || detail.fromDate)
  if (from && to && from <= to) {
    const cursor = new Date(`${from}T00:00:00`)
    const end = new Date(`${to}T00:00:00`)
    while (cursor <= end) {
      leaveDates.push(cursor.toISOString().slice(0, 10))
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  const rows = expandedSessions.length && leaveDates.length && expandedSessions.every(item => !item?.sessionDate && !item?.date)
    ? expandedSessions.flatMap(item => leaveDates.map(date => ({ ...item, sessionDate: date })))
    : expandedSessions
  const requestFromDate = normalizeLeaveDateKey(detail.fromDate)
  const requestToDate = normalizeLeaveDateKey(detail.toDate || detail.fromDate)
  return {
    ...detail,
    affectedSessions: rows.map(session => ({
      ...session,
      batchName: (() => {
        const name = session.batchName || session.batch?.name || session.batch || session.code || session.batchCode || session.batchId || ''
        const timing = session.batchTiming || session.timing || session.batchTime || ''
        return name && timing && !String(name).includes(String(timing)) ? `${name} (${timing})` : name
      })(),
      batchTiming: session.batchTiming || session.timing || session.batchTime || (detail.durationType === 'HALF_DAY' ? `${detail.halfDayStart || ''} - ${detail.halfDayEnd || ''}` : detail.durationType === 'PERMISSION' ? `${detail.permissionStart || ''} - ${detail.permissionEnd || ''}` : ''),
      // The review table must show the requested leave date. Some schedule
      // records arrive as the previous UTC calendar date (for example
      // 18T18:30Z for 19 Sep in India), so prefer the request's date here.
      sessionDate: requestFromDate === requestToDate
        ? requestFromDate
        : normalizeLeaveDateKey(session.sessionDate || session.date || session.leaveDate || detail.fromDate),
      originalStartTime: session.originalStartTime || session.startTime || String(session.batchTiming || session.timing || session.batchTime || '').split(' - ')?.[0] || '',
      originalEndTime: session.originalEndTime || session.endTime || String(session.batchTiming || session.timing || session.batchTime || '').split(' - ')?.[1] || '',
      resolutionStatus: session.resolutionStatus || (session.isSyntheticBatch ? 'NO_SCHEDULED_CLASS' : 'UNRESOLVED'),
      statusLabel: session.statusLabel || (session.isSyntheticBatch ? 'No scheduled class' : 'Needs resolution'),
    })),
  }
}

function formatDeclaredAt(value, timeZone = 'Asia/Kolkata') {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone,
  }).format(new Date(value))
}

const CLOCK_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
const CLOCK_MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

function clockParts(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return { hour: '', minute: '', period: 'AM' }
  const numericHour = Number(match[1])
  return { hour: String(numericHour % 12 || 12).padStart(2, '0'), minute: match[2], period: numericHour >= 12 ? 'PM' : 'AM' }
}

function clockValue({ hour, minute, period }) {
  if (!hour || !minute || !period) return ''
  let numericHour = Number(hour)
  if (period === 'AM' && numericHour === 12) numericHour = 0
  if (period === 'PM' && numericHour !== 12) numericHour += 12
  return `${String(numericHour).padStart(2, '0')}:${minute}`
}

function ClockTimePicker({ label, value, onChange }) {
  const [draftParts, setDraftParts] = useState(() => clockParts(value))
  const parts = value ? clockParts(value) : draftParts
  const update = (field, nextValue) => {
    const nextParts = { ...parts, [field]: nextValue }
    setDraftParts(nextParts)
    onChange(clockValue(nextParts))
  }
  return <div className="faculty-replacement-clock"><span>{label}</span><div><select aria-label={`${label} hour`} value={parts.hour} onChange={event => update('hour', event.target.value)}><option value="">HH</option>{CLOCK_HOURS.map(hour => <option key={hour} value={hour}>{hour}</option>)}</select><select aria-label={`${label} minute`} value={parts.minute} onChange={event => update('minute', event.target.value)}><option value="">MM</option>{CLOCK_MINUTES.map(minute => <option key={minute} value={minute}>{minute}</option>)}</select><select aria-label={`${label} period`} value={parts.period} onChange={event => update('period', event.target.value)}><option value="AM">AM</option><option value="PM">PM</option></select></div></div>
}

function clockMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function batchTimeMinutes(value, period) {
  const text = String(value || '').trim()
  const match = text.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!match) return null
  let hour = Number(match[1])
  const normalizedPeriod = String(period || match[3] || '').toUpperCase()
  if (normalizedPeriod) {
    if (normalizedPeriod === 'AM' && hour === 12) hour = 0
    if (normalizedPeriod === 'PM' && hour !== 12) hour += 12
  }
  return hour * 60 + Number(match[2])
}

function getBatchTimeRange(batch) {
  if (batch?.isCombineTarget) return { start: null, end: null }
  const timing = String(batch.batchTiming || batch.timing || '').split(/\s+-\s+/)
  return {
    start: batchTimeMinutes(batch.startTime || timing[0], batch.startPeriod),
    end: batchTimeMinutes(batch.endTime || timing[1], batch.endPeriod),
  }
}

function getFacultyTimingConflicts(facultyId, groups, startTime, endTime) {
  const start = clockMinutes(startTime)
  const end = clockMinutes(endTime)
  if (start === null || end === null || end <= start) return []
  return groups
    .filter(group => String(group.facultyId || group.branchFacultyId || '').trim() === String(facultyId || '').trim())
    .flatMap(group => group.batches || [])
    .filter(batch => {
      const range = getBatchTimeRange(batch)
      return range.start !== null && range.end !== null && start < range.end && end > range.start
    })
}

function SelectedFacultyBatches({ facultyId, groups = [] }) {
  const selectedBatches = groups
    .filter(group => String(group.facultyId || group.branchFacultyId || '').trim() === String(facultyId || '').trim())
    .flatMap(group => (group.batches || []).map(batch => ({ ...batch, courseName: group.courseName })))
  if (!facultyId) return null
  return <div className="faculty-selected-batches"><strong>Selected faculty batches</strong>{selectedBatches.length ? <div className="faculty-selected-batches-list">{selectedBatches.map(batch => <div key={batch.id || batch.batchId}><span>{batch.batchName || batch.batchId || 'Batch'}</span><small>{batch.batchTiming || `${formatClassTime(batch.startTime)} - ${formatClassTime(batch.endTime)}`}</small></div>)}</div> : <p>No other batches found for this faculty.</p>}</div>
}

function ReplacementTimingStatus({ facultyId, groups = [], startTime, endTime }) {
  const conflicts = getFacultyTimingConflicts(facultyId, groups, startTime, endTime)
  if (!startTime || !endTime || clockMinutes(endTime) <= clockMinutes(startTime)) return null
  return conflicts.length
    ? <p className="faculty-selected-batches-conflict">Time conflict with: {conflicts.map(batch => `${batch.batchName || batch.batchId || 'Batch'} (${batch.batchTiming || `${formatClassTime(batch.startTime)} - ${formatClassTime(batch.endTime)}`})`).join(', ')}</p>
    : <p className="faculty-selected-batches-available">Selected replacement time is available.</p>
}

function normalizeLeaveDateKey(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return text.slice(0, 10)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function formatLeaveDate(value) {
  const date = new Date(`${normalizeLeaveDateKey(value)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value || '-'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function RescheduleAvailability({ facultyId, groups = [], date, startTime, endTime, leaveId, sessionId }) {
  const [availability, setAvailability] = useState([])
  const [combineTarget, setCombineTarget] = useState(null)
  useEffect(() => {
    let active = true
    if (!leaveId || !sessionId || !date) return () => { active = false }
    request(`/faculty-leave-requests/${leaveId}/sessions/${sessionId}/eligible-faculty?assignmentType=RESCHEDULED&targetDate=${encodeURIComponent(date)}&targetStartTime=${encodeURIComponent(startTime || '')}&targetEndTime=${encodeURIComponent(endTime || '')}`)
      .then(response => {
        if (!active) return
        const result = unwrap(response) || {}
        setAvailability(result.availability || [])
        setCombineTarget(result.combineTarget || null)
      })
      .catch(() => {
        if (!active) return
        setAvailability([])
        setCombineTarget(null)
      })
    return () => { active = false }
  }, [leaveId, sessionId, date, startTime, endTime])
  if (!facultyId || !date) return null
  const selectedType = scheduleTypeForDate(date)
  const fallbackRows = groups
    .filter(group => String(group.facultyId || group.branchFacultyId || '').trim() === String(facultyId).trim())
    .flatMap(group => (group.batches || []).map(batch => ({ ...batch, courseName: batch.courseName || group.courseName })))
    .filter(batch => String(batch.weekType || '').toUpperCase() === selectedType)
  const availableRows = availability.length ? availability : fallbackRows
  const rows = combineTarget
    ? [{ ...combineTarget, id: `combine-target-${combineTarget.batchRecordId || combineTarget.batchId}`, isCombineTarget: true, batchName: 'Combine with ' + (combineTarget.batchName || combineTarget.batchId || 'compatible batch'), availabilityStatus: 'AVAILABLE' }, ...availableRows]
    : availableRows
  const requestedStart = clockMinutes(startTime)
  const requestedEnd = clockMinutes(endTime)
  return <div className="faculty-selected-batches faculty-reschedule-availability"><strong>Faculty availability on selected date</strong>{rows.length ? <div className="faculty-selected-batches-list">{rows.map(batch => { const range = getBatchTimeRange(batch); const occupied = batch.availabilityStatus === 'ALREADY_SCHEDULED' || (requestedStart !== null && requestedEnd !== null && range.start !== null && range.end !== null && requestedStart < range.end && requestedEnd > range.start); const submodules = Array.isArray(batch.submodules) ? batch.submodules : []; return <div key={batch.id || batch.batchId}><span><b>{batch.batchName || batch.batchId || 'Batch'}</b><small>{batch.courseName || '-'} · Module: {batch.moduleName || '-'} · Module Progress: {batch.moduleProgress ?? 0}% · Course Progress: {batch.courseProgress ?? 0}%</small>{submodules.length ? <small>Sub-modules: {submodules.map(item => `${item.name} (${item.status})`).join(', ')}</small> : null}</span><small>{batch.batchTiming || `${formatClassTime(batch.startTime)} - ${formatClassTime(batch.endTime)}`} · {occupied ? 'Already Scheduled / Not Available' : 'Available'}</small></div> })}</div> : <p>No {selectedType.toLowerCase()} batches found for this faculty on the selected date.</p>}</div>
}

function scheduleTypeForDate(value) {
  const date = new Date(`${normalizeLeaveDateKey(value)}T00:00:00Z`)
  const day = date.getUTCDay()
  return day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAY'
}

function nextDateKey(value) {
  const date = new Date(`${normalizeLeaveDateKey(value)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
export function InstituteLeavePage({ initialViewMode = 'institute' }) {
  const [data, setData] = useState(null)
  const [facultyRequests, setFacultyRequests] = useState([])
  const [branchBatchGroups, setBranchBatchGroups] = useState([])
  const [viewMode, setViewMode] = useState(initialViewMode)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [leavePage, setLeavePage] = useState(1)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [facultyDetail, setFacultyDetail] = useState(null)
  const [approveTarget, setApproveTarget] = useState(null)
  const [approvalMode, setApprovalMode] = useState('approve')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [resolutionTarget, setResolutionTarget] = useState(null)
  const [resolutionType, setResolutionType] = useState('')
  const [resolutionForm, setResolutionForm] = useState({ replacementFacultyId: '', replacementStartTime: '', replacementEndTime: '', scheduleType: 'WEEKDAY', rescheduledDate: '', rescheduledStartTime: '', rescheduledEndTime: '', targetSessionId: '', reason: '' })
  const [replacementFaculty, setReplacementFaculty] = useState([])
  const [combineSessions, setCombineSessions] = useState([])
  const [combineSource, setCombineSource] = useState(null)
  const [cancel, setCancel] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [successPopup, setSuccessPopup] = useState('')
  const [openActionMenu, setOpenActionMenu] = useState(null)
  const [pinnedActionMenu, setPinnedActionMenu] = useState(false)
  const dialog = useRef(null)
  const facultyDialog = useRef(null)
  const load = useCallback(async () => {
    try {
      const response = await request('/institute-leaves')
      setData(unwrap(response))
    } catch (err) { setError(err.message || 'Unable to load Institute Leave') }
    try {
      const facultyResponse = await request('/faculty-leave-requests/branch')
      setFacultyRequests(unwrap(facultyResponse)?.requests || [])
    } catch (err) {
      // Do not silently turn a failed faculty-request query into an empty
      // table; keep the error visible so the branch admin knows what failed.
      setFacultyRequests([])
      setError(err.message || 'Unable to load faculty leave requests')
    }
    try {
      const batchResponse = await listBranchBatches({ limit: 100 })
      setBranchBatchGroups(batchResponse?.data || [])
    } catch {
      setBranchBatchGroups([])
    }
  }, [])
  useEffect(() => {
    void Promise.resolve().then(load)
    const timer = setInterval(load, 30000)
    window.addEventListener('focus', load)
    return () => { clearInterval(timer); window.removeEventListener('focus', load) }
  }, [load])
  useEffect(() => {
    const openFacultyRequests = () => setViewMode('faculty')
    const openInstituteLeave = () => setViewMode('institute')
    window.addEventListener('open-faculty-leave-requests', openFacultyRequests)
    window.addEventListener('open-institute-leave', openInstituteLeave)
    return () => {
      window.removeEventListener('open-faculty-leave-requests', openFacultyRequests)
      window.removeEventListener('open-institute-leave', openInstituteLeave)
    }
  }, [])
  const open = Boolean(form || detail || cancel)
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  useEffect(() => {
    const facultyOpen = Boolean(facultyDetail || rejectTarget || resolutionTarget)
    if (facultyOpen && !facultyDialog.current?.open) facultyDialog.current?.showModal()
    if (!facultyOpen && facultyDialog.current?.open) facultyDialog.current.close()
  }, [facultyDetail, rejectTarget])
  useEffect(() => {
    const closeOnOutsideClick = event => {
      if (!event.target.closest('.institute-action-menu')) {
        setOpenActionMenu(null)
        setPinnedActionMenu(false)
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])
  const close = () => { if (!busy) { setForm(null); setDetail(null); setFacultyDetail(null); setApproveTarget(null); setApprovalMode('approve'); setRejectTarget(null); setRejectReason(''); setResolutionTarget(null); setResolutionType(''); setReplacementFaculty([]); setCombineSessions([]); setCombineSource(null); setCancel(null) } }
  async function save(event) {
    event.preventDefault()
    if (form) {
      const nextErrors = {}
      if (!form.leaveDate) nextErrors.leaveDate = 'This field is required'
      if (!String(form.reason || '').trim()) nextErrors.reason = 'This field is required'
      setFieldErrors(nextErrors)
      if (Object.keys(nextErrors).length) return
    }
    setBusy(true); setError(''); setMessage('')
    try {
      await request(`/institute-leaves${cancel ? `/${cancel.id}` : form?.id ? `/${form.id}` : ''}`, {
        method: cancel ? 'DELETE' : form.id ? 'PATCH' : 'POST',
        ...(cancel ? {} : { body: JSON.stringify({ leaveDate: form.leaveDate, reason: form.reason }) }),
      })
      setForm(null); setCancel(null)
      const successText = cancel ? 'Institute Leave cancelled. Schedules restored.' : 'Institute Leave saved successfully. Calendars and notifications updated.'
      setMessage(successText)
      setSuccessPopup(successText)
      window.dispatchEvent(new Event('institute-leave-updated'))
      await load()
    } catch (err) { setError(err.message || 'Unable to save Institute Leave') }
    finally { setBusy(false) }
  }
  async function view(leave) {
    setError('')
    try { setDetail(unwrap(await request(`/institute-leaves/${leave.id}`))) }
    catch (err) { setError(err.message) }
  }
  async function viewFacultyRequest(leave) {
    setError('')
    try {
      const detail = normalizeFacultyLeaveDetail(unwrap(await request(`/faculty-leave-requests/${leave.id}`)))
      const batchGroups = branchBatchGroups.length ? branchBatchGroups : (await listBranchBatches({ limit: 100 })).data || []
      if (!branchBatchGroups.length) setBranchBatchGroups(batchGroups)
      const facultyId = String(leave.facultyId || leave.facultyUserId || '').trim().toLowerCase()
      const facultyName = String(leave.facultyName || '').trim().toLowerCase()
      const assignedBatches = batchGroups.flatMap(group => {
        const groupFacultyId = String(group.facultyId || group.branchFacultyId || '').trim().toLowerCase()
        const groupFacultyName = String(group.facultyName || '').trim().toLowerCase()
        const belongsToFaculty = (facultyId && groupFacultyId === facultyId) || (!facultyId && facultyName && groupFacultyName === facultyName)
        if (!belongsToFaculty) return []
        return (group.batches || []).map(batch => ({
          ...batch,
          batchName: batch.batchName || batch.batchId,
          batchTiming: batch.batchTiming || `${batch.startTime || ''} - ${batch.endTime || ''}`,
          isSyntheticBatch: true,
          courseName: group.courseName,
          courseId: group.courseId,
        }))
      })
      setFacultyDetail(normalizeFacultyLeaveDetail(
        detail.affectedSessions.length ? detail : { ...detail, batches: assignedBatches },
      ))
    }
    catch (err) { setError(err.message || 'Unable to load faculty leave request') }
  }
  async function reviewFacultyRequest(id, action, confirmed = false) {
    if (action === 'approve' && !confirmed) {
      const requestItem = facultyRequests.find(item => item.id === id) || (facultyDetail?.id === id ? facultyDetail : { id })
      openApproveConfirmation(requestItem)
      return
    }
    setBusy(true); setError('')
    try {
      if (action === 'reject') await request(`/faculty-leave-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: rejectReason.trim() || 'Rejected by Branch Admin' }) })
      else await request(`/faculty-leave-requests/${id}/${approvalMode === 'delegate' ? 'approve-delegate' : 'approve'}`, { method: 'POST' })
      setFacultyDetail(null); setApproveTarget(null); setApprovalMode('approve'); setRejectTarget(null); setRejectReason(''); setMessage(action === 'approve' ? (approvalMode === 'delegate' ? 'Emergency leave approved and delegated.' : 'Faculty leave approved.') : 'Faculty leave rejected.'); await load()
    } catch (err) {
      setError(err.message || 'Unable to review faculty leave request')
      try { setFacultyDetail(normalizeFacultyLeaveDetail(unwrap(await request(`/faculty-leave-requests/${id}`)))) } catch { /* Keep the review error visible if detail loading fails. */ }
    }
    finally { setBusy(false) }
  }
  function openRejectConfirmation(id) {
    setError(''); setRejectReason(''); setRejectTarget(id)
  }
  function openApproveConfirmation(requestItem, mode = 'approve') {
    setError(''); setApprovalMode(mode); setApproveTarget(requestItem)
  }
  function confirmApprove() {
    if (!approveTarget) return
    void reviewFacultyRequest(approveTarget.id, 'approve', true)
  }
  async function openResolution(session, assignmentType) {
    if (!facultyDetail) return
    if (session?.isSyntheticBatch) {
      setError('This batch has no scheduled class on the selected leave date.')
      return
    }
    setError(''); setResolutionTarget(session); setResolutionType(assignmentType); setCombineSessions([]); setCombineSource(null)
    setResolutionForm({ replacementFacultyId: '', replacementStartTime: '', replacementEndTime: '', scheduleType: '', rescheduledDate: '', rescheduledStartTime: session.originalStartTime || '', rescheduledEndTime: session.originalEndTime || '', targetSessionId: '', reason: '' })
    if (assignmentType === 'REPLACEMENT' || assignmentType === 'COMBINED') {
      try {
        const eligible = unwrap(await request(`/faculty-leave-requests/${facultyDetail.id}/sessions/${session.id}/eligible-faculty?assignmentType=${assignmentType}`)) || {}
        const courseKey = String(session.courseId || '').trim().toLowerCase()
        const courseNameKey = String(session.courseName || '').trim().toLowerCase()
        const fallbackFaculty = Array.from(new Map(branchBatchGroups
          .filter(group => {
            const groupCourseKey = String(group.courseId || '').trim().toLowerCase()
            const groupCourseNameKey = String(group.courseName || '').trim().toLowerCase()
            return (courseKey && groupCourseKey === courseKey) || (courseNameKey && groupCourseNameKey === courseNameKey)
          })
          .map(group => [group.facultyId || group.branchFacultyId, { facultyId: group.facultyId || group.branchFacultyId, name: group.facultyName || group.facultyId, email: group.facultyEmail || '' }])
          .filter(([id]) => id && String(id).toLowerCase() !== String(facultyDetail.facultyId || facultyDetail.facultyId || '').toLowerCase()))
          .values())
        setReplacementFaculty(assignmentType === 'COMBINED' ? (eligible.faculty || []) : ((eligible.faculty || []).length ? eligible.faculty : fallbackFaculty))
        if (assignmentType === 'COMBINED') {
          setCombineSessions(eligible.combineSessions || [])
          setCombineSource(eligible.source || null)
        }
      }
      catch (err) { setError(err.message || 'Unable to load replacement faculty') }
    }
  }
  async function submitResolution() {
    if (!facultyDetail || !resolutionTarget) return
    const payload = { assignmentType: resolutionType, ...resolutionForm, ...(resolutionType === 'REPLACEMENT' ? { replacementDate: resolutionTarget.sessionDate } : {}) }
    if (resolutionType === 'REPLACEMENT' && !payload.replacementFacultyId) return setError('Select a replacement faculty')
    if (resolutionType === 'REPLACEMENT' && (!payload.replacementStartTime || !payload.replacementEndTime)) return setError('Select the replacement start and end time')
    if (resolutionType === 'REPLACEMENT' && clockMinutes(payload.replacementEndTime) <= clockMinutes(payload.replacementStartTime)) return setError('Replacement end time must be after start time')
    if (resolutionType === 'REPLACEMENT' && getFacultyTimingConflicts(payload.replacementFacultyId, branchBatchGroups, payload.replacementStartTime, payload.replacementEndTime).length) return setError('Replacement timing conflicts with an existing faculty batch')
    if (resolutionType === 'RESCHEDULED' && (!payload.rescheduledDate || !payload.rescheduledStartTime || !payload.rescheduledEndTime)) return setError('Complete the rescheduled date and time')
    if (resolutionType === 'RESCHEDULED' && payload.rescheduledDate === resolutionTarget.sessionDate) return setError('Select a new date after the original class date')
    if (resolutionType === 'RESCHEDULED' && scheduleTypeForDate(payload.rescheduledDate) !== payload.scheduleType) return setError('The selected date does not match the schedule type')
    if (resolutionType === 'COMBINED' && !payload.replacementFacultyId) return setError('Select a compatible faculty')
    if (resolutionType === 'COMBINED' && !payload.targetSessionId) return setError('Select a compatible session to combine')
    if (resolutionType === 'CANCELLED' && !payload.reason.trim()) return setError('Enter a cancellation reason')
    setBusy(true); setError('')
    try {
      await request(`/faculty-leave-requests/${facultyDetail.id}/sessions/${resolutionTarget.id}/resolve`, { method: 'POST', body: JSON.stringify(payload) })
      setResolutionTarget(null); setResolutionType(''); setFacultyDetail(normalizeFacultyLeaveDetail(unwrap(await request(`/faculty-leave-requests/${facultyDetail.id}`)))); await load()
    } catch (err) { setError(err.message || 'Unable to resolve affected class') }
    finally { setBusy(false) }
  }
  const leaves = (data?.leaves || []).filter(l => (!status || l.status === status) && `${l.leaveDate} ${l.reason}`.toLowerCase().includes(search.toLowerCase()))
  const leavePageSize = 5
  const leavePageCount = Math.max(1, Math.ceil(leaves.length / leavePageSize))
  const visibleLeaves = leaves.slice((leavePage - 1) * leavePageSize, leavePage * leavePageSize)
  const affectedBatches = detail ? Object.values((detail.affectedClasses || []).reduce((groups, item) => {
    const key = `${item.batchRecordId || item.batchId || item.batchName || 'batch'}:${item.startTime || ''}:${item.endTime || ''}`
    const current = groups[key] || { ...item, affectedStudents: 0 }
    current.affectedStudents += 1
    groups[key] = current
    return groups
  }, {})) : []
  return <section className="institute-leave-page">
    {approveTarget ? <div className="institute-success-popup" role="alertdialog" aria-modal="true"><div className="approval-confirmation-card"><button type="button" className="approval-confirmation-close" aria-label="Close confirmation" onClick={() => setApproveTarget(null)} disabled={busy}>×</button><strong>Confirm Approval</strong><p>Are you sure you want to approve this faculty leave request?</p><p><strong>{approveTarget.facultyName || 'Faculty'}</strong>{approveTarget.fromDate ? ` · ${formatLeaveDate(approveTarget.fromDate)}` : ''}</p><div className="institute-confirm-actions"><button type="button" className="institute-primary" onClick={confirmApprove} disabled={busy}>{busy ? 'Approving...' : 'OK'}</button></div></div></div> : null}
    {viewMode === 'faculty' ? <section className="faculty-request-readonly-panel">
      <header className="institute-leave-header"><div><p className="section-kicker">Branch Admin</p><h2>Faculty Leave Requests</h2><p>Review leave requests submitted by faculty in this branch.</p></div></header>
      {error ? <p role="alert" className="institute-error">{error}</p> : null}
      {message ? <p role="status" className="institute-success">{message}</p> : null}
      <div className="institute-table-scroll"><table><caption>Faculty leave requests</caption><thead><tr><th>S.No</th><th>Faculty</th><th>Leave dates</th><th>Type</th><th>Duration</th><th>Reason</th><th>Status</th><th>Affected classes</th><th>Actions</th></tr></thead><tbody>
        {facultyRequests.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><strong>{item.facultyName}</strong><small>{item.facultyId}</small></td><td>{formatLeaveDate(item.fromDate)}{item.fromDate !== item.toDate ? ` - ${formatLeaveDate(item.toDate)}` : ''}</td><td>{item.leaveType}</td><td>{item.durationType === 'HALF_DAY' ? `${item.halfDayStart || '-'} - ${item.halfDayEnd || '-'}` : item.durationType === 'PERMISSION' ? `${item.permissionHours} hour permission` : 'Full day'}</td><td>{item.reason}</td><td><span className={`faculty-leave-status status-${String(item.status || 'PENDING').toLowerCase()}`}>{item.status || 'PENDING'}</span></td><td>{item.affectedClassCount || 0}</td><td><div className="institute-action-menu"><button type="button" className="institute-action-menu-trigger" aria-label={'Actions for ' + item.facultyName} aria-expanded={openActionMenu === item.id} onClick={() => { if (openActionMenu === item.id) { setOpenActionMenu(null); setPinnedActionMenu(false) } else { setOpenActionMenu(item.id); setPinnedActionMenu(true) } }}><MoreVertical size={19} /></button>{openActionMenu === item.id ? <div className="institute-action-menu-dropdown" role="menu"><button type="button" role="menuitem" onClick={() => { setOpenActionMenu(null); setPinnedActionMenu(false); viewFacultyRequest(item) }}>Replace Faculty</button><button type="button" role="menuitem" disabled={busy || !['PENDING', 'UNDER_REVIEW'].includes(item.status) || (String(item.leaveType).toUpperCase() !== 'EMERGENCY' && Number(item.unresolvedSessionCount || 0) > 0)} onClick={() => { setOpenActionMenu(null); setPinnedActionMenu(false); openApproveConfirmation(item) }}>Approve</button>{String(item.leaveType).toUpperCase() === 'EMERGENCY' ? <button type="button" role="menuitem" disabled={busy || !['PENDING', 'UNDER_REVIEW'].includes(item.status)} onClick={() => { setOpenActionMenu(null); setPinnedActionMenu(false); openApproveConfirmation(item, 'delegate') }}>Approve &amp; Delegate</button> : null}<button type="button" role="menuitem" disabled={busy || !['PENDING', 'UNDER_REVIEW'].includes(item.status)} onClick={() => { setOpenActionMenu(null); setPinnedActionMenu(false); openRejectConfirmation(item.id) }}>Reject</button></div> : null}</div></td></tr>)}
        {!facultyRequests.length ? <tr><td colSpan="9">No faculty leave requests found.</td></tr> : null}
      </tbody></table></div>
      <dialog ref={facultyDialog} className="institute-dialog faculty-review-dialog" onCancel={event => { event.preventDefault(); close() }}>
        {rejectTarget ? <><div className="institute-leave-header"><h3>Reject Leave Request</h3><button type="button" aria-label="Close" onClick={close} disabled={busy}><X size={20} /></button></div><p className="institute-confirm-question">Are you sure you want to reject this faculty leave request?</p><label>Reason (optional)<textarea value={rejectReason} maxLength={500} onChange={event => setRejectReason(event.target.value)} placeholder="Add a reason for the faculty member" /></label><div className="institute-confirm-actions"><button type="button" onClick={close} disabled={busy}>Keep Request</button><button type="button" className="institute-danger-button" onClick={() => reviewFacultyRequest(rejectTarget, 'reject')} disabled={busy}>{busy ? 'Rejecting...' : 'Confirm Reject'}</button></div></> : resolutionTarget ? <div className="faculty-resolution-form"><div className="institute-leave-header"><div><p className="section-kicker">AFFECTED CLASS RESOLUTION</p><h3>{resolutionType === 'REPLACEMENT' ? 'Assign Replacement Faculty' : resolutionType === 'RESCHEDULED' ? 'Reschedule Class' : resolutionType === 'COMBINED' ? 'Combine Class' : 'Cancel Class'}</h3><p>{resolutionTarget.batchName || resolutionTarget.batchId} · {formatLeaveDate(resolutionTarget.sessionDate)} · {formatClassTime(resolutionTarget.originalStartTime)} - {formatClassTime(resolutionTarget.originalEndTime)}</p></div><button type="button" aria-label="Close" onClick={close} disabled={busy}><X size={20} /></button></div>{error ? <p role="alert" className="institute-error">{error}</p> : null}{resolutionType === 'REPLACEMENT' ? <label>Replacement faculty<select value={resolutionForm.replacementFacultyId} onChange={event => setResolutionForm({ ...resolutionForm, replacementFacultyId: event.target.value })}><option value="">Select faculty</option>{replacementFaculty.map(faculty => <option key={faculty.facultyId} value={faculty.facultyId}>{faculty.name} ({faculty.facultyId})</option>)}</select></label> : null}{resolutionType === 'REPLACEMENT' && resolutionForm.replacementFacultyId ? <SelectedFacultyBatches facultyId={resolutionForm.replacementFacultyId} groups={branchBatchGroups} /> : null}{resolutionType === 'REPLACEMENT' && resolutionForm.replacementFacultyId ? <div className="faculty-replacement-timing"><strong>Replacement timing</strong><div><ClockTimePicker label="Start time" value={resolutionForm.replacementStartTime} onChange={value => setResolutionForm({ ...resolutionForm, replacementStartTime: value })} /><ClockTimePicker label="End time" value={resolutionForm.replacementEndTime} onChange={value => setResolutionForm({ ...resolutionForm, replacementEndTime: value })} /></div><ReplacementTimingStatus facultyId={resolutionForm.replacementFacultyId} groups={branchBatchGroups} startTime={resolutionForm.replacementStartTime} endTime={resolutionForm.replacementEndTime} /></div> : null}{resolutionType === 'RESCHEDULED' ? <><div className="faculty-resolution-grid"><label>New date<input type="date" min={resolutionTarget?.sessionDate ? nextDateKey(resolutionTarget.sessionDate) : undefined} value={resolutionForm.rescheduledDate} onChange={event => setResolutionForm({ ...resolutionForm, rescheduledDate: event.target.value, scheduleType: scheduleTypeForDate(event.target.value) })} /></label><label>Schedule type<input type="text" value={resolutionForm.scheduleType ? (resolutionForm.scheduleType === 'WEEKEND' ? 'Weekend' : 'Weekday') : ''} placeholder="Select date" readOnly /></label></div>{resolutionForm.rescheduledDate ? <RescheduleAvailability facultyId={facultyDetail?.facultyId} groups={branchBatchGroups} date={resolutionForm.rescheduledDate} startTime={resolutionForm.rescheduledStartTime} endTime={resolutionForm.rescheduledEndTime} leaveId={facultyDetail?.id} sessionId={resolutionTarget?.id} /> : null}{resolutionForm.rescheduledDate ? <div className="faculty-resolution-grid"><ClockTimePicker label="Start time" value={resolutionForm.rescheduledStartTime} onChange={value => setResolutionForm({ ...resolutionForm, rescheduledStartTime: value })} /><ClockTimePicker label="End time" value={resolutionForm.rescheduledEndTime} onChange={value => setResolutionForm({ ...resolutionForm, rescheduledEndTime: value })} /></div> : null}</> : null}{resolutionType === 'COMBINED' ? <><label>Compatible faculty<select value={resolutionForm.replacementFacultyId} onChange={event => setResolutionForm({ ...resolutionForm, replacementFacultyId: event.target.value, targetSessionId: '' })}><option value="">Select faculty</option>{replacementFaculty.map(faculty => <option key={faculty.facultyId} value={faculty.facultyId}>{faculty.name} ({faculty.facultyId})</option>)}</select></label>{resolutionForm.replacementFacultyId ? <label>Compatible batch<select value={resolutionForm.targetSessionId} onChange={event => setResolutionForm({ ...resolutionForm, targetSessionId: event.target.value })}><option value="">Select batch</option>{combineSessions.filter(item => item.facultyId === resolutionForm.replacementFacultyId && item.courseId === resolutionTarget.courseId && item.sessionDate === resolutionTarget.sessionDate && item.originalStartTime === resolutionTarget.originalStartTime && item.originalEndTime === resolutionTarget.originalEndTime).map(item => <option key={item.id} value={item.id}>{item.batchName} · {formatClassTime(item.originalStartTime)} - {formatClassTime(item.originalEndTime)} · {item.moduleName || 'Module'} · {item.moduleProgress ?? item.courseProgress ?? 'N/A'}%</option>)}</select></label> : null}</> : null}<label>{resolutionType === 'CANCELLED' ? 'Cancellation reason' : 'Notes (optional)'}<textarea value={resolutionForm.reason} onChange={event => setResolutionForm({ ...resolutionForm, reason: event.target.value })} placeholder="Add notes for this resolution" /></label><div className="institute-confirm-actions"><button type="button" onClick={() => { setResolutionTarget(null); setResolutionType(''); setError('') }} disabled={busy}>Back</button><button type="button" className="institute-primary" onClick={submitResolution} disabled={busy}>{busy ? 'Saving...' : 'Save Resolution'}</button></div></div> : facultyDetail ? <div className="faculty-leave-review-detail"><div className="institute-leave-header"><div><p className="section-kicker">FACULTY LEAVE REVIEW</p><h3>{facultyDetail.facultyName}</h3><p>{facultyDetail.leaveType} · {formatLeaveDate(facultyDetail.fromDate)}{facultyDetail.fromDate !== facultyDetail.toDate ? ` - ${formatLeaveDate(facultyDetail.toDate)}` : ''}</p></div><button type="button" aria-label="Close" onClick={close} disabled={busy}><X size={20} /></button></div><p>{facultyDetail.reason}</p><div className="institute-table-scroll"><table><thead><tr><th>Batch</th><th>Date</th><th>Time</th><th>Resolution</th><th>Actions</th></tr></thead><tbody>{(facultyDetail.affectedSessions || []).map(session => <tr key={session.id}><td>{session.batchName || session.batchId || '-'}</td><td>{formatLeaveDate(session.sessionDate)}</td><td>{formatClassTime(session.originalStartTime)} - {formatClassTime(session.originalEndTime)}</td><td><span className={`faculty-leave-status status-${String(session.resolutionStatus || 'UNRESOLVED').toLowerCase()}`}>{session.statusLabel}</span></td><td>{session.resolutionStatus === 'UNRESOLVED' ? <><button type="button" onClick={() => openResolution(session, 'REPLACEMENT')}>Replace</button><button type="button" onClick={() => openResolution(session, 'RESCHEDULED')}>Reschedule</button><button type="button" onClick={() => openResolution(session, 'COMBINED')}>Combine</button></> : session.resolutionStatus === 'NO_SCHEDULED_CLASS' ? 'No action' : 'Resolved'}</td></tr>)}</tbody></table></div><div className="institute-confirm-actions">{['PENDING', 'UNDER_REVIEW'].includes(facultyDetail.status) ? (facultyDetail.affectedSessions || []).some(session => session.resolutionStatus === 'UNRESOLVED') ? <><button type="button" className="institute-danger-button" onClick={() => openRejectConfirmation(facultyDetail.id)} disabled={busy}>Reject</button><button type="button" className="institute-primary" onClick={() => reviewFacultyRequest(facultyDetail.id, 'approve')} disabled={busy}>Approve</button></> : <button type="button" onClick={close} disabled={busy}>Cancel</button> : null}</div></div> : null}
      {resolutionType === 'COMBINED' && resolutionTarget && combineSource ? <div className="faculty-combine-current-details"><strong>Selected Leave Batch: {combineSource.batchName || resolutionTarget.batchName || combineSource.batchId || '-'}</strong><span>Batch ID: {combineSource.batchId || '-'}</span><span>Course: {combineSource.courseName || resolutionTarget.courseName || '-'}</span><span>Current Module: {combineSource.moduleName || '-'}</span><span>Current Sub-Module: {combineSource.currentSubmoduleName || '-'}</span><span>Course Progress: {combineSource.courseProgress ?? 0}%</span>{resolutionForm.replacementFacultyId && !combineSessions.some(item => item.facultyId === resolutionForm.replacementFacultyId) ? <em>No matching batches available for Combine.</em> : null}</div> : null}
      </dialog>
    </section> : <>
    <header className="institute-leave-header"><div className="institute-leave-heading"><span className="institute-heading-icon"><CalendarDays size={34} /></span><div><p className="section-kicker">Management</p><h2>Institute Leave</h2><p>Manage institute-wide leaves and schedule changes</p></div></div>
      <button className="institute-primary" onClick={() => { setError(''); setFieldErrors({}); setForm({ leaveDate: formDate(data?.today), reason: '' }) }} disabled={!data}><Plus size={18} /> Cancel Class</button></header>
    {error && !open ? <p role="alert" className="institute-error">{error}</p> : null}
    {message ? <p role="status" className="institute-success">{message}</p> : null}
    <div className="institute-leave-stats">{[
      { label: "Today's Leave", key: 'today', icon: CalendarCheck2, tone: 'red', note: 'Leave declared today' },
      { label: 'Upcoming Leave', key: 'upcoming', icon: CalendarClock, tone: 'blue', note: 'Next scheduled leave' },
      { label: 'This Month', key: 'thisMonth', icon: BarChart3, tone: 'green', note: 'Leave days' },
      { label: 'Affected Classes', key: 'affectedClasses', icon: UsersRound, tone: 'purple', note: 'Classes affected' },
    ].map(({ label, key, icon: Icon, tone, note }) => <article key={key} className={`leave-stat-card tone-${tone}`}><span className="leave-stat-icon"><Icon size={27} /></span><div className="leave-stat-copy"><span>{label}</span><strong>{data?.summary?.[key] ?? '—'}</strong><small>{note}</small></div></article>)}</div>
    <div className="institute-leave-filters"><input aria-label="Search leave history" placeholder="Search date or reason" value={search} onChange={e => { setSearch(e.target.value); setLeavePage(1) }} /><select aria-label="Leave status" value={status} onChange={e => { setStatus(e.target.value); setLeavePage(1) }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Cancelled</option></select></div>
    <div className="institute-table-scroll"><table><caption>Leave history</caption><thead><tr><th>S.No</th><th>Date</th><th>Reason</th><th>Status</th><th>Affected classes</th><th>Actions</th></tr></thead><tbody>
      {visibleLeaves.map((leave, index) => <tr key={leave.id} className="institute-leave-row-clickable" onClick={event => { if (!event.target.closest('button')) view(leave) }} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) { event.preventDefault(); view(leave) } }} tabIndex={0}><td>{(leavePage - 1) * leavePageSize + index + 1}</td><td>{formatLeaveDate(leave.leaveDate)}</td><td>{leave.reason}</td><td>{leave.status === 'ACTIVE' ? 'Active' : 'Cancelled'}</td><td>{leave.affectedClassCount}</td><td><div className="institute-action-menu" onMouseEnter={() => { if (!pinnedActionMenu) setOpenActionMenu(leave.id) }} onMouseLeave={() => { if (!pinnedActionMenu) setOpenActionMenu(null) }}><button type="button" className="institute-action-menu-trigger" aria-label={`Actions for ${formatLeaveDate(leave.leaveDate)}`} aria-expanded={openActionMenu === leave.id} onClick={() => { if (openActionMenu === leave.id && pinnedActionMenu) { setOpenActionMenu(null); setPinnedActionMenu(false); return } setOpenActionMenu(leave.id); setPinnedActionMenu(true) }}><MoreVertical size={19} /></button>{openActionMenu === leave.id ? <div className="institute-action-menu-dropdown" role="menu" onMouseEnter={() => setOpenActionMenu(leave.id)}><button type="button" role="menuitem" onClick={() => { setOpenActionMenu(null); setPinnedActionMenu(false); view(leave) }}>View</button>{leave.status === 'ACTIVE' ? <><button type="button" role="menuitem" onClick={() => { setOpenActionMenu(null); setPinnedActionMenu(false); setError(''); setForm(leave) }}>Edit</button><button type="button" role="menuitem" onClick={() => { setOpenActionMenu(null); setPinnedActionMenu(false); setError(''); setCancel(leave) }}>Cancel</button></> : null}</div> : null}</div></td></tr>)}
      {!leaves.length ? <tr><td colSpan="6">{data ? 'No leaves found.' : 'Loading leave history…'}</td></tr> : null}
    </tbody></table></div>
    {leaves.length > leavePageSize ? <div className="institute-pagination"><span>Page {Math.min(leavePage, leavePageCount)} of {leavePageCount}</span><div><button type="button" disabled={leavePage === 1} onClick={() => setLeavePage(page => Math.max(1, page - 1))}>Previous</button><button type="button" disabled={leavePage >= leavePageCount} onClick={() => setLeavePage(page => Math.min(leavePageCount, page + 1))}>Next</button></div></div> : null}
    <dialog ref={dialog} className={`institute-dialog ${cancel ? 'is-confirmation' : ''}`.trim()} onCancel={event => { event.preventDefault(); close() }}>
      <div className="institute-leave-header"><h3>{facultyDetail ? 'Faculty Leave Review' : detail ? 'Leave details' : cancel ? 'Cancel Institute Leave' : form?.id ? 'Edit Institute Leave' : 'Declare Leave'}</h3><button type="button" aria-label="Close" onClick={close} disabled={busy}><X size={20} /></button></div>
      {error ? <p role="alert" className="institute-error">{error}</p> : null}
      {form ? <form onSubmit={save} noValidate><label>Leave Date *<input type="date" min={form.id ? undefined : data?.today} value={form.leaveDate} onChange={e => { setForm({ ...form, leaveDate: e.target.value }); setFieldErrors(current => ({ ...current, leaveDate: '' })) }} />{fieldErrors.leaveDate ? <small className="institute-field-error">{fieldErrors.leaveDate}</small> : null}</label><label>Reason *<textarea maxLength={1000} value={form.reason} onChange={e => { setForm({ ...form, reason: e.target.value }); setFieldErrors(current => ({ ...current, reason: '' })) }} />{fieldErrors.reason ? <small className="institute-field-error">{fieldErrors.reason}</small> : null}</label><button className="institute-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Leave'}</button></form> : null}
      {cancel ? <form onSubmit={save}><p className="institute-confirm-question">Are you sure you want to cancel this leave?</p><p>Leave date: <strong>{formatLeaveDate(cancel.leaveDate)}</strong></p><p>This will restore the affected future classes and recalculate schedules.</p><div className="institute-confirm-actions"><button type="button" onClick={close} disabled={busy}>Keep Leave</button><button className="institute-primary" disabled={busy}>{busy ? 'Cancelling…' : 'Confirm Cancel'}</button></div></form> : null}
      {facultyDetail ? <div className="faculty-leave-review-detail"><p><strong>{facultyDetail.facultyName}</strong> · {facultyDetail.leaveType} · {formatLeaveDate(facultyDetail.fromDate)}{facultyDetail.fromDate !== facultyDetail.toDate ? ` - ${formatLeaveDate(facultyDetail.toDate)}` : ''}</p><p>{facultyDetail.reason}</p>{(facultyDetail.affectedSessions || []).some(session => session.resolutionStatus === 'UNRESOLVED') ? <p role="alert" className="institute-error">Resolve every affected class below before approving this leave request.</p> : null}<div className="institute-table-scroll"><table><thead><tr><th>Batch</th><th>Date</th><th>Time</th><th>Resolution</th><th>Actions</th></tr></thead><tbody>{(facultyDetail.affectedSessions || []).map(session => <tr key={session.id}><td>{session.batchName}</td><td>{formatLeaveDate(session.sessionDate)}</td><td>{formatClassTime(session.originalStartTime)} - {formatClassTime(session.originalEndTime)}</td><td><span className={`faculty-leave-status status-${String(session.resolutionStatus || 'UNRESOLVED').toLowerCase()}`}>{session.statusLabel}</span></td><td>{session.resolutionStatus === 'UNRESOLVED' ? <><button type="button" onClick={() => openResolution(session, 'REPLACEMENT')}>Replace</button><button type="button" onClick={() => openResolution(session, 'RESCHEDULED')}>Reschedule</button><button type="button" onClick={() => openResolution(session, 'COMBINED')}>Combine</button></> : 'Resolved'}</td></tr>)}</tbody></table></div>{['PENDING', 'UNDER_REVIEW'].includes(facultyDetail.status) ? <div className="institute-confirm-actions"><button type="button" onClick={() => openRejectConfirmation(facultyDetail.id)} disabled={busy}>Reject</button><button type="button" className="institute-primary" onClick={() => reviewFacultyRequest(facultyDetail.id, 'approve')} disabled={busy || (facultyDetail.affectedSessions || []).some(session => session.resolutionStatus === 'UNRESOLVED')} title={(facultyDetail.affectedSessions || []).some(session => session.resolutionStatus === 'UNRESOLVED') ? 'Resolve all affected classes first' : 'Approve leave request'}>Approve</button></div> : null}</div> : null}
      {detail ? <div><p><strong>{formatLeaveDate(detail.leaveDate)}</strong> · {detail.status === 'ACTIVE' ? 'Active' : 'Cancelled'}</p><p>{detail.reason}</p><p>{detail.affectedClassCount} classes · {detail.affectedStudentCount} students · {detail.affectedFacultyCount} faculty</p><p>Declared: {formatDeclaredAt(detail.declaredAt, data?.timezone)}</p><div className="institute-table-scroll"><table><thead><tr><th>Affected Batch</th><th>Class Time</th><th>Students</th><th>Hours</th></tr></thead><tbody>{affectedBatches.map((item, index) => <tr key={`${item.batchRecordId || item.batchName}-${item.startTime}-${index}`}><td><strong>{item.batchName || item.batchId || 'Batch'}</strong></td><td>{formatClassTime(item.startTime)} – {formatClassTime(item.endTime)}</td><td>{item.affectedStudents}</td><td>{item.scheduledHours}</td></tr>)}</tbody></table></div>{!detail.affectedClassCount ? <p>No scheduled batches affected.</p> : null}</div> : null}
    </dialog>
    {successPopup ? <div className="institute-success-popup" role="alertdialog" aria-modal="true"><div><strong>Success</strong><p>{successPopup}</p><button type="button" className="institute-primary" onClick={() => setSuccessPopup('')}>OK</button></div></div> : null}
    </>}
  </section>
}

function formDate(value) {
  if (value) return value
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
