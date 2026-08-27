function clampPercentage(value) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

export function getStudentPaymentProgress(student = {}) {
  const installments = Array.isArray(student.installmentSchedule)
    ? student.installmentSchedule
    : Array.isArray(student.paymentPlan?.installments)
      ? student.paymentPlan.installments
      : []

  const statusFields = [
    student.firstInstallmentStatus,
    student.secondInstallmentStatus,
    student.thirdInstallmentStatus,
    student.fourthInstallmentStatus,
  ].filter((value) => String(value || '').trim() !== '')

  const explicitCounts = [
    student.installmentCount,
    student.totalInstallments,
    student.paymentPlanInstallmentCount,
    student.paymentPlan?.installmentCount,
    student.paymentPlan?.count,
    Array.isArray(student.paymentPlan?.installments) ? student.paymentPlan.installments.length : 0,
  ]
    .map((value) => Number(value || 0))
    .filter((value) => Number.isFinite(value) && value > 0)

  const totalInstallments = Math.max(
    installments.length,
    statusFields.length,
    ...explicitCounts,
  )

  const paidInstallments = installments.length
    ? installments.reduce((count, installment) => {
        const amount = Number(installment.amount ?? installment.installmentAmount ?? 0)
        const paid = Number(installment.paidAmount ?? installment.amountPaid ?? 0)
        const status = String(installment.status ?? installment.paymentStatus ?? '').trim().toLowerCase()

        if (status === 'paid' || (amount > 0 && paid >= amount) || (!amount && paid > 0)) {
          return count + 1
        }

        return count
      }, 0)
    : [
        student.firstInstallmentStatus,
        student.secondInstallmentStatus,
        student.thirdInstallmentStatus,
        student.fourthInstallmentStatus,
      ].reduce((count, status) => {
        return String(status || '').trim().toLowerCase() === 'paid' ? count + 1 : count
      }, 0)

  const totalWeight = totalInstallments > 0 ? 100 / totalInstallments : 0

  const installmentBasedProgress = installments.length
    ? installments.reduce((sum, installment) => {
        const amount = Number(installment.amount ?? installment.installmentAmount ?? 0)
        const paid = Number(installment.paidAmount ?? installment.amountPaid ?? 0)
        const status = String(installment.status ?? installment.paymentStatus ?? '').trim().toLowerCase()

        let installmentRatio = 0

        if (amount > 0) {
          installmentRatio = Math.min(1, Math.max(0, paid / amount))
        } else if (status === 'paid' || paid > 0) {
          installmentRatio = 1
        }

        return sum + (installmentRatio * totalWeight)
      }, 0)
    : 0

  const statusBasedProgress = !installments.length && totalInstallments > 0
    ? (paidInstallments / totalInstallments) * 100
    : 0

  const fallbackAmountPaid = Number(student.paidAmount ?? student.totalPaid ?? student.amountPaid ?? 0)
  const fallbackTotalAmount = Number(student.finalFee ?? student.courseAmount ?? student.totalAmount ?? student.afterDiscount ?? 0)
  const amountBasedProgress = !installments.length && fallbackTotalAmount > 0
    ? (fallbackAmountPaid / fallbackTotalAmount) * 100
    : 0

  const paidInstallmentPercentage = clampPercentage(
    installments.length
      ? installmentBasedProgress
      : Math.max(statusBasedProgress, amountBasedProgress),
  )

  const totalFee = fallbackTotalAmount
  const paidAmount = installments.length
    ? installments.reduce(
        (sum, installment) => sum + Number(installment.paidAmount ?? installment.amountPaid ?? 0),
        0,
      )
    : fallbackAmountPaid

  return {
    totalFee,
    paidAmount,
    paidInstallments,
    totalInstallments,
    paidInstallmentPercentage,
    pendingAmount: Math.max(totalFee - paidAmount, 0),
  }
}

export function withStudentPaymentProgress(student = {}) {
  return {
    ...student,
    ...getStudentPaymentProgress(student),
  }
}
