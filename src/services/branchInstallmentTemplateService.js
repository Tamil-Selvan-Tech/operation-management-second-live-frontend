import { request } from './apiClient'

const TEMPLATE_PAGE_LIMIT = 6
const TEMPLATE_SNAPSHOT_EVENT = 'cispro:branch-installment-templates-changed'
const TEMPLATE_SNAPSHOT_CHANNEL = 'cispro:branch-installment-templates'

// ---------------------------------------------------------------------------
// Event helpers – notify UI components that template data has changed so they
// can re-fetch from the database via the API.
// ---------------------------------------------------------------------------

function emitBranchInstallmentTemplateChange() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new Event(TEMPLATE_SNAPSHOT_EVENT))

  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel(TEMPLATE_SNAPSHOT_CHANNEL)
      channel.postMessage({ type: 'changed', at: Date.now() })
      channel.close()
    } catch {
      // Ignore broadcast failures and fall back to direct event delivery.
    }
  }
}

export function subscribeBranchInstallmentTemplateChanges(listener) {
  if (typeof window === 'undefined') return () => {}

  const handleCustomEvent = () => { listener() }
  const handleBroadcastMessage = () => { listener() }

  window.addEventListener(TEMPLATE_SNAPSHOT_EVENT, handleCustomEvent)

  let channel = null
  if ('BroadcastChannel' in window) {
    try {
      channel = new BroadcastChannel(TEMPLATE_SNAPSHOT_CHANNEL)
      channel.addEventListener('message', handleBroadcastMessage)
    } catch {
      channel = null
    }
  }

  return () => {
    window.removeEventListener(TEMPLATE_SNAPSHOT_EVENT, handleCustomEvent)
    if (channel) {
      channel.removeEventListener('message', handleBroadcastMessage)
      channel.close()
    }
  }
}

// ---------------------------------------------------------------------------
// Normalizers – ensure consistent shape for data coming from the API.
// ---------------------------------------------------------------------------

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeInstallments(values) {
  if (!Array.isArray(values)) return []
  return values
    .map((value) => Number(String(value ?? '').trim()))
    .filter((value) => Number.isFinite(value))
}

export function normalizeBranchInstallmentTemplate(template) {
  if (!template) return null

  const installments = Array.isArray(template.installments)
    ? template.installments
    : Array.isArray(template.installmentAmounts)
      ? template.installmentAmounts
      : []
  const planType =
    String(template.planType || template.templateType || 'CUSTOM').trim().toUpperCase() || 'CUSTOM'

  return {
    ...template,
    id: template.id || '',
    branchId: template.branchId || '',
    branchCourseId: template.branchCourseId || '',
    templateName: normalizeText(template.templateName || template.planName),
    planType,
    installmentCount: Number(template.installmentCount || installments.length || 0),
    installments: normalizeInstallments(installments),
    dueRule: normalizeText(template.dueRule || 'Admission'),
    allowCustomization: Boolean(template.allowCustomization ?? true),
    status: template.status || 'ACTIVE',
    createdAt: template.createdAt || '',
    updatedAt: template.updatedAt || '',
    course: template.course || null,
  }
}

export function normalizeBranchInstallmentTemplateList(templates) {
  return Array.isArray(templates)
    ? templates.map(normalizeBranchInstallmentTemplate).filter(Boolean)
    : []
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

function buildSearchParams(query = {}) {
  const params = new URLSearchParams()
  const page =
    Number.isInteger(Number(query.page)) && Number(query.page) > 0 ? Number(query.page) : 1
  const limit =
    Number.isInteger(Number(query.limit)) && Number(query.limit) > 0
      ? Math.min(Number(query.limit), 100)
      : TEMPLATE_PAGE_LIMIT

  params.set('page', String(page))
  params.set('limit', String(limit))

  const search = String(query.search ?? '').trim()
  if (search) params.set('search', search)

  const status = String(query.status ?? '').trim()
  if (status) params.set('status', status)

  const sortBy = String(query.sortBy ?? '').trim()
  if (sortBy) params.set('sortBy', sortBy)

  const sortOrder = String(query.sortOrder ?? '').trim()
  if (sortOrder) params.set('sortOrder', sortOrder)

  return params
}

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

// ---------------------------------------------------------------------------
// CRUD – all operations go directly to the backend API / database.
// The backend enforces branch isolation via the authenticated user's JWT so
// each branch admin only ever sees and modifies their own data.
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated list of installment templates for the current branch.
 * Data comes exclusively from the database – no localStorage involved.
 */
export async function listBranchInstallmentTemplates(query = {}) {
  const params = buildSearchParams(query)
  const response = await request(`/branch-installment-templates?${params.toString()}`)

  return {
    data: normalizeBranchInstallmentTemplateList(unwrapData(response)),
    meta: response?.meta ?? response?.data?.meta ?? null,
  }
}

/**
 * Create a new installment template in the database for the current branch.
 */
export async function createBranchInstallmentTemplate(payload) {
  const response = await request('/branch-installment-templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const normalized = normalizeBranchInstallmentTemplate(unwrapData(response))
  emitBranchInstallmentTemplateChange()
  return normalized
}

/**
 * Update an existing installment template in the database.
 */
export async function updateBranchInstallmentTemplate(templateId, payload) {
  const response = await request(`/branch-installment-templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  const normalized = normalizeBranchInstallmentTemplate(unwrapData(response))
  emitBranchInstallmentTemplateChange()
  return normalized
}

/**
 * Delete an installment template from the database.
 */
export async function deleteBranchInstallmentTemplate(templateId) {
  const response = await request(`/branch-installment-templates/${templateId}`, {
    method: 'DELETE',
  })

  const normalized = normalizeBranchInstallmentTemplate(unwrapData(response))
  emitBranchInstallmentTemplateChange()
  return normalized
}
