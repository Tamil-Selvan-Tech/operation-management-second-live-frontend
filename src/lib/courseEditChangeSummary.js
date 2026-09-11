function text(value) {
  return String(value ?? '').trim()
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function nameOf(item, fallback) {
  return text(item?.name || item?.title || item?.modelName || item?.submodelName) || fallback
}

function childrenOf(model) {
  return list(model?.submodels || model?.subModels || model?.submodules || model?.subModules)
}

function identity(item) {
  const id = text(item?.id || item?._id || item?.modelId || item?.submodelId)
  return id && !/^((module|model|submodule)-\d+)$/.test(id) ? id : ''
}

function pairRecords(previous, next) {
  const oldRecords = list(previous)
  const newRecords = list(next)
  const pairs = []
  const usedOld = new Set()
  const usedNew = new Set()

  newRecords.forEach((record, newIndex) => {
    const id = identity(record)
    if (!id) return
    const oldIndex = oldRecords.findIndex((candidate, index) => !usedOld.has(index) && identity(candidate) === id)
    if (oldIndex >= 0) {
      pairs.push({ oldRecord: oldRecords[oldIndex], newRecord: record, oldIndex, newIndex })
      usedOld.add(oldIndex)
      usedNew.add(newIndex)
    }
  })

  newRecords.forEach((record, newIndex) => {
    if (usedNew.has(newIndex)) return
    const newName = nameOf(record, '')
    const oldIndex = oldRecords.findIndex(
      (candidate, index) => !usedOld.has(index) && nameOf(candidate, '') === newName && newName,
    )
    if (oldIndex >= 0) {
      pairs.push({ oldRecord: oldRecords[oldIndex], newRecord: record, oldIndex, newIndex })
      usedOld.add(oldIndex)
      usedNew.add(newIndex)
    }
  })

  // For legacy records without IDs, pair the remaining records by their relative
  // position. This is only a fallback; records with IDs are always matched by ID.
  newRecords.forEach((record, newIndex) => {
    if (usedNew.has(newIndex)) return
    const oldIndex = oldRecords.findIndex((_, index) => !usedOld.has(index))
    if (oldIndex >= 0) {
      pairs.push({ oldRecord: oldRecords[oldIndex], newRecord: record, oldIndex, newIndex })
      usedOld.add(oldIndex)
      usedNew.add(newIndex)
    }
  })

  return {
    pairs,
    added: newRecords.filter((_, index) => !usedNew.has(index)),
    deleted: oldRecords.filter((_, index) => !usedOld.has(index)),
  }
}

function comparableFields(item, kind) {
  const ignored = new Set(['id', '_id', 'sequenceNo', 'order', 'position', 'percentage', 'weight', 'share'])
  const fields = {}
  Object.entries(item || {}).forEach(([field, value]) => {
    if (ignored.has(field) || ['name', 'title', 'modelName', 'submodelName', 'submodels', 'subModels', 'submodules', 'subModules'].includes(field)) return
    if (value !== undefined && value !== null && typeof value !== 'object') fields[field] = text(value)
  })
  if (kind === 'model' && !Object.keys(fields).length && item?.description !== undefined) fields.description = text(item.description)
  return fields
}

function fieldChanges(oldRecord, newRecord, kind) {
  const oldFields = comparableFields(oldRecord, kind)
  const newFields = comparableFields(newRecord, kind)
  const fields = new Set([...Object.keys(oldFields), ...Object.keys(newFields)])
  return [...fields]
    .filter((field) => oldFields[field] !== newFields[field])
    .map((field) => ({ field, oldValue: oldFields[field] || '', newValue: newFields[field] || '' }))
}

export function compareCourseEditModules(previousModules = [], nextModules = []) {
  const changes = { added: [], updated: [], renamed: [], deleted: [] }
  const models = pairRecords(previousModules, nextModules)

  models.added.forEach((model) => changes.added.push({ type: 'MODEL_ADDED', modelName: nameOf(model, 'Unnamed model'), subModels: childrenOf(model).map((child, index) => nameOf(child, `Submodel ${index + 1}`)) }))
  models.deleted.forEach((model) => changes.deleted.push({ type: 'MODEL_DELETED', modelName: nameOf(model, 'Unnamed model'), subModels: childrenOf(model).map((child, index) => nameOf(child, `Submodel ${index + 1}`)) }))

  models.pairs.forEach(({ oldRecord, newRecord }) => {
    const oldModelName = nameOf(oldRecord, 'Unnamed model')
    const newModelName = nameOf(newRecord, 'Unnamed model')
    if (oldModelName !== newModelName) changes.renamed.push({ type: 'MODEL_RENAMED', oldName: oldModelName, newName: newModelName })
    const modelFields = fieldChanges(oldRecord, newRecord, 'model')
    if (modelFields.length) changes.updated.push({ type: 'MODEL_UPDATED', modelName: newModelName, changes: modelFields })

    const subs = pairRecords(childrenOf(oldRecord), childrenOf(newRecord))
    subs.added.forEach((submodel) => changes.added.push({ type: 'SUBMODEL_ADDED', modelName: newModelName, subModelName: nameOf(submodel, 'Unnamed submodel') }))
    subs.deleted.forEach((submodel) => changes.deleted.push({ type: 'SUBMODEL_DELETED', modelName: oldModelName, subModelName: nameOf(submodel, 'Unnamed submodel') }))
    subs.pairs.forEach(({ oldRecord: oldSubmodel, newRecord: newSubmodel }) => {
      const oldName = nameOf(oldSubmodel, 'Unnamed submodel')
      const newName = nameOf(newSubmodel, 'Unnamed submodel')
      if (oldName !== newName) changes.renamed.push({ type: 'SUBMODEL_RENAMED', modelName: newModelName, oldName, newName })
      const subChanges = fieldChanges(oldSubmodel, newSubmodel, 'submodel')
      if (subChanges.length) changes.updated.push({ type: 'SUBMODEL_UPDATED', modelName: newModelName, subModelName: newName, changes: subChanges })
    })
  })

  return changes
}

function quote(value) {
  return `"${text(value)}"`
}

export function formatCourseEditChangeSummary(previousModules, nextModules, facultyName = 'Faculty', courseName = 'Course') {
  const changes = compareCourseEditModules(previousModules, nextModules)
  const sections = []
  if (changes.added.length) sections.push(`Added\n${changes.added.map((change) => change.type === 'MODEL_ADDED' ? `- Model: ${change.modelName}${change.subModels.length ? ` (Sub-Models: ${change.subModels.join(', ')})` : ''}` : `- Sub-Model: ${change.subModelName} under ${change.modelName}`).join('\n')}`)
  if (changes.updated.length) sections.push(`Updated\n${changes.updated.map((change) => `- ${change.type === 'MODEL_UPDATED' ? `Model: ${change.modelName}` : `Sub-Model: ${change.subModelName} under ${change.modelName}`}\n${change.changes.map((item) => `  ${item.field} changed from ${quote(item.oldValue)} to ${quote(item.newValue)}`).join('\n')}`).join('\n')}`)
  if (changes.renamed.length) sections.push(`Renamed\n${changes.renamed.map((change) => `- ${change.type === 'MODEL_RENAMED' ? 'Model' : `Sub-Model under ${change.modelName}`}: ${quote(change.oldName)} -> ${quote(change.newName)}`).join('\n')}`)
  if (changes.deleted.length) sections.push(`Deleted\n${changes.deleted.map((change) => change.type === 'MODEL_DELETED' ? `- Model: ${change.modelName}` : `- Sub-Model: ${change.subModelName} from ${change.modelName}`).join('\n')}`)
  if (!sections.length) return { changes, hasChanges: false, summary: '' }
  return { changes, hasChanges: true, summary: `Course Content Updated\n${text(facultyName) || 'Faculty'} made the following changes to ${text(courseName) || 'Course'}:\n\n${sections.join('\n\n')}\n\nPlease review the updated course content.` }
}
