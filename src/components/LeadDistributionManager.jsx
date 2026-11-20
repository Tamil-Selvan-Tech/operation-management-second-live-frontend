import { useCallback, useEffect, useState } from 'react'
import { ArrowRightLeft, CheckCircle2, LoaderCircle, RefreshCw, Users, X } from 'lucide-react'
import { distributeLeadImport, getLeadImportTargets, listLeadImportDistributionJobs } from '../services/leadImportService'
import '../styles/LeadDistributionManager.css'
import '../styles/LeadDistributionManagerEnhancements.css'

const unwrap = (response) => response?.data || response || {}
export function LeadDistributionManager({ currentUser = {}, onClose, onDistributed }) {
  const [jobs, setJobs] = useState([])
  const [targets, setTargets] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [allocation, setAllocation] = useState({ jobId: '', counts: {} })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lastEditedTargetId, setLastEditedTargetId] = useState('')
  const [distributionComplete, setDistributionComplete] = useState(null)
  const [activeTab, setActiveTab] = useState("")
  const [expandedHistoryId, setExpandedHistoryId] = useState("")
  const pendingJobs = jobs.filter((job) => String(job.status || "").toUpperCase() === "AWAITING_DISTRIBUTION")
  const historyJobs = jobs.filter((job) => String(job.status || "").toUpperCase() !== "AWAITING_DISTRIBUTION")
  const hasProcessingHistory = historyJobs.some((job) => ["PENDING", "RUNNING"].includes(String(job.status || "").toUpperCase()))
  const selected = pendingJobs.find((job) => job.id === selectedId)
  const eligible = Number(selected?.distributableRows || 0)
  const branchAdminId = String(currentUser.id || currentUser.userId || '')
  const defaults = Object.fromEntries(targets.map((target) => [target.id, target.id === branchAdminId ? eligible : 0]))
  const counts = allocation.jobId === selectedId ? allocation.counts : defaults
  const salesTargets = targets.filter((target) => target.id !== branchAdminId)
  const orderedTargets = [...salesTargets, ...targets.filter((target) => target.id === branchAdminId)]
  const salesAssigned = salesTargets.reduce((total, target) => total + (Number(counts[target.id]) || 0), 0)
  const branchBalance = Math.max(0, eligible - salesAssigned)
  const overAllocated = salesAssigned > eligible
  const validAllocation = Boolean(targets.some((target) => target.id === branchAdminId)) && !overAllocated
  const salesPercent = eligible ? Math.min(100, (salesAssigned / eligible) * 100) : 0

  const setSalesAllocation = (targetId, value) => {
    // The fields start at 0. Normalize leading zeroes so typing 40 over that
    // default never turns the allocation into 040 (or 0400).
    const digits = String(value).replace(/\D/g, '')
    const nextValue = digits.replace(/^0+(?=\d)/, '')
    setLastEditedTargetId(targetId)
    const nextCounts = { ...counts, [targetId]: nextValue }
    const nextSalesAssigned = salesTargets.reduce((total, target) => total + (Number(nextCounts[target.id]) || 0), 0)
    nextCounts[branchAdminId] = Math.max(0, eligible - nextSalesAssigned)
    setAllocation({ jobId: selectedId, counts: nextCounts })
  }

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [jobResponse, targetResponse] = await Promise.all([listLeadImportDistributionJobs(), getLeadImportTargets(currentUser.branchId || '')])
      const nextJobs = unwrap(jobResponse) || []
      const targetData = unwrap(targetResponse)
      setJobs(Array.isArray(nextJobs) ? nextJobs : [])
      setTargets(targetData.targets || [])
      setSelectedId((current) => nextJobs.some((job) => job.id === current && String(job.status || "").toUpperCase() === "AWAITING_DISTRIBUTION") ? current : nextJobs.find((job) => String(job.status || "").toUpperCase() === "AWAITING_DISTRIBUTION")?.id || "")
      setActiveTab((current) => current === "" || (current === "pending" && !nextJobs.some((job) => String(job.status || "").toUpperCase() === "AWAITING_DISTRIBUTION")) ? (nextJobs.some((job) => String(job.status || "").toUpperCase() === "AWAITING_DISTRIBUTION") ? "pending" : "history") : current)
    } catch (requestError) { setError(requestError?.body?.message || requestError?.message || 'Could not load branch leads waiting for distribution.') }
    finally { setLoading(false) }
  }, [currentUser.branchId])
  useEffect(() => { const timer = window.setTimeout(() => { void refresh() }, 0); return () => window.clearTimeout(timer) }, [refresh])
  useEffect(() => {
    if (!hasProcessingHistory) return undefined
    const timer = window.setInterval(async () => {
      try {
        const response = await listLeadImportDistributionJobs()
        const latestJobs = unwrap(response)
        if (Array.isArray(latestJobs)) setJobs(latestJobs)
      } catch { /* Keep the latest visible history while the import service is temporarily unavailable. */ }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [hasProcessingHistory])

  const submit = async () => {
    if (!selected || !validAllocation || saving) return
    setSaving(true); setError('')
    try {
      const allocations = targets.map((target) => ({ userId: target.id, count: Number(counts[target.id] || 0) })).filter((item) => item.count > 0)
      const result = await distributeLeadImport(selected.id, allocations)
      setDistributionComplete({
        fileName: selected.fileName || selected.uploadId,
        allocations,
        total: Number(result?.data?.distributableRows ?? eligible),
      })
      window.dispatchEvent(new Event('cispro:lead-import-updated'))
      await onDistributed?.()
    } catch (requestError) { setError(requestError?.body?.message || requestError?.message || 'Distribution could not be saved. Review the allocation and try again.') }
    finally { setSaving(false) }
  }

  const statusLabel = (status) => ({ AWAITING_DISTRIBUTION: "Waiting for distribution", PENDING: "Queued", RUNNING: "Importing", COMPLETED: "Completed", COMPLETED_WITH_ERRORS: "Completed with warnings", FAILED: "Failed" }[String(status || "").toUpperCase()] || "Processing")
  const recipientRole = (role) => String(role || "").toUpperCase().replaceAll("_", " ").includes("BRANCH") ? "Branch Admin" : "Sales Admin"
  return <div className="lead-distribution-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose?.() }}>
    <section className="lead-distribution-dialog" role="dialog" aria-modal="true" aria-labelledby="lead-distribution-title">
      <header><div><span className="lead-distribution-icon"><ArrowRightLeft size={19} /></span><div><p>BRANCH LEADS</p><h2 id="lead-distribution-title">Lead distribution</h2><small>Assign incoming leads and review previous uploads shared with your branch.</small></div></div><button type="button" onClick={onClose} aria-label="Close" disabled={saving}><X size={18} /></button></header>
      {error ? <div className="lead-distribution-error" role="alert">{error}</div> : null}
      {distributionComplete ? <div className="lead-distribution-success"><CheckCircle2 size={42} /><h3>Leads distributed</h3><p><strong>{distributionComplete.total.toLocaleString()}</strong> leads from <strong>{distributionComplete.fileName}</strong> were assigned successfully.</p><div>{distributionComplete.allocations.map((item) => { const target = targets.find((candidate) => candidate.id === item.userId); return <span key={item.userId}><strong>{target?.fullName || 'Account'}</strong><b>{item.count.toLocaleString()} leads</b></span> })}</div><small>Import continues in the background. Each recipient’s progress appears in Distribution history and Uploads.</small><button type="button" onClick={() => { setDistributionComplete(null); setActiveTab("history"); void refresh() }}>View distribution history</button></div> : loading ? <div className="lead-distribution-loading"><LoaderCircle className="lead-distribution-spin" /> Loading upload history…</div> : <>
        <nav className="lead-distribution-tabs" aria-label="Lead distribution views"><button type="button" className={activeTab === 'pending' ? 'is-active' : ''} onClick={() => setActiveTab('pending')}>Waiting to distribute <b>{pendingJobs.length}</b></button><button type="button" className={activeTab === 'history' ? 'is-active' : ''} onClick={() => setActiveTab('history')}>Distribution history <b>{historyJobs.length}</b></button><button type="button" className="lead-distribution-refresh" onClick={() => void refresh()} aria-label="Refresh uploads"><RefreshCw size={15} /></button></nav>
        {activeTab === 'history' ? <div className="lead-distribution-history">
          {historyJobs.length ? historyJobs.map((job) => {
            const expanded = expandedHistoryId === job.id
            return <article className={`lead-distribution-history-item${expanded ? ' is-expanded' : ''}`} key={job.id}>
              <button type="button" className="lead-distribution-history-entry" aria-expanded={expanded} onClick={() => setExpandedHistoryId(expanded ? '' : job.id)}>
                <span className="lead-distribution-history-entry-icon" aria-hidden="true">XLS</span>
                <span className="lead-distribution-history-entry-name"><strong>{job.fileName || job.uploadId}</strong><small>{job.createdAt ? new Date(job.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable'} · {job.uploadedByName || 'Super Admin'}</small></span>
                <span className={'lead-distribution-status is-' + String(job.status || '').toLowerCase()}>{statusLabel(job.status)}</span>
                <span className="lead-distribution-history-chevron" aria-hidden="true">{expanded ? '\u2212' : '+'}</span>
              </button>
              {expanded ? <div className="lead-distribution-history-details">
                {job.recipients?.length ? job.recipients.map((recipient) => <div className="lead-distribution-history-detail-row" key={recipient.userId}>
                  <span><strong>{recipient.fullName}</strong><small>{recipientRole(recipient.role)} · Uploaded by {recipient.distributedByName || 'Branch Admin'}</small></span>
                  <span className="lead-distribution-history-detail-count">{Number(recipient.totalRows || 0).toLocaleString()} leads</span>
                  <span className="lead-distribution-history-detail-progress">{Number(recipient.processedRows || 0).toLocaleString()}/{Number(recipient.totalRows || 0).toLocaleString()} · {Number(recipient.progress || 0)}%</span>
                </div>) : <p>{String(job.status || '').toUpperCase() === 'AWAITING_DISTRIBUTION' ? 'Waiting for branch distribution.' : 'No distribution details recorded.'}</p>}
              </div> : null}
            </article>
          }) : <div className="lead-distribution-empty"><Users size={26} /><strong>No distribution history yet</strong><span>Super Admin uploads and allocations to Sales Admins will appear here.</span><button type="button" onClick={() => void refresh()}><RefreshCw size={14} /> Refresh</button></div>}
        </div> : pendingJobs.length ? <div className="lead-distribution-content">
          <label className="lead-distribution-job-select">Upload to distribute<select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setAllocation({ jobId: '', counts: {} }) }}>{pendingJobs.map((job) => <option key={job.id} value={job.id}>{job.fileName || job.uploadId} · {job.distributableRows} available</option>)}</select></label>
          <div className="lead-distribution-summary"><div><span>Uploaded rows</span><strong>{selected?.totalRows || 0}</strong></div><div><span>Ready to assign</span><strong>{eligible}</strong></div><div><span>Sales Admin allocation</span><strong>{salesAssigned}</strong></div><div className="is-balance"><span>Branch Admin balance</span><strong>{branchBalance}</strong></div></div>
          <div className="lead-distribution-meter" role="img" aria-label={`${salesAssigned} assigned to Sales Admins, ${branchBalance} retained by Branch Admin out of ${eligible} valid leads`}><span><i style={{ width: `${salesPercent}%` }} /></span><div><small>Sales Admins <strong>{salesAssigned}</strong></small><small>Branch Admin balance <strong>{branchBalance}</strong></small></div></div>
          <div className="lead-distribution-table"><div className="lead-distribution-table-head"><span>Account</span><span>Leads</span></div>{orderedTargets.map((target) => {
            const isBranchAdmin = target.id === branchAdminId
            const value = Number(counts[target.id] || 0)
            const availableForTarget = Math.max(0, eligible - (salesAssigned - value))
            const fieldError = !isBranchAdmin && value > availableForTarget && (value > eligible || target.id === lastEditedTargetId) ? `Maximum available: ${availableForTarget} leads` : ''
            return <div className={`lead-distribution-row${isBranchAdmin ? ' is-branch-admin' : ''}`} key={target.id}><span><strong>{target.fullName}{isBranchAdmin ? ' (You · Branch Admin)' : ''}</strong><small>{isBranchAdmin ? 'Remaining leads stay with your branch account' : String(target.role || '').replaceAll('_', ' ')}</small></span>{isBranchAdmin ? <span className="lead-distribution-balance-value" aria-label={`Branch Admin balance: ${branchBalance}`}>{branchBalance}</span> : <div className="lead-distribution-input-wrap"><input type="text" inputMode="numeric" pattern="[0-9]*" value={counts[target.id] ?? 0} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setSalesAllocation(target.id, event.target.value)} aria-label={'Lead count for ' + target.fullName} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `lead-distribution-error-${target.id}` : undefined} />{fieldError ? <small className="lead-distribution-field-error" id={`lead-distribution-error-${target.id}`} role="alert">{fieldError}</small> : null}</div>}</div>
          })}</div>
          <div className={'lead-distribution-total' + (validAllocation ? ' is-valid' : ' is-invalid')}><span>{overAllocated ? <>Reduce Sales Admin allocations by <strong>{salesAssigned - eligible}</strong></> : <>Branch Admin keeps <strong>{branchBalance}</strong> of <strong>{eligible}</strong> remaining leads</>}</span><small>Assign counts to Sales Admins; the unassigned balance stays with you. Pending Completion rows are included. Lead IDs are created only for Active Leads.</small></div>
          <footer><span>Original upload by Super Admin · Distribution by {currentUser.fullName || 'you'}</span><button type="button" onClick={() => void submit()} disabled={saving || !validAllocation || !eligible}>{saving ? <><LoaderCircle className="lead-distribution-spin" size={15} /> Distributing…</> : 'Confirm distribution'}</button></footer>
        </div> : <div className="lead-distribution-empty"><Users size={26} /><strong>No uploads are waiting for distribution</strong><span>Completed and previous allocations are available under Distribution history.</span><button type="button" onClick={() => setActiveTab('history')}>View distribution history</button></div>}
      </>}
    </section>
  </div>
}
