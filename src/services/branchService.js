import { request } from './apiClient'
import { clearBranchRegistry } from '../lib/branchAuth'

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

function unwrapResponse(response) {
  return response?.data || response
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

export async function listBranches(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value))
    }
  })

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ''
  const response = await request(`/branches${suffix}`, { method: 'GET' })
  clearBranchRegistry()
  const data = Array.isArray(response?.data) ? response.data.map(normalizeBranchRecord) : []

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

  clearBranchRegistry()
  return mergeBranchPayload(unwrapResponse(response), payload)
}

export async function updateBranch(branchId, payload) {
  const response = await request(`/branches/${branchId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  clearBranchRegistry()
  return mergeBranchPayload(unwrapResponse(response), payload)
}

export async function deleteBranch(branchId) {
  const response = await request(`/branches/${branchId}`, {
    method: 'DELETE',
  })

  clearBranchRegistry()
  return normalizeBranchRecord(unwrapResponse(response))
}

export async function resendBranchInvitation(branchId) {
  const response = await request(`/branches/${branchId}/resend-invitation`, {
    method: 'POST',
  })

  clearBranchRegistry()
  const branch = normalizeBranchRecord(response?.branch || response?.data?.branch || response?.data || {})

  return {
    branch,
    message: response?.message || 'Invitation email sent successfully',
  }
}

export async function getCurrentBranchProfile() {
  const response = await request('/branches/me', {
    method: 'GET',
  })

  clearBranchRegistry()
  return normalizeBranchRecord(unwrapResponse(response))
}
