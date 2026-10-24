import { useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { friendlyCourseImportMessage } from '../lib/courseImportMessages'

const NUMBER_COLUMNS = new Set(['Duration in Months','Total Course Hours','Standard Course Fee','Registration Fee','Discount','Academic Test Count'])
const normalizePlanName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
const duplicateIssue = (message) => /duplicate|already exists|matches multiple active branch templates/i.test(message)

export default function CourseImportSheetTable({ sheetName, sheet, panelId, rows, errors, edits, busy, availablePaymentPlans = [], ambiguousPaymentPlanNames = [], invalidRows = [], duplicateRows = [], emptyMessage = 'No rows in this sheet.', onEditRow, onDeleteRow }) {
  const headers = sheet?.headers || []
  const rowSerialNumbers = new Map((sheet?.rows || []).map((sheetRow, index) => [sheetRow.row, index + 1]))
  const [editingRow, setEditingRow] = useState(null)

  const errorsByCell = new Map()
  const errorsByRow = new Map()
  for (const item of errors) {
    if (item.sheet !== sheetName) continue
    if (item.row >= 2) {
      if (!errorsByRow.has(item.row)) errorsByRow.set(item.row, [])
      errorsByRow.get(item.row).push(item)
    }
    if (!headers.includes(item.column)) continue
    const key = String(item.row) + ':' + item.column
    if (!errorsByCell.has(key)) errorsByCell.set(key, [])
    errorsByCell.get(key).push(item)
  }

  const invalidRowSet = new Set(invalidRows)
  const duplicateRowSet = new Set(duplicateRows)
  const sheetLevelErrors = errors.filter((item) => item.sheet === sheetName && (!headers.includes(item.column) || !item.row || item.row === 1))
  const paymentPlanHelp = sheetName === 'Payment Plans'
    ? availablePaymentPlans.length
      ? 'Choose an active plan name or supported alias. Full Payment maps to a unique full-payment template; 3 Installment maps to a unique three-installment template.' + (ambiguousPaymentPlanNames.length ? ' Duplicate plan names are excluded; rename them in Payment Plan Management.' : '')
      : ambiguousPaymentPlanNames.length
        ? 'No uniquely named active plans are available. Rename duplicate plans in Payment Plan Management, then validate again.'
        : 'This branch has no active payment plans. Add one in Payment Plan Management, then click Validate file to refresh the list.'
    : ''

  if (!rows.length) return <div className="course-import-sheet-panel" id={panelId} role="tabpanel" aria-labelledby={panelId.replace('panel', 'tab')} aria-label={sheetName + ' preview'}>{sheetName === 'Payment Plans' ? <div className={'course-import-plan-help' + (availablePaymentPlans.length ? '' : ' is-warning')} role={availablePaymentPlans.length ? 'status' : 'alert'}>{paymentPlanHelp}</div> : null}<div className="course-import-empty-sheet">{sheetLevelErrors.map((item, index) => <div className="course-import-sheet-validation" role="alert" key={index}><strong>{item.column}</strong><span>{friendlyCourseImportMessage(item.column, item.message)}</span></div>)}<strong>{emptyMessage}</strong><span>{emptyMessage.startsWith('No rows found for') ? 'Choose a different filter or adjust your search.' : 'Check the validation errors for missing rows or references.'}</span></div></div>

  return (
    <div className="course-import-sheet-panel" id={panelId} role="tabpanel" aria-labelledby={panelId.replace('panel', 'tab')} aria-label={sheetName + ' preview'}>
      {sheetLevelErrors.map((item, index) => <div className="course-import-sheet-validation" role="alert" key={index}><strong>{item.column}</strong><span>{friendlyCourseImportMessage(item.column, item.message)}</span></div>)}
      {sheetName === 'Payment Plans' ? <div className={'course-import-plan-help' + (availablePaymentPlans.length ? '' : ' is-warning')} role={availablePaymentPlans.length ? 'status' : 'alert'}>{paymentPlanHelp}</div> : null}
      <div className={'course-import-table-wrap course-import-edit-wrap sheet-' + sheetName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
        <table className="course-import-edit-table">
          <thead><tr><th data-column="S.No">S.No</th>{headers.map((header) => <th key={header} data-column={header}>{header}</th>)}<th data-column="Actions">Actions</th><th data-column="Row status">Status</th></tr></thead>
          <tbody>{rows.map((row) => {
            const rowIssues = errorsByRow.get(row.row) || []
            const duplicate = duplicateRowSet.has(row.row) || rowIssues.some((item) => duplicateIssue(item.message))
            const invalid = invalidRowSet.has(row.row) || duplicateRowSet.has(row.row) || rowIssues.length > 0
            const statusDetail = duplicate ? (sheetName === 'Courses' ? 'Duplicate course' : 'Duplicate row') : invalid ? (rowIssues.length === 1 ? '1 issue to fix' : rowIssues.length + ' issues to fix') : ''
            const statusLabel = duplicate ? 'Duplicate' : invalid ? 'Invalid' : 'Valid'
            const statusClass = duplicate ? 'is-duplicate' : invalid ? 'is-invalid' : 'is-valid'
            const isEditing = editingRow?.sheetName === sheetName && editingRow?.row === row.row
            const rowValues = isEditing ? editingRow.values : {}
            const savedValues = edits[sheetName]?.[row.row] || {}
            const otherRowEditing = editingRow?.sheetName === sheetName && editingRow?.row !== row.row
            const beginEdit = () => {
              const values = Object.fromEntries(headers.map((column) => [column, savedValues[column] ?? row.values[column] ?? '']))
              setEditingRow({ sheetName, row: row.row, values })
            }
            const saveRow = async () => {
              const changes = {}
              headers.forEach((column) => {
                const previous = savedValues[column] ?? row.values[column] ?? ''
                const next = rowValues[column] ?? previous
                if (String(next ?? '') !== String(previous ?? '')) changes[column] = next
              })
              if (Object.keys(changes).length) await onEditRow(sheetName, row.row, changes)
              setEditingRow(null)
            }
            const updateDraft = (column, value) => setEditingRow((current) => current ? { ...current, values: { ...current.values, [column]: value } } : current)

            return (
              <tr key={row.row} className={[invalid && 'has-row-issue', isEditing && 'is-editing'].filter(Boolean).join(' ')}>
                <th scope="row" className="course-import-row-heading" data-column="S.No" title={'Excel row ' + row.row}>{rowSerialNumbers.get(row.row) ?? row.row - 1}</th>
                {headers.map((column) => {
                  const issueList = errorsByCell.get(String(row.row) + ':' + column) || []
                  const errorId = 'course-import-cell-error-' + sheetName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + row.row + '-' + column.replace(/[^a-z0-9]/gi, '-')
                  const savedValue = savedValues[column] ?? row.values[column] ?? ''
                  const value = isEditing ? (rowValues[column] ?? savedValue) : savedValue
                  const displayValue = value === '' || value == null ? '-' : String(value)
                  const normalizedPlanValue = normalizePlanName(value)
                  const matchingPaymentPlan = availablePaymentPlans.find((plan) => normalizePlanName(plan.templateName) === normalizedPlanValue || (plan.aliases || []).some((alias) => normalizePlanName(alias) === normalizedPlanValue))
                  const exactPlanChoiceExists = availablePaymentPlans.some((plan) => plan.templateName === value || (plan.aliases || []).includes(value))
                  const props = {
                    value, disabled: busy, 'aria-label': column + ', Excel row ' + row.row,
                    'aria-invalid': Boolean(issueList.length), 'aria-describedby': issueList.length ? errorId : undefined,
                    onChange: (event) => updateDraft(column, event.target.value),
                  }
                  return (
                    <td key={column} data-column={column} className={issueList.length ? 'has-cell-error' : ''}>
                      <label className="course-import-mobile-label">{column}</label>
                      {isEditing
                        ? sheetName === 'Courses' && column === 'Mode' ? <select {...props}>{['Online','Offline','Hybrid'].map((option) => <option key={option}>{option}</option>)}</select>
                          : sheetName === 'Courses' && column === 'Status' ? <select {...props}>{['Active','Inactive'].map((option) => <option key={option}>{option}</option>)}</select>
                            : sheetName === 'Payment Plans' && column === 'Payment Plan Name' ? <select {...props}>
                              {value && !exactPlanChoiceExists ? <option value={value}>{value} ({matchingPaymentPlan ? 'alias for ' + matchingPaymentPlan.templateName : 'not a valid plan name'})</option> : null}
                              <option value="">Select an active payment plan</option>
                              {availablePaymentPlans.flatMap((plan) => [
                                <option key={'plan-' + plan.templateName} value={plan.templateName}>{plan.templateName} ({plan.installmentCount} installments)</option>,
                                ...(plan.aliases || []).map((alias) => <option key={'alias-' + plan.templateName + '-' + alias} value={alias}>{alias} (alias for {plan.templateName})</option>),
                              ])}
                            </select>
                            : <input {...props} type="text" inputMode={sheetName === 'Courses' && NUMBER_COLUMNS.has(column) ? 'numeric' : 'text'} />
                        : <span className="course-import-cell-display" title={displayValue}>{displayValue}</span>}
                      {issueList.length ? <small className="course-import-cell-error" id={errorId}>{issueList.map((item) => friendlyCourseImportMessage(item.column, item.message)).join(' ')}</small> : null}
                    </td>
                  )
                })}
                <td className="course-import-row-actions" data-column="Actions"><label className="course-import-mobile-label">Action</label><div className="course-import-row-action-buttons">
                  {isEditing ? <><button type="button" className="course-import-row-action is-save" disabled={Boolean(busy)} onClick={saveRow} aria-label={'Save edits for Excel row ' + row.row}><Check size={14} aria-hidden="true" /><span>Save</span></button><button type="button" className="course-import-row-action is-cancel" disabled={Boolean(busy)} onClick={() => setEditingRow(null)} aria-label={'Cancel edits for Excel row ' + row.row}><X size={14} aria-hidden="true" /><span className="sr-only">Cancel</span></button></>
                    : duplicate && sheetName === 'Courses' ? <button type="button" className="course-import-row-action is-delete" disabled={Boolean(busy)} onClick={() => void onDeleteRow?.(sheetName, row.row)} aria-label={'Delete duplicate course at Excel row ' + row.row}><Trash2 size={14} aria-hidden="true" /><span>Delete</span></button>
                    : <button type="button" className="course-import-row-action is-edit" disabled={Boolean(busy) || Boolean(otherRowEditing)} onClick={beginEdit} aria-label={'Edit Excel row ' + row.row}><Pencil size={14} aria-hidden="true" /><span>Edit</span></button>}                </div></td>
                <td className="course-import-row-state" data-column="Row status" title={statusDetail || statusLabel}><label className="course-import-mobile-label">Status</label><span className="course-import-row-state-content">{invalid ? <span className={'course-import-row-badge ' + statusClass}>{statusLabel}</span> : <span className="course-import-row-state-label is-valid">{statusLabel}</span>}{statusDetail ? <small>{statusDetail}</small> : null}</span></td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
    </div>
  )
}
