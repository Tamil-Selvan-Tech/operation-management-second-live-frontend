function normalizeWorkStudentId(value = '') {
  return String(value || '').trim().toLowerCase()
}

function getWorkStudentIds(entry = {}) {
  const source = Array.isArray(entry.selectedStudentIds)
    ? entry.selectedStudentIds
    : Array.isArray(entry.studentIds)
      ? entry.studentIds
      : []

  return source
    .map((value) => normalizeWorkStudentId(value))
    .filter(Boolean)
}

function getWorkEntrySubmoduleIds(entry = {}) {
  const source = Array.isArray(entry.selectedSubmoduleIds)
    ? entry.selectedSubmoduleIds
    : Array.isArray(entry.submoduleIds)
      ? entry.submoduleIds
      : Array.isArray(entry.submodules)
        ? entry.submodules.map((item) => item?.id || item?.submoduleId || item?.value || '').filter(Boolean)
        : []

  return Array.from(
    new Set(
      source
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  )
}

function getCourseModels(course) {
  const source = course && typeof course === 'object' ? course : {}

  return Array.isArray(source.models)
    ? source.models
    : Array.isArray(source.courseModels)
      ? source.courseModels
      : Array.isArray(source.modules)
        ? source.modules
        : []
}

function getCourseSubmodules(module = {}) {
  const source = module && typeof module === 'object' ? module : {}

  return Array.isArray(source.submodules)
    ? source.submodules
    : Array.isArray(source.submodels)
      ? source.submodels
      : Array.isArray(source.subModules)
        ? source.subModules
        : []
}

function isFacultyWorkEntryForStudent(entry = {}, student = {}) {
  if (!entry || !student) return false

  const applyToAllStudents = Boolean(entry.applyToAllStudents)
  const entryStudentIds = getWorkStudentIds(entry)
  const studentId = normalizeWorkStudentId(student.id || student.studentId || '')
  const studentCourseId = normalizeWorkStudentId(student.courseId || student.course?.id || '')
  const entryCourseId = normalizeWorkStudentId(entry.courseId || '')

  const isTargetedStudent = applyToAllStudents || (studentId && entryStudentIds.includes(studentId))
  if (!isTargetedStudent) return false

  if (entryCourseId && studentCourseId && entryCourseId !== studentCourseId) {
    return false
  }

  return true
}

function getFacultyTodayWorkEntriesForStudent(entries = [], student = {}, courseId = '') {
  const normalizedCourseId = normalizeWorkStudentId(courseId)

  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    if (!isFacultyWorkEntryForStudent(entry, student)) {
      return false
    }

    const entryCourseId = normalizeWorkStudentId(entry.courseId || '')
    if (normalizedCourseId && entryCourseId && entryCourseId !== normalizedCourseId) {
      return false
    }

    return true
  })
}

function buildFacultyTodayWorkProgressSummary(entries = [], course = {}, student = null) {
  const modules = getCourseModels(course)
  if (!modules.length) return null

  const normalizedCourseId = normalizeWorkStudentId(course?.id || course?.courseId || '')
  const matchingEntries = student
    ? getFacultyTodayWorkEntriesForStudent(entries, student, normalizedCourseId)
    : (Array.isArray(entries) ? entries : []).filter((entry) => normalizeWorkStudentId(entry.courseId || '') === normalizedCourseId)

  if (!matchingEntries.length) return null

  const latestEntry = [...matchingEntries].sort(
    (left, right) => new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime(),
  )[0] || null

  const moduleCompletionMap = new Map()
  modules.forEach((module, moduleIndex) => {
    const moduleId = String(module?.id || `module-${moduleIndex}`).trim()
    if (!moduleId) return
    moduleCompletionMap.set(moduleId, new Set())
  })

  matchingEntries.forEach((entry) => {
    const entryModuleId = String(entry?.moduleId || '').trim()
    if (!entryModuleId) return
    const submoduleSet = moduleCompletionMap.get(entryModuleId)
    if (!submoduleSet) return

    getWorkEntrySubmoduleIds(entry).forEach((submoduleId) => {
      submoduleSet.add(submoduleId)
    })
  })

  const moduleSummaries = modules.map((module, moduleIndex) => {
    const moduleId = String(module?.id || `module-${moduleIndex}`).trim()
    const submodules = getCourseSubmodules(module)
    const completedSubmoduleIds = Array.from(moduleCompletionMap.get(moduleId) || new Set())
    const totalSubmodules = submodules.length
    const completedCount = totalSubmodules > 0
      ? Math.min(totalSubmodules, new Set(completedSubmoduleIds).size)
      : new Set(completedSubmoduleIds).size
    const moduleProgress = totalSubmodules > 0
      ? Math.min(100, (completedCount / totalSubmodules) * 100)
      : (completedCount > 0 ? 100 : 0)

    return {
      moduleId,
      module,
      totalSubmodules,
      completedCount,
      moduleProgress,
    }
  })

  const courseProgressTotals = moduleSummaries.reduce((acc, moduleSummary) => {
    acc.completed += Number(moduleSummary.completedCount || 0)
    acc.total += Number(moduleSummary.totalSubmodules || 0)
    return acc
  }, { completed: 0, total: 0 })

  const courseProgress = courseProgressTotals.total > 0
    ? (courseProgressTotals.completed / courseProgressTotals.total) * 100
    : 0

  const currentModuleId = String(latestEntry?.moduleId || '').trim()
  const currentModuleSummary = moduleSummaries.find((item) => item.moduleId === currentModuleId) || moduleSummaries[0] || null

  return {
    entry: latestEntry,
    selectedSubmoduleIds: getWorkEntrySubmoduleIds(latestEntry || {}),
    moduleProgress: currentModuleSummary?.moduleProgress || 0,
    courseProgress: Math.min(100, courseProgress),
    moduleSummary: currentModuleSummary,
    moduleSummaries,
  }
}

export {
  buildFacultyTodayWorkProgressSummary,
  getFacultyTodayWorkEntriesForStudent,
  getWorkEntrySubmoduleIds,
  getWorkStudentIds,
  isFacultyWorkEntryForStudent,
  normalizeWorkStudentId,
}
