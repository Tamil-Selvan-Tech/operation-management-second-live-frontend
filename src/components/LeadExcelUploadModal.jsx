import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Pencil, RefreshCw, Save, Trash2, Upload, X } from 'lucide-react'
import { downloadLeadImportTemplate, getLeadImportTargets, importLeadRows, previewLeadImport, revalidateLeadImport } from '../services/leadImportService'
import { completeUpload, failUpload, getUploadSnapshot, startUpload, updateUpload } from '../lib/uploadProgressStore'
import '../styles/LeadExcelUploadModal.css'

const PAGE_SIZE = 25
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
  return ({ READY: 'Ready', PENDING_COMPLETION: 'Valid - Pending completion', DUPLICATE: 'Duplicate', INVALID: 'Invalid', IMPORTED: 'Imported', PENDING_EDIT: 'Edited - revalidate' })[status] || status || 'Review'
}

export function LeadExcelUploadModal({ isOpen, onClose, currentUser = {}, onImported, onPendingChanged }) {
  const inputRef = useRef(null)
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [targetData, setTargetData] = useState({ branches: [], targets: [], lockedBranchId: null, lockedTargetId: null })
  const [branchId, setBranchId] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [deadlineAt, setDeadlineAt] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingRow, setEditingRow] = useState(null)
  const [tablePage, setTablePage] = useState(1)
  const [importStatus, setImportStatus] = useState(null)
  const [dragging, setDragging] = useState(false)

  const role = roleName(currentUser)
  const isCombinedBranchAdmin = role === 'BRANCH_ADMIN' && String(currentUser?.roleAccess || currentUser?.managedBranch?.roleAccess || '').toUpperCase() === 'BRANCH_ADMIN_SALES_ADMIN'
  const branchLocked = role === 'BRANCH_ADMIN' || (role === 'SALES_ADMIN' && Boolean(targetData.lockedBranchId))
  const targetLocked = role === 'SALES_ADMIN' || isCombinedBranchAdmin
  const rows = useMemo(() => preview?.rows || [], [preview?.rows])
  const visibleRows = useMemo(() => rows.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE), [rows, tablePage])
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))

  useEffect(() => {
    if (!isOpen) return undefined
    const resetTimer = window.setTimeout(() => {
      setStep(1); setFile(null); setPreview(null); setBusy(false); setError(''); setNotice(''); setEditingRow(null); setTablePage(1); setImportStatus(null); setDragging(false)
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
    void getLeadImportTargets(branchId).then((response) => { const data = response?.data || response || {}; setTargetData(data); if (role === 'SALES_ADMIN') setAssignedToId(data.lockedTargetId || currentUser?.id || currentUser?.userId || '') }).catch((requestError) => setError(errorMessage(requestError)))
    return () => window.clearTimeout(clearTargetTimer)
  }, [branchId, branchLocked, currentUser?.id, currentUser?.userId, isOpen, role])

  if (!isOpen) return null

  const selectFile = async (nextFile) => {
    setError(''); setNotice(''); setPreview(null); setImportStatus(null); setEditingRow(null); setTablePage(1)
    if (!nextFile) return
    if (!/\.xlsx$/i.test(nextFile.name)) { setError('Only .xlsx files are supported.'); return }
    if (!branchId || !assignedToId) { setError('Select a branch and Sales Admin before uploading.'); return }
    if (!deadlineAt) { setError('Select a completion deadline before uploading.'); return }
    setFile(nextFile); setBusy(true)
    try {
      const response = await previewLeadImport(nextFile, { branchId, assignedToId, deadlineAt, distributionMode })
      setPreview(response?.data || response || {})
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
      const response = await revalidateLeadImport(nextRows, { branchId, assignedToId, deadlineAt, distributionMode })
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
      const response = await revalidateLeadImport(preview.rows, { branchId, assignedToId, deadlineAt, distributionMode })
      setPreview(response?.data || response || {}); setEditingRow(null); setNotice('Validation refreshed. Review the row status before importing.')
    } catch (requestError) { setError(errorMessage(requestError)) } finally { setBusy(false) }
  }

  const importWorkbook = async () => {
    if (!preview?.rows?.length) return
    if (editingRow) { setError('Save or cancel the current row edit before importing.'); return }
    if (preview.rows.some((row) => ['INVALID', 'DUPLICATE', 'PENDING_EDIT'].includes(row.status))) { setError('Fix or remove invalid and duplicate rows, then revalidate before importing.'); return }
    if (getUploadSnapshot().some((upload) => upload.type === 'lead' && upload.status === 'RUNNING')) { setError('Another lead workbook is already importing. Please wait until it finishes.'); return }
    setBusy(true); setError(''); setStep(3); setImportStatus({ status: 'PENDING', progress: 0, processedRows: 0, totalRows: preview.rows.length })
    const uploadId = startUpload({ type: 'lead', label: file?.name || 'Lead workbook', total: preview.rows.length, visibleTo: [currentUser?.id, currentUser?.userId, assignedToId] })
    try {
      const result = await importLeadRows(preview.rows, { branchId, assignedToId, deadlineAt, distributionMode, fileName: file?.name, onProgress: (status) => { setImportStatus(status); updateUpload(uploadId, { uploadId: status.uploadId, progress: status.progress || 0, processed: status.processedRows || 0, total: status.totalRows || preview.rows.length, status: status.status || 'RUNNING' }) } })
      const status = result?.data || result || {}
      setImportStatus(status)
      const progressPatch = { progress: Number(status.progress ?? 100), processed: status.processedRows || preview.rows.length, total: status.totalRows || preview.rows.length, result: status }
      if (String(status.status || '').toUpperCase() === 'AWAITING_DISTRIBUTION') {
        updateUpload(uploadId, { ...progressPatch, status: 'AWAITING_DISTRIBUTION' })
        setNotice(`${Number(status.totalRows || preview.rows.length).toLocaleString()} leads are staged and waiting for Branch Admin distribution.`)
      } else {
        completeUpload(uploadId, { ...progressPatch, status: status.status || 'COMPLETED' })
        setNotice(`Lead import completed. ${status.activeRows || 0} active leads and ${status.pendingRows || 0} pending completion rows are ready.`)
      }
      await onImported?.(status)
      onPendingChanged?.()
    } catch (requestError) { failUpload(uploadId, { error: errorMessage(requestError) }); setError(errorMessage(requestError)); setStep(2) } finally { setBusy(false) }
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

  return <div className="lead-import-backdrop" role="presentation">
    <section className="lead-import-modal" role="dialog" aria-modal="true" aria-labelledby="lead-import-title">
      <header className="lead-import-header"><div><p className="lead-import-eyebrow">SALES CRM</p><h2 id="lead-import-title">Upload Lead Excel</h2><p>Upload, validate and assign leads without a row-count restriction.</p></div><button type="button" className="lead-import-close" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
      <div className="lead-import-stepper">{['Upload lead excel', 'Review & validate', 'Import results'].map((label, index) => {
        const stepNumber = index + 1
        const canNavigate = stepNumber === 1 || (stepNumber === 2 && Boolean(preview)) || (stepNumber === 3 && Boolean(importStatus))
        return <button key={label} type="button" className={step === stepNumber ? 'is-active' : step > stepNumber ? 'is-complete' : ''} onClick={() => { if (canNavigate) setStep(stepNumber) }} disabled={!canNavigate} aria-current={step === stepNumber ? 'step' : undefined}>
          <span>{step > stepNumber ? <CheckCircle2 size={15} /> : stepNumber}</span><strong>{label}</strong>
        </button>
      })}</div>
      {error ? <div className="lead-import-notice is-error">{error}</div> : null}{notice ? <div className="lead-import-notice is-success">{notice}</div> : null}
      {step === 1 ? <div className="lead-import-body">
        <div className="lead-import-assignment">
          <div><span>Upload destination</span><strong>{role === 'SUPER_ADMIN' ? 'Choose a branch and upload destination' : isCombinedBranchAdmin ? 'Your branch and account' : role === 'BRANCH_ADMIN' ? 'Your branch - choose Sales Admin' : 'Your assigned branch and account'}</strong></div>
          <div className="lead-import-assignment-fields">
            <label>Branch<select value={branchId} disabled={branchLocked || busy} onChange={(event) => setBranchId(event.target.value)}><option value="">Select branch</option>{(targetData.branches || []).map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}</select></label>
            <label>Sales Admin<select value={assignedToId} disabled={targetLocked || busy || !branchId} onChange={(event) => setAssignedToId(event.target.value)}><option value="">Select account</option>{(targetData.targets || []).map((target) => <option key={target.id} value={target.id}>{target.fullName}{isCombinedBranchAdmin && target.id === (currentUser?.id || currentUser?.userId) ? ' (You)' : ` - ${target.role === 'BRANCH_ADMIN' ? 'Branch + Sales' : 'Sales Admin'}`}</option>)}</select></label>
            <label>Completion deadline<input type="date" value={deadlineAt} min={new Date().toISOString().slice(0, 10)} disabled={busy} onChange={(event) => setDeadlineAt(event.target.value)} /></label>
          </div>
          {distributionMode ? <small>Upload to <strong>{targetName}</strong>. The Branch Admin will distribute valid leads among this branch?s Sales Admins and retain a share.</small> : targetName ? <small>Leads will be assigned to <strong>{targetName}</strong> after import.</small> : null}
        </div>
        <div className={'lead-import-dropzone ' + (dragging ? 'is-dragging' : '')} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void selectFile(event.dataTransfer.files?.[0]) }}>
          <FileSpreadsheet size={38} /><h3>{file ? file.name : 'Drop your lead workbook here'}</h3><p>{file ? 'Excel file selected. Your uploaded file is preserved while you review or edit the rows.' : 'Name and mobile are required. Core-only rows go to Pending Completion; complete rows go to Active Leads.'}</p>
          <button type="button" className="lead-import-primary" onClick={() => inputRef.current?.click()} disabled={busy || !branchId || !assignedToId}>{busy ? <><LoaderCircle className="lead-import-spin" size={16} /> Validating...</> : <><Upload size={16} /> {file ? 'Choose another Excel file' : 'Choose Excel file'}</>}</button>
          <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={(event) => void selectFile(event.target.files?.[0])} />
        </div>
        <div className="lead-import-template"><div><strong>Need the correct format?</strong><span>Download the template with sample rows in the Lead Data sheet.</span></div><button type="button" className="lead-import-secondary" onClick={() => void downloadLeadImportTemplate()} disabled={busy}><Download size={15} /> Download template</button></div>
      </div> : null}
      {step === 2 ? <div className="lead-import-body">
        <div className="lead-import-summary-grid"><div><span>Total rows</span><strong>{preview?.totalRows || 0}</strong></div><div className="is-ready"><span>Ready for active</span><strong>{preview?.readyRows || 0}</strong></div><div className="is-pending"><span>Valid - pending completion</span><strong>{preview?.pendingRows || 0}</strong></div><div className="is-invalid"><span>Duplicates / invalid</span><strong>{(preview?.duplicateRows || 0) + (preview?.invalidRows || 0)}</strong></div></div>
        <div className="lead-import-preview-head"><div><h3>Preview & validate</h3><p>Click Edit to change every field in a row. Saving a row validates it automatically.</p></div><button type="button" className="lead-import-secondary" onClick={() => void revalidate()} disabled={busy || Boolean(editingRow)}><RefreshCw size={15} /> Revalidate</button></div>
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
        <div className="lead-import-pagination"><span>Showing {(tablePage - 1) * PAGE_SIZE + (visibleRows.length ? 1 : 0)}-{Math.min(tablePage * PAGE_SIZE, rows.length)} of {rows.length}</span><div><button type="button" onClick={() => setTablePage((page) => Math.max(1, page - 1))} disabled={tablePage <= 1}>Previous</button><button type="button" onClick={() => setTablePage((page) => Math.min(totalPages, page + 1))} disabled={tablePage >= totalPages}>Next</button></div></div>
        <div className="lead-import-actions"><button type="button" className="lead-import-secondary" onClick={() => { setStep(1); setPreview(null); setFile(null); setEditingRow(null) }} disabled={busy || Boolean(editingRow)}>Choose another file</button><button type="button" className="lead-import-primary" onClick={() => void importWorkbook()} disabled={busy || Boolean(editingRow) || !rows.length || rows.some((row) => ['INVALID', 'DUPLICATE', 'PENDING_EDIT'].includes(row.status))}>{busy ? <><LoaderCircle className="lead-import-spin" size={16} /> Importing...</> : 'Import leads'}</button></div>
      </div> : null}
      {step === 3 ? <div className="lead-import-body lead-import-results"><div className="lead-import-result-icon"><CheckCircle2 size={32} /></div><h3>{importStatus?.status === 'AWAITING_DISTRIBUTION' ? 'Ready for branch distribution' : importStatus?.status === 'FAILED' ? 'Import failed' : importStatus?.status === 'COMPLETED' ? 'Import completed' : 'Import processing'}</h3><p>{importStatus?.status === 'AWAITING_DISTRIBUTION' ? 'The upload is ready. The Branch Admin can now assign each valid lead to themselves or a Sales Admin.' : importStatus?.status === 'FAILED' ? importStatus.errorMessage : 'You can close this window. Upload progress will continue in the header.'}</p><div className="lead-import-progress"><div><span>{importStatus?.status === 'AWAITING_DISTRIBUTION' ? 'Rows staged' : 'Rows processed'}</span><strong>{Number(importStatus?.processedRows || 0).toLocaleString()} of {Number(importStatus?.totalRows || preview?.rows?.length || 0).toLocaleString()} · {Math.max(0, Math.min(100, Number(importStatus?.progress || 0)))}%</strong></div><div className={`lead-import-progress-track${Number(importStatus?.progress || 0) <= 0 && importStatus?.status !== 'FAILED' ? ' is-indeterminate' : ''}`}><i style={{ width: `${Math.max(0, Math.min(100, Number(importStatus?.progress || 0))) || 28}%` }} /></div></div><div className="lead-import-result-grid"><div><span>Active leads</span><strong>{importStatus?.activeRows || 0}</strong></div><div><span>Valid pending</span><strong>{importStatus?.pendingRows || 0}</strong></div><div><span>Duplicates</span><strong>{importStatus?.duplicateRows || 0}</strong></div><div><span>Invalid</span><strong>{importStatus?.invalidRows || 0}</strong></div></div><div className="lead-import-actions"><button type="button" className="lead-import-primary" onClick={onClose}>Done</button></div></div> : null}
    </section>
  </div>
}
