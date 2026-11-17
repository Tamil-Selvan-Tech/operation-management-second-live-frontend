import { CheckCircle2, CloudUpload, LoaderCircle, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { dismissUpload, getUploadSnapshot, subscribeUploadProgress } from '../lib/uploadProgressStore'

function statusText(item) {
  if (item.status === 'FAILED') return item.error || 'Upload failed'
  if (['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(String(item.status || '').toUpperCase())) return item.status === 'COMPLETED_WITH_ERRORS' ? 'Upload completed with warnings' : 'Upload completed'
  return `${Math.max(0, Math.min(100, Number(item.progress || 0)))}% uploading`
}

function isRunning(item) {
  return ['PENDING', 'RUNNING'].includes(String(item?.status || '').toUpperCase())
}

export function UploadProgressIndicator() {
  const [uploads, setUploads] = useState(getUploadSnapshot())
  const [open, setOpen] = useState(false)

  useEffect(() => subscribeUploadProgress(() => setUploads([...getUploadSnapshot()])), [])

  const activeCount = uploads.filter(isRunning).length
  const activeUpload = uploads.find(isRunning)
  const activeProgress = Math.max(0, Math.min(100, Number(activeUpload?.progress || 0)))
  if (!uploads.length) return null

  return <div className="upload-progress-menu">
    <button type="button" className={`upload-progress-button${activeCount ? ' is-active' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Upload progress">
      <CloudUpload size={17} />
      <span>{activeCount ? `${activeCount} upload${activeCount === 1 ? '' : 's'}` : 'Uploads'}</span>
      {activeCount ? <b>{activeCount}</b> : null}
      {activeCount ? <span className="upload-progress-button-meter" aria-hidden="true"><i style={{ width: `${activeProgress || 28}%` }} /></span> : null}
    </button>
    {open ? <div className="upload-progress-popover" role="status">
      <div className="upload-progress-popover-head"><strong>Upload activity</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close upload activity">×</button></div>
      <div className="upload-progress-list">{uploads.slice(0, 5).map((item) => <article key={item.id} className={`upload-progress-item is-${String(item.status || '').toLowerCase()}`}>
        <span className="upload-progress-item-icon">{isRunning(item) ? <LoaderCircle className="upload-progress-spin" size={16} /> : item.status === 'FAILED' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}</span>
        <div><strong title={item.label}>{item.label}</strong><small>{statusText(item)}</small>{isRunning(item) ? <div className={`upload-progress-track${Number(item.progress || 0) <= 0 ? ' is-indeterminate' : ''}`}><i style={{ width: `${Math.max(0, Math.min(100, Number(item.progress || 0))) || 28}%` }} /></div> : null}</div>
        {item.status !== 'RUNNING' ? <button type="button" onClick={() => dismissUpload(item.id)} aria-label={`Dismiss ${item.label}`}>×</button> : null}
      </article>)}</div>
    </div> : null}
  </div>
}
