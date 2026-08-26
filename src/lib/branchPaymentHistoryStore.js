const BRANCH_PAYMENT_HISTORY_KEY = 'cispro.branch-payment-history'

function isBrowser() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function normalizeBranchScope(branchScope) {
  const values = []

  if (!branchScope) return values

  if (Array.isArray(branchScope)) {
    branchScope.forEach((value) => {
      values.push(...normalizeBranchScope(value))
    })
    return [...new Set(values)]
  }

  if (typeof branchScope === 'object') {
    values.push(branchScope.id, branchScope.branchId, branchScope.branchCode)
  } else {
    values.push(branchScope)
  }

  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function getRecordBranchKeys(record = {}) {
  return normalizeBranchScope([
    record.branchId,
    record.branchCode,
    record.branchKey,
  ])
}

function recordMatchesBranchScope(record, branchScope) {
  const scopeKeys = normalizeBranchScope(branchScope)
  if (scopeKeys.length === 0) return true

  const recordKeys = getRecordBranchKeys(record)
  return scopeKeys.some((scopeKey) => recordKeys.includes(scopeKey))
}

function readAll() {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(BRANCH_PAYMENT_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(records) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(BRANCH_PAYMENT_HISTORY_KEY, JSON.stringify(records))
  } catch {
    // ignore storage errors
  }
}

function dispatchChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cispro:branch-payment-history-changed'))
  }
}

function normalizePaymentMode(value) {
  const text = String(value || '').trim()
  if (!text) return ''

  const normalized = text.toLowerCase()
  if (normalized === 'installment' || normalized === 'installments') {
    return ''
  }

  return text
}

function normalizePaymentEntry(entry = {}) {
  const amount = Number(
    entry.amount ??
    entry.amountReceived ??
    entry.paidAmount ??
    entry.amountPaid ??
    0,
  )

  const paymentDateRaw =
    entry.paymentDate ??
    entry.paidDate ??
    entry.datePaid ??
    entry.paidOn ??
    entry.updatedAt ??
    entry.paidAt ??
    entry.createdAt ??
    null

  const mode = normalizePaymentMode(
    entry.paymentMode ||
    entry.mode ||
    entry.paymentMethod ||
    entry.method ||
    entry.transactionMode ||
    entry.paymentType ||
    entry.modeOfPayment ||
    '',
  )

  const studentId = String(entry.studentId || '').trim()
  const receiptNumber = String(
    entry.receiptNumber ||
    entry.receiptNo ||
    entry.receipt ||
    '',
  ).trim()

  return {
    ...entry,
    id: String(
      entry.id ||
      receiptNumber ||
      `${studentId || 'payment'}-${paymentDateRaw || Date.now()}-${amount}-${mode || 'mode'}`,
    ).trim(),
    studentId,
    studentName: String(entry.studentName || '').trim(),
    course: String(entry.course || '').trim(),
    amount,
    paymentMode: mode,
    mode,
    paymentDateRaw,
    paymentDate: entry.paymentDate || paymentDateRaw || '',
    dateRaw: paymentDateRaw,
    date: entry.date || '',
    receiptNumber,
    payAgainst: String(entry.payAgainst || '').trim(),
    branchId: String(entry.branchId || '').trim(),
    branchCode: String(entry.branchCode || '').trim(),
    collectedBy: String(entry.collectedBy || '').trim(),
    notes: String(entry.notes || '').trim(),
    createdAt: entry.createdAt || paymentDateRaw || '',
  }
}

export function loadBranchPaymentHistoryEntries(branchScope = '') {
  const all = readAll().map(normalizePaymentEntry)
  const normalizedScope = normalizeBranchScope(branchScope)
  if (normalizedScope.length === 0) return all
  return all.filter((record) => recordMatchesBranchScope(record, normalizedScope))
}

export function saveBranchPaymentHistoryEntry(entry = {}) {
  const normalizedEntry = normalizePaymentEntry(entry)
  const all = readAll().map(normalizePaymentEntry)
  const next = [
    normalizedEntry,
    ...all.filter((record) => {
      if (normalizedEntry.receiptNumber && record.receiptNumber === normalizedEntry.receiptNumber) {
        return false
      }

      if (normalizedEntry.id && record.id === normalizedEntry.id) {
        return false
      }

      return true
    }),
  ]

  writeAll(next)
  dispatchChange()
  return normalizedEntry
}
