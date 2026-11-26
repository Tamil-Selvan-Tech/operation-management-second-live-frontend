import { CheckCircle2, CloudUpload, LoaderCircle, XCircle } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Clock3 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { dismissUpload, getUploadSnapshot, subscribeUploadProgress } from '../lib/uploadProgressStore'
import { loadSession } from '../lib/session'
import { listActiveLeadImports } from '../services/leadImportService'
import { downloadCourseImportErrors, listCourseImportJobs, retryCourseImportJob } from '../services/courseImportService'
import { LeadDistributionManager } from './LeadDistributionManager'

function dismissedStorageKey(userId) {
  return `cispro.dismissedUploadProgressIds:${userId || 'anonymous'}`
}

function readDismissedRemoteIds(userId) {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(window.localStorage.getItem(dismissedStorageKey(userId)) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function statusText(item) {
  if (String(item.status || '').toUpperCase() === 'AWAITING_DISTRIBUTION') {
    const processed = Number(item.processed || 0)
    const total = Number(item.total || 0)
    if (item.directDistribution) return `${Number(item.unassignedRows ?? Math.max(0, total - processed)).toLocaleString()} leads remain unassigned · Waiting for Super Admin`
    return total
      ? `${processed.toLocaleString()} of ${total.toLocaleString()} rows staged · Waiting for Branch Admin distribution`
      : 'Waiting for Branch Admin distribution'
  }
  if (item.status === 'FAILED') return item.error || 'Upload failed'
  if (['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(String(item.status || '').toUpperCase())) {
    const completedAt = item.completedAt || item.updatedAt
    const timestamp = completedAt ? new Date(completedAt).getTime() : NaN
    const elapsed = Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : null
    const minutes = elapsed === null ? null : Math.floor(elapsed / 60000)
    const hours = minutes === null ? null : Math.floor(minutes / 60)
    const ago = minutes === null ? '' : minutes < 1 ? 'just now' : hours >= 1 ? `${hours} hr${hours === 1 ? '' : 's'} ago` : minutes === 1 ? '1 min ago' : `${minutes} mins ago`
    const label = item.status === 'COMPLETED_WITH_ERRORS' ? 'Upload completed with warnings' : 'Upload completed'
    return ago ? `${label} - ${ago}` : label
  }
  const processed = Number(item.processed || 0)
  const total = Number(item.total || 0)
  const progress = Math.max(0, Math.min(100, Number(item.progress || 0)))
  return total ? `${processed.toLocaleString()} of ${total.toLocaleString()} processed - ${progress}%` : `${progress}% uploading`
}

function isRunning(item) {
  return ['PENDING', 'RUNNING'].includes(String(item?.status || '').toUpperCase())
}

function isAwaitingDistribution(item) {
  return String(item?.status || '').toUpperCase() === 'AWAITING_DISTRIBUTION'
}

export function UploadProgressIndicator() {
  const [uploads, setUploads] = useState(getUploadSnapshot())
  const [allowedSalesBranches, setAllowedSalesBranches] = useState(null)
  const previousSalesBranches = useRef(null)
  const [sharedLeadUploads, setSharedLeadUploads] = useState([])
  const [sharedCourseUploads, setSharedCourseUploads] = useState([])
  const previousLeadStatuses = useRef(new Map())
  const previousCourseStatuses = useRef(new Map())
  const [dismissedRemoteIds, setDismissedRemoteIds] = useState(() => {
    const user = loadSession()?.user || {}
    return readDismissedRemoteIds(String(user.id || user.userId || ''))
  })
  const [open, setOpen] = useState(false)
  const [distributionManagerOpen, setDistributionManagerOpen] = useState(false)
  const [distributionJobId, setDistributionJobId] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [popoverPosition, setPopoverPosition] = useState(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const [, setClock] = useState(0)

  useEffect(() => {
    const updateBranches = (event) => {
      const next = event.detail?.branchIds || []
      const signature = [...next].sort().join(':')
      if (previousSalesBranches.current !== null && previousSalesBranches.current !== signature) setRefreshVersion((value) => value + 1)
      previousSalesBranches.current = signature
      setAllowedSalesBranches(next)
    }
    window.addEventListener('cispro:sales-branch-context', updateBranches)
    return () => window.removeEventListener('cispro:sales-branch-context', updateBranches)
  }, [])

  useEffect(() => subscribeUploadProgress(() => setUploads([...getUploadSnapshot()])), [])

  useEffect(() => {
    const handleLeadImportUpdate = () => setRefreshVersion((value) => value + 1)
    window.addEventListener('cispro:lead-import-updated', handleLeadImportUpdate)
    return () => window.removeEventListener('cispro:lead-import-updated', handleLeadImportUpdate)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!loadSession()?.user?.id && !loadSession()?.user?.userId) return undefined
    let active = true
    let timer
    const schedule = (delay) => { if (active) timer = window.setTimeout(refresh, delay) }
    const refresh = async () => {
      const sessionRole = String(loadSession()?.user?.role || loadSession()?.user?.userRole || '').toLowerCase().replaceAll('_', '-')
      // Course-import jobs are scoped through the signed-in branch profile.
      // Super Admin has no branch profile, so polling this endpoint returns 404.
      const mayReadCourseImports = sessionRole === 'branch-admin'
      const mayReadLeadImports = ['branch-admin', 'super-admin', 'sales-admin', 'branch-admin-sales-admin'].includes(sessionRole)
      let hasActiveJobs = false
      let hasWaitingLeadJobs = false
      try {
        const [leadResult, courseResult] = await Promise.allSettled([mayReadLeadImports ? listActiveLeadImports() : Promise.resolve({ data: [] }), mayReadCourseImports ? listCourseImportJobs() : Promise.resolve({ jobs: [] })])
        if (!active) return
        const leadData = leadResult.status === 'fulfilled' ? (leadResult.value?.data || leadResult.value || []) : []
        const courseData = courseResult.status === 'fulfilled' ? (courseResult.value?.data || courseResult.value || {}) : {}
        const leadJobs = Array.isArray(leadData) ? leadData : []
        const courseJobs = Array.isArray(courseData?.jobs) ? courseData.jobs : []
        setSharedLeadUploads(leadJobs)
        setSharedCourseUploads(courseJobs)
        hasActiveJobs = [...leadJobs, ...courseJobs].some((job) => ['PENDING', 'RUNNING'].includes(String(job.status || '').toUpperCase()))
        hasWaitingLeadJobs = leadJobs.some(isAwaitingDistribution)
        let leadImportCompleted = false
        for (const job of leadJobs) {
          const status = String(job.status || '').toUpperCase()
          const previous = previousLeadStatuses.current.get(job.id)
          if ((!previous || ['PENDING', 'RUNNING'].includes(previous)) && ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'].includes(status)) leadImportCompleted = true
          previousLeadStatuses.current.set(job.id, status)
        }
        if (leadImportCompleted) window.dispatchEvent(new CustomEvent('cispro:lead-import-completed'))
        for (const job of courseJobs) {
          const status = String(job.status || '').toUpperCase()
          const previous = previousCourseStatuses.current.get(job.id)
          if (previous && ['PENDING', 'RUNNING'].includes(previous) && ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'].includes(status)) {
            window.dispatchEvent(new CustomEvent('cispro:course-import-completed', { detail: job }))
          }
          previousCourseStatuses.current.set(job.id, status)
        }
      } finally {
      // Keep the header badge synchronized even when the activity panel is closed.
      // Staged lead jobs poll less often so the view can notice when the Branch Admin assigns them.
        if (hasActiveJobs) schedule(15000)
        else if (hasWaitingLeadJobs) schedule(30000)
      }
    }
    void refresh()
    return () => { active = false; window.clearTimeout(timer) }
  }, [open, refreshVersion])

  async function handleCourseRetry(item) {
    try { await retryCourseImportJob(item.jobId) } catch { /* the next server poll remains authoritative */ }
  }

  async function handleCourseErrors(item) {
    try { await downloadCourseImportErrors(item.jobId) } catch { /* keep the header usable if a report is unavailable */ }
  }

  const sessionUser = loadSession()?.user || {}
  const currentUserId = String(sessionUser.id || sessionUser.userId || '')
  const sessionRole = String(sessionUser.role || sessionUser.userRole || '').toLowerCase().replaceAll('_', '-')
  const remoteDismissKey = dismissedStorageKey(currentUserId)

  useEffect(() => {
    try { window.localStorage.setItem(remoteDismissKey, JSON.stringify(dismissedRemoteIds)) } catch { /* best effort */ }
  }, [dismissedRemoteIds, remoteDismissKey])

  const recipientGroupedUploadIds = new Set(sharedLeadUploads.filter((job) => job.sourceJobId).map((job) => job.uploadId).filter(Boolean))
  const remoteLeadByUploadId = new Map(sharedLeadUploads.filter((job) => !job.sourceJobId).map((job) => [job.uploadId, job]))
  const branchScopedUploads = uploads.filter((item) => {
    if (sessionRole !== 'sales-admin' || !allowedSalesBranches || item.type !== 'lead') return true
    const branchId = item.branchId || item.result?.branchId || remoteLeadByUploadId.get(item.uploadId)?.branchId
    return branchId ? allowedSalesBranches.includes(branchId) : isRunning(item)
  })
  const localVisibleUploads = branchScopedUploads.filter((item) => item.type !== 'lead' || ((currentUserId && item.visibleTo?.includes(currentUserId)) && !recipientGroupedUploadIds.has(item.uploadId))).map((item) => {
    const remote = item.type === 'lead' ? remoteLeadByUploadId.get(item.uploadId) : null
    const merged = remote ? { ...item, jobId: remote.id, branchId: remote.branchId, directDistribution: Boolean(remote.directDistribution), unassignedRows: remote.unassignedRows, status: remote.status, progress: remote.progress, processed: remote.processedRows, total: remote.totalRows, completedAt: remote.completedAt, updatedAt: remote.updatedAt, error: remote.errorMessage || item.error } : item
    return sessionRole === 'super-admin' && !merged.directDistribution && String(merged.status || '').toUpperCase() === 'AWAITING_DISTRIBUTION'
      ? { ...merged, status: 'COMPLETED' }
      : merged
  })
  const scopedLeadUploads = sessionRole === 'sales-admin' && allowedSalesBranches ? sharedLeadUploads.filter((job) => allowedSalesBranches.includes(job.branchId)) : sharedLeadUploads
  const remoteVisibleUploads = [...scopedLeadUploads.map((job) => ({ id: 'server-' + job.id, jobId: job.id, branchId: job.branchId, directDistribution: Boolean(job.directDistribution), unassignedRows: job.unassignedRows, type: 'lead', uploadId: job.uploadId, perRecipient: Boolean(job.sourceJobId), label: job.activityLabel || job.fileName || 'Lead workbook', status: job.status, progress: job.progress, processed: job.processedRows, total: job.totalRows, completedAt: job.completedAt, updatedAt: job.updatedAt })), ...sharedCourseUploads.map((job) => ({ id: 'server-course-' + job.id, jobId: job.id, type: 'course', uploadId: job.uploadId, label: 'Course upload - ' + (job.fileName || 'Course workbook'), status: job.status, error: job.errorMessage, progress: job.progress, processed: job.processedRows, total: job.totalRows, failed: job.failedRows, completedAt: job.completedAt, updatedAt: job.updatedAt }))].filter((item) => !dismissedRemoteIds.includes(item.id))
  const visibleUploads = [...localVisibleUploads, ...remoteVisibleUploads.filter((remote) => remote.perRecipient || !localVisibleUploads.some((local) => local.uploadId && local.uploadId === remote.uploadId))]
  const activeCount = visibleUploads.filter(isRunning).length
  const waitingCount = visibleUploads.filter(isAwaitingDistribution).length
  const activityCount = activeCount + waitingCount
  const activeUpload = visibleUploads.find(isRunning)
  const activeProgress = Math.max(0, Math.min(100, Number(activeUpload?.progress || 0)))
  const visibleUploadsLength = visibleUploads.length

  useLayoutEffect(() => {
    if (!open) return undefined
    const placePopover = () => {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const panel = popoverRef.current?.getBoundingClientRect()
      if (!trigger || !panel) return
      const left = Math.max(12, Math.min(window.innerWidth - panel.width - 12, trigger.right - panel.width))
      const below = trigger.bottom + 7
      const top = below + panel.height <= window.innerHeight - 12 ? below : Math.max(12, trigger.top - panel.height - 7)
      setPopoverPosition({ left, top })
    }
    placePopover()
    window.addEventListener('resize', placePopover)
    window.addEventListener('scroll', placePopover, true)
    return () => {
      window.removeEventListener('resize', placePopover)
      window.removeEventListener('scroll', placePopover, true)
    }
  }, [open, visibleUploadsLength])

  useEffect(() => {
    if (!open) return undefined
    const closeWhenClickingOutside = (event) => {
      const target = event.target
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', closeWhenClickingOutside)
    return () => document.removeEventListener('pointerdown', closeWhenClickingOutside)
  }, [open])
  // Keep the header shortcut contextual: once every upload has completed (or
  // failed and is no longer running), there is no active upload flow to show.
  // A staged lead import still counts as active until it is distributed.
  if (!activityCount) return null

  return <div className="upload-progress-menu">
    <button type="button" ref={triggerRef} className={`upload-progress-button${activeCount ? ' is-active' : waitingCount ? ' is-waiting' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Upload progress">
      <CloudUpload size={17} />
      <span>{activeCount ? `${activeCount} active upload${activeCount === 1 ? '' : 's'}` : waitingCount ? `${waitingCount} waiting upload${waitingCount === 1 ? '' : 's'}` : 'Uploads'}</span>
      {activityCount ? <b>{activityCount}</b> : null}
      {activeCount ? <span className="upload-progress-button-meter" aria-hidden="true"><i style={{ width: `${activeProgress || 28}%` }} /></span> : null}
    </button>
    {open ? createPortal(<div ref={popoverRef} className="upload-progress-popover" role="status" style={{ position: 'fixed', left: popoverPosition?.left ?? 0, top: popoverPosition?.top ?? 0, right: 'auto', transform: 'none', visibility: popoverPosition ? 'visible' : 'hidden', zIndex: 2147483647 }}>
      <div className="upload-progress-popover-head"><strong>Upload activity</strong><span><button type="button" onClick={() => setOpen(false)} aria-label="Close upload activity"><X size={16} strokeWidth={2} /></button></span></div>
      <div className="upload-progress-list">{visibleUploads.length ? visibleUploads.map((item) => <article key={item.id} className={`upload-progress-item is-${String(item.status || '').toLowerCase()}`}>
        <span className="upload-progress-item-icon">{isRunning(item) ? <LoaderCircle className="upload-progress-spin" size={16} /> : isAwaitingDistribution(item) ? <Clock3 size={16} /> : item.status === 'FAILED' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}</span>
        <div><strong title={item.label}>{item.label}</strong><small>{statusText(item)}</small>{item.type === 'course' && !isRunning(item) && item.failed > 0 ? <span className="upload-progress-item-actions"><button type="button" onClick={() => void handleCourseErrors(item)}>Download errors</button>{['COMPLETED_WITH_ERRORS', 'FAILED'].includes(String(item.status).toUpperCase()) ? <button type="button" onClick={() => void handleCourseRetry(item)}>Retry failed</button> : null}</span> : null}{isRunning(item) ? <div className={`upload-progress-track${Number(item.progress || 0) <= 0 ? ' is-indeterminate' : ''}`}><i style={{ width: `${Math.max(0, Math.min(100, Number(item.progress || 0))) || 28}%` }} /></div> : null}{sessionRole === 'super-admin' && item.type === 'lead' && item.directDistribution && isAwaitingDistribution(item) ? <span className="upload-progress-item-actions"><button type="button" onClick={() => { setDistributionJobId(item.jobId || ''); setDistributionManagerOpen(true); setOpen(false) }}>Distribute remaining leads</button></span> : null}</div>
        {!isRunning(item) ? <button type="button" onClick={() => item.id.startsWith('server-') ? setDismissedRemoteIds((current) => [...current, item.id]) : dismissUpload(item.id)} aria-label={`Dismiss ${item.label}`}><X size={14} strokeWidth={2} /></button> : null}
      </article>) : <p className="upload-progress-empty">No recent upload activity.</p>}</div>
    </div>, document.body) : null}
    {distributionManagerOpen ? <LeadDistributionManager currentUser={sessionUser} initialJobId={distributionJobId} onClose={() => setDistributionManagerOpen(false)} onDistributed={() => setRefreshVersion((value) => value + 1)} /> : null}
  </div>
}
