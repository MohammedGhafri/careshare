import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCareApi } from './careApi.js'
import { pgliteSql } from './pgliteSql.js'

// Runs the real SQL against in-memory Postgres.

const RX_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

function registerBody(overrides = {}) {
  return {
    op: 'registerPrescription',
    source: 'scan',
    who: 'Sarah',
    prescription: {
      id: RX_ID,
      medication: 'Amoxicillin',
      strength: '500 mg',
      form: 'capsule',
      dose: { quantity: 1, unit: 'capsule' },
      frequency: { type: 'times_per_day', count: 3 },
      duration_days: 1,
      start_date: '2026-11-20',
    },
    doses: ['08:00', '14:00', '20:00'].map((t, i) => ({
      id: `med-${RX_ID}-0-${i}`,
      start: `2026-11-20T${t}:00.000Z`,
      end: `2026-11-20T${t.slice(0, 2)}:15:00.000Z`,
    })),
    activity: { id: 'act-1', who: 'Sarah', what: 'Added Amoxicillin 500 mg', at: '2026-11-20T10:00:00.000Z' },
    ...overrides,
  }
}

const post = (handle, body) =>
  handle(new Request('http://x/api/care', { method: 'POST', body: JSON.stringify(body) }))
const get = (handle) => handle(new Request('http://x/api/care')).then((r) => r.json())

describe('care API', () => {
  let handle
  beforeEach(async () => {
    handle = createCareApi(pgliteSql(new PGlite()))
  })

  it('creates its schema on first use and returns empty state', async () => {
    expect(await get(handle)).toEqual({ prescriptions: [], doses: [], activity: [] })
  })

  it('saves a prescription with its doses and activity, and reads back the same record', async () => {
    const res = await post(handle, registerBody())
    expect(res.status).toBe(201)

    const state = await get(handle)
    expect(state.prescriptions).toHaveLength(1)
    expect(state.prescriptions[0]).toMatchObject({
      id: RX_ID,
      source: 'scan',
      medication: 'Amoxicillin',
      strength: '500 mg',
      form: 'capsule',
      dose: { quantity: 1, unit: 'capsule' },
      frequency: { type: 'times_per_day', count: 3 },
      duration_days: 1,
      start_date: '2026-11-20',
    })
    expect(state.doses.map((d) => [d.start, d.status])).toEqual([
      ['2026-11-20T08:00:00.000Z', 'due'],
      ['2026-11-20T14:00:00.000Z', 'due'],
      ['2026-11-20T20:00:00.000Z', 'due'],
    ])
    expect(state.activity[0].what).toBe('Added Amoxicillin 500 mg')
  })

  it('records a dose status and a reschedule, each with an activity entry', async () => {
    await post(handle, registerBody())
    const doseId = `med-${RX_ID}-0-1`
    const activity = (id) => ({ id, who: 'Priya', what: 'x', at: '2026-11-20T15:00:00.000Z' })

    expect((await post(handle, { op: 'updateDose', id: doseId, status: 'taken', note: 'With lunch', updatedBy: 'Priya', updatedAt: '14:05', activity: activity('a2') })).status).toBe(200)
    expect((await post(handle, { op: 'updateDose', id: doseId, start: '2026-11-20T15:00:00.000Z', end: '2026-11-20T15:15:00.000Z', activity: activity('a3') })).status).toBe(200)

    const dose = (await get(handle)).doses.find((d) => d.id === doseId)
    expect(dose).toMatchObject({ status: 'taken', note: 'With lunch', updatedBy: 'Priya', start: '2026-11-20T15:00:00.000Z' })
    expect((await get(handle)).activity).toHaveLength(3)
  })

  it('rejects invalid input without writing anything', async () => {
    const bad = [
      registerBody({ source: 'other' }),
      registerBody({ doses: [] }),
      registerBody({ prescription: { ...registerBody().prescription, medication: '' } }),
      { op: 'updateDose', id: `med-${RX_ID}-0-0`, status: 'eaten', activity: { id: 'a', who: 'x', what: 'x', at: '2026-11-20T10:00:00Z' } },
      { op: 'drop tables' },
    ]
    for (const body of bad) expect((await post(handle, body)).status).toBe(400)
    expect(await get(handle)).toEqual({ prescriptions: [], doses: [], activity: [] })
  })

  it('returns 404 for an unknown dose and 409 for a duplicate save', async () => {
    await post(handle, registerBody())
    expect((await post(handle, registerBody())).status).toBe(409)
    const res = await post(handle, { op: 'updateDose', id: 'med-nope', status: 'taken', activity: { id: 'a9', who: 'x', what: 'x', at: '2026-11-20T10:00:00Z' } })
    expect(res.status).toBe(404)
    expect((await get(handle)).activity).toHaveLength(1)
  })
})
