// Deterministic, rules-based weekly summary builder (per PRD.txt: "Rules
// detect → AI explains → humans act" — this is the "rules detect" half, with
// no AI involved at all). Per US17 (docs/UserStories.txt), the summary:
//   - uses only stored data (no invented content)
//   - highlights unresolved issues ("needs attention")
//   - keeps the original entries accessible (every line traces to a real item)
//   - contains no diagnoses or clinical interpretation
//
// This module has no React/DOM dependency so it can be unit tested directly
// and reused by any renderer (currently WeeklySummaryPdf.jsx).

import { deriveAlerts } from './rules.js'
import { getStatus } from './status.js'

const STATUS_PRIORITY = { urgent: 0, attention: 1 }

export function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 Sun .. 6 Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diffToMonday)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function inRange(date, start, end) {
  return date >= start && date < end
}

function formatTime(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatWhen(date) {
  return `${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${formatTime(date)}`
}

function formatRangeLabel(start, end) {
  const lastDay = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  const startLabel = start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const endLabel = lastDay.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

function countBy(list, keyFn) {
  const counts = {}
  for (const item of list) {
    const key = keyFn(item)
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

function groupBy(list, keyFn) {
  const map = new Map()
  for (const item of list) {
    const key = keyFn(item)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return [...map.entries()]
}

// Returns one entry per day in the week that has at least one item, each
// holding that day's items sorted by start time.
function groupByDay(list, weekStart) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000))
  return days
    .map((day) => [day, list.filter((item) => isSameDay(item.start, day)).sort((a, b) => a.start - b.start)])
    .filter(([, dayItems]) => dayItems.length > 0)
}

// Builds a plain-data weekly summary from the care plan's current state.
// `weekStart` can be any date inside the target week — it's normalised to
// the Monday that starts that week.
export function buildWeeklySummary({
  items = [],
  activity = [],
  gcalEvents = [],
  weekStart,
  person = null,
  careCircle = [],
  now = new Date(),
}) {
  const start = startOfWeek(weekStart)
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)

  const weekItems = items.filter((item) => inRange(item.start, start, end))
  const medicationItems = weekItems.filter((item) => item.kind === 'medication')
  const visitItems = weekItems.filter((item) => item.kind === 'visit')
  const taskItems = weekItems.filter((item) => item.kind === 'task')
  const weekGcalEvents = gcalEvents.filter((event) => event.start && inRange(event.start, start, end))
  const weekActivity = activity.filter((entry) => entry.at && inRange(entry.at, start, end))

  // "Needs attention" combines the same rules-based alerts used live in the
  // app (so a dose flagged missed on the calendar is flagged here too) with
  // tasks already marked attention, restricted to items that fall in this
  // week and with the most urgent items first.
  const itemAlerts = deriveAlerts(items, now)
    .filter((alert) => {
      const item = items.find((i) => i.id === alert.itemId)
      return item && inRange(item.start, start, end)
    })
  const taskAlerts = taskItems
    .filter((item) => item.status === 'attention')
    .map((item) => ({
      id: `task-alert-${item.id}`,
      itemId: item.id,
      title: item.title,
      what: `${item.title} — assigned to ${item.assignedTo}`,
      when: formatWhen(item.start),
      why: 'Marked as needing attention.',
      status: 'attention',
    }))
  const needsAttention = [...itemAlerts, ...taskAlerts].sort(
    (a, b) => (STATUS_PRIORITY[a.status] ?? 2) - (STATUS_PRIORITY[b.status] ?? 2)
  )

  const medications = groupBy(medicationItems, (item) => item.name).map(([name, doses]) => {
    const sorted = [...doses].sort((a, b) => a.start - b.start)
    const exceptions = sorted
      .filter((item) => item.status === 'missed' || item.status === 'declined' || item.status === 'unknown')
      .map((item) => ({
        when: formatWhen(item.start),
        label: getStatus(item.status).label,
        tone: getStatus(item.status).tone,
        why: item.why || null,
      }))
    return {
      name,
      schedule: sorted[0]?.schedule || null,
      doseCount: sorted.length,
      counts: countBy(sorted, (item) => item.status),
      exceptions,
    }
  })

  function toDaySection(dayItems, mapItem) {
    return groupByDay(dayItems, start).map(([day, items]) => ({
      day: formatDay(day),
      items: items.map(mapItem),
    }))
  }

  const visits = toDaySection(visitItems, (item) => ({
    time: formatTime(item.start),
    title: item.type,
    assignedTo: item.assignedTo,
    label: getStatus(item.status).label,
    tone: getStatus(item.status).tone,
    notes: item.notes || null,
  }))

  const tasks = toDaySection(taskItems, (item) => ({
    time: formatTime(item.start),
    title: item.title,
    assignedTo: item.assignedTo,
    label: getStatus(item.status).label,
    tone: getStatus(item.status).tone,
  }))

  const googleEvents = [...weekGcalEvents]
    .sort((a, b) => a.start - b.start)
    .map((event) => ({ when: formatWhen(event.start), title: event.title }))

  const activityLog = [...weekActivity]
    .sort((a, b) => a.at - b.at)
    .map((entry) => ({
      when: formatWhen(entry.at),
      who: entry.who,
      what: entry.what,
      why: entry.why || null,
      outcome: entry.outcome || null,
    }))

  return {
    person,
    careCircle,
    generatedAt: now,
    range: { start, end, label: formatRangeLabel(start, end) },
    overview: {
      medication: countBy(medicationItems, (item) => item.status),
      visits: countBy(visitItems, (item) => item.status),
      tasks: countBy(taskItems, (item) => item.status),
      needsAttentionCount: needsAttention.length,
    },
    needsAttention,
    medications,
    visits,
    tasks,
    googleEvents,
    activity: activityLog,
  }
}
