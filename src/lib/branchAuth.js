import { seedBranches } from '../data/branchSeedData'

const BRANCH_REGISTRY_KEY = 'cispro.branch-registry'
const BRANCH_SESSION_KEY = 'cispro.branch-session'

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const readJSON = (key) => {
  if (!isBrowser()) return null

  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

const writeJSON = (key, value) => {
  if (!isBrowser()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

const normalizeMailStatus = (value, fallback = 'Inactive') => {
  const text = String(value || '').trim().toLowerCase()
  if (text === 'active') return 'Active'
  if (text === 'inactive') return 'Inactive'
  return fallback
}

export function normalizeBranchRecord(branch = {}) {
  const tempPassword = String(
    branch.tempPassword || branch.temporaryPassword || branch.temporary_password || '',
  ).trim()
  const resendMailStatus = normalizeMailStatus(
    branch.resendMailStatus || (branch.welcomeMailSent ? 'Active' : ''),
    'Inactive',
  )
  return {
    id: Number(branch.id) || Date.now(),
    branchId: String(branch.branchId || '').trim(),
    branchName: String(branch.branchName || '').trim(),
    branchAdminName: String(branch.branchAdminName || '').trim(),
    branchEmail: String(branch.branchEmail || '').trim().toLowerCase(),
    branchPhone: String(branch.branchPhone || '').trim(),
    branchAddress: String(branch.branchAddress || '').trim(),
    tempPassword,
    mustResetPassword: Boolean(branch.mustResetPassword || tempPassword),
    status: String(branch.status || 'Active').trim() || 'Active',
    createdAt: String(branch.createdAt || '').trim(),
    resendMailStatus,
    welcomeMailSent: Boolean(branch.welcomeMailSent || resendMailStatus === 'Active'),
  }
}

export function loadBranchRegistry() {
  const stored = readJSON(BRANCH_REGISTRY_KEY)
  const source = Array.isArray(stored) && stored.length ? stored : seedBranches
  return source.map(normalizeBranchRecord)
}

export function saveBranchRegistry(branches = []) {
  writeJSON(BRANCH_REGISTRY_KEY, branches.map(normalizeBranchRecord))
}

export function clearBranchRegistry() {
  if (!isBrowser()) return
  window.localStorage.removeItem(BRANCH_REGISTRY_KEY)
}

export function createTemporaryPassword(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const randomValues = new Uint32Array(length)
    crypto.getRandomValues(randomValues)
    return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join('')
  }

  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

export function addBranchWithCredentials(branch = {}) {
  const registry = loadBranchRegistry()
  const nextBranch = normalizeBranchRecord({
    ...branch,
    tempPassword: createTemporaryPassword(10),
    mustResetPassword: true,
    createdAt: branch.createdAt || new Date().toISOString().slice(0, 10),
    status: branch.status || 'Active',
    resendMailStatus: 'Inactive',
    welcomeMailSent: false,
  })

  const nextRegistry = [nextBranch, ...registry]
  saveBranchRegistry(nextRegistry)
  return nextBranch
}

export function updateBranchRecord(branchId, updater) {
  const registry = loadBranchRegistry()
  const nextRegistry = registry.map((branch) => {
    if (String(branch.id) !== String(branchId)) return branch
    return normalizeBranchRecord(typeof updater === 'function' ? updater(branch) : { ...branch, ...updater })
  })

  saveBranchRegistry(nextRegistry)
  return nextRegistry
}

export function updateBranchRecordByEmail(branchEmail, updater) {
  const normalizedEmail = String(branchEmail || '').trim().toLowerCase()
  const registry = loadBranchRegistry()
  const nextRegistry = registry.map((branch) => {
    if (branch.branchEmail !== normalizedEmail) return branch
    return normalizeBranchRecord(typeof updater === 'function' ? updater(branch) : { ...branch, ...updater })
  })

  saveBranchRegistry(nextRegistry)
  return nextRegistry
}

export function findBranchByEmail(branchEmail) {
  const normalizedEmail = String(branchEmail || '').trim().toLowerCase()
  if (!normalizedEmail) return null

  return loadBranchRegistry().find((branch) => branch.branchEmail === normalizedEmail) || null
}

export function deleteBranchRecord(branchId) {
  const registry = loadBranchRegistry()
  const nextRegistry = registry.filter((branch) => String(branch.id) !== String(branchId))
  saveBranchRegistry(nextRegistry)
  return nextRegistry
}

export function findBranchByCredentials(email, tempPassword) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPassword = String(tempPassword || '').trim()
  return loadBranchRegistry().find(
    (branch) =>
      branch.branchEmail === normalizedEmail &&
      branch.tempPassword &&
      branch.tempPassword === normalizedPassword,
  ) || null
}

export function loadBranchSession() {
  if (!isBrowser()) return null

  try {
    const session = JSON.parse(window.localStorage.getItem(BRANCH_SESSION_KEY) || 'null')
    if (!session?.branchEmail) return null
    return session
  } catch {
    return null
  }
}

export function saveBranchSession(session) {
  writeJSON(BRANCH_SESSION_KEY, session)
}

export function clearBranchSession() {
  if (!isBrowser()) return
  window.localStorage.removeItem(BRANCH_SESSION_KEY)
}

export function createBranchSession(branch) {
  return {
    branchId: branch.branchId,
    branchName: branch.branchName,
    branchAdminName: branch.branchAdminName,
    branchEmail: branch.branchEmail,
    branchPhone: branch.branchPhone,
    branchAddress: branch.branchAddress,
    mustResetPassword: Boolean(branch.mustResetPassword),
    loggedInAt: new Date().toISOString(),
  }
}

export function markBranchWelcomeMailSent(branchEmail) {
  const normalizedEmail = String(branchEmail || '').trim().toLowerCase()
  if (!normalizedEmail) return null

  return updateBranchRecordByEmail(normalizedEmail, (branch) => ({
    ...branch,
    resendMailStatus: 'Active',
    welcomeMailSent: true,
  }))
}
