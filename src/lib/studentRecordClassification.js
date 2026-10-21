export function isCompletedStudentReportRecord(student = {}) {
  const importMarker = [
    student?.isCompletedStudentImport,
    student?.completedStudentImport,
    student?.isHistoricalStudent,
    student?.historicalImport,
  ].some((value) => value === true)

  const sourceMarker = [
    student?.source,
    student?.sourceType,
    student?.recordType,
    student?.importSource,
    student?.lifecycleSource,
  ].some((value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_').includes('COMPLETED_STUDENT'))

  const reportFieldMarker = [
    student?.databaseSource,
    student?.courseStartingDate,
    student?.courseEndingDate,
    student?.certificationStatus,
    student?.certificateIssuedDate,
    student?.academicProject,
    student?.placement,
  ].some((value) => value !== undefined && value !== null && String(value).trim() !== '')

  if (importMarker || sourceMarker || reportFieldMarker) return true

  const lifecycleValues = [
    student?.lifecycleStatus,
    student?.studentLifecycleStatus,
    student?.recordStatus,
    student?.studentStatus,
    student?.currentStatus,
    student?.status,
  ].map((value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_'))
  const hasCompletedLifecycleStatus = lifecycleValues.some((value) => value.includes('COMPLETED') && !value.includes('NOT_COMPLETED'))
  const hasDiscontinuedLifecycleStatus = lifecycleValues.some((value) => value === 'DISCONTINUED')
  const hasCompletedDate = Boolean(student?.courseCompletedAt || student?.completedAt)

  const enrollments = Array.isArray(student?.courseEnrollments) ? student.courseEnrollments : []
  const hasActiveEnrollment = enrollments.some((entry) => {
    const status = String(entry?.status || entry?.recordStatus || '').trim().toUpperCase()
    return status === 'ACTIVE' && !entry?.courseCompletedAt && !entry?.completedAt
  })
  const hasVisibleEnrollment = enrollments.some((entry) => {
    const status = String(entry?.status || entry?.recordStatus || entry?.studentStatus || '').trim().toUpperCase()
    return !['COMPLETED', 'DISCONTINUED'].includes(status) && !entry?.courseCompletedAt && !entry?.completedAt
  })

  if (enrollments.length) return !hasVisibleEnrollment

  const hasOperationalData = [
    student?.finalFee,
    student?.courseAmount,
    student?.totalAmount,
    student?.afterDiscount,
    student?.paidAmount,
    student?.totalPaid,
    student?.amountPaid,
    student?.courseProgress,
    student?.courseCompletionPercentage,
    student?.progress,
    student?.admissionDate,
    student?.courseStartDate,
    student?.courseEndDate,
    student?.batchId,
    student?.batchName,
    student?.facultyId,
    student?.facultyName,
  ].some((value) => value !== undefined && value !== null && String(value).trim() !== '')
    || (Array.isArray(student?.installmentSchedule) && student.installmentSchedule.length > 0)

  if (!hasOperationalData) return true
  return Boolean(
    student?.isDiscontinued
      || String(student?.discontinuationStatus || '').trim().toUpperCase() === 'APPROVED'
      || hasDiscontinuedLifecycleStatus
      || (hasCompletedDate && !hasActiveEnrollment)
      || hasCompletedLifecycleStatus,
  )
}
