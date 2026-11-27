import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, LoaderCircle, MoreVertical, X } from 'lucide-react'
import { request } from '../services/apiClient'
import '../styles/SalesAdminLeaveManagementPage.css'

const LEAVE_TYPES = [
  { value: 'PERMISSION', label: 'Permission' },
  { value: 'HALF_DAY', label: 'Half Day Leave' },
  { value: 'FULL_DAY', label: 'Full Day Leave' },
]
const initialForm = { leaveType: 'FULL_DAY', startDate: '', endDate: '', duration: '1', startTime: '', endTime: '', reason: '' }

function dateInputValue(date) { const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return localDate.toISOString().slice(0, 10) }
function formatDate(value) { if (!value) return '-'; const date = new Date(`${String(value).slice(0, 10)}T00:00:00`); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date) }
function labelForLeaveType(value) { return LEAVE_TYPES.find((item) => item.value === String(value).toUpperCase())?.label || value || '-' }
function unwrapRequests(response) { return response?.data?.requests || response?.requests || response?.data?.leaveRequests || response?.leaveRequests || [] }
function canManageRequest(item) { if (String(item.status || '').toUpperCase() !== 'PENDING') return false; const deadline = new Date(`${String(item.startDate).slice(0, 10)}T${item.leaveType === 'FULL_DAY' ? '00:00' : (item.startTime || '00:00')}:00`); return Date.now() < deadline.getTime() }

export default function SalesAdminLeaveManagementPage() {
  const today = useMemo(() => dateInputValue(new Date()), [])
  const [requests, setRequests] = useState([])
  const [form, setForm] = useState({ ...initialForm })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState('')
  const [cancelItem, setCancelItem] = useState(null)
  const loadRequests = useCallback(async () => { try { const response = await request('/sales-admin/leave-requests'); setRequests(unwrapRequests(response)); setError('') } catch (reason) { setError(reason?.body?.message || reason?.message || 'Unable to load leave requests.') } finally { setLoading(false) } }, [])
  useEffect(() => { const refreshId = window.setInterval(() => { void loadRequests() }, 30000); queueMicrotask(() => { void loadRequests() }); return () => window.clearInterval(refreshId) }, [loadRequests])
  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const closeModal = () => { if (!saving) { setIsModalOpen(false); setError('') } }
  const openModal = (item = null) => { setSuccess(''); setError(''); setEditingId(item?.id || ''); setForm(item ? { leaveType: item.leaveType, startDate: String(item.startDate).slice(0, 10), endDate: String(item.endDate || item.startDate).slice(0, 10), duration: String(item.duration || 1), startTime: item.startTime || '', endTime: item.endTime || '', reason: item.reason || '' } : { ...initialForm, startDate: today, endDate: today }); setIsModalOpen(true) }
  const submit = async (event) => {
    event.preventDefault(); setError('')
    if (!form.leaveType || !form.startDate || !form.reason.trim()) return setError('Leave type, leave date and reason are required.')
    if (form.leaveType === 'FULL_DAY' && !form.endDate) return setError('End date is required for full-day leave.')
    if (form.endDate && form.endDate < form.startDate) return setError('End date cannot be earlier than start date.')
    if (form.leaveType !== 'FULL_DAY' && (!form.startTime || !form.endTime)) return setError('Start time and end time are required for this leave type.')
    if (form.startTime && form.endTime && form.endTime <= form.startTime) return setError('End time must be later than start time.')
    setSaving(true)
    try { const payload = { leaveType: form.leaveType, startDate: form.startDate, endDate: form.leaveType === 'FULL_DAY' ? form.endDate : form.startDate, duration: Number(form.duration) || 1, startTime: form.leaveType === 'FULL_DAY' ? null : form.startTime, endTime: form.leaveType === 'FULL_DAY' ? null : form.endTime, reason: form.reason.trim() }; await request(editingId ? `/sales-admin/leave-requests/${editingId}` : '/sales-admin/leave-requests', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); setIsModalOpen(false); setEditingId(''); setSuccess(editingId ? 'Leave request updated successfully.' : 'Leave request submitted successfully.'); setForm({ ...initialForm }); await loadRequests() } catch (reason) { setError(reason?.body?.message || reason?.message || 'Unable to save leave request.') } finally { setSaving(false) }
  }
  const cancelRequest = async () => { if (!cancelItem || saving) return; setSaving(true); setError(''); try { await request(`/sales-admin/leave-requests/${cancelItem.id}/cancel`, { method: 'POST' }); setCancelItem(null); setSuccess('Leave request cancelled successfully.'); await loadRequests() } catch (reason) { setError(reason?.body?.message || reason?.message || 'Unable to cancel leave request.') } finally { setSaving(false) } }
  return <section className="sales-admin-leave-page">
    <header className="sales-admin-leave-header"><div><p className="sales-admin-leave-eyebrow">ATTENDANCE &amp; TIME OFF</p><h2>Leave Management</h2><p>Submit a request and track its approval status.</p></div><button type="button" className="sales-admin-leave-primary" onClick={openModal}><CalendarDays size={17} /> Leave Request</button></header>
    {success ? <div className="sales-admin-leave-feedback is-success" role="status"><CheckCircle2 size={16} />{success}</div> : null}{error && !isModalOpen ? <div className="sales-admin-leave-feedback is-error" role="alert">{error}</div> : null}
    <div className="sales-admin-leave-card"><div className="sales-admin-leave-card-heading"><div><h3>Request History</h3><p>Your latest leave requests appear here.</p></div><Clock3 size={20} /></div>{loading ? <div className="sales-admin-leave-state"><LoaderCircle className="sales-admin-leave-spinner" size={18} /> Loading requests...</div> : <div className="sales-admin-leave-table-wrap"><table className="sales-admin-leave-table"><thead><tr><th>S.No</th><th>Request Date</th><th>Sales Admin Name</th><th>Sales Admin ID</th><th>Leave Type</th><th>Leave Date</th><th>Duration</th><th>Status</th></tr></thead><tbody>{requests.map((item, index) => <tr key={item.id || index}><td>{index + 1}</td><td>{formatDate(item.createdAt || item.requestDate)}</td><td>{item.salesAdminName || item.salesAdmin?.fullName || item.salesAdmin?.name || '-'}</td><td>{item.salesAdminId || item.salesAdmin?.userCode || '-'}</td><td>{labelForLeaveType(item.leaveType)}</td><td>{formatDate(item.startDate || item.leaveDate)}{item.endDate && String(item.endDate).slice(0, 10) !== String(item.startDate || item.leaveDate).slice(0, 10) ? ` – ${formatDate(item.endDate)}` : ''}</td><td>{item.duration || 1} day{Number(item.duration) === 1 ? '' : 's'}</td><td><span className={`sales-admin-leave-status is-${String(item.status || 'PENDING').toLowerCase()}`}>{item.status || 'PENDING'}</span></td></tr>)}{!requests.length ? <tr><td colSpan="8" className="sales-admin-leave-empty">No leave requests found.</td></tr> : null}</tbody></table></div>}</div>
    {isModalOpen ? <div className="sales-admin-leave-modal-backdrop" role="presentation"><form className="sales-admin-leave-modal" onSubmit={submit} noValidate><div className="sales-admin-leave-modal-header"><div><p className="sales-admin-leave-eyebrow">NEW REQUEST</p><h3>Apply for Leave</h3></div><button type="button" className="sales-admin-leave-close" onClick={closeModal} aria-label="Close"><X size={18} /></button></div>{error ? <div className="sales-admin-leave-feedback is-error" role="alert">{error}</div> : null}<div className="sales-admin-leave-form-grid"><label>Leave Type *<select value={form.leaveType} onChange={(event) => updateForm('leaveType', event.target.value)}>{LEAVE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Leave Date *<input type="date" min={today} value={form.startDate} onChange={(event) => { updateForm('startDate', event.target.value); if (form.leaveType !== 'FULL_DAY') updateForm('endDate', event.target.value) }} /></label>{form.leaveType === 'FULL_DAY' ? <label>End Date *<input type="date" min={form.startDate || today} value={form.endDate} onChange={(event) => updateForm('endDate', event.target.value)} /></label> : null}<label>Duration (days) *<input type="number" min="1" step="1" value={form.duration} onChange={(event) => updateForm('duration', event.target.value)} /></label>{form.leaveType !== 'FULL_DAY' ? <><label>Start Time *<input type="time" value={form.startTime} onChange={(event) => updateForm('startTime', event.target.value)} /></label><label>End Time *<input type="time" value={form.endTime} onChange={(event) => updateForm('endTime', event.target.value)} /></label></> : null}<label className="sales-admin-leave-reason">Reason *<textarea rows="4" maxLength="1000" value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} placeholder="Explain the reason for your leave" /></label></div><div className="sales-admin-leave-modal-actions"><button type="button" className="sales-admin-leave-cancel" onClick={closeModal} disabled={saving}>Cancel</button><button type="submit" className="sales-admin-leave-submit" disabled={saving}>{saving ? <><LoaderCircle className="sales-admin-leave-spinner" size={16} /> Submitting...</> : 'Submit Request'}</button></div></form></div> : null}
  </section>
}
