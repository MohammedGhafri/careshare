// Maps a domain status value to a visual tone + label + icon.
// Per US19: status is never shown by colour alone — always paired with text and an icon.
// Per US01: an item with no recorded outcome is shown as "Not recorded / Unknown",
// never assumed to have happened.

const STATUS_MAP = {
  // Medication
  taken: { tone: 'complete', label: 'Taken', icon: '✅' },
  due: { tone: 'normal', label: 'Due later', icon: '🕒' },
  unknown: { tone: 'attention', label: 'Not recorded — Unknown', icon: '❓' },
  missed: { tone: 'urgent', label: 'Missed', icon: '⚠️' },
  declined: { tone: 'urgent', label: 'Declined', icon: '⛔' },

  // Visits / tasks
  complete: { tone: 'complete', label: 'Complete', icon: '✅' },
  scheduled: { tone: 'normal', label: 'Scheduled', icon: '📅' },
  attention: { tone: 'attention', label: 'Needs attention', icon: '⚠️' },
  normal: { tone: 'normal', label: 'On track', icon: '🕒' },

  // Alerts
  urgent: { tone: 'urgent', label: 'Urgent — needs response', icon: '🚨' },
}

export function getStatus(statusKey) {
  return STATUS_MAP[statusKey] || { tone: 'normal', label: statusKey, icon: 'ℹ️' }
}

// Shared with CalendarView (event colours) and WeeklySummaryPdf (status
// pills) so both views agree on what each tone looks like.
export const TONE_COLORS = {
  complete: { bg: '#DCFCE7', border: '#22C55E', text: '#15803D' },
  normal: { bg: '#DBEAFE', border: '#3B82F6', text: '#1D4ED8' },
  attention: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  urgent: { bg: '#FEE2E2', border: '#EF4444', text: '#B91C1C' },
}
