import { loadBranchStudents } from '../lib/branchStudentStore'
import {
  buildStudentPortalProfileFromRecord,
  createStudentPortalSession,
  findStudentPortalProfile,
  getStudentPortalLoginHint,
  validateStudentPortalCredentials,
} from '../data/studentPortalMock'

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase()
}

function findBranchStudentRecord(identifier) {
  const normalizedIdentifier = normalizeIdentifier(identifier)
  if (!normalizedIdentifier) return null

  const students = loadBranchStudents()

  return (
    students.find((student) => normalizeIdentifier(student.studentId) === normalizedIdentifier) ||
    students.find((student) => normalizeIdentifier(student.emailAddress) === normalizedIdentifier) ||
    students.find((student) => normalizeIdentifier(student.email) === normalizedIdentifier) ||
    students.find((student) => normalizeIdentifier(student.studentName) === normalizedIdentifier) ||
    null
  )
}

function isValidBranchPassword(record, password) {
  const normalizedPassword = String(password || '').trim()
  const validPasswords = [
    record?.loginPassword,
    record?.temporaryPassword,
    record?.tempPassword,
    record?.studentPassword,
    record?.password,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  return validPasswords.includes(normalizedPassword)
}

export function resolveStudentPortalProfile(identifierOrSession = '') {
  const sessionIdentifier =
    typeof identifierOrSession === 'object' && identifierOrSession
      ? identifierOrSession.studentId || identifierOrSession.email || identifierOrSession.userCode || identifierOrSession.name
      : identifierOrSession

  const branchRecord = findBranchStudentRecord(sessionIdentifier)
  if (branchRecord) {
    const fallbackProfile = findStudentPortalProfile(sessionIdentifier) || getStudentPortalLoginHint()
    return buildStudentPortalProfileFromRecord(branchRecord, fallbackProfile)
  }

  return findStudentPortalProfile(sessionIdentifier) || buildStudentPortalProfileFromRecord({}, getStudentPortalLoginHint())
}

export function validateStudentPortalLogin(identifier, password) {
  const branchRecord = findBranchStudentRecord(identifier)
  if (branchRecord) {
    if (!isValidBranchPassword(branchRecord, password)) {
      return { success: false, error: 'Invalid student ID, email, or temporary password.' }
    }

    const profile = buildStudentPortalProfileFromRecord(branchRecord, findStudentPortalProfile(identifier) || getStudentPortalLoginHint())
    return {
      success: true,
      profile,
      source: 'branch-record',
    }
  }

  const mockResult = validateStudentPortalCredentials(identifier, password)
  if (mockResult.success) {
    return {
      ...mockResult,
      source: 'mock',
    }
  }

  return mockResult
}

export function buildStudentPortalSession(profile) {
  return createStudentPortalSession(profile)
}

export function findStudentPortalProfileByIdentifier(identifier) {
  const branchRecord = findBranchStudentRecord(identifier)
  if (branchRecord) {
    const fallbackProfile = findStudentPortalProfile(identifier) || getStudentPortalLoginHint()
    return buildStudentPortalProfileFromRecord(branchRecord, fallbackProfile)
  }

  return findStudentPortalProfile(identifier)
}

export function getCurrentStudentPortalProfile(sessionUser = null) {
  const sessionIdentifier =
    sessionUser?.studentId ||
    sessionUser?.email ||
    sessionUser?.userCode ||
    sessionUser?.name ||
    ''

  return resolveStudentPortalProfile(sessionIdentifier)
}
