import { request } from './apiClient'

function extractLedgerEntriesPayload(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.records)) return payload.records

  if (payload?.data && typeof payload.data === 'object') {
    return extractLedgerEntriesPayload(payload.data)
  }

  return []
}

function normalizeLedgerEntry(entry = {}) {
  const debit = Number(entry.debit ?? 0)
  const credit = Number(entry.credit ?? 0)
  const amount = Number(entry.amount ?? debit ?? credit ?? 0)
  const dateRaw = String(
    entry.dateRaw ||
    entry.paymentDate ||
    entry.createdAt ||
    entry.date ||
    '',
  ).trim()

  return {
    ...entry,
    id: String(entry.id || `${entry.studentId || 'ledger'}-${dateRaw || Date.now()}-${amount}`).trim(),
    studentRecordId: String(entry.studentRecordId || entry.branchStudentId || '').trim(),
    branchId: String(entry.branchId || '').trim(),
    studentId: String(entry.studentId || '').trim(),
    studentName: String(entry.studentName || '').trim(),
    course: String(entry.course || '').trim(),
    description: String(entry.description || '').trim(),
    entryType: String(entry.entryType || (credit > 0 ? 'CREDIT' : 'DEBIT')).trim().toUpperCase(),
    debit,
    credit,
    amount,
    runningBalance: Number(entry.runningBalance ?? 0),
    studentBalanceAfter: Number(entry.studentBalanceAfter ?? entry.runningBalance ?? 0),
    paymentMode: String(entry.paymentMode || '').trim(),
    receiptNumber: String(entry.receiptNumber || '').trim(),
    payAgainst: String(entry.payAgainst || '').trim(),
    transactionReference: String(entry.transactionReference || '').trim(),
    notes: String(entry.notes || '').trim(),
    referenceType: String(entry.referenceType || '').trim(),
    referenceId: String(entry.referenceId || '').trim(),
    dateRaw,
    date: String(entry.date || dateRaw).trim(),
    status: String(entry.status || '').trim(),
    entryNo: Number(entry.entryNo ?? 0),
  }
}

function normalizeLedgerSummary(summary = {}) {
  return {
    totalDebit: Number(summary.totalDebit ?? 0),
    totalCredit: Number(summary.totalCredit ?? 0),
    outstandingBalance: Number(summary.outstandingBalance ?? 0),
    entryCount: Number(summary.entryCount ?? 0),
    paymentCount: Number(summary.paymentCount ?? 0),
    studentCount: Number(summary.studentCount ?? 0),
  }
}

function extractLedgerResponse(response = {}) {
  const entries = extractLedgerEntriesPayload(response)
  const summary = normalizeLedgerSummary(response?.meta || response?.summary || {})
  return {
    entries: entries.map(normalizeLedgerEntry),
    summary,
  }
}

export async function listBranchLedger(query = {}) {
  const params = new URLSearchParams()

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === '') {
      return
    }

    params.set(key, String(value))
  })

  const response = await request(`/branch-students/ledger${params.toString() ? `?${params.toString()}` : ''}`, {
    method: 'GET',
  })

  return extractLedgerResponse(response || {})
}

export async function getBranchStudentLedger(studentId) {
  const response = await request(`/branch-students/${encodeURIComponent(String(studentId || '').trim())}/ledger`, {
    method: 'GET',
  })

  return extractLedgerResponse(response || {})
}
