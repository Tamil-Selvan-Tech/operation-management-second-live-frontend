export function isCompletedStudentReportRecord(student = {}) {
  const importMarker = [
    student?.isCompletedStudentImport,
    student?.completedStudentImport,
    student?.isHistoricalStudent,
    student?.historicalImport,
  ].some((value) => value === true || String(value || '').trim().toLowerCase() === 'true')

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

  const importedLifecycleValues = [
    student?.importedLifecycleStatus,
    ...(Array.isArray(student?.courseEnrollments) ? student.courseEnrollments.map((entry) => entry?.importedLifecycleStatus) : []),
  ]
  const importedLifecycleMarker = importedLifecycleValues.some((value) => ['COMPLETED', 'DISCONTINUED'].includes(String(value || '').trim().toUpperCase()))

  // Course completion belongs to the normal Students workflow and must not
  // turn an operational student into a historical upload row. Only explicit
  // import/source markers or report-only fields identify an uploaded report.
  return importMarker || sourceMarker || reportFieldMarker || importedLifecycleMarker
}
