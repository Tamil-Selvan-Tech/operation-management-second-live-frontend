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
  const resendMailStatus = String(record.resendMailStatus || '').trim().toLowerCase() === 'active'
    ? 'Active'
    : 'Inactive'
  return {
    id: String(record.id || ''),
    branchId: String(record.branchId || '').trim(),
    branchName: String(record.branchName || '').trim(),
    branchAdminName: String(record.branchAdminName || '').trim(),
    branchEmail: String(record.branchEmail || '').trim().toLowerCase(),
    branchPhone: String(record.branchPhone || '').trim(),
    branchCountryCode: String(record.branchCountryCode || '').trim(),
    branchCountry: String(record.branchCountry || '').trim(),
    branchStateCode: String(record.branchStateCode || '').trim(),
    branchState: String(record.branchState || '').trim(),
    branchCity: String(record.branchCity || record.branchDistrict || '').trim(),
    branchDistrict: String(record.branchDistrict || record.branchCity || '').trim(),
    branchAddress: String(record.branchAddress || '').trim(),
    tempPassword,
    mustResetPassword: Boolean(record.mustResetPassword || tempPassword),
    status: normalizeStatus(record.status),
    lastLoginAt: String(record.lastLoginAt || '').trim(),
    createdAt: normalizeDate(record.createdAt),
    updatedAt: normalizeDate(record.updatedAt),
    resendMailStatus,
    welcomeMailSent: Boolean(record.welcomeMailSent || resendMailStatus === 'Active'),
  }
}

function hasExplicitMustResetPassword(record = {}) {
  return Object.prototype.hasOwnProperty.call(record, 'mustResetPassword')
}

function unwrapResponse(response) {
  return response?.data || response
}

function pickNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

function mergeBranchPayload(responseRecord = {}, payload = {}) {
  const normalizedResponse = normalizeBranchRecord(responseRecord)
  const normalizedPayload = normalizeBranchRecord(payload)

  return {
    ...normalizedResponse,
    branchId: normalizedResponse.branchId || normalizedPayload.branchId,
    branchName: normalizedResponse.branchName || normalizedPayload.branchName,
    branchAdminName: normalizedResponse.branchAdminName || normalizedPayload.branchAdminName,
    branchEmail: normalizedResponse.branchEmail || normalizedPayload.branchEmail,
    branchPhone: normalizedResponse.branchPhone || normalizedPayload.branchPhone,
    branchCountryCode: normalizedResponse.branchCountryCode || normalizedPayload.branchCountryCode,
    branchCountry: normalizedResponse.branchCountry || normalizedPayload.branchCountry,
    branchStateCode: normalizedResponse.branchStateCode || normalizedPayload.branchStateCode,
    branchState: normalizedResponse.branchState || normalizedPayload.branchState,
    branchCity: normalizedResponse.branchCity || normalizedPayload.branchCity,
    branchDistrict: normalizedResponse.branchDistrict || normalizedPayload.branchDistrict,
    branchAddress: normalizedResponse.branchAddress || normalizedPayload.branchAddress,
    status: normalizedResponse.status || normalizedPayload.status,
    createdAt: normalizedResponse.createdAt || normalizedPayload.createdAt,
    updatedAt: normalizedResponse.updatedAt || normalizedPayload.updatedAt,
  }
}

function syncLocalBranchRecord(record) {
  const normalized = normalizeBranchRecord(record)
  if (!normalized.branchEmail) return normalized
  const explicitMustResetPassword = hasExplicitMustResetPassword(record)

  const registry = loadBranchRegistry()
  const existing = registry.find((branch) => branch.branchEmail === normalized.branchEmail)
  const merged = existing
    ? {
        ...existing,
        ...normalized,
        tempPassword:
          explicitMustResetPassword && !normalized.mustResetPassword
            ? ''
            : normalized.tempPassword || existing.tempPassword || '',
        mustResetPassword: explicitMustResetPassword
          ? Boolean(normalized.mustResetPassword)
          : Boolean(
              normalized.mustResetPassword ||
                existing.mustResetPassword ||
                normalized.tempPassword ||
                existing.tempPassword,
            ),
        resendMailStatus:
          String(normalized.resendMailStatus || existing.resendMailStatus || 'Inactive').trim().toLowerCase() ===
          'active'
            ? 'Active'
            : 'Inactive',
        welcomeMailSent: Boolean(normalized.welcomeMailSent || existing.welcomeMailSent),
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
  let nextData = data

  if (data.length) {
    const registry = loadBranchRegistry()
    const registryByEmail = new Map(registry.map((branch) => [branch.branchEmail, branch]))
    nextData = data.map((branch) => {
      const existing = registryByEmail.get(branch.branchEmail)
      if (!existing) {
        return {
          ...branch,
          tempPassword: branch.tempPassword || '',
          mustResetPassword: Boolean(branch.mustResetPassword || branch.tempPassword),
          resendMailStatus:
            String(branch.resendMailStatus || 'Inactive').trim().toLowerCase() === 'active'
              ? 'Active'
              : 'Inactive',
          welcomeMailSent: Boolean(branch.welcomeMailSent || branch.resendMailStatus === 'Active'),
        }
      }

      return {
        ...branch,
        branchId: pickNonEmpty(branch.branchId, existing.branchId),
        branchName: pickNonEmpty(branch.branchName, existing.branchName),
        branchAdminName: pickNonEmpty(branch.branchAdminName, existing.branchAdminName),
        branchEmail: pickNonEmpty(branch.branchEmail, existing.branchEmail),
        branchPhone: pickNonEmpty(branch.branchPhone, existing.branchPhone),
        branchCountryCode: pickNonEmpty(branch.branchCountryCode, existing.branchCountryCode),
        branchCountry: pickNonEmpty(branch.branchCountry, existing.branchCountry),
        branchStateCode: pickNonEmpty(branch.branchStateCode, existing.branchStateCode),
        branchState: pickNonEmpty(branch.branchState, existing.branchState),
        branchCity: pickNonEmpty(branch.branchCity, existing.branchCity, branch.branchDistrict, existing.branchDistrict),
        branchDistrict: pickNonEmpty(branch.branchDistrict, existing.branchDistrict, branch.branchCity, existing.branchCity),
        branchAddress: pickNonEmpty(branch.branchAddress, existing.branchAddress),
        tempPassword:
          hasExplicitMustResetPassword(branch) && !branch.mustResetPassword
            ? ''
            : branch.tempPassword || existing.tempPassword || '',
        mustResetPassword: hasExplicitMustResetPassword(branch)
          ? Boolean(branch.mustResetPassword)
          : Boolean(
              branch.mustResetPassword ||
                existing.mustResetPassword ||
                branch.tempPassword ||
                existing.tempPassword,
            ),
        resendMailStatus:
          String(branch.resendMailStatus || existing.resendMailStatus || 'Inactive').trim().toLowerCase() ===
          'active'
            ? 'Active'
            : 'Inactive',
        welcomeMailSent: Boolean(branch.welcomeMailSent || existing.welcomeMailSent),
      }
    })

    const nextRegistry = [...nextData]
    for (const branch of registry) {
      if (!data.some((item) => item.branchEmail === branch.branchEmail)) {
        nextRegistry.push(branch)
      }
    }

    saveBranchRegistry(nextRegistry)
  }

  return {
    data: nextData,
    meta: response?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 },
  }
}

export async function createBranch(payload) {
  const response = await request('/branches', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return syncLocalBranchRecord(mergeBranchPayload(unwrapResponse(response), payload))
}

export async function updateBranch(branchId, payload) {
  const response = await request(`/branches/${branchId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  return syncLocalBranchRecord(mergeBranchPayload(unwrapResponse(response), payload))
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
  if (branch.branchEmail) {
    syncLocalBranchRecord({
      ...branch,
      mustResetPassword: true,
      resendMailStatus: 'Inactive',
      welcomeMailSent: false,
    })
  }

  return {
    branch,
    message: response?.message || 'Invitation email sent successfully',
  }
}

export async function getCurrentBranchProfile() {
  const response = await request('/branches/me', {
    method: 'GET',
  })

  return syncLocalBranchRecord(unwrapResponse(response))
}
