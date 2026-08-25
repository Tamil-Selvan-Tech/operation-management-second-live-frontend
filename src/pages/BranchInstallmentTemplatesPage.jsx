import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CirclePlus,
  Pencil,
  Search,
  Filter,
  Trash2,
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
    allowCustomization: true,
    status: 'ACTIVE',
  }
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
  const pageSize = 5
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [editingTemplateId, setEditingTemplateId] = useState('')
  const [form, setForm] = useState(() => createEmptyTemplateForm())
  const [touched, setTouched] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const validation = useMemo(() => createValidationErrors(form), [form])
  const [openActionMenuId, setOpenActionMenuId] = useState(null)
  const [actionMenuPinned, setActionMenuPinned] = useState(false)
  const loadTemplates = useMemo(() => async (nextPage = 1) => {
    setLoading(true)
    setError('')
    try {
      const result = await listBranchInstallmentTemplates({
        page: nextPage,
        limit: pageSize,
        search: searchTerm,
        status: statusFilter,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      const nextTotalPages = Math.max(1, Number(result.meta?.totalPages || 1))
      const nextTotalCount = Number(result.meta?.total || result.meta?.totalCount || result.meta?.count || (result.data || []).length || 0)
      setTemplates(result.data || [])
      setTotalPages(nextTotalPages)
      setTotalCount(nextTotalCount)
      setPage(Math.min(nextPage, nextTotalPages))
    } catch (err) {
      setTemplates([])
      setTotalPages(1)
      setTotalCount(0)
      setError(err?.message || 'Unable to load installment templates.')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, statusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTemplates(page)
  }, [searchTerm, statusFilter, page, loadTemplates])

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
const checkDuplicateTemplate = (
  installmentCount,
  currentId = ''
) => {
  const normalizedCount = Number(installmentCount || 0)

  return templates.some((template) => {
    const existingCount = Number(template.installmentCount || 0)

    return (
      existingCount === normalizedCount &&
      String(template.id) !== String(currentId)
    )
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
      allowCustomization: true,
      status: true,
    }
    setTouched(nextTouched)
if (Object.keys(validation.errors).length > 0) {
  setError(
    Object.values(validation.errors)[0] ||
    'Please complete the template form.'
  )
  return
}

// Check duplicate template
const duplicateExists = checkDuplicateTemplate(
  form.installmentCount,
  editingTemplateId
)

if (duplicateExists) {
  setError(
    `An installment plan with ${Number(
      form.installmentCount
    )} installments already exists.`
  )
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
        allowCustomization: Boolean(form.allowCustomization),
        status: String(form.status || 'ACTIVE').trim(),
      }

            if (editingTemplateId) {
        await updateBranchInstallmentTemplate(editingTemplateId, payload)
      } else {
        await createBranchInstallmentTemplate(payload)
      }

      resetForm()
      setIsCreateOpen(false)
      await loadTemplates(editingTemplateId ? page : 1)

    } catch (err) {
      if (err?.status === 409) {
        setError(
          err?.body?.message ||
          `An installment plan with ${Number(
            form.installmentCount
          )} installments already exists.`
        )
      } else {
        setError(
          err?.body?.message ||
          err?.body?.error ||
          err?.message ||
          'Unable to save installment template.'
        )
      }
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
  console.log('SAVE ERROR:', err)
  console.log('SAVE ERROR BODY:', err?.body)

  if (err?.status === 409) {
    setError(
      err?.body?.message ||
      err?.body?.error ||
      `An installment plan with ${Number(
        form.installmentCount
      )} installments already exists.`
    )
  } else {
    setError(
      err?.body?.message ||
      err?.body?.error ||
      err?.message ||
      'Unable to save installment template.'
    )
  }
} finally {
  setSaving(false)
}
}
useEffect(() => {
  const handleOutsideClick = (event) => {
    if (!event.target.closest('.installment-action-menu')) {
      setOpenActionMenuId(null)
      setActionMenuPinned(false)
    }
  }

  document.addEventListener('mousedown', handleOutsideClick)

  return () => {
    document.removeEventListener('mousedown', handleOutsideClick)
  }
}, [])

  const shouldShowError = (field) => Boolean(touched[field] && validation.errors[field])
  const safeCurrentPage = Math.min(Math.max(1, Number(page) || 1), totalPages)
  const startItem = totalCount > 0 ? ((safeCurrentPage - 1) * pageSize) + 1 : 0
  const endItem = totalCount > 0 ? Math.min(startItem + templates.length - 1, totalCount) : 0
  const displayRows = useMemo(() => {
    const accentPalette = [
      { background: '#dbeafe', color: '#2563eb' },
      { background: '#dcfce7', color: '#16a34a' },
      { background: '#ede9fe', color: '#7c3aed' },
      { background: '#fef3c7', color: '#f59e0b' },
      { background: '#fee2e2', color: '#ef4444' },
    ]

    return templates.map((template, index) => {
      const installmentCount = Math.max(1, Number(template.installmentCount) || 1)
      const isCustom = String(template.planType || '').toUpperCase() === 'CUSTOM' || installmentCount > 1

      return {
        ...template,
        accent: accentPalette[index % accentPalette.length],
        installmentLabel: isCustom ? `${installmentCount} Installments` : 'Custom',
      }
    })
  }, [templates])

  return (
    <section className="installment-page">
      <div className="installment-page-hero">
        <div className="installment-hero-copy">
          <p className="installment-kicker">INSTALLMENT TEMPLATES</p>
          <h2>Payment plans made simple</h2>
          <p className="installment-hero-description">
            Create and manage reusable payment schedules for your courses.
          </p>
        </div>
        <div className="installment-hero-actions">
          <button
            type="button"
            className="installment-create-button"
            onClick={() => {
              resetForm()
              setIsCreateOpen(true)
            }}
          >
            <CirclePlus size={16} strokeWidth={2.2} />
            Create Template
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
{deleteTarget ? (
  <div className="installment-modal-backdrop">
    <div
      className="installment-delete-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-template-title"
    >
      <div className="installment-delete-modal-icon">
        <Trash2 size={28} strokeWidth={2.2} />
      </div>

      <h3 id="delete-template-title">
        Delete Installment Template?
      </h3>

      <p>
        Are you sure you want to delete{' '}
        <strong>{deleteTarget.templateName}</strong>?
        This action cannot be undone.
      </p>

      <div className="installment-delete-actions">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDeleteTarget(null)}
          disabled={saving}
        >
          Cancel
        </Button>

        <Button
          type="button"
          onClick={handleDelete}
          disabled={saving}
        >
          {saving ? 'Deleting...' : 'OK'}
        </Button>
      </div>
    </div>
  </div>
) : null}

  <div className="installment-table-card">
    <div className="installment-table-toolbar">
      <label className="installment-search">
        <Search size={18} strokeWidth={2.2} />
        <input
          type="search"
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value)
            setPage(1)
          }}
        />
      </label>

      <label className="installment-filter-select">
        <Filter size={16} strokeWidth={2.2} />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </label>
    </div>

    <div className="installment-table-shell">
      <div className="installment-template-table-head">
        <span>Template Name</span>
        <span>Installments</span>
        <span>Status</span>
        <span>Actions</span>
      </div>

      {loading ? (
        <div className="installment-table-state">Loading templates...</div>
      ) : displayRows.length ? (
        displayRows.map((template) => (
          <div
            key={template.id}
            className="installment-template-table-row"
          >
            <div className="installment-template-name">
              <span
                className="installment-template-icon"
                style={{
                  background: template.accent.background,
                  color: template.accent.color,
                }}
              >
                <CalendarDays size={16} strokeWidth={2.1} />
              </span>
              <div className="installment-template-name-copy">
                <strong>{template.templateName}</strong>
              </div>
            </div>

            <div className="installment-template-value">
              {template.installmentLabel}
            </div>

            <div>
              <span
                className={`installment-status ${String(template.status || 'ACTIVE').toLowerCase()}`}
              >
                <span className="installment-status-dot" />
                {template.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="installment-template-actions">
              <details
                className="installment-action-menu"
                open={openActionMenuId === template.id}
                onMouseEnter={() => {
                  if (!actionMenuPinned) {
                    setOpenActionMenuId(template.id)
                  }
                }}
                onMouseLeave={() => {
                  if (!actionMenuPinned) {
                    setOpenActionMenuId(null)
                  }
                }}
              >
                <summary
                  aria-label={`Actions for ${template.templateName}`}
                  onClick={(event) => {
                    event.preventDefault()
                    setOpenActionMenuId(template.id)
                    setActionMenuPinned(true)
                  }}
                >
                  <span />
                  <span />
                  <span />
                </summary>

                <div className="installment-action-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionMenuId(null)
                      setActionMenuPinned(false)
                      startEdit(template)
                    }}
                  >
                    <Pencil size={14} strokeWidth={2.2} />
                    Edit
                  </button>

                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => {
                      setOpenActionMenuId(null)
                      setActionMenuPinned(false)
                      confirmDelete(template)
                    }}
                  >
                    <Trash2 size={14} strokeWidth={2.2} />
                    Delete
                  </button>
                </div>
              </details>
            </div>
          </div>
        ))
      ) : (
        <div className="installment-table-state is-empty">
          No installment templates found.
        </div>
      )}
    </div>

    <div className="installment-table-footer">
      <div className="installment-table-summary">
        {totalCount > 0
          ? `Showing ${startItem} to ${endItem} of ${totalCount}`
          : 'Showing 0 '}
      </div>

      <PaginationBar
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        onPageChange={(nextPage) => setPage(nextPage)}
        className="installment-pagination"
        label="Installment templates pagination"
        showSummary={false}
      />
    </div>
  </div>
  </div>
    </section>
  )
}
