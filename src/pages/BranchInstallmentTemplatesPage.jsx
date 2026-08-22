import { useEffect, useMemo, useState } from 'react'
import {
  BadgeInfo,
  CalendarDays,
  CirclePlus,
  IndianRupee,
  Pencil,
  RefreshCcw,
  Search,
  Shield,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'

import { Button } from '../components/Button'
import { PaginationBar } from '../components/PaginationBar'
import {
  createBranchInstallmentTemplate,
  deleteBranchInstallmentTemplate,
  listBranchInstallmentTemplates,
  normalizeBranchInstallmentTemplate,
  updateBranchInstallmentTemplate,
} from '../services/branchInstallmentTemplateService'
import '../styles/BranchInstallmentTemplatesPage.css'

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE']
const DUE_RULE_OPTIONS = ['Admission', 'Monthly', 'Custom']

function Field({ label, hint, error, required = false, children }) {
  return (
    <label className="installment-field">
      <span className="installment-field-label">
        {label}
        {required ? <strong>*</strong> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <span className="installment-field-error">{error}</span> : null}
    </label>
  )
}

function createEmptyTemplateForm() {
  return {
    templateName: '',
    installmentCount: '1',
    dueRule: 'Admission',
    customDueRule: '',
    allowCustomization: true,
    status: 'ACTIVE',
  }
}

function sumAmounts(amounts = []) {
  return (Array.isArray(amounts) ? amounts : [])
    .map((value) => Number(String(value || '').trim()))
    .filter((value) => Number.isFinite(value))
    .reduce((total, value) => total + value, 0)
}

function createValidationErrors(form) {
  const errors = {}
  const installmentCount = Number(form.installmentCount || 0)

  if (!String(form.templateName || '').trim()) {
    errors.templateName = 'Template name is required.'
  }

  if (!String(form.installmentCount || '').trim()) {
    errors.installmentCount = 'Installment count is required.'
  } else if (installmentCount <= 0) {
    errors.installmentCount = 'Installment count must be greater than zero.'
  }

  return {
    errors,
    installmentCount: Math.max(1, installmentCount || 1),
  }
}

export function BranchInstallmentTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [editingTemplateId, setEditingTemplateId] = useState('')
  const [form, setForm] = useState(() => createEmptyTemplateForm())
  const [touched, setTouched] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
const [isCreateOpen, setIsCreateOpen] = useState(false)
  const validation = useMemo(() => createValidationErrors(form), [form])

  const loadTemplates = async (nextPage = page) => {
    setLoading(true)
    setError('')
    try {
      const result = await listBranchInstallmentTemplates({
        page: nextPage,
        limit: 6,
        search: searchTerm,
        status: statusFilter,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      setTemplates(result.data || [])
      setTotalPages(Math.max(1, Number(result.meta?.totalPages || 1)))
      setPage(Math.min(nextPage, Math.max(1, Number(result.meta?.totalPages || 1))))
    } catch (err) {
      setTemplates([])
      setError(err?.message || 'Unable to load installment templates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTemplates(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const markTouched = (key) => {
    setTouched((current) => ({
      ...current,
      [key]: true,
    }))
  }

  const updateField = (field, value) => {
    setError('')
    setForm((current) => {
      if (field === 'installmentCount') {
        const safeCountValue = String(value || '').replace(/[^\d]/g, '')
        return {
          ...current,
          installmentCount: safeCountValue,
        }
      }

      return {
        ...current,
        [field]: value,
      }
    })
  }

  const resetForm = () => {
    setEditingTemplateId('')
    setForm(createEmptyTemplateForm())
    setTouched({})
    setError('')
  }

  const startEdit = (template) => {
    const normalized = normalizeBranchInstallmentTemplate(template)
    setEditingTemplateId(normalized.id)
    setIsCreateOpen(true)
    setForm({
      templateName: normalized.templateName || '',
      installmentCount: String(normalized.installmentCount || 1),
      dueRule: normalized.dueRule || 'Admission',
      allowCustomization: Boolean(normalized.allowCustomization ?? true),
      status: normalized.status || 'ACTIVE',
    })
    setTouched({})
    setError('')
  }

  const submitForm = async (event) => {
    event.preventDefault()
    const nextTouched = {
      templateName: true,
      installmentCount: true,
      dueRule: true,
      allowCustomization: true,
      status: true,
    }
    setTouched(nextTouched)

    if (Object.keys(validation.errors).length > 0) {
      setError(Object.values(validation.errors)[0] || 'Please complete the template form.')
      return
    }

    setSaving(true)
    try {
      const normalizedInstallmentCount = Math.max(1, Number(form.installmentCount || 0) || 1)
      const normalizedPlanType = normalizedInstallmentCount <= 1 ? 'FULL_PAYMENT' : 'CUSTOM'

      const payload = {
        templateName: String(form.templateName || '').trim(),
        planType: normalizedPlanType,
        installmentCount: normalizedInstallmentCount,
        installments: [],
        dueRule: String(form.dueRule || 'Admission').trim(),
        allowCustomization: Boolean(form.allowCustomization),
        status: String(form.status || 'ACTIVE').trim(),
      }

      if (editingTemplateId) {
        await updateBranchInstallmentTemplate(editingTemplateId, payload)
      } else {
        await createBranchInstallmentTemplate(payload)
      }
      const wasEditing = Boolean(editingTemplateId)

      resetForm()
      setIsCreateOpen(false)

      await loadTemplates(wasEditing ? page : 1)
    } catch (err) {
      setError(err?.message || 'Unable to save installment template.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (template) => {
    setDeleteTarget(template)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await deleteBranchInstallmentTemplate(deleteTarget.id)
      setDeleteTarget(null)
      await loadTemplates(page)
    } catch (err) {
      setError(err?.message || 'Unable to delete template.')
    } finally {
      setSaving(false)
    }
  }

  const shouldShowError = (field) => Boolean(touched[field] && validation.errors[field])
  const templateModeLabel = Number(form.installmentCount || 0) <= 1 ? 'Full Payment' : 'Customize'

  return (
    <section className="installment-page">
      <div className="installment-page-hero">
        <div>
          <p className="installment-kicker">Installment Template</p>
          <h2>Create reusable payment plans</h2>
          {/* <p>
            Build standalone installment templates here. Later you can pick them for courses or student fee plans.
          </p> */}
        </div>
        {/* <div className="installment-page-stats">
          <article>
            <span>Total Rows</span>
            <strong>{templates.length}</strong>
          </article>
          <article>
            <span>Active</span>
            <strong>{templates.filter((item) => item.status === 'ACTIVE').length}</strong>
          </article>
        </div> */}
        <div>
          <button
            type="button"
            className="installment-reset-button"
            onClick={() => {
  resetForm()
  setIsCreateOpen(true)
}}
          >
            <CirclePlus size={14} strokeWidth={2.2} />
            {isCreateOpen ? 'Hide Form' : 'Create Template'}
          </button>
        </div>

      </div>
<div className="installment-page-layout">
  {isCreateOpen ? (
  <div className="installment-modal-backdrop">
    <div
      className="installment-create-modal"
      role="dialog"
      aria-modal="true"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="installment-card-header">
        <div>
          <p className="installment-card-label">
            Installment Template
          </p>

          <h3>
            {editingTemplateId
              ? 'Edit Installment Template'
              : 'Create Installment Template'}
          </h3>
        </div>

        <button
          type="button"
          className="installment-modal-close"
          onClick={() => {
            setIsCreateOpen(false)
            resetForm()
          }}
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>

      <div className="installment-form-grid">

        <Field
          label="Plan Name"
          required
          hint="Example: 3 Installments Plan"
          error={
            shouldShowError('templateName')
              ? validation.errors.templateName
              : ''
          }
        >
          <input
            type="text"
            placeholder="Two Installments"
            value={form.templateName}
            onChange={(event) =>
              updateField('templateName', event.target.value)
            }
            onBlur={() => markTouched('templateName')}
          />
        </Field>

        <Field
          label="Installment Count"
          required
          hint="1 = Full Payment, 2 or more = Customize"
          error={
            shouldShowError('installmentCount')
              ? validation.errors.installmentCount
              : ''
          }
        >
          <input
            type="text"
            inputMode="numeric"
            placeholder="3"
            value={form.installmentCount}
            onChange={(event) =>
              updateField(
                'installmentCount',
                event.target.value
              )
            }
            onFocus={(event) =>
              event.currentTarget.select()
            }
            onClick={(event) =>
              event.currentTarget.select()
            }
            onBlur={() =>
              markTouched('installmentCount')
            }
          />
        </Field>

        <Field
          label="Due Rule"
          hint="Default timing rule for the plan"
        >
          <select
            value={form.dueRule}
            onChange={(event) => {
              updateField(
                'dueRule',
                event.target.value
              )

              if (event.target.value !== 'Custom') {
                updateField('customDueRule', '')
              }
            }}
          >
            {DUE_RULE_OPTIONS.map((option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            ))}
          </select>

          {form.dueRule === 'Custom' ? (
            <input
              type="text"
              placeholder="Enter custom due rule"
              value={form.customDueRule}
              onChange={(event) =>
                updateField(
                  'customDueRule',
                  event.target.value
                )
              }
            />
          ) : null}
        </Field>

        <Field
          label="Status"
          hint="Template activation state"
        >
          <select
            value={form.status}
            onChange={(event) =>
              updateField(
                'status',
                event.target.value
              )
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option
                key={option}
                value={option}
              >
                {option === 'ACTIVE'
                  ? 'Active'
                  : 'Inactive'}
              </option>
            ))}
          </select>
        </Field>

      </div>

      {error ? (
        <div className="installment-error-banner">
          {error}
        </div>
      ) : null}

      <div className="installment-form-actions">

        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            resetForm()
            setIsCreateOpen(false)
          }}
          disabled={saving}
        >
          Cancel
        </Button>

        <Button
          type="button"
          disabled={saving}
          onClick={submitForm}
        >
          {saving
            ? 'Saving...'
            : editingTemplateId
              ? 'Update Template'
              : 'Create Template'}
        </Button>

      </div>
    </div>
  </div>
) : null}

  {/* Saved Templates */}
  <div className="installment-template-table">
  <div className="installment-template-table-head">
    <span>Template</span>
    <span>Installments</span>
    <span>Due Rule</span>
    <span>Status</span>
    <span>Actions</span>
  </div>

  {templates.map((template) => (
    <div
      key={template.id}
      className="installment-template-table-row"
    >
      {/* Template */}
      <div className="installment-template-name">
        <strong>{template.templateName}</strong>
      </div>

      {/* Installments */}
      <div className="installment-template-value">
        {template.installmentCount}
      </div>

      {/* Due Rule */}
      <div className="installment-template-value">
        {template.dueRule || 'Admission'}
      </div>

      {/* Status */}
      <div>
        <span
          className={`installment-status ${
            String(template.status || 'ACTIVE').toLowerCase()
          }`}
        >
          <span className="installment-status-dot" />
          {template.status === 'ACTIVE' ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Actions */}
      <div className="installment-template-actions">
        <details className="installment-action-menu">
          <summary
            aria-label={`Actions for ${template.templateName}`}
          >
            <span />
            <span />
            <span />
          </summary>

          <div className="installment-action-dropdown">
            <button
              type="button"
              onClick={() => startEdit(template)}
            >
              <Pencil size={14} strokeWidth={2.2} />
              Edit
            </button>

            <button
              type="button"
              className="is-danger"
              onClick={() => confirmDelete(template)}
            >
              <Trash2 size={14} strokeWidth={2.2} />
              Delete
            </button>
          </div>
        </details>
      </div>
    </div>
  ))}
</div>
</div>
    </section>
  )
}


