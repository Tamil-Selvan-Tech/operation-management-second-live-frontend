import { useCallback, useEffect, useState } from 'react'
import { Pencil, RefreshCw, Save, X } from 'lucide-react'
import { listLeadImportHistory, updateLeadImportDeadline } from '../services/leadImportService'
import '../styles/LeadUploadHistory.css'

const unwrap = (response) => response?.data ?? response ?? []
const errorText = (error) => error?.body?.message || error?.message || 'Unable to load upload history.'
const dateText = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-'
const inputDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : ''
const today = () => new Date().toISOString().slice(0, 10)

export function LeadUploadHistory({ onClose, canEdit = true }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [editingId, setEditingId] = useState('')
  const [draftDeadline, setDraftDeadline] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = unwrap(await listLeadImportHistory())
      setItems(Array.isArray(result) ? result : [])
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const beginEdit = (item) => {
    setNotice('')
    setError('')
    setEditingId(item.id)
    setDraftDeadline(inputDate(item.deadlineAt))
  }

  const save = async (item) => {
    if (!draftDeadline || savingId) return
    setSavingId(item.id)
    setError('')
    setNotice('')
    try {
      await updateLeadImportDeadline(item.id, draftDeadline)
      setEditingId('')
      setNotice('Deadline updated. The previous notification schedule is now inactive.')
      await load()
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setSavingId('')
    }
  }

  return (
    <div className="lead-history-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.() }}>
      <section className="lead-history-dialog" role="dialog" aria-modal="true" aria-labelledby="lead-history-title">
        <header className="lead-history-header"><div><p>SALES CRM</p><h2 id="lead-history-title">Excel Upload History</h2><span>Review progress and edit the active deadline for pending leads.</span></div><div className="lead-history-actions"><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh history"><RefreshCw size={16} className={loading ? 'lead-history-spin' : ''} /></button><button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></div></header>
        {error ? <div className="lead-history-message is-error" role="alert">{error}</div> : null}
        {notice ? <div className="lead-history-message is-success">{notice}</div> : null}
        {loading ? <div className="lead-history-empty">Loading upload history...</div> : items.length ? <div className="lead-history-list">{items.map((item) => {
          const pending = Number(item.pendingLeadCount ?? item.pendingRows ?? 0)
          const completed = Number(item.completedLeadCount ?? item.activeRows ?? 0)
          const editing = editingId === item.id
          return <article className="lead-history-card" key={item.id}>
            <div className="lead-history-card-main"><div><strong>{item.fileName || item.uploadId || 'Lead workbook'}</strong><small>Uploaded {dateText(item.createdAt)} by {item.uploadedBy?.fullName || 'Super Admin'}</small></div><span className={`lead-history-status is-${String(item.progressStatus || item.status || '').toLowerCase()}`}>{item.progressStatus || item.status || 'IN PROGRESS'}</span></div>
            <div className="lead-history-meta"><span>Assigned to <b>{item.assignedTo?.fullName || 'Account'}</b></span><span>Completed <b>{completed}</b></span><span>Pending <b>{pending}</b></span><span>Current deadline <b>{dateText(item.deadlineAt)}</b></span></div>
            {canEdit ? <div className="lead-history-edit">{editing ? <><input type="date" value={draftDeadline} min={today()} onChange={(event) => setDraftDeadline(event.target.value)} aria-label="New completion deadline" /><button type="button" className="is-primary" onClick={() => void save(item)} disabled={!draftDeadline || savingId === item.id}><Save size={15} />{savingId === item.id ? 'Saving...' : 'Save deadline'}</button><button type="button" onClick={() => setEditingId('')} disabled={Boolean(savingId)}>Cancel</button></> : <button type="button" onClick={() => beginEdit(item)} disabled={!pending}><Pencil size={15} />{pending ? 'Edit / Extend deadline' : 'All leads completed'}</button>}</div> : null}
            {item.history?.length ? <details className="lead-history-changes"><summary>View deadline / assignment history ({item.history.length})</summary>{item.history.map((change) => <div key={change.id}><span>{dateText(change.createdAt)}</span><span>{dateText(change.previousDeadlineAt)} → {dateText(change.newDeadlineAt)}</span><b>{change.leadCount} leads</b></div>)}</details> : null}
          </article>
        })}</div> : <div className="lead-history-empty">No Excel uploads found.</div>}
      </section>
    </div>
  )
}
