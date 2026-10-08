function clampPercentage(value) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

export function getStudentPaymentProgress(student = {}, courseScope = {}) {
  const installments = Array.isArray(student.installmentSchedule)
    ? student.installmentSchedule
    : Array.isArray(student.paymentPlan?.installments)
      ? student.paymentPlan.installments
      : []

  // Sequential enrollments share one installment schedule at the student
  // level. Attribute each installment to courses in sequence so a payment
  // made for an earlier course is not shown against a later course's batch.
  const courseEnrollments = Array.isArray(student.courseEnrollments)
    ? [...student.courseEnrollments].sort((left, right) => Number(left?.sequenceOrder || 0) - Number(right?.sequenceOrder || 0))
    : Array.isArray(student.courses)
      ? [...student.courses].sort((left, right) => Number(left?.sequenceOrder || 0) - Number(right?.sequenceOrder || 0))
      : []
  const sequential = String(student.arrangementType || student.enrollmentType || '').trim().toUpperCase() === 'SEQUENTIAL'
  const scopeCourseId = String(courseScope.courseId || '').trim()
  const scopeCourseName = String(courseScope.courseName || '').trim().toLowerCase()
  const scopedEnrollmentIndex = courseEnrollments.findIndex((enrollment) => {
    const enrollmentCourseId = String(enrollment?.courseId || enrollment?.course?.id || enrollment?.id || '').trim()
    const enrollmentCourseName = String(enrollment?.courseName || enrollment?.course?.name || enrollment?.name || '').trim().toLowerCase()
    return (scopeCourseId && enrollmentCourseId === scopeCourseId) || (!scopeCourseId && scopeCourseName && enrollmentCourseName === scopeCourseName)
  })

  if (sequential && courseEnrollments.length > 1 && scopedEnrollmentIndex >= 0 && installments.length) {
    const courseAmounts = courseEnrollments.map((enrollment) => Math.max(Number(
      enrollment?.finalCourseAmount ??
      enrollment?.totalCourseAmount ??
      enrollment?.courseAmount ??
      enrollment?.totalAmount ??
      enrollment?.afterDiscount ??
      0,
    ) || 0, 0))
    const paidByCourse = courseAmounts.map(() => 0)
    const scheduledByCourse = courseAmounts.map(() => 0)

    const allocateSequentially = (amount, capacities) => {
      let remaining = Math.max(Number(amount) || 0, 0)
      return capacities.map((capacity) => {
        const allocated = Math.min(remaining, Math.max(Number(capacity) || 0, 0))
        remaining -= allocated
        return allocated
      })
    }

    installments.forEach((installment) => {
      const amount = Math.max(Number(installment?.amount ?? installment?.installmentAmount ?? 0) || 0, 0)
      const paid = Math.min(amount, Math.max(Number(installment?.paidAmount ?? installment?.amountPaid ?? 0) || 0, 0))
      const savedAllocations = Array.isArray(installment?.courseAllocations) ? installment.courseAllocations : []
      let allocations

      if (savedAllocations.length) {
        allocations = courseEnrollments.map((enrollment, index) => {
          const enrollmentCourseId = String(enrollment?.courseId || enrollment?.course?.id || enrollment?.id || '').trim()
          const enrollmentCourseName = String(enrollment?.courseName || enrollment?.course?.name || enrollment?.name || '').trim().toLowerCase()
          const saved = savedAllocations.find((allocation) => (
            (enrollmentCourseId && String(allocation?.courseId || '').trim() === enrollmentCourseId) ||
            (enrollmentCourseName && String(allocation?.courseName || '').trim().toLowerCase() === enrollmentCourseName)
          ))
          return Math.min(Math.max(Number(saved?.allocatedAmount ?? saved?.amount ?? 0) || 0, 0), Math.max(courseAmounts[index] - scheduledByCourse[index], 0))
        })
      } else {
        allocations = allocateSequentially(amount, courseAmounts.map((total, index) => total - scheduledByCourse[index]))
      }

      const paidAllocations = allocateSequentially(paid, allocations)
      allocations.forEach((allocation, index) => {
        scheduledByCourse[index] += allocation
        paidByCourse[index] += Math.min(allocation, paidAllocations[index])
      })
    })

    const totalFee = courseAmounts[scopedEnrollmentIndex]
    const paidAmount = Math.min(totalFee, paidByCourse[scopedEnrollmentIndex])
    const percentage = totalFee > 0 ? (paidAmount / totalFee) * 100 : 0
    return {
      totalFee,
      paidAmount,
      paidInstallments: 0,
      totalInstallments: 0,
      paidInstallmentPercentage: clampPercentage(percentage),
      pendingAmount: Math.max(totalFee - paidAmount, 0),
    }
  }

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
