export function friendlyCourseImportMessage(column, rawMessage) {
  const message = String(rawMessage ?? '').trim()
  const text = message.toLocaleLowerCase()
  const field = String(column ?? '').toLocaleLowerCase()

  if (/course code already exists in this branch/.test(text)) return 'Already exists.'
  if (/duplicate course code/.test(text)) return 'Duplicate course code in this upload.'
  if (/course name already exists in this branch/.test(text)) return 'Already exists.'
  if (/duplicate course name/.test(text)) return 'Duplicate course name in this upload.'
  if (/matches multiple active branch templates/.test(text)) return 'This plan name is ambiguous. Choose a unique plan.'
  if (/no active branch payment template or supported alias matches/.test(text)) return 'Choose an active payment plan for this branch.'
  if (/no active payment plans are configured|no uniquely named active payment plans/.test(text)) return 'No active payment plan is available for this branch.'
  if (/duplicate payment plan/.test(text)) return 'This plan is already added for this course.'
  if (/course must be listed in this workbook/.test(text)) return 'Add this course code to the Courses sheet.'
  if (/module does not belong to this course/.test(text)) return 'Choose a module under this course.'
  if (/duplicate module/.test(text)) return 'Duplicate module for this course.'
  if (/duplicate submodule/.test(text)) return 'Duplicate submodule for this module.'
  if (/add at least one module/.test(text)) return 'Add at least one module for this course.'
  if (/add at least one submodule/.test(text)) return 'Add at least one submodule for this module.'
  if (/add a valid active payment plan/.test(text)) return 'Add an active payment plan for this course.'
  if (/required/.test(text)) return 'This value is required.'
  if (/must not exceed|too long|exceeds the maximum/.test(text)) return 'This value is too long.'
  if (/percentage|must total 100/.test(text)) return 'Check that the percentages total 100%.'
  if (/must be a|must be greater|cannot be|must not be|invalid number|positive number/.test(text)) return 'Enter a valid ' + (field || 'value') + '.'

  return message.length > 100 ? 'Check this value and try again.' : message
}
