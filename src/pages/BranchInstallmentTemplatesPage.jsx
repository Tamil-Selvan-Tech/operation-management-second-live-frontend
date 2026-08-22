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

      resetForm()
      await loadTemplates(editingTemplateId ? page : 1)
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
              setIsCreateOpen((current) => !current)
              if (isCreateOpen) {
                resetForm()
              }
            }}
          >
            <CirclePlus size={14} strokeWidth={2.2} />
            {isCreateOpen ? 'Hide Form' : 'Create Template'}
          </button>
        </div>

      </div>
<div className="installment-page-layout">
  {isCreateOpen ? (
    <div className="installment-card installment-form-card">
      <div className="installment-card-header">
        <div>
          <p className="installment-card-label">Installment Template</p>
          <h3>
            {editingTemplateId
              ? 'Edit Installment Template'
              : 'Create Installment Template'}
          </h3>
        </div>
      </div>

      <div className="installment-form-grid">
        <Field
          label="Plan Name"
          required
          hint="Example: 3 Installments Plan"
          error={shouldShowError('templateName') ? validation.errors.templateName : ''}
        >
          <input
            type="text"
            placeholder="Two Installments"
            value={form.templateName}
            onChange={(event) => updateField('templateName', event.target.value)}
            onBlur={() => markTouched('templateName')}
          />
        </Field>

        <Field
          label="Installment Count"
          required
          hint="1 = Full Payment, 2 or more = Customize"
          error={shouldShowError('installmentCount') ? validation.errors.installmentCount : ''}
        >
          <input
            type="text"
            inputMode="numeric"
            placeholder="3"
            value={form.installmentCount}
            onChange={(event) => updateField('installmentCount', event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
            onBlur={() => markTouched('installmentCount')}
          />
        </Field>

        <div className="installment-mode-banner">
          <BadgeInfo size={14} strokeWidth={2.2} />
          <span>Current template mode: {templateModeLabel}</span>
        </div>

        <Field label="Due Rule" hint="Default timing rule for the plan">
          <select
            value={form.dueRule}
            onChange={(event) => updateField('dueRule', event.target.value)}
          >
            {DUE_RULE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Allow Customization"
          hint="Can this template be adjusted later?"
        >
          <button
            type="button"
            className={`installment-toggle ${
              form.allowCustomization ? 'is-on' : ''
            }`.trim()}
            onClick={() =>
              updateField('allowCustomization', !form.allowCustomization)
            }
          >
            <span>
              {form.allowCustomization ? 'Enabled' : 'Disabled'}
            </span>
            <strong>
              {form.allowCustomization ? 'Yes' : 'No'}
            </strong>
          </button>
        </Field>

        <Field label="Status" hint="Template activation state">
          <select
            value={form.status}
            onChange={(event) => updateField('status', event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'ACTIVE' ? 'Active' : 'Inactive'}
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
          onClick={resetForm}
          disabled={saving}
        >
          Reset
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
  ) : null}

  {/* Saved Templates */}
  <div className="installment-card installment-list-card">
    <div className="installment-card-header">
      <div>
        <p className="installment-card-label">Saved Templates</p>
        <h3>Reusable plans</h3>
      </div>

      <button
        type="button"
        className="installment-reset-button"
        onClick={() => void loadTemplates(page)}
      >
        <RefreshCcw size={14} strokeWidth={2.2} />
        Refresh
      </button>
    </div>

    <div className="installment-filter-row">
      <input
        type="text"
        placeholder="Search templates"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void loadTemplates(1)
          }
        }}
      />

      <select
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
      >
        <option value="">All Status</option>

        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === 'ACTIVE' ? 'Active' : 'Inactive'}
          </option>
        ))}
      </select>
    </div>

    {/* Existing templates list */}
    {loading ? (
      <div className="installment-empty-state">
        Loading templates...
      </div>
    ) : templates.length ? (
      <div className="installment-list">
        {templates.map((template) => (
          <article
            key={template.id}
            className="installment-list-item"
          >
            <div className="installment-list-item-head">
              <div>
                <strong>{template.templateName}</strong>

                <span>
                  <BadgeInfo size={12} strokeWidth={2.2} />
                  {template.planType === 'FULL_PAYMENT'
                    ? 'Full Payment'
                    : 'Customize'}{' '}
                  • {template.installmentCount} installments
                </span>
              </div>

              <span
                className={`installment-status ${String(
                  template.status || 'ACTIVE'
                ).toLowerCase()}`}
              >
                {template.status === 'ACTIVE'
                  ? 'Active'
                  : 'Inactive'}
              </span>
            </div>

            <div className="installment-list-meta">
              <span>
                <Shield size={12} strokeWidth={2.3} />
                {template.dueRule || 'Admission'}
              </span>

              <span>
                <CalendarDays size={12} strokeWidth={2.3} />
                {template.course?.name || 'Standalone template'}
              </span>
            </div>

            <div className="installment-list-actions">
              <button
                type="button"
                className="installment-inline-action"
                onClick={() => startEdit(template)}
              >
                <Pencil size={14} strokeWidth={2.3} />
                Edit
              </button>

              <button
                type="button"
                className="installment-inline-action is-danger"
                onClick={() => confirmDelete(template)}
              >
                <Trash2 size={14} strokeWidth={2.3} />
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className="installment-empty-state">
        No installment templates yet.
      </div>
    )}

    <PaginationBar
      currentPage={page}
      totalPages={totalPages}
      onPageChange={(nextPage) => void loadTemplates(nextPage)}
      label="Installment template pagination"
    />
  </div>
</div>
     

      {deleteTarget ? (
        <div className="installment-modal-backdrop" role="presentation">
          <div className="installment-delete-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="installment-delete-modal-icon">
              <Trash2 size={28} strokeWidth={2.2} />
            </div>
            <h3>Delete template?</h3>
            <p>
              {deleteTarget.templateName} will be removed from the template list.
            </p>
            <div className="installment-delete-actions">
              <button type="button" className="installment-inline-action" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="installment-inline-action is-danger" onClick={handleDelete} disabled={saving}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}


