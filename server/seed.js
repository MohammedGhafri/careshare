// Synthetic/mock data only, per the prototype constraints in docs/PRD.txt.
// Margaret is the fictional supported person used throughout the demo scenario.
//
// This used to be src/data/mockData.js, generated once at module load. It's
// now generateSeed(now), called by the server on first run and again
// whenever "Reset demo data" is used — so a reset always re-anchors the
// week to whichever day it's actually run on, instead of going stale.

export const supportedPerson = {
  name: 'Margaret',
  role: 'Supported Person',
}

export const careCircle = [
  { id: 'sarah', name: 'Sarah', role: 'Family Coordinator', relationship: 'Daughter', phone: '07700 900111' },
  { id: 'priya', name: 'Priya', role: 'Carer', relationship: 'Professional carer', phone: '07700 900222' },
  { id: 'tom', name: 'Tom', role: 'Trusted Volunteer', relationship: 'Neighbour', phone: '07700 900333' },
]

// --- date helpers -----------------------------------------------------

function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 Sun .. 6 Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diffToMonday)
  d.setHours(0, 0, 0, 0)
  return d
}

function atTime(baseDate, dayOffset, hh, mm) {
  const d = new Date(baseDate)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hh, mm, 0, 0)
  return d
}

function plusMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const MED_DEFS = [
  { key: 'morning', name: 'Morning tablets (Amlodipine)', hh: 8, mm: 0, schedule: 'Every day' },
  { key: 'lunchtime', name: 'Lunchtime tablets (Aspirin)', hh: 12, mm: 30, schedule: 'Every day' },
  { key: 'midday', name: 'Midday tablets (Metformin)', hh: 13, mm: 0, schedule: 'Every day' },
  { key: 'evening', name: 'Evening tablets (Levothyroxine)', hh: 18, mm: 0, schedule: 'Every day' },
]

// Generates one week (Mon-Sun, containing `now`) of medications/visits/tasks
// plus a seed activity log. Returns plain items (same shape the app has
// always used) with real Date objects for start/end/at — the API layer is
// responsible for serialising these to ISO strings for storage/transport.
export function generateSeed(now = new Date()) {
  const today = new Date(now)
  const weekStart = startOfWeek(today)
  const todayOffset = Math.round((new Date(today).setHours(0, 0, 0, 0) - weekStart) / 86400000)

  // --- medications ---------------------------------------------------
  // Four recurring medications, one scheduled event per day, Mon-Sun. Past
  // days default to "taken" (with one "missed" for realism); today keeps a
  // mixed set of statuses; future days are "due".
  const TODAY_MED_STATUS = {
    morning: { status: 'taken', updatedBy: 'Priya', updatedAt: '08:10', why: 'Confirmed by carer during the morning visit.' },
    lunchtime: { status: 'missed', updatedBy: 'Priya', updatedAt: '14:00', why: 'Margaret declined, said she had already eaten.' },
    midday: { status: 'due', updatedBy: null, updatedAt: null, why: 'Not due yet today.' },
    evening: { status: 'unknown', updatedBy: null, updatedAt: null, why: 'No one has recorded an outcome within the configured check window, so the status is shown as Unknown rather than assumed taken.' },
  }

  const medications = []
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    MED_DEFS.forEach((def) => {
      const start = atTime(weekStart, dayOffset, def.hh, def.mm)
      const end = plusMinutes(start, 15)
      let status, updatedBy, updatedAt, why

      if (dayOffset === todayOffset) {
        ;({ status, updatedBy, updatedAt, why } = TODAY_MED_STATUS[def.key])
      } else if (dayOffset > todayOffset) {
        status = 'due'
        updatedBy = null
        updatedAt = null
        why = 'Upcoming — not due yet.'
      } else {
        // Past days: mostly taken, one missed for variety (Wednesday's lunchtime dose).
        const isMissedExample = dayOffset === todayOffset - 2 && def.key === 'lunchtime'
        status = isMissedExample ? 'missed' : 'taken'
        updatedBy = 'Priya'
        updatedAt = `${String(def.hh).padStart(2, '0')}:${String(def.mm + 10).padStart(2, '0')}`
        why = isMissedExample ? 'Recorded as missed by carer.' : 'Confirmed by carer.'
      }

      medications.push({
        id: `med-${def.key}-${dayOffset}`,
        kind: 'medication',
        name: def.name,
        title: def.name,
        schedule: def.schedule,
        reminderTime: `${String(def.hh).padStart(2, '0')}:${String(def.mm).padStart(2, '0')}`,
        start,
        end,
        status,
        updatedBy,
        updatedAt,
        why,
        editable: false,
      })
    })
  }

  // --- visits ----------------------------------------------------------
  const VISIT_DEFS = [
    { dayOffset: todayOffset - 1, hh: 9, mm: 0, type: 'Morning wellbeing check', assignedTo: 'Priya', status: 'complete', notes: 'Margaret was in good spirits.' },
    { dayOffset: todayOffset, hh: 8, mm: 0, type: 'Morning wellbeing check', assignedTo: 'Priya', status: 'complete', notes: 'Margaret was in good spirits, had breakfast.' },
    { dayOffset: todayOffset, hh: 15, mm: 30, type: 'Volunteer visit', assignedTo: 'Tom', status: 'scheduled', notes: '' },
    { dayOffset: todayOffset + 1, hh: 10, mm: 0, type: 'GP appointment (accompanied)', assignedTo: 'Sarah', status: 'scheduled', notes: 'Annual review.' },
    { dayOffset: todayOffset + 1, hh: 16, mm: 0, type: 'Volunteer visit', assignedTo: 'Tom', status: 'scheduled', notes: '' },
    { dayOffset: todayOffset + 3, hh: 9, mm: 0, type: 'Morning wellbeing check', assignedTo: 'Priya', status: 'scheduled', notes: '' },
  ]

  const visits = VISIT_DEFS.map((v, idx) => {
    const start = atTime(weekStart, v.dayOffset, v.hh, v.mm)
    const end = plusMinutes(start, 45)
    return {
      id: `visit-${idx}`,
      kind: 'visit',
      type: v.type,
      title: `${v.type} — ${v.assignedTo}`,
      assignedTo: v.assignedTo,
      start,
      end,
      status: v.status,
      notes: v.notes,
      updatedBy: v.status === 'complete' ? v.assignedTo : 'Sarah',
      updatedAt: v.status === 'complete' ? 'this morning' : 'when scheduled',
      editable: true,
    }
  })

  // --- tasks -------------------------------------------------------------
  const TASK_DEFS = [
    { dayOffset: todayOffset, hh: 11, mm: 0, title: 'Collect repeat prescription from pharmacy', assignedTo: 'Sarah', status: 'attention' },
    { dayOffset: todayOffset, hh: 17, mm: 0, title: 'Weekly shopping drop-off', assignedTo: 'Tom', status: 'normal' },
    { dayOffset: todayOffset + 2, hh: 10, mm: 0, title: 'Book opticians appointment', assignedTo: 'Sarah', status: 'normal' },
  ]

  const tasks = TASK_DEFS.map((t, idx) => {
    const start = atTime(weekStart, t.dayOffset, t.hh, t.mm)
    const end = plusMinutes(start, 30)
    return {
      id: `task-${idx}`,
      kind: 'task',
      title: t.title,
      assignedTo: t.assignedTo,
      start,
      end,
      due: isSameDay(start, today) ? 'Today' : start.toLocaleDateString('en-GB', { weekday: 'long' }),
      status: t.status,
      editable: true,
    }
  })

  const activity = [
    {
      id: 'a1',
      who: 'Priya',
      what: 'Recorded morning tablets as Taken',
      at: atTime(weekStart, todayOffset, 8, 10),
      why: 'Confirmed during morning visit',
      outcome: 'Medication tracker updated',
    },
    {
      id: 'a2',
      who: 'Priya',
      what: 'Completed morning wellbeing check',
      at: atTime(weekStart, todayOffset, 8, 15),
      outcome: 'No concerns recorded',
    },
    {
      id: 'a3',
      who: 'Priya',
      what: 'Recorded lunchtime tablets as Missed',
      at: atTime(weekStart, todayOffset, 14, 0),
      why: 'Margaret declined, said she had already eaten',
      outcome: 'Medication tracker updated',
    },
    {
      id: 'a5',
      who: 'Sarah',
      what: "Scheduled Tom's volunteer visit",
      at: atTime(weekStart, todayOffset - 1, 18, 40),
      outcome: 'Visit added to the calendar',
    },
    {
      id: 'a6',
      who: 'Sarah',
      what: 'Added evening medication (Levothyroxine) to Margaret’s schedule',
      at: atTime(weekStart, todayOffset - 3, 9, 0),
      outcome: 'Medication tracker updated',
    },
  ]

  return {
    items: [...medications, ...visits, ...tasks],
    activity,
  }
}
