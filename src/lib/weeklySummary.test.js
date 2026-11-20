import { describe, expect, it } from 'vitest'
import { buildWeeklySummary, startOfWeek } from './weeklySummary.js'

// Monday 16 Nov 2026 -> Sunday 22 Nov 2026.
const WEEK_START = new Date(2026, 10, 16)
const NOW = new Date(2026, 10, 20) // Friday, same week — matches prescriptionParser.test.js's fixed "today".

function at(dayOffset, hh, mm) {
  return new Date(2026, 10, 16 + dayOffset, hh, mm)
}

describe('startOfWeek', () => {
  it('rolls a Sunday back to the Monday that started its week', () => {
    const sunday = new Date(2026, 10, 22, 13, 0) // Sun 22 Nov
    expect(startOfWeek(sunday)).toEqual(new Date(2026, 10, 16))
  })

  it('leaves a Monday at the start of its own day', () => {
    const monday = new Date(2026, 10, 16, 18, 30)
    expect(startOfWeek(monday)).toEqual(new Date(2026, 10, 16))
  })
})

describe('buildWeeklySummary', () => {
  const items = [
    // In week: one missed dose (always urgent), one unrecorded dose whose
    // check window has expired (attention), one taken dose — same medication
    // name as the missed one, to exercise grouping.
    {
      id: 'med-a-missed', kind: 'medication', name: 'MedA', schedule: 'Every day',
      start: at(0, 8, 0), end: at(0, 8, 15), status: 'missed', why: 'Declined by Margaret.',
    },
    {
      id: 'med-b-unknown', kind: 'medication', name: 'MedB', schedule: 'Every day',
      start: at(1, 8, 0), end: at(1, 8, 15), status: 'unknown', why: null,
    },
    {
      id: 'med-a-taken', kind: 'medication', name: 'MedA', schedule: 'Every day',
      start: at(2, 8, 0), end: at(2, 8, 15), status: 'taken', why: null,
    },
    // Out of week: a missed dose dated the following week — must not leak
    // into counts or needsAttention even though deriveAlerts would normally
    // flag it.
    {
      id: 'med-a-missed-next-week', kind: 'medication', name: 'MedA', schedule: 'Every day',
      start: new Date(2026, 10, 23, 8, 0), end: new Date(2026, 10, 23, 8, 15), status: 'missed', why: null,
    },
    {
      id: 'visit-overdue', kind: 'visit', type: 'GP appointment', assignedTo: 'Sarah',
      start: at(0, 9, 0), end: at(0, 9, 45), status: 'scheduled', notes: '',
    },
    {
      id: 'task-attention', kind: 'task', title: 'Collect prescription', assignedTo: 'Tom',
      start: at(1, 10, 0), end: at(1, 10, 30), status: 'attention',
    },
    {
      id: 'task-normal', kind: 'task', title: 'Weekly shopping', assignedTo: 'Tom',
      start: at(2, 17, 0), end: at(2, 17, 30), status: 'normal',
    },
  ]

  const activity = [
    { id: 'a1', who: 'Priya', what: 'Recorded MedA as missed', at: at(0, 8, 20), outcome: 'Tracker updated' },
    { id: 'a2', who: 'Sarah', what: 'Out of week entry', at: new Date(2026, 10, 10, 9, 0) },
  ]

  const gcalEvents = [
    { id: 'g1', kind: 'google', title: 'Family call', start: at(3, 18, 0), end: at(3, 18, 30) },
    { id: 'g2', kind: 'google', title: 'Next week event', start: new Date(2026, 10, 25, 9, 0), end: new Date(2026, 10, 25, 9, 30) },
  ]

  it('restricts the range to the Mon–Sun week containing weekStart', () => {
    const summary = buildWeeklySummary({ items: [], activity: [], gcalEvents: [], weekStart: at(3, 12, 0), now: NOW })
    expect(summary.range.start).toEqual(new Date(2026, 10, 16))
    expect(summary.range.end).toEqual(new Date(2026, 10, 23))
  })

  it('excludes items, activity and Google events outside the week', () => {
    const summary = buildWeeklySummary({ items, activity, gcalEvents, weekStart: WEEK_START, now: NOW })
    expect(summary.activity).toHaveLength(1)
    expect(summary.activity[0].what).toBe('Recorded MedA as missed')
    expect(summary.googleEvents).toHaveLength(1)
    expect(summary.googleEvents[0].title).toBe('Family call')
    expect(summary.overview.medication).toEqual({ missed: 1, unknown: 1, taken: 1 })
  })

  it('counts visits and tasks by status', () => {
    const summary = buildWeeklySummary({ items, activity: [], gcalEvents: [], weekStart: WEEK_START, now: NOW })
    expect(summary.overview.visits).toEqual({ scheduled: 1 })
    expect(summary.overview.tasks).toEqual({ attention: 1, normal: 1 })
  })

  it('surfaces needs-attention items in-week only, urgent first', () => {
    const summary = buildWeeklySummary({ items, activity: [], gcalEvents: [], weekStart: WEEK_START, now: NOW })
    expect(summary.overview.needsAttentionCount).toBe(4)
    expect(summary.needsAttention.map((a) => a.itemId)).toEqual([
      'med-a-missed', // urgent — sorted first
      'med-b-unknown',
      'visit-overdue',
      'task-attention',
    ])
    expect(summary.needsAttention.find((a) => a.itemId === 'med-a-missed-next-week')).toBeUndefined()
  })

  it('groups medication doses by name with exception doses listed', () => {
    const summary = buildWeeklySummary({ items, activity: [], gcalEvents: [], weekStart: WEEK_START, now: NOW })
    const medA = summary.medications.find((m) => m.name === 'MedA')
    const medB = summary.medications.find((m) => m.name === 'MedB')

    expect(medA.doseCount).toBe(2)
    expect(medA.counts).toEqual({ missed: 1, taken: 1 })
    expect(medA.exceptions).toHaveLength(1)
    expect(medA.exceptions[0]).toMatchObject({ label: 'Missed', tone: 'urgent', why: 'Declined by Margaret.' })

    expect(medB.doseCount).toBe(1)
    expect(medB.exceptions[0]).toMatchObject({ label: 'Not recorded — Unknown', tone: 'attention' })
  })
})
