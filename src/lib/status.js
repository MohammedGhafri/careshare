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
