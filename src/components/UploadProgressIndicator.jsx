import { CheckCircle2, CloudUpload, LoaderCircle, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { dismissUpload, getUploadSnapshot, subscribeUploadProgress } from '../lib/uploadProgressStore'
import { loadSession } from '../lib/session'
import { listActiveLeadImports } from '../services/leadImportService'

function statusText(item) {
  if (item.status === 'FAILED') return item.error || 'Upload failed'
  if (['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(String(item.status || '').toUpperCase())) {
    const completedAt = item.completedAt || item.updatedAt
    const timestamp = completedAt ? new Date(completedAt).getTime() : NaN
    const elapsed = Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : null
    const minutes = elapsed === null ? null : Math.floor(elapsed / 60000)
    const ago = minutes === null ? '' : minutes < 1 ? 'just now' : minutes === 1 ? '1 min ago' : `${minutes} mins ago`
    const label = item.status === 'COMPLETED_WITH_ERRORS' ? 'Upload completed with warnings' : 'Upload completed'
    return ago ? `${label} · ${ago}` : label
  }
  return `${Math.max(0, Math.min(100, Number(item.progress || 0)))}% uploading`
}

function isRunning(item) {
  return ['PENDING', 'RUNNING'].includes(String(item?.status || '').toUpperCase())
}

export function UploadProgressIndicator() {
  const [uploads, setUploads] = useState(getUploadSnapshot())
  const [sharedLeadUploads, setSharedLeadUploads] = useState([])
  const [dismissedRemoteIds, setDismissedRemoteIds] = useState([])
  const [open, setOpen] = useState(false)
  const [, setClock] = useState(Date.now())

  useEffect(() => subscribeUploadProgress(() => setUploads([...getUploadSnapshot()])), [])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!loadSession()?.user?.id && !loadSession()?.user?.userId) return undefined
    let active = true
    const refresh = async () => {
      try {
        const response = await listActiveLeadImports()
        const jobs = response?.data || response || []
        if (active) setSharedLeadUploads(Array.isArray(jobs) ? jobs : [])
      } catch {
        if (active) setSharedLeadUploads([])
      }
    }
    void refresh()
    const timer = window.setInterval(refresh, 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  const sessionUser = loadSession()?.user || {}
  const currentUserId = String(sessionUser.id || sessionUser.userId || '')
  const localVisibleUploads = uploads.filter((item) => item.type !== 'lead' || (currentUserId && item.visibleTo?.includes(currentUserId)))
  const remoteVisibleUploads = sharedLeadUploads.map((job) => ({ id: `server-${job.id}`, type: 'lead', uploadId: job.uploadId, label: job.fileName || 'Lead workbook', status: job.status, progress: job.progress, processed: job.processedRows, total: job.totalRows, completedAt: job.completedAt, updatedAt: job.updatedAt })).filter((item) => !dismissedRemoteIds.includes(item.id))
  const visibleUploads = [...localVisibleUploads, ...remoteVisibleUploads.filter((remote) => !localVisibleUploads.some((local) => local.uploadId && local.uploadId === remote.uploadId))]
  const activeCount = visibleUploads.filter(isRunning).length
  const activeUpload = visibleUploads.find(isRunning)
  const activeProgress = Math.max(0, Math.min(100, Number(activeUpload?.progress || 0)))
  if (!visibleUploads.length) return null

  return <div className="upload-progress-menu">
    <button type="button" className={`upload-progress-button${activeCount ? ' is-active' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Upload progress">
      <CloudUpload size={17} />
      <span>{activeCount ? `${activeCount} upload${activeCount === 1 ? '' : 's'}` : 'Uploads'}</span>
      {activeCount ? <b>{activeCount}</b> : null}
      {activeCount ? <span className="upload-progress-button-meter" aria-hidden="true"><i style={{ width: `${activeProgress || 28}%` }} /></span> : null}
    </button>
    {open ? <div className="upload-progress-popover" role="status">
      <div className="upload-progress-popover-head"><strong>Upload activity</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close upload activity">×</button></div>
      <div className="upload-progress-list">{visibleUploads.slice(0, 5).map((item) => <article key={item.id} className={`upload-progress-item is-${String(item.status || '').toLowerCase()}`}>
        <span className="upload-progress-item-icon">{isRunning(item) ? <LoaderCircle className="upload-progress-spin" size={16} /> : item.status === 'FAILED' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}</span>
        <div><strong title={item.label}>{item.label}</strong><small>{statusText(item)}</small>{isRunning(item) ? <div className={`upload-progress-track${Number(item.progress || 0) <= 0 ? ' is-indeterminate' : ''}`}><i style={{ width: `${Math.max(0, Math.min(100, Number(item.progress || 0))) || 28}%` }} /></div> : null}</div>
        {!isRunning(item) ? <button type="button" onClick={() => item.id.startsWith('server-') ? setDismissedRemoteIds((current) => [...current, item.id]) : dismissUpload(item.id)} aria-label={`Dismiss ${item.label}`}>×</button> : null}
      </article>)}</div>
    </div> : null}
  </div>
}
