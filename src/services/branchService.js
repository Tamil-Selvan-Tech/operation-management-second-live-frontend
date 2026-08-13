import { request } from './apiClient'
import {
  loadBranchRegistry,
  saveBranchRegistry,
} from '../lib/branchAuth'

function normalizeStatus(value) {
  const text = String(value || '').trim().toUpperCase()
  return text === 'INACTIVE' ? 'Inactive' : 'Active'
}

function normalizeDate(value) {
  const text = String(value || '').trim()
  return text ? text.slice(0, 10) : ''
}

function normalizeBranchRecord(record = {}) {
  const tempPassword = String(
    record.tempPassword || record.temporaryPassword || record.temporary_password || '',
  ).trim()
  return {
    id: String(record.id || ''),
    branchId: String(record.branchId || '').trim(),
    branchName: String(record.branchName || '').trim(),
    branchAdminName: String(record.branchAdminName || '').trim(),
    branchEmail: String(record.branchEmail || '').trim().toLowerCase(),
    branchPhone: String(record.branchPhone || '').trim(),
    branchAddress: String(record.branchAddress || '').trim(),
    tempPassword,
    mustResetPassword: Boolean(record.mustResetPassword || tempPassword),
    status: normalizeStatus(record.status),
    createdAt: normalizeDate(record.createdAt),
    updatedAt: normalizeDate(record.updatedAt),
  }
}

function unwrapResponse(response) {
  return response?.data || response
}

function syncLocalBranchRecord(record) {
  const normalized = normalizeBranchRecord(record)
  if (!normalized.branchEmail) return normalized

  const registry = loadBranchRegistry()
  const existing = registry.find((branch) => branch.branchEmail === normalized.branchEmail)
  const merged = existing
    ? {
        ...existing,
        ...normalized,
        tempPassword: normalized.tempPassword || existing.tempPassword || '',
        mustResetPassword:
          Boolean(
            normalized.mustResetPassword ||
              existing.mustResetPassword ||
              normalized.tempPassword ||
              existing.tempPassword,
          ),
      }
    : {
        ...normalized,
        tempPassword: normalized.tempPassword || '',
        mustResetPassword: Boolean(normalized.mustResetPassword || normalized.tempPassword),
      }

  const nextRegistry = existing
    ? registry.map((branch) => (branch.branchEmail === normalized.branchEmail ? merged : branch))
    : [
        merged,
        ...registry,
      ]

  saveBranchRegistry(nextRegistry)

  return normalized
}

function removeLocalBranchRecord(branchId) {
  const normalizedId = String(branchId || '').trim()
  if (!normalizedId) return

  const nextRegistry = loadBranchRegistry().filter((branch) => String(branch.id) !== normalizedId)
  saveBranchRegistry(nextRegistry)
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
  const data = Array.isArray(response?.data) ? response.data.map(normalizeBranchRecord) : []

  if (data.length) {
    const registry = loadBranchRegistry()
    const registryByEmail = new Map(registry.map((branch) => [branch.branchEmail, branch]))
    const nextRegistry = data.map((branch) => {
      const existing = registryByEmail.get(branch.branchEmail)
      if (!existing) {
        return {
          ...branch,
          tempPassword: branch.tempPassword || '',
          mustResetPassword: Boolean(branch.mustResetPassword || branch.tempPassword),
        }
      }

      return {
        ...existing,
        ...branch,
        tempPassword: branch.tempPassword || existing.tempPassword || '',
        mustResetPassword: Boolean(
          branch.mustResetPassword ||
            existing.mustResetPassword ||
            branch.tempPassword ||
            existing.tempPassword,
        ),
      }
    })

    for (const branch of registry) {
      if (!data.some((item) => item.branchEmail === branch.branchEmail)) {
        nextRegistry.push(branch)
      }
    }

    saveBranchRegistry(nextRegistry)
  }

  return {
    data,
    meta: response?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 },
  }
}

export async function createBranch(payload) {
  const response = await request('/branches', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return syncLocalBranchRecord(unwrapResponse(response))
}

export async function updateBranch(branchId, payload) {
  const response = await request(`/branches/${branchId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return syncLocalBranchRecord(unwrapResponse(response))
}

export async function deleteBranch(branchId) {
  const response = await request(`/branches/${branchId}`, {
    method: 'DELETE',
  })

  removeLocalBranchRecord(branchId)
  return normalizeBranchRecord(unwrapResponse(response))
}

export async function resendBranchInvitation(branchId) {
  const response = await request(`/branches/${branchId}/resend-invitation`, {
    method: 'POST',
  })

  const branch = normalizeBranchRecord(response?.branch || response?.data?.branch || response?.data || {})
  if (branch.branchEmail) syncLocalBranchRecord({ ...branch, mustResetPassword: true })

  return {
    branch,
    message: response?.message || 'Invitation email sent successfully',
  }
}

export async function getCurrentBranchProfile() {
  const response = await request('/branches/me', {
    method: 'GET',
  })

  return normalizeBranchRecord(unwrapResponse(response))
}
