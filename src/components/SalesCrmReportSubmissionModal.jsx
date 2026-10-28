import { useMemo, useState } from 'react'
import { FileSpreadsheet, Loader2, X } from 'lucide-react'
import { submitSalesCrmReport } from '../services/salesCrmReportSubmissionService'
import '../styles/SalesCrmReportSubmissionModal.css'

const types = [['COMPREHENSIVE', 'Comprehensive Sales CRM Report'], ['MONTHLY_SALES', 'Monthly Sales Report'], ['LEAD_MANAGEMENT', 'Lead Management Report'], ['FOLLOW_UP', 'Follow-up Report'], ['ADMISSION', 'Admission Report']]

export function SalesCrmReportSubmissionModal({ isOpen, onClose, branches = [], initialBranchId = '', initialFromDate = '', initialToDate = '', onSubmitted }) {
  const [form, setForm] = useState({ reportName: 'Comprehensive Sales CRM Report', reportType: 'COMPREHENSIVE', fromDate: initialFromDate, toDate: initialToDate, branchId: initialBranchId, message: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const selectedPeriod = useMemo(() => form.fromDate && form.toDate ? `${form.fromDate} to ${form.toDate}` : 'Select both dates', [form.fromDate, form.toDate])
  if (!isOpen) return null
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event) => {
    event.preventDefault(); setError('')
    if (!form.fromDate || !form.toDate) return setError('From Date and To Date are required.')
    if (form.fromDate > form.toDate) return setError('To Date cannot be earlier than From Date.')
    setSubmitting(true)
    try { const response = await submitSalesCrmReport({ ...form, idempotencyKey: `${Date.now()}-${form.reportType}-${form.fromDate}-${form.toDate}` }); onSubmitted?.(response?.data || response); onClose?.() } catch (reason) { setError(reason?.body?.message || reason?.message || 'Unable to generate and send the report.') } finally { setSubmitting(false) }
  }
  return <div className="sales-crm-submit-backdrop"><form className="sales-crm-submit-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="sales-crm-submit-title"><header><div><span>SALES CRM REPORTS</span><h2 id="sales-crm-submit-title">Send Report</h2><p>Generate an Excel report and send it to Super Admin.</p></div><button type="button" onClick={onClose} disabled={submitting} aria-label="Close"><X size={18} /></button></header><div className="sales-crm-submit-grid"><label>Report Name<input value={form.reportName} onChange={(event) => update('reportName', event.target.value)} required /></label><label>Report Type<select value={form.reportType} onChange={(event) => { const value = event.target.value; update('reportType', value); update('reportName', types.find(([key]) => key === value)?.[1] || '') }}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>From Date<input type="date" value={form.fromDate} onChange={(event) => update('fromDate', event.target.value)} required /></label><label>To Date<input type="date" min={form.fromDate || undefined} value={form.toDate} onChange={(event) => update('toDate', event.target.value)} required /></label><label>Branch<select value={form.branchId} onChange={(event) => update('branchId', event.target.value)}><option value="">All permitted branches</option>{branches.map((branch) => <option key={branch.id || branch.branchId} value={branch.id}>{branch.branchName || branch.branchId}</option>)}</select></label><label>Report Format<input value="Excel (.xlsx)" readOnly /></label><label className="sales-crm-submit-message">Optional Message<textarea rows="3" value={form.message} onChange={(event) => update('message', event.target.value)} /></label></div><div className="sales-crm-submit-period"><span>Selected report period</span><strong>{selectedPeriod}</strong></div>{error ? <p className="sales-crm-submit-error" role="alert">{error}</p> : null}<footer><button type="button" onClick={onClose} disabled={submitting}>Cancel</button><button type="submit" disabled={submitting}>{submitting ? <><Loader2 size={16} className="is-spinning" />Generating &amp; Sending...</> : <><FileSpreadsheet size={16} />Generate &amp; Send Report</>}</button></footer></form></div>
}
