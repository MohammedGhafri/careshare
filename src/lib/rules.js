// Deterministic, rules-based alert generation (per PRD.txt: "Rules detect →
// AI explains → humans act" — alert *generation* is never decided by AI).
//
// deriveAlerts() is a pure function of the current items and "now", so
// recording a medication as Taken (or completing a visit) immediately clears
// the matching alert in every view that reads from the same state.

export function deriveAlerts(items, now = new Date()) {
  const alerts = []

  for (const item of items) {
    if (item.kind === 'medication') {
      if (item.status === 'unknown' && item.end <= now) {
        alerts.push({
          id: `alert-${item.id}`,
          itemId: item.id,
          title: `${item.name}'s status has not been confirmed`,
          what: `${item.name} — no outcome recorded`,
          when: `${formatWhen(item.start)}, check window expired at ${formatTime(item.end)}`,
          why: 'No outcome has been recorded within the configured check window.',
          whoShouldRespond: 'Sarah (Family Coordinator)',
          status: 'attention',
        })
      } else if (item.status === 'missed') {
        alerts.push({
          id: `alert-${item.id}`,
          itemId: item.id,
          title: `${item.name} was missed`,
          what: `${item.name} — recorded as missed`,
          when: formatWhen(item.start),
          why: item.notes || item.why || 'Recorded as missed.',
          whoShouldRespond: 'Sarah (Family Coordinator)',
          status: 'urgent',
        })
      }
    }

    if (item.kind === 'visit' && item.status === 'scheduled' && item.end <= now) {
      alerts.push({
        id: `alert-${item.id}`,
        itemId: item.id,
        title: `${item.type} with ${item.assignedTo} hasn't been completed`,
        what: `${item.type}, assigned to ${item.assignedTo}`,
        when: `Expected by ${formatWhen(item.end)}`,
        why: "The visit's expected completion time has passed without being marked complete.",
        whoShouldRespond: 'Sarah (Family Coordinator)',
        status: 'attention',
      })
    }
  }

  return alerts
}

function formatTime(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatWhen(date) {
  return `${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${formatTime(date)}`
}
