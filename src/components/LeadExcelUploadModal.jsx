import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Pencil, RefreshCw, Save, Trash2, Upload, UserRound, UsersRound, X } from 'lucide-react'
import { downloadLeadImportTemplate, getLeadImportTargets, importLeadRows, previewLeadImport, revalidateLeadImport } from '../services/leadImportService'
import { completeUpload, failUpload, getUploadSnapshot, startUpload, updateUpload } from '../lib/uploadProgressStore'
import '../styles/LeadExcelUploadModal.css'

const PAGE_SIZE = 15
const PREVIEW_FIELDS = [
  ['studentName', 'Student Name'], ['phoneNumber', 'Mobile Number'], ['alternativeNumber', 'Alt. Mobile'],
  ['email', 'Email'], ['qualification', 'Qualification'], ['location', 'Location'], ['locationDistance', 'Location Distance'],
  ['otherLocationDistance', 'Other Location Distance'], ['callType', 'Call Type'], ['otherCallType', 'Other Call Type'],
  ['status', 'Lead Status'], ['otherStatus', 'Other Status'], ['stage', 'Lead Stage'], ['otherStage', 'Other Stage'],
  ['course', 'Course Name'], ['otherCourse', 'Other Course'], ['nextFollowUpDate', 'Follow-up Date'], ['nextFollowUpTime', 'Follow-up Time'],
  ['leadSource', 'Lead Source'], ['otherLeadSource', 'Other Lead Source'], ['referredBy', 'Referred By'],
  ['referredName', 'Referred Name'], ['paymentStatus', 'Payment Status'], ['paymentAmount', 'Payment Amount'],
  ['classSchedule', 'Class Schedule'], ['courseMode', 'Course Mode'], ['trainingMode', 'Training Mode'], ['leadDate', 'Lead Date'],
]
const roleName = (user) => String(user?.role || '').toUpperCase().replace(/-/g, '_')
const errorMessage = (error) => error?.body?.message || error?.body?.error || error?.message || 'Unable to process the workbook.'

function statusLabel(status) {
  return ({ READY: 'Ready', PENDING_COMPLETION: 'Fresh Lead', DUPLICATE: 'Duplicate', INVALID: 'Invalid', IMPORTED: 'Imported', PENDING_EDIT: 'Edited - revalidate' })[status] || status || 'Review'
}
function normalizedImportStatus(row) {
  const status = String(row?.status || '').trim().toUpperCase()
  const hasDuplicateError = row?.errors?.some((error) => /duplicate|already exists|already imported/i.test(String(error)))
  if (hasDuplicateError || status.includes('DUPLICATE')) return 'DUPLICATE'
  return status
}

export function LeadExcelUploadModal({ isOpen, onClose, currentUser = {}, onImported, onPendingChanged }) {
  const inputRef = useRef(null)
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [targetData, setTargetData] = useState({ branches: [], targets: [], lockedBranchId: null, lockedTargetId: null })
  const [branchId, setBranchId] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [deadlineAt, setDeadlineAt] = useState('')
  const [directDistribution, setDirectDistribution] = useState(false)
  const [directAllocations, setDirectAllocations] = useState({})
  const [directDeadlines, setDirectDeadlines] = useState({})
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingRow, setEditingRow] = useState(null)
  const [tablePage, setTablePage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [importStatus, setImportStatus] = useState(null)
  const [dragging, setDragging] = useState(false)

  const role = roleName(currentUser)
  const directDistributionMode = role === 'SUPER_ADMIN' && directDistribution
  const isCombinedBranchAdmin = role === 'BRANCH_ADMIN' && String(currentUser?.roleAccess || currentUser?.managedBranch?.roleAccess || '').toUpperCase() === 'BRANCH_ADMIN_SALES_ADMIN'
  const branchLocked = role === 'BRANCH_ADMIN' || (role === 'SALES_ADMIN' && Boolean(targetData.lockedBranchId))
  // A combined Branch Admin account can still choose any Sales Admin assigned
  // to its branch when uploading. Only Sales Admin logins are locked to self.
  const targetLocked = role === 'SALES_ADMIN'
  const rows = useMemo(() => preview?.rows || [], [preview?.rows])
  const filteredRows = useMemo(() => statusFilter === 'ALL' ? rows : rows.filter((row) => normalizedImportStatus(row) === statusFilter), [rows, statusFilter])
  const visibleRows = useMemo(() => filteredRows.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE), [filteredRows, tablePage])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))

  useEffect(() => {
    if (!isOpen) return undefined
    const resetTimer = window.setTimeout(() => {
      setStep(1); setFile(null); setPreview(null); setBusy(false); setError(''); setNotice(''); setEditingRow(null); setTablePage(1); setStatusFilter('ALL'); setImportStatus(null); setDragging(false); setDirectDistribution(false); setDirectAllocations({}); setDirectDeadlines({})
      const initialBranch = currentUser?.branchId || ''
      const initialTarget = targetLocked ? currentUser?.id || currentUser?.userId || '' : ''
      setBranchId(initialBranch); setAssignedToId(initialTarget); setDeadlineAt('')
    }, 0)
    const initialBranch = currentUser?.branchId || ''
    const initialTarget = targetLocked ? currentUser?.id || currentUser?.userId || '' : ''
    void getLeadImportTargets(initialBranch).then((response) => {
      const data = response?.data || response || {}
      setTargetData(data)
      setBranchId(data.lockedBranchId || initialBranch || ((role === 'SUPER_ADMIN' || data.branches?.length === 1) ? data.branches?.[0]?.id || '' : ''))
      setAssignedToId(data.lockedTargetId || initialTarget || '')
    }).catch((requestError) => setError(errorMessage(requestError)))
    if (inputRef.current) inputRef.current.value = ''
    return () => window.clearTimeout(resetTimer)
  }, [isOpen, currentUser?.id, currentUser?.userId, currentUser?.branchId, role, targetLocked])

  useEffect(() => {
    if (!isOpen || !branchId || branchLocked) return undefined
    const clearTargetTimer = window.setTimeout(() => setAssignedToId(''), 0)
    void getLeadImportTargets(branchId).then((response) => { const data = response?.data || response || {}; setTargetData(data); if (role === 'SALES_ADMIN') setAssignedToId(data.lockedTargetId || currentUser?.id || currentUser?.userId || ''); else if (directDistributionMode) setAssignedToId(data.targets?.find((target) => String(target.role || '').toUpperCase() === 'BRANCH_ADMIN')?.id || '') }).catch((requestError) => setError(errorMessage(requestError)))
    return () => window.clearTimeout(clearTargetTimer)
  }, [branchId, branchLocked, currentUser?.id, currentUser?.userId, directDistributionMode, isOpen, role])

  if (!isOpen) return null

  const selectFile = async (nextFile) => {
    setError(''); setNotice(''); setPreview(null); setImportStatus(null); setEditingRow(null); setTablePage(1); setStatusFilter('ALL')
    if (!nextFile) return
    if (!/\.xlsx$/i.test(nextFile.name)) { setError('Only .xlsx files are supported.'); return }
    if (!branchId || !assignedToId) { setError('Select a branch and Sales Admin before uploading.'); return }
    if (!deadlineAt) { setError('Select a completion deadline before uploading.'); return }
    setFile(nextFile); setBusy(true)
    try {
      const response = await previewLeadImport(nextFile, { branchId, assignedToId, deadlineAt, distributionMode: distributionMode || directDistributionMode, directDistribution: directDistributionMode })
      setPreview(response?.data || response || {})
      setDirectAllocations({}); setDirectDeadlines({})
      setStep(2)
    } catch (requestError) { setFile(null); setError(errorMessage(requestError)) } finally { setBusy(false) }
  }

  const beginEdit = (row) => setEditingRow({ rowNumber: row.rowNumber, data: { ...(row.data || {}) } })
  const updateEditing = (field, value) => setEditingRow((current) => current ? ({ ...current, data: { ...current.data, [field]: value } }) : current)
  const saveEdit = async () => {
    if (!editingRow || !preview?.rows?.length || busy) return
    const editedRow = editingRow
    const nextRows = preview.rows.map((row) => row.rowNumber === editedRow.rowNumber
      ? { ...row, data: editedRow.data, status: 'PENDING_EDIT', errors: [], warnings: [] }
      : row)
    setPreview((current) => current ? ({ ...current, rows: nextRows }) : current)
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await revalidateLeadImport(nextRows, { branchId, assignedToId, deadlineAt, distributionMode: distributionMode || directDistributionMode })
      setPreview(response?.data || response || {})
      setEditingRow(null)
      setNotice('Row saved and validated. Review the updated status before importing.')
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  const revalidate = async () => {
    if (!preview?.rows?.length) return
    setBusy(true); setError(''); setEditingRow(null)
    try {
      const response = await revalidateLeadImport(preview.rows, { branchId, assignedToId, deadlineAt, distributionMode: distributionMode || directDistributionMode })
      setPreview(response?.data || response || {}); setEditingRow(null); setNotice('Validation refreshed. Review the row status before importing.')
    } catch (requestError) { setError(errorMessage(requestError)) } finally { setBusy(false) }
  }

  const importWorkbook = async () => {
    if (!preview?.rows?.length) return
    if (editingRow) { setError('Save or cancel the current row edit before importing.'); return }
    if (preview.rows.some((row) => ['INVALID', 'DUPLICATE', 'PENDING_EDIT'].includes(row.status))) { setError('Fix or remove invalid and duplicate rows, then revalidate before importing.'); return }
    if (getUploadSnapshot().some((upload) => upload.type === 'lead' && upload.status === 'RUNNING')) { setError('Another lead workbook is already importing. Please wait until it finishes.'); return }
    setBusy(true); setError(''); setStep(directDistributionMode ? 4 : 3); setImportStatus({ status: 'PENDING', progress: 0, processedRows: 0, totalRows: preview.rows.length, directDistribution: directDistributionMode })
    const uploadId = startUpload({ type: 'lead', label: file?.name || 'Lead workbook', total: preview.rows.length, visibleTo: [currentUser?.id, currentUser?.userId, assignedToId] })
    try {
      const allocations = directDistributionMode ? targetData.targets.map((target) => ({ userId: target.id, count: Number(directAllocations[target.id] || 0), deadlineAt: directDeadlines[target.id] || deadlineAt })).filter((item) => item.count > 0) : []
      const result = await importLeadRows(preview.rows, { branchId, assignedToId, deadlineAt, distributionMode: distributionMode || directDistributionMode, directDistribution: directDistributionMode, allocations, fileName: file?.name, onProgress: (status) => { setImportStatus(status); updateUpload(uploadId, { uploadId: status.uploadId, progress: status.progress || 0, processed: status.processedRows || 0, total: status.totalRows || preview.rows.length, status: status.status || 'RUNNING', directDistribution: Boolean(status.directDistribution), branchId: status.branchId }) } })
      const status = result?.data || result || {}
      setImportStatus(status)
      const progressPatch = { progress: Number(status.progress ?? 100), processed: status.processedRows ?? preview.rows.length, total: status.totalRows || preview.rows.length, result: status }
      if (String(status.status || '').toUpperCase() === 'AWAITING_DISTRIBUTION') {
        updateUpload(uploadId, { ...progressPatch, status: 'AWAITING_DISTRIBUTION' })
        setNotice(status.directDistribution ? `${Number(status.unassignedRows || 0).toLocaleString()} valid leads remain unassigned in this Super Admin upload. You can distribute them later from Upload activity.` : `${Number(status.totalRows || preview.rows.length).toLocaleString()} leads are staged and waiting for Branch Admin distribution.`)
      } else {
        completeUpload(uploadId, { ...progressPatch, status: status.status || 'COMPLETED' })
        setNotice(`Lead import completed. ${status.activeRows || 0} active leads and ${status.pendingRows || 0} fresh leads are ready.`)
      }
      await onImported?.(status)
      onPendingChanged?.()
    } catch (requestError) { failUpload(uploadId, { error: errorMessage(requestError) }); setError(errorMessage(requestError)); setStep(directDistributionMode ? 3 : 2) } finally { setBusy(false) }
  }

  const removeRow = (rowNumber) => setPreview((current) => {
    if (!current) return current
    const nextRows = current.rows.filter((row) => row.rowNumber !== rowNumber)
    return {
      ...current,
      rows: nextRows,
      totalRows: nextRows.length,
      readyRows: nextRows.filter((row) => row.status === 'READY').length,
      pendingRows: nextRows.filter((row) => row.status === 'PENDING_COMPLETION').length,
      duplicateRows: nextRows.filter((row) => row.status === 'DUPLICATE').length,
      invalidRows: nextRows.filter((row) => row.status === 'INVALID').length,
    }
  })
  const selectedTarget = targetData.targets?.find((item) => item.id === assignedToId)
  const distributionMode = role === 'SUPER_ADMIN' && String(selectedTarget?.role || '').toUpperCase() === 'BRANCH_ADMIN'
  const targetName = selectedTarget?.fullName || ''
  const directRecipientTargets = targetData.targets || []
  const directEligibleRows = Number(preview?.readyRows || 0) + Number(preview?.pendingRows || 0)
  const directAssignedRows = directRecipientTargets.reduce((total, target) => total + (Number(directAllocations[target.id]) || 0), 0)
  const directRemainingRows = Math.max(0, directEligibleRows - directAssignedRows)
  const directOverAllocated = directAssignedRows > directEligibleRows
  const directAllocationValid = directDistributionMode && directAssignedRows > 0 && !directOverAllocated && directRecipientTargets.filter((target) => Number(directAllocations[target.id]) > 0).every((target) => Boolean(directDeadlines[target.id] || deadlineAt))
  const setDirectCount = (targetId, rawValue) => {
    const digits = String(rawValue).replace(/\D/g, '').replace(/^0+(?=\d)/, '')
    setDirectAllocations((current) => ({ ...current, [targetId]: digits }))
  }

  return <div className="lead-import-backdrop" role="presentation">
    <section className="lead-import-modal" role="dialog" aria-modal="true" aria-labelledby="lead-import-title">
      <header className="lead-import-header"><div><p className="lead-import-eyebrow">SALES CRM</p><h2 id="lead-import-title">Upload Lead Excel</h2><p>Upload, validate and assign leads without a row-count restriction.</p></div><button type="button" className="lead-import-close" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
      <div className={`lead-import-stepper${directDistributionMode ? ' is-direct' : ''}`}>{(directDistributionMode ? ['Upload lead excel', 'Preview & validate', 'Choose distribution', 'Import results'] : ['Upload lead excel', 'Review & validate', 'Import results']).map((label, index) => {
        const stepNumber = index + 1
        const reviewReady = Boolean(preview?.rows?.length) && !editingRow && !rows.some((row) => ['INVALID', 'DUPLICATE', 'PENDING_EDIT'].includes(row.status))
        const canNavigate = stepNumber === 1 || (stepNumber === 2 && Boolean(preview)) || (directDistributionMode && stepNumber === 3 && reviewReady) || (stepNumber === (directDistributionMode ? 4 : 3) && Boolean(importStatus))
        return <button key={label} type="button" className={step === stepNumber ? 'is-active' : step > stepNumber ? 'is-complete' : ''} onClick={() => { if (canNavigate) setStep(stepNumber) }} disabled={!canNavigate} aria-current={step === stepNumber ? 'step' : undefined}>
          <span>{step > stepNumber ? <CheckCircle2 size={15} /> : stepNumber}</span><strong>{label}</strong>
        </button>
      })}</div>
      {error ? <div className="lead-import-notice is-error">{error}</div> : null}{notice ? <div className="lead-import-notice is-success">{notice}</div> : null}
      {step === 1 ? <div className="lead-import-body lead-import-upload-step">
        <div className="lead-import-assignment">
          <div><span>Upload destination</span><strong>{role === 'SUPER_ADMIN' ? 'Select a branch and distribution method' : isCombinedBranchAdmin ? 'Your branch and account' : role === 'BRANCH_ADMIN' ? 'Your branch - choose Sales Admin' : 'Your assigned branch and account'}</strong></div>
          {role === 'SUPER_ADMIN' ? <div className="lead-import-routing-options" role="group" aria-label="Lead distribution method"><button type="button" className={!directDistribution ? 'is-selected' : ''} aria-pressed={!directDistribution} onClick={() => { setDirectDistribution(false); setDirectAllocations({}); setError('') }} disabled={busy}><span className="lead-import-route-icon"><UserRound size={18} /></span><span className="lead-import-route-copy"><strong>Upload to one account</strong><small>Upload to one account first. The Branch Admin can distribute the leads later.</small></span></button><button type="button" className={directDistribution ? 'is-selected' : ''} aria-pressed={directDistribution} onClick={() => { setDirectDistribution(true); setDirectAllocations({}); setError(''); setAssignedToId(targetData.targets?.find((target) => String(target.role || '').toUpperCase() === 'BRANCH_ADMIN')?.id || '') }} disabled={busy || !branchId}><span className="lead-import-route-icon"><UsersRound size={18} /></span><span className="lead-import-route-copy"><strong>Distribute directly</strong><small>After preview, distribute the validated leads to Branch Admins or Sales Admins in the selected branch with separate lead counts and deadlines.</small></span></button></div> : null}
          <div className="lead-import-assignment-fields">
            <label>Branch<select value={branchId} disabled={branchLocked || busy} onChange={(event) => setBranchId(event.target.value)}><option value="">Select branch</option>{(targetData.branches || []).map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}</select></label>
            <label>{directDistributionMode ? 'Branch Admin owner for this upload' : 'Sales Admin / Branch Admin'}<select value={assignedToId} disabled={targetLocked || busy || !branchId || (directDistributionMode && Boolean(targetData.targets?.some((target) => String(target.role || '').toUpperCase() === 'BRANCH_ADMIN')))} onChange={(event) => setAssignedToId(event.target.value)}><option value=''>Select account</option>{(directDistributionMode ? targetData.targets?.filter((target) => String(target.role || '').toUpperCase() === 'BRANCH_ADMIN') : targetData.targets || []).map((target) => <option key={target.id} value={target.id}>{target.fullName} - {String(target.role || '').replaceAll('_', ' ')}</option>)}</select></label>
            <label>Completion deadline<input type="date" value={deadlineAt} min={new Date().toISOString().slice(0, 10)} disabled={busy} onChange={(event) => setDeadlineAt(event.target.value)} /></label>
          </div>
          {directDistributionMode ? null : distributionMode ? <small>Upload to <strong>{targetName}</strong>. The Branch Admin will distribute valid leads among this branch's Sales Admins and retain a share.</small> : targetName ? <small>Leads will be assigned to <strong>{targetName}</strong> after import.</small> : null}
        </div>
        <div className="lead-import-file-actions">
          <div className="lead-import-template"><div><strong>Before you upload</strong><span>Use the Lead Data template with the correct headers and sample rows.</span></div><button type="button" className="lead-import-secondary" onClick={() => void downloadLeadImportTemplate()} disabled={busy}><Download size={15} /> Download template</button></div>
          <div className={'lead-import-dropzone ' + (dragging ? 'is-dragging' : '')} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void selectFile(event.dataTransfer.files?.[0]) }}>
            <span className="lead-import-dropzone-icon"><FileSpreadsheet size={28} /></span><h3>{file ? file.name : 'Drop your lead workbook here'}</h3><p>{file ? 'Excel file selected. Your uploaded file is preserved while you review or edit the rows.' : 'Upload an .xlsx file with lead details.'}</p>
            <button type="button" className="lead-import-primary" onClick={() => inputRef.current?.click()} disabled={busy || !branchId || !assignedToId}>{busy ? <><LoaderCircle className="lead-import-spin" size={16} /> Validating...</> : <><Upload size={16} /> {file ? 'Choose another Excel file' : 'Choose Excel file'}</>}</button>
            <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={(event) => void selectFile(event.target.files?.[0])} />
          </div>
        </div>
      </div> : null}
      {step === 2 ? <div className="lead-import-body">
        <div className="lead-import-summary-grid"><div><span>Total rows</span><strong>{preview?.totalRows || 0}</strong></div><div className="is-ready"><span>Ready for active</span><strong>{preview?.readyRows || 0}</strong></div><div className="is-pending"><span>Fresh Leads</span><strong>{preview?.pendingRows || 0}</strong></div><button type="button" className={`lead-import-summary-card is-invalid${statusFilter === 'DUPLICATE' ? ' is-selected' : ''}`} onClick={() => { setStatusFilter('DUPLICATE'); setTablePage(1) }} disabled={busy || Boolean(editingRow)}><span>Duplicates / invalid</span><strong>{(preview?.duplicateRows || 0) + (preview?.invalidRows || 0)}</strong></button></div>
        {directDistributionMode && (Number(preview?.duplicateRows || 0) + Number(preview?.invalidRows || 0) > 0) ? <div className="lead-import-review-warning" role="status">Remove or edit all duplicate and invalid rows, then revalidate before continuing to distribution.</div> : null}
        <div className="lead-import-preview-head"><div><h3>Preview & validate</h3><p>Click Edit to change every field in a row. Saving a row validates it automatically.</p></div><div className="lead-import-preview-tools"><label className="lead-import-status-filter">Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setTablePage(1) }} disabled={busy || Boolean(editingRow)}><option value="ALL">All statuses</option><option value="READY">Ready</option><option value="PENDING_COMPLETION">Fresh Lead</option><option value="DUPLICATE">Duplicate</option><option value="INVALID">Invalid</option><option value="PENDING_EDIT">Edited - revalidate</option><option value="IMPORTED">Imported</option></select></label><button type="button" className="lead-import-secondary" onClick={() => void revalidate()} disabled={busy || Boolean(editingRow)}><RefreshCw size={15} /> Revalidate</button></div></div>
        <div className="lead-import-table-wrap"><table className="lead-import-table"><thead><tr><th>S.No</th>{PREVIEW_FIELDS.map(([, label]) => <th key={label}>{label}</th>)}<th>Status</th><th>Actions</th></tr></thead><tbody>{visibleRows.map((row, visibleIndex) => {
          const rowEditing = editingRow?.rowNumber === row.rowNumber
          return <tr key={row.rowNumber} className={'is-' + String(row.status || '').toLowerCase() + (rowEditing ? ' is-editing' : '')}><td>{(tablePage - 1) * PAGE_SIZE + visibleIndex + 1}</td>
            {PREVIEW_FIELDS.map(([field]) => <td key={field}>{rowEditing
              ? <input className="lead-import-inline-input" value={editingRow?.data?.[field] ?? ''} onChange={(event) => updateEditing(field, event.target.value)} aria-label={field + ' row ' + row.rowNumber} />
              : <button type="button" className="lead-import-cell" onClick={() => beginEdit(row)} title="Click Edit to change this row">{row.data?.[field] || '-'}</button>}</td>)}
            <td><span className={'lead-import-status status-' + String(row.status || '').toLowerCase()}>{statusLabel(row.status)}</span>{row.errors?.length ? <small>{row.errors.join(' ')}</small> : null}</td>
            <td className="lead-import-actions-cell">{rowEditing
              ? <><button type="button" className="lead-import-save" onClick={() => void saveEdit()} disabled={busy}>{busy ? <LoaderCircle className="lead-import-spin" size={14} /> : <Save size={14} />} {busy ? 'Checking…' : 'Save'}</button><button type="button" className="lead-import-cancel" onClick={() => setEditingRow(null)} disabled={busy}>Cancel</button></>
              : <><button type="button" className="lead-import-icon-button" onClick={() => beginEdit(row)} aria-label="Edit row"><Pencil size={14} /> Edit</button><button type="button" className="lead-import-remove" onClick={() => removeRow(row.rowNumber)}><Trash2 size={13} /> Remove</button></>}
            </td>
          </tr>
        })}</tbody></table>{!visibleRows.length ? <p className="lead-import-empty">No rows in this preview.</p> : null}</div>
        <div className="lead-import-pagination"><span>Showing {filteredRows.length ? (tablePage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(tablePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}{statusFilter !== 'ALL' ? ` filtered from ${rows.length}` : ''}</span><div><button type="button" onClick={() => setTablePage((page) => Math.max(1, page - 1))} disabled={tablePage <= 1}>Previous</button><button type="button" onClick={() => setTablePage((page) => Math.min(totalPages, page + 1))} disabled={tablePage >= totalPages}>Next</button></div></div>
        <div className="lead-import-actions"><button type="button" className="lead-import-secondary" onClick={() => { setStep(1); setPreview(null); setFile(null); setEditingRow(null) }} disabled={busy || Boolean(editingRow)}>Choose another file</button>{directDistributionMode ? <button type="button" className="lead-import-primary" onClick={() => setStep(3)} disabled={busy || Boolean(editingRow) || !rows.length || rows.some((row) => ['INVALID', 'DUPLICATE', 'PENDING_EDIT'].includes(row.status))}>{'Continue to distribution'}</button> : <button type="button" className="lead-import-primary" onClick={() => void importWorkbook()} disabled={busy || Boolean(editingRow) || !rows.length || rows.some((row) => ['INVALID', 'DUPLICATE', 'PENDING_EDIT'].includes(row.status))}>{busy ? <><LoaderCircle className="lead-import-spin" size={16} /> Importing...</> : 'Import leads'}</button>}</div>
      </div> : null}
      {step === 3 && directDistributionMode ? <div className="lead-import-body lead-import-distribution-step"><div className="lead-import-distribution-intro"><span className="lead-import-eyebrow">STEP 3 ? DISTRIBUTION</span><h3>Choose recipients and lead counts</h3><p>Preview is complete. Set a lead count and deadline for each branch account, then start the import.</p></div><div className="lead-import-summary-grid lead-import-distribution-summary"><div><span>Rows to assign</span><strong>{directEligibleRows.toLocaleString()}</strong></div><div className="is-ready"><span>Active Leads</span><strong>{Number(preview?.readyRows || 0).toLocaleString()}</strong></div><div className="is-pending"><span>Fresh Leads</span><strong>{Number(preview?.pendingRows || 0).toLocaleString()}</strong></div><div><span>Still unassigned</span><strong>{directRemainingRows.toLocaleString()}</strong></div></div><section className="lead-import-direct-allocation" aria-labelledby="lead-import-direct-allocation-title"><div className="lead-import-direct-allocation-heading"><div><span>DIRECT DISTRIBUTION</span><h3 id="lead-import-direct-allocation-title">Set account allocations</h3><p>Only admins assigned to {targetData.branches?.find((branch) => branch.id === branchId)?.branchName || 'this branch'} are listed.</p></div><div><small>Valid rows</small><strong>{directEligibleRows.toLocaleString()}</strong></div></div><div className="lead-import-direct-allocation-summary"><span>Assigned <strong>{directAssignedRows.toLocaleString()}</strong></span><span>Remaining <strong>{directRemainingRows.toLocaleString()}</strong></span><span>Default deadline <strong>{deadlineAt || 'not set'}</strong></span></div><div className="lead-import-direct-recipient-list">{directRecipientTargets.map((target) => <div className="lead-import-direct-recipient" key={target.id}><div><strong>{target.fullName}</strong><span className={'lead-import-role-tag is-' + String(target.role || '').toLowerCase()}>{String(target.role || '').replaceAll('_', ' ')}</span></div><label><span>Lead count</span><input type="text" inputMode="numeric" value={directAllocations[target.id] ?? '0'} onFocus={(event) => { if (event.currentTarget.value === '0') setDirectAllocations((current) => ({ ...current, [target.id]: '' })) }} onBlur={() => setDirectAllocations((current) => ({ ...current, [target.id]: String(Number(current[target.id] || 0)) }))} onChange={(event) => setDirectCount(target.id, event.target.value)} aria-label={'Lead count for ' + target.fullName} /></label><label><span>Deadline</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={directDeadlines[target.id] || deadlineAt} onChange={(event) => setDirectDeadlines((current) => ({ ...current, [target.id]: event.target.value }))} aria-label={'Completion deadline for ' + target.fullName} /></label></div>)}</div>{directOverAllocated ? <p className="lead-import-direct-allocation-error" role="alert">Assigned count exceeds the {directEligibleRows.toLocaleString()} valid rows. Reduce one or more allocations.</p> : null}<p className="lead-import-direct-allocation-footnote">Duplicate and invalid rows were removed from the allocation total. Unassigned rows stay with the Super Admin. Active Leads get IDs; Fresh Leads remain in Fresh Leads.</p></section><div className="lead-import-actions"><button type="button" className="lead-import-secondary" onClick={() => setStep(2)} disabled={busy}>Back to preview</button><button type="button" className="lead-import-primary" onClick={() => void importWorkbook()} disabled={busy || !directAllocationValid}>{busy ? <><LoaderCircle className="lead-import-spin" size={16} /> Importing...</> : 'Distribute & import'}</button></div></div> : null}
      {step === (directDistributionMode ? 4 : 3) ? <div className="lead-import-body lead-import-results"><div className="lead-import-result-icon"><CheckCircle2 size={32} /></div><h3>{importStatus?.status === 'AWAITING_DISTRIBUTION' ? (importStatus?.directDistribution ? 'Leads staged - distribution pending' : 'Ready for branch distribution') : importStatus?.status === 'FAILED' ? 'Import failed' : importStatus?.status === 'COMPLETED' ? 'Import completed' : 'Import processing'}</h3><p>{importStatus?.status === 'AWAITING_DISTRIBUTION' ? (importStatus?.directDistribution ? `${Number(importStatus?.unassignedRows || 0).toLocaleString()} valid leads remain unassigned. Continue distribution from Upload activity when ready.` : 'The upload is ready. The Branch Admin can now assign each valid lead to themselves or a Sales Admin.') : importStatus?.status === 'FAILED' ? importStatus.errorMessage : 'You can close this window. Upload progress will continue in the header.'}</p><div className="lead-import-progress"><div><span>{importStatus?.status === 'AWAITING_DISTRIBUTION' ? 'Rows staged' : 'Rows processed'}</span><strong>{Number(importStatus?.processedRows || 0).toLocaleString()} of {Number(importStatus?.totalRows || preview?.rows?.length || 0).toLocaleString()} · {Math.max(0, Math.min(100, Number(importStatus?.progress || 0)))}%</strong></div><div className={`lead-import-progress-track${Number(importStatus?.progress || 0) <= 0 && importStatus?.status !== 'FAILED' ? ' is-indeterminate' : ''}`}><i style={{ width: `${Math.max(0, Math.min(100, Number(importStatus?.progress || 0))) || 28}%` }} /></div></div><div className="lead-import-result-grid"><div><span>Active leads</span><strong>{importStatus?.activeRows || 0}</strong></div><div><span>Fresh Leads</span><strong>{importStatus?.pendingRows || 0}</strong></div><div><span>Duplicates</span><strong>{importStatus?.duplicateRows || 0}</strong></div><div><span>Invalid</span><strong>{importStatus?.invalidRows || 0}</strong></div></div><div className="lead-import-actions"><button type="button" className="lead-import-primary" onClick={onClose}>Done</button></div></div> : null}
    </section>
  </div>
}
