import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowRightLeft, Building2, Check, CheckCircle2, RefreshCw, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { request } from '../services/apiClient'
import '../styles/SalesAdminBranchTransfer.css'

export default function SalesAdminBranchTransfer({ user, onClose, onComplete }) {
  const [preview, setPreview] = useState(null)
  const [sourceId, setSourceId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [allocations, setAllocations] = useState({})
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState(null)
  const closeRef = useRef(null)
  const savingRef = useRef(false)
  const dialogRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus?.() }
  }, [])
  useEffect(() => {
    let active = true
    request('/sales-admins/' + encodeURIComponent(user.id) + '/branch-transfer' + (sourceId ? '?sourceBranchId=' + encodeURIComponent(sourceId) : ''))
      .then((response) => { if (active) { setPreview(response.data); setAllocations({}); setDestinationId(''); setStep(1) } })
      .catch((reason) => { if (active) { setPreview(null); setError(reason?.message || 'Unable to load the transfer details.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user.id, sourceId, reload])
  const recipients = preview?.recipients || []
  const selected = recipients.filter((recipient) => Object.hasOwn(allocations, recipient.id))
  const total = preview?.summary?.total || 0
  const assigned = selected.reduce((sum, recipient) => sum + (Number(allocations[recipient.id]) || 0), 0)
  const remaining = total - assigned
  const destination = preview?.destinations?.find((branch) => branch.id === destinationId)
  const validAllocation = assigned === total && (total === 0 || selected.length > 0) && selected.every((recipient) => Number.isSafeInteger(Number(allocations[recipient.id])) && Number(allocations[recipient.id]) > 0)
  const next = () => {
    setError('')
    if (step === 1 && (!destination || preview?.blockedReason)) { setError(preview?.blockedReason || 'Select a destination branch.'); return }
    if (step === 2 && !validAllocation) { setError('Allocate all ' + total + ' leads using positive whole counts.'); return }
    setStep((current) => current + 1)
  }
  const submit = async () => {
    if (savingRef.current || !validAllocation || !destination) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const response = await request('/sales-admins/' + encodeURIComponent(user.id) + '/branch-transfer', { method: 'POST', body: JSON.stringify({
        sourceBranchId: preview.source.id, destinationBranchId: destinationId, version: preview.version,
        allocations: selected.map((recipient) => ({ userId: recipient.id, count: Number(allocations[recipient.id]) })),
      }), timeoutMs: 90000 })
      setResult(response.data)
      onComplete?.(response.data)
    } catch (reason) { setError(reason?.message || 'Unable to complete the move. No partial transfer was saved.') }
    finally { savingRef.current = false; setSaving(false) }
  }
  const close = () => { if (!savingRef.current) onClose() }
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); close() }
    if (event.key !== 'Tab') return
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')]
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return createPortal(<div className="sales-transfer-backdrop" onKeyDown={onKeyDown}>
    <section ref={dialogRef} className="sales-transfer-dialog" role="dialog" aria-modal="true" aria-labelledby="sales-transfer-title" aria-busy={saving}>
      <header className="sales-transfer-header"><span className="sales-transfer-icon"><ArrowRightLeft size={22} /></span><div><p>ACCOUNT TRANSFER</p><h2 id="sales-transfer-title">Move Sales Admin</h2><span>{user.fullName} {user.userCode ? '(' + user.userCode + ')' : ''}</span></div><button ref={closeRef} type="button" onClick={close} disabled={saving} aria-label="Close transfer"><X size={19} /></button></header>
      {!result ? <nav className="sales-transfer-steps" aria-label="Transfer steps">{['Choose branch', 'Hand over leads', 'Review & move'].map((name, index) => <span key={name} className={step === index + 1 ? 'is-current' : step > index + 1 ? 'is-done' : ''} aria-current={step === index + 1 ? 'step' : undefined}><i>{step > index + 1 ? <Check size={13} /> : index + 1}</i>{name}</span>)}</nav> : null}
      <div className="sales-transfer-body">
        {loading ? <p className="sales-transfer-state"><RefreshCw size={18} className="spin" /> Loading branch and lead details...</p> : result ? <div className="sales-transfer-success"><CheckCircle2 size={42} /><h3>Branch move completed</h3><p>{user.fullName} is now assigned to <strong>{result.destination.branchName}</strong>.</p><p>{result.totalLeads} leads were handed over within {result.source.branchName}.</p></div> : preview ? <>
          {step === 1 ? <>
            <div className="sales-transfer-branch-grid"><label><span>Current branch</span>{preview.branches.length > 1 ? <select value={preview.source.id} onChange={(event) => { setLoading(true); setError(''); setSourceId(event.target.value) }}>{preview.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}</select> : <strong><Building2 size={17} />{preview.source.branchName}</strong>}</label><ArrowRight className="sales-transfer-branch-arrow" size={20} /><label><span>Move to branch <b>*</b></span><select value={destinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">Select destination branch</option>{preview.destinations.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}</select></label></div>
            {!preview.destinations.length ? <p className="sales-transfer-warning">No other active branch is available.</p> : null}
            <div className="sales-transfer-summary"><div><span>Total to hand over</span><strong>{total}</strong></div><div><span>Fresh Leads</span><strong>{preview.summary.fresh}</strong></div><div><span>Active / in progress</span><strong>{preview.summary.active}</strong></div><div><span>Closed</span><strong>{preview.summary.closed}</strong></div><div><span>Converted</span><strong>{preview.summary.converted}</strong></div></div>
            <p className="sales-transfer-note">All assigned leads stay in the current branch and will be handed over to its other admins. Call history, stages, follow-up dates, admission records and existing deadlines are retained.</p>
            {preview.blockedReason ? <p className="sales-transfer-warning">{preview.blockedReason}</p> : null}
          </> : step === 2 ? <>
            <div className="sales-transfer-section-title"><div><h3>Hand over leads in {preview.source.branchName}</h3><p>Select recipients and enter how many leads each will receive.</p></div><span>{total} total leads</span></div>
            {total === 0 ? <div className="sales-transfer-empty"><CheckCircle2 size={25} /><p>No assigned leads to hand over. You can continue with the branch move.</p></div> : recipients.length ? <div className="sales-transfer-recipients">{recipients.map((recipient) => {
              const checked = Object.hasOwn(allocations, recipient.id)
              return <div key={recipient.id} className={'sales-transfer-recipient' + (checked ? ' is-selected' : '')}><label><input type="checkbox" checked={checked} onChange={() => setAllocations((current) => { const next = { ...current }; if (checked) delete next[recipient.id]; else next[recipient.id] = ''; return next })} /><span><strong>{recipient.fullName}</strong><small>{recipient.role === 'BRANCH_ADMIN' ? 'Branch Admin' : 'Sales Admin'}{recipient.userCode ? ' | ' + recipient.userCode : ''}</small></span></label><label className="sales-transfer-count"><span>Leads</span><input aria-label={'Leads for ' + recipient.fullName} type="number" min="1" step="1" inputMode="numeric" disabled={!checked} value={checked ? allocations[recipient.id] : ''} placeholder="0" onChange={(event) => setAllocations((current) => ({ ...current, [recipient.id]: event.target.value }))} /></label></div>
            })}</div> : <p className="sales-transfer-warning">There are no other active Sales Admins or Branch Admin available in this branch. Assign one before moving this account.</p>}
            <div className={'sales-transfer-balance' + (remaining === 0 ? ' is-balanced' : remaining < 0 ? ' is-over' : '')}><span>Allocated <strong>{assigned} / {total}</strong></span><span>{remaining < 0 ? 'Over-allocated' : 'Remaining'} <strong>{Math.abs(remaining)}</strong></span></div>
          </> : <>
            <div className="sales-transfer-section-title"><div><h3>Review branch move</h3><p>Confirm the lead handover before changing branch access.</p></div></div>
            <div className="sales-transfer-route"><strong>{preview.source.branchName}</strong><ArrowRight size={20} /><strong>{destination?.branchName}</strong></div>
            <div className="sales-transfer-review-list">{selected.map((recipient) => <div key={recipient.id}><span><strong>{recipient.fullName}</strong><small>{recipient.role === 'BRANCH_ADMIN' ? 'Branch Admin' : 'Sales Admin'}</small></span><strong>{allocations[recipient.id]} leads</strong></div>)}{total === 0 ? <p>No assigned leads to hand over.</p> : null}</div>
            <p className="sales-transfer-note">{user.fullName}&apos;s branch access will move from {preview.source.branchName} to {destination?.branchName}. Existing leads stay in {preview.source.branchName} with the recipients listed above; future work will use {destination?.branchName}.</p>
          </>}
        </> : null}
        {error ? <p className="sales-transfer-error" role="alert">{error}</p> : null}
      </div>
      <footer className="sales-transfer-footer">
        {!result ? <button type="button" className="sales-transfer-secondary" onClick={() => { setLoading(true); setError(''); setReload((value) => value + 1) }} disabled={saving || loading}><RefreshCw size={14} />Refresh counts</button> : <span />}
        <div>{result ? <button type="button" className="sales-transfer-primary" onClick={close}>Done</button> : <><button type="button" className="sales-transfer-secondary" onClick={step > 1 ? () => { setStep((value) => value - 1); setError('') } : close} disabled={saving}>{step > 1 ? <><ArrowLeft size={14} />Back</> : 'Cancel'}</button>{step < 3 ? <button type="button" className="sales-transfer-primary" onClick={next} disabled={loading || !preview || Boolean(preview.blockedReason) || (step === 1 ? !destination : !validAllocation)}>Next<ArrowRight size={14} /></button> : <button type="button" className="sales-transfer-primary" onClick={submit} disabled={saving || !validAllocation}>{saving ? 'Moving...' : 'Confirm & move'}</button>}</>}</div>
      </footer>
    </section>
  </div>, document.body)
}
