import { request } from './apiClient'

const TEMPLATE_PAGE_LIMIT = 6

function unwrapData(response) {
  if (!response) return null
  return response.data ?? response
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeInstallments(values) {
  if (!Array.isArray(values)) return []
  return values.map((value) => Number(String(value ?? '').trim())).filter((value) => Number.isFinite(value))
}

export function normalizeBranchInstallmentTemplate(template) {
  if (!template) return null

  const installments = Array.isArray(template.installments)
    ? template.installments
    : Array.isArray(template.installmentAmounts)
      ? template.installmentAmounts
      : []
  const planType = String(template.planType || template.templateType || 'CUSTOM').trim().toUpperCase() || 'CUSTOM'

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

function buildSearchParams(query = {}) {
  const params = new URLSearchParams()
  const page = Number.isInteger(Number(query.page)) && Number(query.page) > 0 ? Number(query.page) : 1
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

export async function listBranchInstallmentTemplates(query = {}) {
  const params = buildSearchParams(query)
  const response = await request(`/branch-installment-templates?${params.toString()}`)
  return {
    data: normalizeBranchInstallmentTemplateList(unwrapData(response)),
    meta: response?.meta ?? response?.data?.meta ?? null,
  }
}

export async function createBranchInstallmentTemplate(payload) {
  const response = await request('/branch-installment-templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return normalizeBranchInstallmentTemplate(unwrapData(response))
}

export async function updateBranchInstallmentTemplate(templateId, payload) {
  const response = await request(`/branch-installment-templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return normalizeBranchInstallmentTemplate(unwrapData(response))
}

export async function deleteBranchInstallmentTemplate(templateId) {
  const response = await request(`/branch-installment-templates/${templateId}`, {
    method: 'DELETE',
  })

  return normalizeBranchInstallmentTemplate(unwrapData(response))
}
