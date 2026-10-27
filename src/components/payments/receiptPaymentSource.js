export const isSalesCrmPaymentRecord = (payment = {}) => {
  const markers = [
    payment.paymentMode,
    payment.paymentMethod,
    payment.mode,
    payment.transactionReference,
    payment.payAgainst,
    payment.notes,
  ]
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean)

  return markers.some((marker) => (
    marker.includes('SALES CRM') || marker.startsWith('LEAD:')
  ))
}

export const hasSalesCollectedAmount = (student = {}, payment = null) => {
  const paymentRecords = [
    payment,
    ...(Array.isArray(student.payments) ? student.payments : []),
  ].filter(Boolean)

  if (paymentRecords.some((record) => (
    Number(record.amount ?? record.paidAmount ?? record.credit ?? 0) > 0
    && isSalesCrmPaymentRecord(record)
  ))) return true

  return (Array.isArray(student.installmentSchedule) ? student.installmentSchedule : [])
    .some((installment) => (
      Number(installment.amountPaid ?? installment.paidAmount ?? 0) > 0
      && isSalesCrmPaymentRecord(installment)
    ))
}