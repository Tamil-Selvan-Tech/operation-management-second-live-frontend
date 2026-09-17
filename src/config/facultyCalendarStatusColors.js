const COLOR_PALETTE = {
  CLASS: { background: 'var(--calendar-class-bg)', text: 'var(--calendar-class-text)', border: 'var(--calendar-class-border)', hover: 'var(--calendar-class-hover)' },
  NO_CLASS: { background: 'var(--calendar-no-class-bg)', text: 'var(--calendar-no-class-text)', border: 'var(--calendar-no-class-border)', hover: 'var(--calendar-no-class-hover)' },
  FACULTY_WEEKLY_OFF: { background: 'var(--calendar-week-off-bg)', text: 'var(--calendar-week-off-text)', border: 'var(--calendar-week-off-border)', hover: 'var(--calendar-week-off-hover)' },
  HOLIDAY: { background: 'var(--calendar-holiday-bg)', text: 'var(--calendar-holiday-text)', border: 'var(--calendar-holiday-border)', hover: 'var(--calendar-holiday-hover)' },
  PRESENT: { background: 'var(--calendar-present-bg)', text: 'var(--calendar-present-text)', border: 'var(--calendar-present-border)', hover: 'var(--calendar-present-hover)' },
  ABSENT: { background: 'var(--calendar-absent-bg)', text: 'var(--calendar-absent-text)', border: 'var(--calendar-absent-border)', hover: 'var(--calendar-absent-hover)' },
  INSTITUTE_LEAVE: { background: 'var(--calendar-cancel-bg)', text: 'var(--calendar-cancel-text)', border: 'var(--calendar-cancel-border)', hover: 'var(--calendar-cancel-hover)' },
  LEAVE: { background: 'var(--calendar-leave-bg)', text: 'var(--calendar-leave-text)', border: 'var(--calendar-leave-border)', hover: 'var(--calendar-leave-hover)' },
  HALF_DAY: { background: 'var(--calendar-half-day-bg)', text: 'var(--calendar-half-day-text)', border: 'var(--calendar-half-day-border)', hover: 'var(--calendar-half-day-hover)' },
  PERMISSION: { background: 'var(--calendar-permission-bg)', text: 'var(--calendar-permission-text)', border: 'var(--calendar-permission-border)', hover: 'var(--calendar-permission-hover)' },
  REASSIGNED: { background: 'var(--calendar-reassigned-bg)', text: 'var(--calendar-reassigned-text)', border: 'var(--calendar-reassigned-border)', hover: 'var(--calendar-reassigned-hover)' },
  COMBINED: { background: 'var(--calendar-reassigned-bg)', text: 'var(--calendar-reassigned-text)', border: 'var(--calendar-reassigned-border)', hover: 'var(--calendar-reassigned-hover)' },
}

export function statusStyle(status) {
  const color = COLOR_PALETTE[status] || COLOR_PALETTE.NO_CLASS
  return {
    '--status-background': color.background,
    '--status-text': color.text,
    '--status-border': color.border,
    '--status-hover': color.hover,
  }
}
