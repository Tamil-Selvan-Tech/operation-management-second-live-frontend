import { request } from './apiClient'

function normalizeStatus(value) {
  const text = String(value || '').trim().toUpperCase()
  return text === 'INACTIVE' ? 'Inactive' : 'Active'
}

function normalizeDate(value) {
  const text = String(value || '').trim()
  return text ? text.slice(0, 10) : ''
}

function normalizeBranchRecord(record = {}) {
  return {
    id: String(record.id || ''),
    branchId: String(record.branchId || '').trim(),
    branchName: String(record.branchName || '').trim(),
    branchAdminName: String(record.branchAdminName || '').trim(),
    branchEmail: String(record.branchEmail || '').trim().toLowerCase(),
    branchPhone: String(record.branchPhone || '').trim(),
    branchAddress: String(record.branchAddress || '').trim(),
    tempPassword: String(record.tempPassword || '').trim(),
    status: normalizeStatus(record.status),
    createdAt: normalizeDate(record.createdAt),
    updatedAt: normalizeDate(record.updatedAt),
  }
}

function unwrapResponse(response) {
  return response?.data || response
}

export async function listBranches(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value))
    }
  })

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const response = await request(`/branches${suffix}`, { method: 'GET' })

  return {
    data: Array.isArray(response?.data) ? response.data.map(normalizeBranchRecord) : [],
    meta: response?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 },
  }
}

export async function createBranch(payload) {
  const response = await request('/branches', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return normalizeBranchRecord(unwrapResponse(response))
}

export async function updateBranch(branchId, payload) {
  const response = await request(`/branches/${branchId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return normalizeBranchRecord(unwrapResponse(response))
}

export async function deleteBranch(branchId) {
  const response = await request(`/branches/${branchId}`, {
    method: 'DELETE',
  })

  return normalizeBranchRecord(unwrapResponse(response))
}

export async function resendBranchInvitation(branchId) {
  const response = await request(`/branches/${branchId}/resend-invitation`, {
    method: 'POST',
  })

  return {
    branch: normalizeBranchRecord(response?.branch || response?.data?.branch || response?.data || {}),
    message: response?.message || 'Invitation email sent successfully',
  }
}

export async function getCurrentBranchProfile() {
  const response = await request('/branches/me', {
    method: 'GET',
  })

  return normalizeBranchRecord(unwrapResponse(response))
}
