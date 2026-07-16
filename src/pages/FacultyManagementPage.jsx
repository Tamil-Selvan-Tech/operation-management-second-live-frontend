import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Clock3, Eye, Mail, PencilLine, Phone, Plus, Save, Trash2, UserRound, UsersRound, X } from 'lucide-react'
import { Button } from '../components/Button'
import { OperationManagerHeader } from '../components/OperationManagerHeader'
import { loadFacultyRecords, saveFacultyRecords } from '../data/facultyRecords'
import { COURSE_RECORD_SYNC_EVENT, loadCourseRecords } from '../data/courseRecords'
import { listCourses, normalizeCourseList } from '../services/courseService'
import { useAuth } from '../auth/useAuth'

function createEmptyForm() {
  return {
    facultyName: '',
    facultyEmail: '',
    facultyPhone: '',
    courseId: '',
    status: 'Active',
    batchEntries: [],
    batchName: '',
    batchTiming: '',
    batchTimingCustomStart: '',
    batchTimingCustomStartMeridiem: 'AM',
    batchTimingCustomEnd: '',
    batchTimingCustomEndMeridiem: 'PM',
  }
}

const BATCH_TIMING_OPTIONS = ['09.30 AM - 6.30 PM', '10.00 AM - 7.30 PM', '10.30 AM - 7.30 PM', '11.00 AM - 8.00 PM']

function createEmptyBatchTimingState() {
  return {
    batchTimingPreset: '',
    batchTimingCustomStart: '',
    batchTimingCustomStartMeridiem: 'AM',
    batchTimingCustomEnd: '',
    batchTimingCustomEndMeridiem: 'PM',
  }
}

function parseBatchTimingState(batchTiming = '') {
  const normalizedTiming = String(batchTiming || '').trim()

  if (BATCH_TIMING_OPTIONS.includes(normalizedTiming)) {
    return {
      ...createEmptyBatchTimingState(),
      batchTimingPreset: normalizedTiming,
    }
  }

  const customMatch = normalizedTiming.match(/^(\d{1,2}[:.]\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}[:.]\d{2})\s*(AM|PM)$/i)
  if (customMatch) {
    return {
      batchTimingPreset: 'Custom',
      batchTimingCustomStart: customMatch[1].replace('.', ':'),
      batchTimingCustomStartMeridiem: customMatch[2].toUpperCase(),
      batchTimingCustomEnd: customMatch[3].replace('.', ':'),
      batchTimingCustomEndMeridiem: customMatch[4].toUpperCase(),
    }
  }

  return createEmptyBatchTimingState()
}

function formatBatchTimingState(entry = {}) {
  const preset = String(entry.batchTimingPreset || '').trim()
  if (preset && preset !== 'Custom') return preset

  const start = String(entry.batchTimingCustomStart || '').trim()
  const startMeridiem = String(entry.batchTimingCustomStartMeridiem || 'AM').trim()
  const end = String(entry.batchTimingCustomEnd || '').trim()
  const endMeridiem = String(entry.batchTimingCustomEndMeridiem || 'PM').trim()
  if (!start || !end) return ''

  return `${start} ${startMeridiem} - ${end} ${endMeridiem}`
}

function getTimingMode(entry = {}) {
  return String(entry.batchTimingPreset || '').trim() === 'Custom' ? 'Custom' : 'preset'
}

function apiErrorMessage(error, fallback) {
  return error?.body?.message || error?.message || fallback
}

function FacultyField({ label, required = false, error, icon, children }) {
  return (
    <label className={`course-field faculty-field ${icon ? 'faculty-field-has-icon' : ''}`.trim()}>
      <span>
        {label}
        {required ? <b>*</b> : null}
      </span>
      <div className="faculty-field-control">
        {icon ? <span className="faculty-field-icon">{icon}</span> : null}
        {children}
      </div>
      {error ? <small className="course-field-error">{error}</small> : null}
    </label>
  )
}

function FacultyEditorContent({
  form,
  isCoursesLoading,
  activeCourseOptions,
  validationErrors,
  shouldShowError,
  updateField,
  markTouched,
  addBatchEntry,
  isEditMode,
  isSubmitting,
  onCancel,
}) {
  return (
    <>
      <div className="faculty-modal-grid">
        <section className="faculty-card faculty-card-info">
          <div className="faculty-card-head">
            <div className="faculty-card-head-icon">
              <UserRound />
            </div>
            <h4>Faculty Information</h4>
          </div>

          <div className="faculty-field-stack">
            <FacultyField
              label="Faculty Name"
              required
              icon={<UserRound />}
              error={shouldShowError('facultyName') ? validationErrors.facultyName : ''}
            >
              <input
                type="text"
                placeholder="Enter faculty name"
                value={form.facultyName}
                onChange={(event) => {
                  const value = event.target.value
                  const autoBatchName = value.trim() ? `${value.trim()} batch` : ''
                  updateField('facultyName', value)
                  updateField('batchName', autoBatchName)
                }}
                onBlur={() => markTouched('facultyName')}
                aria-invalid={Boolean(shouldShowError('facultyName'))}
              />
            </FacultyField>

            <FacultyField
              label="Faculty Email"
              required
              icon={<Mail />}
              error={shouldShowError('facultyEmail') ? validationErrors.facultyEmail : ''}
            >
              <input
                type="email"
                placeholder="Enter email address"
                value={form.facultyEmail}
                onChange={(event) => updateField('facultyEmail', event.target.value)}
                onBlur={() => markTouched('facultyEmail')}
                aria-invalid={Boolean(shouldShowError('facultyEmail'))}
              />
            </FacultyField>

            <FacultyField
              label="Faculty Phone"
              required
              icon={<Phone />}
              error={shouldShowError('facultyPhone') ? validationErrors.facultyPhone : ''}
            >
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter phone number"
                value={form.facultyPhone}
                onChange={(event) => updateField('facultyPhone', event.target.value.replace(/\D/g, '').slice(0, 10))}
                onBlur={() => markTouched('facultyPhone')}
                aria-invalid={Boolean(shouldShowError('facultyPhone'))}
              />
            </FacultyField>

            <FacultyField
              label="Select Course"
              required
              icon={<BookOpen />}
              error={shouldShowError('courseId') ? validationErrors.courseId : ''}
            >
              <select
                value={form.courseId}
                onChange={(event) => updateField('courseId', event.target.value)}
                onBlur={() => markTouched('courseId')}
                aria-invalid={Boolean(shouldShowError('courseId'))}
                disabled={isCoursesLoading}
              >
                <option value="">{isCoursesLoading ? 'Loading courses...' : 'Select course'}</option>
                {!isCoursesLoading && activeCourseOptions.length
                  ? activeCourseOptions.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))
                  : null}
                {!isCoursesLoading && !activeCourseOptions.length ? <option value="" disabled>No active courses available</option> : null}
              </select>
            </FacultyField>

            <FacultyField
              label="Select Status"
              required
              icon={<UsersRound />}
              error={shouldShowError('status') ? validationErrors.status : ''}
            >
              <select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
                onBlur={() => markTouched('status')}
                aria-invalid={Boolean(shouldShowError('status'))}
              >
                <option value="">Select status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </FacultyField>
          </div>
        </section>

        <section className="faculty-card faculty-card-batch">
          <div className="faculty-card-head">
            <div className="faculty-card-head-icon">
              <UsersRound />
            </div>
            <h4>Batch Management</h4>
          </div>

          <div className="faculty-batch-subtitle">Add New Batch</div>

          <FacultyField label="Batch Name" required icon={<BookOpen />}>
            <input
              type="text"
              placeholder="Enter batch name"
              value={form.batchName || (form.facultyName.trim() ? `${form.facultyName.trim()} batch` : '')}
              onChange={(event) => updateField('batchName', event.target.value)}
              onFocus={() => updateField('batchName', form.batchName || (form.facultyName.trim() ? `${form.facultyName.trim()} batch` : ''))}
            />
          </FacultyField>

          <FacultyField label="Batch Timing" required icon={<Clock3 />}>
            <select
              value={form.batchTiming}
              onChange={(event) => {
                const nextTiming = event.target.value
                updateField('batchTiming', nextTiming)
                if (nextTiming !== 'Custom') {
                  updateField('batchTimingCustomStart', '')
                  updateField('batchTimingCustomStartMeridiem', 'AM')
                  updateField('batchTimingCustomEnd', '')
                  updateField('batchTimingCustomEndMeridiem', 'PM')
                }
              }}
            >
              <option value="">Select timing</option>
              <option>09.30 AM - 6.30 PM</option>
              <option>10.00 AM - 7.30 PM</option>
              <option>10.30 AM - 7.30 PM</option>
              <option>11.00 AM - 8.00 PM</option>
              <option>Custom</option>
            </select>
          </FacultyField>

          {form.batchTiming === 'Custom' ? (
            <FacultyField label="Custom Timing" required icon={<Clock3 />}>
              <div className="faculty-custom-timing-range">
                <div className="faculty-custom-timing-side">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="09:30"
                    aria-label="Custom timing start time"
                    value={form.batchTimingCustomStart}
                    onChange={(event) => updateField('batchTimingCustomStart', event.target.value)}
                  />
                  <select
                    aria-label="Custom timing start meridiem"
                    value={form.batchTimingCustomStartMeridiem}
                    onChange={(event) => updateField('batchTimingCustomStartMeridiem', event.target.value)}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                <span aria-hidden="true">-</span>
                <div className="faculty-custom-timing-side">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="06:30"
                    aria-label="Custom timing end time"
                    value={form.batchTimingCustomEnd}
                    onChange={(event) => updateField('batchTimingCustomEnd', event.target.value)}
                  />
                  <select
                    aria-label="Custom timing end meridiem"
                    value={form.batchTimingCustomEndMeridiem}
                    onChange={(event) => updateField('batchTimingCustomEndMeridiem', event.target.value)}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </FacultyField>
          ) : null}

          <button type="button" className="faculty-batch-add faculty-batch-add-full" onClick={addBatchEntry}>
            <Plus />
            <span>Add Batch</span>
          </button>

          <div className="faculty-batch-list-wrap">
            <div className="faculty-batch-list-title">
              <strong>Batches ({form.batchEntries.length})</strong>
            </div>
            {form.batchEntries.length ? (
              <div className="faculty-batch-list faculty-batch-list-scroll" aria-label="Added batches">
                {form.batchEntries.map((entry) => (
                  <div key={entry.id} className="faculty-batch-item faculty-batch-item-image">
                    <div className="faculty-batch-item-copy">
                      <strong>{entry.batchName}</strong>
                      <small>{entry.batchTiming}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="faculty-batch-empty">No batches added yet</div>
            )}
          </div>

          {shouldShowError('batchEntries') ? <small className="course-field-error">{validationErrors.batchEntries}</small> : null}
        </section>
      </div>

      <div className="faculty-form-actions faculty-form-actions-large">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="faculty-save-button">
          <Save />
          <span>{isEditMode ? (isSubmitting ? 'Updating...' : 'Update') : isSubmitting ? 'Submitting...' : 'Save Faculty'}</span>
        </Button>
      </div>
    </>
  )
}

function FacultyInlineEditorTable({
  form,
  isCoursesLoading,
  activeCourseOptions,
  validationErrors,
  shouldShowError,
  updateField,
  markTouched,
  addBatchEntry,
  setForm,
  onCancel,
  isSubmitting,
}) {
  const updateBatchEntry = (entryId, field, value) => {
    setForm((current) => ({
      ...current,
      batchEntries: current.batchEntries.map((entry) =>
        entry.id === entryId ? { ...entry, [field]: value } : entry,
      ),
    }))
  }

  const updateBatchTimingEntry = (entryId, nextTiming) => {
    setForm((current) => ({
      ...current,
      batchEntries: current.batchEntries.map((entry) => {
        if (entry.id !== entryId) return entry

        if (nextTiming === 'Custom') {
          return {
            ...entry,
            batchTimingPreset: 'Custom',
          }
        }

        return {
          ...entry,
          batchTimingPreset: nextTiming,
          batchTimingCustomStart: '',
          batchTimingCustomStartMeridiem: 'AM',
          batchTimingCustomEnd: '',
          batchTimingCustomEndMeridiem: 'PM',
        }
      }),
    }))
  }

  const updateBatchTimingCustomField = (entryId, field, value) => {
    setForm((current) => ({
      ...current,
      batchEntries: current.batchEntries.map((entry) =>
        entry.id === entryId ? { ...entry, batchTimingPreset: 'Custom', [field]: value } : entry,
      ),
    }))
  }

  const removeBatchEntry = (entryId) => {
    setForm((current) => ({
      ...current,
      batchEntries: current.batchEntries.filter((entry) => entry.id !== entryId),
    }))
  }

  return (
    <>
      <div className="faculty-view-table-shell faculty-view-table-shell-edit">
        <table className="faculty-details-table faculty-details-table-edit">
          <tbody>
            <tr>
              <th>Faculty Name</th>
              <td>
                <input
                  className="faculty-inline-input"
                  type="text"
                  placeholder="Enter faculty name"
                  value={form.facultyName}
                  onChange={(event) => {
                    const value = event.target.value
                    const autoBatchName = value.trim() ? `${value.trim()} batch` : ''
                    updateField('facultyName', value)
                    updateField('batchName', autoBatchName)
                  }}
                  onBlur={() => markTouched('facultyName')}
                  aria-invalid={Boolean(shouldShowError('facultyName'))}
                />
              </td>
              <th>Status</th>
              <td>
                <select
                  className="faculty-inline-input"
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                  onBlur={() => markTouched('status')}
                  aria-invalid={Boolean(shouldShowError('status'))}
                >
                  <option value="">Select status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </td>
            </tr>
            <tr>
              <th>Faculty Email</th>
              <td>
                <input
                  className="faculty-inline-input"
                  type="email"
                  placeholder="Enter email address"
                  value={form.facultyEmail}
                  onChange={(event) => updateField('facultyEmail', event.target.value)}
                  onBlur={() => markTouched('facultyEmail')}
                  aria-invalid={Boolean(shouldShowError('facultyEmail'))}
                />
              </td>
              <th>Faculty Phone</th>
              <td>
                <input
                  className="faculty-inline-input"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter phone number"
                  value={form.facultyPhone}
                  onChange={(event) => updateField('facultyPhone', event.target.value.replace(/\D/g, '').slice(0, 10))}
                  onBlur={() => markTouched('facultyPhone')}
                  aria-invalid={Boolean(shouldShowError('facultyPhone'))}
                />
              </td>
            </tr>
            <tr>
              <th>Course</th>
              <td>
                <select
                  className="faculty-inline-input"
                  value={form.courseId}
                  onChange={(event) => updateField('courseId', event.target.value)}
                  onBlur={() => markTouched('courseId')}
                  aria-invalid={Boolean(shouldShowError('courseId'))}
                  disabled={isCoursesLoading}
                >
                  <option value="">{isCoursesLoading ? 'Loading courses...' : 'Select course'}</option>
                  {!isCoursesLoading && activeCourseOptions.length
                    ? activeCourseOptions.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))
                    : null}
                  {!isCoursesLoading && !activeCourseOptions.length ? <option value="" disabled>No active courses available</option> : null}
                </select>
              </td>
              <th>Total Batches</th>
              <td>{form.batchEntries.length}</td>
            </tr>
          </tbody>
        </table>

        <div className="faculty-view-batch-section">
          <div className="faculty-view-batch-header">
            <div>
              <h4>Batch Details</h4>
              <p>Edit the batch rows directly in the table below.</p>
            </div>
          </div>

          <table className="faculty-batch-details-table faculty-batch-details-table-edit">
            <thead>
              <tr>
                <th>S.NO</th>
                <th>Batch Name</th>
                <th>Batch Timing</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {form.batchEntries.map((entry, index) => (
                <tr key={entry.id}>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      className="faculty-inline-input"
                      type="text"
                      value={entry.batchName || ''}
                      onChange={(event) => updateBatchEntry(entry.id, 'batchName', event.target.value)}
                    />
                  </td>
                  <td>
                    <div className="faculty-inline-batch-timing">
                      <select
                        className="faculty-inline-input"
                        value={entry.batchTimingPreset || ''}
                        onChange={(event) => updateBatchTimingEntry(entry.id, event.target.value)}
                      >
                        <option value="">Select timing</option>
                        {BATCH_TIMING_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                        <option value="Custom">Custom</option>
                      </select>

                      {getTimingMode(entry) === 'Custom' ? (
                        <div className="faculty-inline-custom-timing">
                          <div className="faculty-inline-custom-timing-side">
                            <input
                              className="faculty-inline-input"
                              type="text"
                              inputMode="numeric"
                              placeholder="09:30"
                              value={entry.batchTimingCustomStart || ''}
                              onChange={(event) =>
                                updateBatchTimingCustomField(entry.id, 'batchTimingCustomStart', event.target.value)
                              }
                            />
                            <select
                              className="faculty-inline-input"
                              value={entry.batchTimingCustomStartMeridiem || 'AM'}
                              onChange={(event) =>
                                updateBatchTimingCustomField(entry.id, 'batchTimingCustomStartMeridiem', event.target.value)
                              }
                            >
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                            </select>
                          </div>
                          <span aria-hidden="true">-</span>
                          <div className="faculty-inline-custom-timing-side">
                            <input
                              className="faculty-inline-input"
                              type="text"
                              inputMode="numeric"
                              placeholder="06:30"
                              value={entry.batchTimingCustomEnd || ''}
                              onChange={(event) =>
                                updateBatchTimingCustomField(entry.id, 'batchTimingCustomEnd', event.target.value)
                              }
                            />
                            <select
                              className="faculty-inline-input"
                              value={entry.batchTimingCustomEndMeridiem || 'PM'}
                              onChange={(event) =>
                                updateBatchTimingCustomField(entry.id, 'batchTimingCustomEndMeridiem', event.target.value)
                              }
                            >
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                            </select>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <button type="button" className="faculty-row-action danger" onClick={() => removeBatchEntry(entry.id)}>
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="faculty-batch-inline-add-row">
                <td>+</td>
                <td>
                  <input
                    className="faculty-inline-input"
                    type="text"
                    placeholder="Enter batch name"
                    value={form.batchName || (form.facultyName.trim() ? `${form.facultyName.trim()} batch` : '')}
                    onChange={(event) => updateField('batchName', event.target.value)}
                    onFocus={() =>
                      updateField('batchName', form.batchName || (form.facultyName.trim() ? `${form.facultyName.trim()} batch` : ''))
                    }
                  />
                </td>
                <td>
                  <div className="faculty-inline-batch-timing">
                    <select
                      className="faculty-inline-input"
                      value={form.batchTiming}
                      onChange={(event) => {
                        const nextTiming = event.target.value
                        updateField('batchTiming', nextTiming)
                        if (nextTiming !== 'Custom') {
                          updateField('batchTimingCustomStart', '')
                          updateField('batchTimingCustomStartMeridiem', 'AM')
                          updateField('batchTimingCustomEnd', '')
                          updateField('batchTimingCustomEndMeridiem', 'PM')
                        }
                      }}
                    >
                      <option value="">Select timing</option>
                      {BATCH_TIMING_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value="Custom">Custom</option>
                    </select>

                    {form.batchTiming === 'Custom' ? (
                      <div className="faculty-inline-custom-timing">
                        <div className="faculty-inline-custom-timing-side">
                          <input
                            className="faculty-inline-input"
                            type="text"
                            inputMode="numeric"
                            placeholder="09:30"
                            value={form.batchTimingCustomStart}
                            onChange={(event) => updateField('batchTimingCustomStart', event.target.value)}
                          />
                          <select
                            className="faculty-inline-input"
                            value={form.batchTimingCustomStartMeridiem}
                            onChange={(event) => updateField('batchTimingCustomStartMeridiem', event.target.value)}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                        <span aria-hidden="true">-</span>
                        <div className="faculty-inline-custom-timing-side">
                          <input
                            className="faculty-inline-input"
                            type="text"
                            inputMode="numeric"
                            placeholder="06:30"
                            value={form.batchTimingCustomEnd}
                            onChange={(event) => updateField('batchTimingCustomEnd', event.target.value)}
                          />
                          <select
                            className="faculty-inline-input"
                            value={form.batchTimingCustomEndMeridiem}
                            onChange={(event) => updateField('batchTimingCustomEndMeridiem', event.target.value)}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>
                  <button type="button" className="faculty-batch-add faculty-batch-inline-add-button" onClick={addBatchEntry}>
                    Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          {shouldShowError('batchEntries') ? <small className="course-field-error">{validationErrors.batchEntries}</small> : null}
        </div>
      </div>

      <div className="faculty-form-actions faculty-form-actions-large faculty-inline-actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="faculty-save-button">
          <Save />
          <span>{isSubmitting ? 'Updating...' : 'Save Changes'}</span>
        </Button>
      </div>
    </>
  )
}

function getTodayLabel() {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())
}

function getCurrentTimestamp() {
  return new Date().toISOString()
}

function createBatchEntryId(index = 0) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`
}

function getPrefilledForm(record = null) {
  if (!record) return createEmptyForm()

  const batchEntries = Array.isArray(record.batchEntries)
    ? record.batchEntries.map((entry) => {
        const timingState = parseBatchTimingState(entry.batchTiming)

        return {
          id: entry.id || createBatchEntryId(),
          batchName: String(entry.batchName || '').trim(),
          batchTiming: String(entry.batchTiming || '').trim(),
          ...timingState,
        }
      })
    : record.batch
      ? [
          {
            id: `${record.id || 'batch'}-legacy`,
            batchName: String(record.batch || '').trim(),
            batchTiming: String(record.batchTiming || '').trim(),
            ...parseBatchTimingState(record.batchTiming),
          },
        ]
      : []

  return {
    facultyName: record.facultyName || '',
    facultyEmail: record.facultyEmail || '',
    facultyPhone: record.facultyPhone || '',
    courseId: record.courseId || '',
    status: String(record.status || 'Active'),
    batchEntries,
    batchName: '',
    batchTiming: '',
    batchTimingCustomStart: '',
    batchTimingCustomStartMeridiem: 'AM',
    batchTimingCustomEnd: '',
    batchTimingCustomEndMeridiem: 'PM',
  }
}

export function FacultyManagementPage() {
  const { role } = useAuth()
  const isBusinessOwner = role === 'business-owner'
  const headerTitle = isBusinessOwner ? 'Business Owner Dashboard' : 'Operation Manager Dashboard'
  const headerEyebrow = isBusinessOwner ? 'Business Owner' : 'Operation Manager'
  const headerSummary = 'Faculty assignments, active course mapping, and team setup.'
  const headerInitials = isBusinessOwner ? 'BW' : 'OM'
  const headerProfileTitle = isBusinessOwner ? 'Business Head' : 'Operation Manager'
  const headerEmail = isBusinessOwner ? 'business.owner@cispro.com' : 'operation.manager@cispro.com'

  const [records, setRecords] = useState(() => loadFacultyRecords())
  const [courseOptions, setCourseOptions] = useState([])
  const [isCoursesLoading, setIsCoursesLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [editingFacultyId, setEditingFacultyId] = useState('')
  const [selectedFacultyRecord, setSelectedFacultyRecord] = useState(null)
  const [isViewDrawerEditing, setIsViewDrawerEditing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState(createEmptyForm())
  const [touched, setTouched] = useState({})
  const [actionError, setActionError] = useState('')
  const itemsPerPage = 5

  const activeCourseOptions = useMemo(
    () => courseOptions.filter((course) => String(course?.status || '').toLowerCase() === 'active'),
    [courseOptions],
  )

  const validationErrors = useMemo(() => {
    const nextErrors = {}
    const normalizedEmail = form.facultyEmail.trim().toLowerCase()
    const duplicateEmail = normalizedEmail
      ? records.find((record) => {
          if (record.id === editingFacultyId) return false
          return String(record.facultyEmail || '').trim().toLowerCase() === normalizedEmail
        })
      : null

    if (!form.facultyName.trim()) nextErrors.facultyName = 'Faculty name is required.'
    if (!form.facultyEmail.trim()) nextErrors.facultyEmail = 'Faculty email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.facultyEmail.trim())) {
      nextErrors.facultyEmail = 'Enter a valid email address.'
    } else if (duplicateEmail) {
      nextErrors.facultyEmail = 'Email already exists.'
    }
    if (!form.facultyPhone.trim()) nextErrors.facultyPhone = 'Faculty phone number is required.'
    else if (!/^\d{10}$/.test(form.facultyPhone.trim())) nextErrors.facultyPhone = 'Enter a valid 10-digit phone number.'
    if (!form.batchEntries.length) nextErrors.batchEntries = 'Add at least one batch.'
    if (!form.courseId) nextErrors.courseId = 'Please select an active course.'
    if (!form.status.trim()) nextErrors.status = 'Please select faculty status.'

    return nextErrors
  }, [editingFacultyId, form, records])

  const selectedCourse = useMemo(() => {
    return (
      activeCourseOptions.find((course) => course.id === form.courseId) ||
      courseOptions.find((course) => course.id === form.courseId) ||
      null
    )
  }, [activeCourseOptions, courseOptions, form.courseId])

  const totalFaculty = records.length
  const latestFaculty = records[0] || null
  const isViewMode = modalMode === 'view'
  const isEditMode = modalMode === 'edit'
  const totalPages = Math.max(1, Math.ceil(totalFaculty / itemsPerPage))
  const currentPageSafe = Math.min(currentPage, totalPages)
  const paginatedRecords = useMemo(() => {
    const start = (currentPageSafe - 1) * itemsPerPage
    return records.slice(start, start + itemsPerPage)
  }, [currentPageSafe, records])

  const selectedCourseName = selectedCourse?.name || ''

  const shouldShowError = (field) => touched[field] && validationErrors[field]

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const markTouched = (field) => {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  const addBatchEntry = () => {
    const batchName = (form.batchName || form.facultyName).trim()
    const batchTiming = form.batchTiming.trim()
    const batchTimingCustomStart = form.batchTimingCustomStart.trim()
    const batchTimingCustomStartMeridiem = form.batchTimingCustomStartMeridiem.trim()
    const batchTimingCustomEnd = form.batchTimingCustomEnd.trim()
    const batchTimingCustomEndMeridiem = form.batchTimingCustomEndMeridiem.trim()
    const resolvedBatchTiming =
      batchTiming === 'Custom'
        ? batchTimingCustomStart && batchTimingCustomEnd
          ? `${batchTimingCustomStart} ${batchTimingCustomStartMeridiem} - ${batchTimingCustomEnd} ${batchTimingCustomEndMeridiem}`
          : ''
        : batchTiming

    if (!batchName || !batchTiming || !resolvedBatchTiming) {
      setActionError('Enter batch name and batch timing, then click Add Batch.')
      return
    }

    setActionError('')
    setForm((current) => ({
      ...current,
      batchEntries: [
        ...current.batchEntries,
        {
          id: createBatchEntryId(current.batchEntries.length + 1),
          batchName,
          batchTiming: resolvedBatchTiming,
          ...parseBatchTimingState(resolvedBatchTiming),
        },
      ],
      batchName,
      batchTiming: '',
      batchTimingCustomStart: '',
      batchTimingCustomStartMeridiem: 'AM',
      batchTimingCustomEnd: '',
      batchTimingCustomEndMeridiem: 'PM',
    }))
  }

  const loadCourseOptions = async () => {
    setIsCoursesLoading(true)

    try {
      const result = await listCourses({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' })
      const normalizedCourses = normalizeCourseList(result.data || loadCourseRecords())
      setCourseOptions(normalizedCourses)
      setActionError('')
    } catch (error) {
      setCourseOptions(normalizeCourseList(loadCourseRecords()))
      setActionError(apiErrorMessage(error, 'Failed to load active courses from the backend.'))
    } finally {
      setIsCoursesLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCourseOptions()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    const refreshCourses = () => {
      void loadCourseOptions()
    }

    window.addEventListener(COURSE_RECORD_SYNC_EVENT, refreshCourses)

    return () => window.removeEventListener(COURSE_RECORD_SYNC_EVENT, refreshCourses)
  }, [])

  useEffect(() => {
    const syncFacultyRecords = () => {
      setRecords(loadFacultyRecords())
    }

    window.addEventListener('storage', syncFacultyRecords)
    window.addEventListener('cispro:faculty-changed', syncFacultyRecords)

    return () => {
      window.removeEventListener('storage', syncFacultyRecords)
      window.removeEventListener('cispro:faculty-changed', syncFacultyRecords)
    }
  }, [])

  const closeModal = () => {
    setIsModalOpen(false)
    setIsSubmitting(false)
    setActionError('')
    setForm(createEmptyForm())
    setTouched({})
    setModalMode('create')
    setEditingFacultyId('')
    setSelectedFacultyRecord(null)
    setIsViewDrawerEditing(false)
  }

  const openCreateModal = () => {
    setActionError('')
    setForm(createEmptyForm())
    setTouched({})
    setModalMode('create')
    setEditingFacultyId('')
    setSelectedFacultyRecord(null)
    setIsViewDrawerEditing(false)
    setIsModalOpen(true)
  }

  const openViewModal = (record) => {
    setActionError('')
    setForm(getPrefilledForm(record))
    setTouched({})
    setModalMode('view')
    setEditingFacultyId(record.id)
    setSelectedFacultyRecord(record)
    setIsViewDrawerEditing(false)
    setIsModalOpen(true)
  }

  const openEditModal = (record) => {
    setActionError('')
    setForm(getPrefilledForm(record))
    setTouched({})
    setModalMode('view')
    setEditingFacultyId(record.id)
    setSelectedFacultyRecord(record)
    setIsViewDrawerEditing(true)
    setIsModalOpen(true)
  }

  const cancelInlineEdit = () => {
    if (selectedFacultyRecord) {
      setForm(getPrefilledForm(selectedFacultyRecord))
    }
    setTouched({})
    setActionError('')
    setIsViewDrawerEditing(false)
  }

  const toggleInlineEditMode = () => {
    const next = !isViewDrawerEditing
    if (next && selectedFacultyRecord) {
      setForm(getPrefilledForm(selectedFacultyRecord))
      setTouched({})
      setActionError('')
    }
    setIsViewDrawerEditing(next)
  }

  const openDeleteModal = (record) => {
    setActionError('')
    setDeleteTarget(record)
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isViewMode && !isViewDrawerEditing) {
      closeModal()
      return
    }

    const nextTouched = {
      facultyName: true,
      facultyEmail: true,
      facultyPhone: true,
      batchEntries: true,
      courseId: true,
      status: true,
    }
    setTouched(nextTouched)

    if (Object.keys(validationErrors).length > 0) return

    setIsSubmitting(true)
    setActionError('')

    const existingRecord = records.find((record) => record.id === editingFacultyId)
    const existingBatchEntries = Array.isArray(form.batchEntries) && form.batchEntries.length
      ? form.batchEntries
      : Array.isArray(selectedFacultyRecord?.batchEntries) && selectedFacultyRecord.batchEntries.length
        ? selectedFacultyRecord.batchEntries
        : []
    const nextRecord = {
      id: editingFacultyId || `${Date.now()}`,
      facultyName: form.facultyName.trim(),
      facultyEmail: form.facultyEmail.trim(),
      facultyPhone: form.facultyPhone.trim(),
      status: form.status.trim() || 'Active',
      batchEntries: existingBatchEntries.map((entry) => ({
        id: entry.id,
        batchName: String(entry.batchName || '').trim(),
        batchTiming: formatBatchTimingState(entry),
      })),
      batchCount: existingBatchEntries.length,
      courseId: form.courseId,
      courseName: selectedCourseName,
      createdAt: existingRecord?.createdAt || getCurrentTimestamp(),
      createdOn: existingRecord?.createdOn || getTodayLabel(),
      updatedAt: getCurrentTimestamp(),
      updatedOn: getTodayLabel(),
    }

    try {
      const nextRecords = isEditMode || isViewDrawerEditing
        ? records.map((record) => (record.id === editingFacultyId ? nextRecord : record))
        : [nextRecord, ...records]
      setRecords(nextRecords)
      saveFacultyRecords(nextRecords)
      setCurrentPage(1)
      if (isViewDrawerEditing) {
        setSelectedFacultyRecord(nextRecord)
        setForm(getPrefilledForm(nextRecord))
        setTouched({})
        setIsSubmitting(false)
        setIsViewDrawerEditing(false)
        return
      }
      closeModal()
    } catch (error) {
      setActionError(apiErrorMessage(error, 'Unable to save faculty details right now.'))
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirmed = () => {
    if (!deleteTarget) return

    const nextRecords = records.filter((record) => record.id !== deleteTarget.id)
    setRecords(nextRecords)
    saveFacultyRecords(nextRecords)
    setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil(nextRecords.length / itemsPerPage))))
    closeDeleteModal()
  }

  return (
    <section className="faculty-management-page">
      <OperationManagerHeader
        className="operation-manager-header-plain"
        eyebrow={headerEyebrow}
        title={headerTitle}
        summary={headerSummary}
        initials={headerInitials}
        profileTitle={headerProfileTitle}
        email={headerEmail}
      />

      <article className="faculty-management-hero">
        <div>
          <p className="eyebrow faculty-management-title">Faculty Management</p>
          <p>Assign faculty to active courses and keep instructor details organized in one place.</p>
        </div>

        <div className="faculty-management-actions">
          <div className="faculty-management-stat">
            <span>Total Faculty</span>
            <strong>{totalFaculty}</strong>
          </div>
          <Button type="button" className="faculty-add-button" onClick={openCreateModal}>
            + Add Faculty
          </Button>
        </div>
      </article>

      <article className="faculty-list-card">
        <div className="faculty-list-header">
          <div>
            <h3>Faculty List</h3>
            <p>New faculty records appear here after submit.</p>
          </div>
          {latestFaculty ? (
            <div className="faculty-latest-chip">
              Latest: <strong>{latestFaculty.facultyName}</strong>
            </div>
          ) : null}
        </div>

        {actionError ? (
          <div className="faculty-empty-state" role="alert" aria-live="polite">
            <strong>Action failed</strong>
            <p>{actionError}</p>
          </div>
        ) : null}

        {records.length ? (
          <div className="faculty-table-wrap">
            <table className="faculty-table">
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Batch</th>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.facultyName}</strong>
                      <small>Faculty member</small>
                    </td>
                    <td>{record.facultyEmail}</td>
                    <td>{record.facultyPhone}</td>
                    <td>{Array.isArray(record.batchEntries) ? record.batchEntries.length : Number(record.batchCount || 0) || '-'}</td>
                    <td>{record.courseName || '-'}</td>
                    <td>
                      <span className={`status-pill ${String(record.status || 'Active').toLowerCase()}`}>
                        {record.status || 'Active'}
                      </span>
                    </td>
                    <td>
                      <div className="faculty-row-actions">
                        <button
                          type="button"
                          className="faculty-row-action"
                          onClick={() => openViewModal(record)}
                          aria-label={`View ${record.facultyName}`}
                          title="View"
                        >
                          <Eye />
                        </button>
                        <button
                          type="button"
                          className="faculty-row-action"
                          onClick={() => openEditModal(record)}
                          aria-label={`Edit ${record.facultyName}`}
                          title="Edit"
                        >
                          <PencilLine />
                        </button>
                        <button
                          type="button"
                          className="faculty-row-action danger"
                          onClick={() => openDeleteModal(record)}
                          aria-label={`Delete ${record.facultyName}`}
                          title="Delete"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="faculty-empty-state">
            <strong>No faculty added yet</strong>
            <p>Use the Add Faculty button to link a faculty member to an active course.</p>
          </div>
        )}

        {records.length > itemsPerPage ? (
          <div className="faculty-pagination">
            <button
              type="button"
              className="faculty-pagination-button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPageSafe === 1}
            >
              Prev
            </button>
            <div className="faculty-pagination-status">
              Page <strong>{currentPageSafe}</strong> of <strong>{totalPages}</strong>
            </div>
            <button
              type="button"
              className="faculty-pagination-button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPageSafe === totalPages}
            >
              Next
            </button>
          </div>
        ) : null}
      </article>

            {isModalOpen && !isViewMode ? (
        <div className="course-modal-backdrop faculty-modal-backdrop" role="presentation">
          <form
            className="course-modal panel-card faculty-modal faculty-modal-image"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-modal-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSubmit}
          >
            <div className="faculty-modal-top">
              <div className="faculty-modal-top-left">
                <div className="faculty-modal-icon">
                  <UserRound />
                </div>
                <div>
                  <h3 id="faculty-modal-title">{isEditMode ? 'Edit Faculty' : 'Add Faculty'}</h3>
                </div>
              </div>
              <div className="faculty-modal-top-right">
                <span className="faculty-modal-badge">
                  <span className="faculty-modal-badge-dot" />
                  Active Course Mapping
                </span>
                <button type="button" className="faculty-modal-close" onClick={closeModal} aria-label="Close form">
                  <X />
                </button>
              </div>
            </div>

            <div className="faculty-modal-grid">
              <section className="faculty-card faculty-card-info">
                <div className="faculty-card-head">
                  <div className="faculty-card-head-icon">
                    <UserRound />
                  </div>
                  <h4>Faculty Information</h4>
                </div>

                <div className="faculty-field-stack">
                  <FacultyField
                    label="Faculty Name"
                    required
                    icon={<UserRound />}
                    error={shouldShowError('facultyName') ? validationErrors.facultyName : ''}
                  >
                    <input
                      type="text"
                      placeholder="Enter faculty name"
                      value={form.facultyName}
                      onChange={(event) => {
                        const value = event.target.value
                        const autoBatchName = value.trim() ? `${value.trim()} batch` : ''
                        setForm((current) => ({
                          ...current,
                          facultyName: value,
                          batchName: autoBatchName,
                        }))
                      }}
                      onBlur={() => markTouched('facultyName')}
                      aria-invalid={Boolean(shouldShowError('facultyName'))}
                      disabled={isViewMode}
                    />
                  </FacultyField>

                  <FacultyField
                    label="Faculty Email"
                    required
                    icon={<Mail />}
                    error={shouldShowError('facultyEmail') ? validationErrors.facultyEmail : ''}
                  >
                    <input
                      type="email"
                      placeholder="Enter email address"
                      value={form.facultyEmail}
                      onChange={(event) => updateField('facultyEmail', event.target.value)}
                      onBlur={() => markTouched('facultyEmail')}
                      aria-invalid={Boolean(shouldShowError('facultyEmail'))}
                      disabled={isViewMode}
                    />
                  </FacultyField>

                  <FacultyField
                    label="Faculty Phone"
                    required
                    icon={<Phone />}
                    error={shouldShowError('facultyPhone') ? validationErrors.facultyPhone : ''}
                  >
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Enter phone number"
                      value={form.facultyPhone}
                      onChange={(event) => updateField('facultyPhone', event.target.value.replace(/\D/g, '').slice(0, 10))}
                      onBlur={() => markTouched('facultyPhone')}
                      aria-invalid={Boolean(shouldShowError('facultyPhone'))}
                      disabled={isViewMode}
                    />
                  </FacultyField>

                  <FacultyField
                    label="Select Course"
                    required
                    icon={<BookOpen />}
                    error={shouldShowError('courseId') ? validationErrors.courseId : ''}
                  >
                    <select
                      value={form.courseId}
                      onChange={(event) => updateField('courseId', event.target.value)}
                      onBlur={() => markTouched('courseId')}
                      aria-invalid={Boolean(shouldShowError('courseId'))}
                      disabled={isCoursesLoading || isViewMode}
                    >
                      <option value="">{isCoursesLoading ? 'Loading courses...' : 'Select course'}</option>
                      {!isCoursesLoading && activeCourseOptions.length
                        ? activeCourseOptions.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.name}
                            </option>
                          ))
                        : null}
                      {!isCoursesLoading && !activeCourseOptions.length ? <option value="" disabled>No active courses available</option> : null}
                    </select>
                  </FacultyField>

                  <FacultyField
                    label="Select Status"
                    required
                    icon={<UsersRound />}
                    error={shouldShowError('status') ? validationErrors.status : ''}
                  >
                    <select
                      value={form.status}
                      onChange={(event) => updateField('status', event.target.value)}
                      onBlur={() => markTouched('status')}
                      aria-invalid={Boolean(shouldShowError('status'))}
                      disabled={isViewMode}
                    >
                      <option value="">Select status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </FacultyField>
                </div>
              </section>

              <section className="faculty-card faculty-card-batch">
                <div className="faculty-card-head">
                  <div className="faculty-card-head-icon">
                    <UsersRound />
                  </div>
                  <h4>Batch Management</h4>
                </div>

                <div className="faculty-batch-subtitle">Add New Batch</div>

                <FacultyField label="Batch Name" required icon={<BookOpen />}>
                  <input
                    type="text"
                    placeholder="Enter batch name"
                    value={form.batchName || (form.facultyName.trim() ? `${form.facultyName.trim()} batch` : '')}
                    onChange={(event) => updateField('batchName', event.target.value)}
                    onFocus={() =>
                      updateField('batchName', form.batchName || (form.facultyName.trim() ? `${form.facultyName.trim()} batch` : ''))
                    }
                    disabled={isViewMode}
                  />
                </FacultyField>

                <FacultyField label="Batch Timing" required icon={<Clock3 />}>
                  <select
                    value={form.batchTiming}
                    onChange={(event) => {
                      const nextTiming = event.target.value
                      updateField('batchTiming', nextTiming)
                      if (nextTiming !== 'Custom') {
                        updateField('batchTimingCustomStart', '')
                        updateField('batchTimingCustomStartMeridiem', 'AM')
                        updateField('batchTimingCustomEnd', '')
                        updateField('batchTimingCustomEndMeridiem', 'PM')
                      }
                    }}
                    disabled={isViewMode}
                  >
                    <option value="">Select timing</option>
                    <option>09.30 AM - 6.30 PM</option>
                    <option>10.00 AM - 7.30 PM</option>
                    <option>10.30 AM - 7.30 PM</option>
                    <option>11.00 AM - 8.00 PM</option>
                    <option>Custom</option>
                  </select>
                </FacultyField>

                {form.batchTiming === 'Custom' ? (
                  <FacultyField label="Custom Timing" required icon={<Clock3 />}>
                    <div className="faculty-custom-timing-range">
                      <div className="faculty-custom-timing-side">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="09:30"
                          aria-label="Custom timing start time"
                          value={form.batchTimingCustomStart}
                          onChange={(event) => updateField('batchTimingCustomStart', event.target.value)}
                          disabled={isViewMode}
                        />
                        <select
                          aria-label="Custom timing start meridiem"
                          value={form.batchTimingCustomStartMeridiem}
                          onChange={(event) => updateField('batchTimingCustomStartMeridiem', event.target.value)}
                          disabled={isViewMode}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                      <span aria-hidden="true">-</span>
                      <div className="faculty-custom-timing-side">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="06:30"
                          aria-label="Custom timing end time"
                          value={form.batchTimingCustomEnd}
                          onChange={(event) => updateField('batchTimingCustomEnd', event.target.value)}
                          disabled={isViewMode}
                        />
                        <select
                          aria-label="Custom timing end meridiem"
                          value={form.batchTimingCustomEndMeridiem}
                          onChange={(event) => updateField('batchTimingCustomEndMeridiem', event.target.value)}
                          disabled={isViewMode}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </FacultyField>
                ) : null}

                <button type="button" className="faculty-batch-add faculty-batch-add-full" onClick={addBatchEntry} disabled={isViewMode}>
                  <Plus />
                  <span>Add Batch</span>
                </button>

                <div className="faculty-batch-list-wrap">
                  <div className="faculty-batch-list-title">
                    <strong>Batches ({form.batchEntries.length})</strong>
                  </div>
                  {form.batchEntries.length ? (
                    <div className="faculty-batch-list faculty-batch-list-scroll" aria-label="Added batches">
                      {form.batchEntries.map((entry) => (
                        <div key={entry.id} className="faculty-batch-item faculty-batch-item-image">
                          <div className="faculty-batch-item-copy">
                            <strong>{entry.batchName}</strong>
                            <small>{entry.batchTiming}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="faculty-batch-empty">No batches added yet</div>
                  )}
                </div>

                {shouldShowError('batchEntries') ? <small className="course-field-error">{validationErrors.batchEntries}</small> : null}
              </section>
            </div>

            <div className="faculty-form-actions faculty-form-actions-large">
              <Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </Button>
              {!isViewMode ? (
                <Button type="submit" disabled={isSubmitting} className="faculty-save-button">
                  <Save />
                  <span>{isEditMode ? (isSubmitting ? 'Updating...' : 'Update') : isSubmitting ? 'Submitting...' : 'Save Faculty'}</span>
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      {isModalOpen && isViewMode && selectedFacultyRecord ? (
        <div className="course-modal-backdrop faculty-modal-backdrop faculty-view-backdrop" role="presentation">
          <aside
            className="course-modal panel-card faculty-view-drawer faculty-view-drawer-image"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-view-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="faculty-view-header">
              <div aria-hidden="true" />
              <h3 id="faculty-view-title">{isViewDrawerEditing ? 'Edit Faculty' : 'Faculty Details'}</h3>

              <div className="faculty-view-actions">
                <Button
                  type="button"
                  className="faculty-view-edit-button"
                  onClick={toggleInlineEditMode}
                >
                  {isViewDrawerEditing ? 'View' : 'Edit'}
                </Button>
                <button type="button" className="faculty-view-close" onClick={closeModal} aria-label="Close faculty details">
                  X
                </button>
              </div>
            </div><br></br>

            {isViewDrawerEditing ? (
              <form
                className="faculty-inline-edit-form"
                role="form"
                onSubmit={handleSubmit}
                onClick={(event) => event.stopPropagation()}
              >
                <FacultyInlineEditorTable
                  form={form}
                  isCoursesLoading={isCoursesLoading}
                  activeCourseOptions={activeCourseOptions}
                  validationErrors={validationErrors}
                  shouldShowError={shouldShowError}
                  updateField={updateField}
                  markTouched={markTouched}
                  addBatchEntry={addBatchEntry}
                  setForm={setForm}
                  onCancel={cancelInlineEdit}
                  isSubmitting={isSubmitting}
                />
              </form>
            ) : (
              <div className="faculty-view-table-shell">
                <table className="faculty-details-table">
                  <tbody>
                    <tr>
                      <th>Faculty Name</th>
                      <td>{selectedFacultyRecord.facultyName || '-'}</td>
                      <th>Status</th>
                      <td>
                        <span className={`status-pill ${String(selectedFacultyRecord.status || 'Active').toLowerCase()}`}>
                          {selectedFacultyRecord.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <th>Faculty Email</th>
                      <td>{selectedFacultyRecord.facultyEmail || '-'}</td>
                      <th>Faculty Phone</th>
                      <td>{selectedFacultyRecord.facultyPhone || '-'}</td>
                    </tr>
                    <tr>
                      <th>Course</th>
                      <td>{selectedFacultyRecord.courseName || '-'}</td>
                      <th>Total Batches</th>
                      <td>
                        {Array.isArray(selectedFacultyRecord.batchEntries) ? selectedFacultyRecord.batchEntries.length : Number(selectedFacultyRecord.batchCount || 0) || 0}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="faculty-view-batch-section">
                  <div className="faculty-view-batch-header">
                    <div>
                      <h4>Batch Details</h4>
                      <p>All added batches for this faculty appear below.</p>
                    </div>
                  </div>

                  {Array.isArray(selectedFacultyRecord.batchEntries) && selectedFacultyRecord.batchEntries.length ? (
                    <table className="faculty-batch-details-table">
                      <thead>
                        <tr>
                          <th>S.NO</th>
                          <th>Batch Name</th>
                          <th>Batch Timing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedFacultyRecord.batchEntries.map((entry, index) => (
                          <tr key={entry.id}>
                            <td>{index + 1}</td>
                            <td>{entry.batchName || '-'}</td>
                            <td>{entry.batchTiming || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="faculty-view-empty">No batches added yet</div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="course-modal-backdrop faculty-modal-backdrop" role="presentation">
          <div
            className="course-modal panel-card faculty-modal faculty-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="course-modal-close" onClick={closeDeleteModal} aria-label="Close delete confirmation">
              ×
            </button>

            <div className="course-modal-header">
              <div>
                <p className="section-kicker">Confirm delete</p>
                <h3 id="faculty-delete-title">Are you sure delete this faculty?</h3>
              </div>
            </div>

            <p className="faculty-delete-copy">
              This will remove <strong>{deleteTarget.facultyName}</strong> from the faculty list.
            </p>

            <div className="faculty-form-actions">
              <Button type="button" variant="ghost" onClick={closeDeleteModal}>
                Cancel
              </Button>
              <Button type="button" onClick={handleDeleteConfirmed}>
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
