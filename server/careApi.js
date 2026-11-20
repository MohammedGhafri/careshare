// Server-side CareShare persistence API, shared by the Vercel function
// (api/care.js) and the Vite dev middleware. `sql` is a tagged-template query
// function — Neon's `neon(url)` in production — so every value is sent as a
// bound parameter, never concatenated into SQL.
//
// Single endpoint, /api/care:
//   GET                                   -> { prescriptions, doses, activity }
//   POST { op: 'registerPrescription' }   -> saves a prescription, its doses and an activity entry
//   POST { op: 'updateDose' }             -> records a dose status/note/reschedule plus an activity entry

const MAX_BODY_BYTES = 1_000_000
const DOSE_STATUSES = new Set(['due', 'taken', 'missed', 'declined', 'unknown'])
const SOURCES = new Set(['scan', 'manual'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SCHEMA = [
  (sql) => sql`
    create table if not exists prescriptions (
      id uuid primary key,
      source text not null check (source in ('scan', 'manual')),
      medication text not null,
      strength text,
      form text,
      dose_quantity double precision,
      dose_unit text,
      frequency_type text not null default 'times_per_day',
      frequency_count integer not null check (frequency_count between 1 and 12),
      duration_days integer not null check (duration_days between 1 and 365),
      start_date date not null,
      instructions text,
      created_by text not null,
      created_at timestamptz not null default now()
    )`,
  (sql) => sql`
    create table if not exists doses (
      id text primary key,
      prescription_id uuid not null references prescriptions (id) on delete cascade,
      starts_at timestamptz not null,
      ends_at timestamptz not null,
      status text not null default 'due',
      updated_by text,
      updated_at text,
      note text
    )`,
  (sql) => sql`create index if not exists doses_prescription_id_idx on doses (prescription_id)`,
  (sql) => sql`
    create table if not exists activity (
      id text primary key,
      who text not null,
      what text not null,
      why text,
      outcome text,
      at timestamptz not null default now()
    )`,
]

class BadRequest extends Error {}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

function text(value, field, { max = 200, required = false } = {}) {
  if (value == null || value === '') {
    if (required) throw new BadRequest(`${field} is required`)
    return null
  }
  if (typeof value !== 'string' || value.length > max) throw new BadRequest(`${field} must be a string of at most ${max} characters`)
  return value.trim()
}

function int(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new BadRequest(`${field} must be a whole number between ${min} and ${max}`)
  return value
}

function timestamp(value, field) {
  const d = typeof value === 'string' ? new Date(value) : null
  if (!d || Number.isNaN(d.getTime())) throw new BadRequest(`${field} must be an ISO timestamp`)
  return d.toISOString()
}

function activityEntry(a) {
  if (!a || typeof a !== 'object') throw new BadRequest('activity is required')
  return {
    id: text(a.id, 'activity.id', { max: 80, required: true }),
    who: text(a.who, 'activity.who', { max: 80, required: true }),
    what: text(a.what, 'activity.what', { max: 500, required: true }),
    why: text(a.why, 'activity.why', { max: 1000 }),
    outcome: text(a.outcome, 'activity.outcome', { max: 200 }),
    at: timestamp(a.at, 'activity.at'),
  }
}

function parseRegister(body) {
  const p = body.prescription
  if (!p || typeof p !== 'object') throw new BadRequest('prescription is required')
  if (typeof p.id !== 'string' || !UUID_RE.test(p.id)) throw new BadRequest('prescription.id must be a UUID')
  if (!SOURCES.has(body.source)) throw new BadRequest('source must be "scan" or "manual"')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.start_date || '')) throw new BadRequest('prescription.start_date must be YYYY-MM-DD')

  const quantity = p.dose?.quantity ?? null
  if (quantity != null && (typeof quantity !== 'number' || !(quantity > 0) || quantity > 1000)) {
    throw new BadRequest('prescription.dose.quantity must be a positive number')
  }

  const prescription = {
    id: p.id,
    source: body.source,
    medication: text(p.medication, 'prescription.medication', { required: true }),
    strength: text(p.strength, 'prescription.strength'),
    form: text(p.form, 'prescription.form'),
    doseQuantity: quantity,
    doseUnit: text(p.dose?.unit, 'prescription.dose.unit'),
    frequencyCount: int(p.frequency?.count, 'prescription.frequency.count', 1, 12),
    durationDays: int(p.duration_days, 'prescription.duration_days', 1, 365),
    startDate: p.start_date,
    instructions: text(p.instructions, 'prescription.instructions', { max: 500 }),
    createdBy: text(body.who, 'who', { max: 80, required: true }),
  }

  if (!Array.isArray(body.doses)) throw new BadRequest('doses must be an array')
  if (body.doses.length !== prescription.frequencyCount * prescription.durationDays) {
    throw new BadRequest('doses must contain one entry per scheduled dose')
  }
  const prefix = `med-${prescription.id}-`
  const doses = body.doses.map((d, i) => {
    if (typeof d?.id !== 'string' || !d.id.startsWith(prefix) || d.id.length > 120) {
      throw new BadRequest(`doses[${i}].id must start with ${prefix}`)
    }
    return { id: d.id, start: timestamp(d.start, `doses[${i}].start`), end: timestamp(d.end, `doses[${i}].end`) }
  })

  return { prescription, doses, activity: activityEntry(body.activity) }
}

function parseUpdateDose(body) {
  const status = body.status ?? null
  if (status != null && !DOSE_STATUSES.has(status)) throw new BadRequest('status is not a recognised dose status')
  const start = body.start != null ? timestamp(body.start, 'start') : null
  const end = body.end != null ? timestamp(body.end, 'end') : null
  if ((start == null) !== (end == null)) throw new BadRequest('start and end must be sent together')
  if (status == null && start == null) throw new BadRequest('nothing to update')
  return {
    id: text(body.id, 'id', { max: 120, required: true }),
    status,
    note: text(body.note, 'note', { max: 1000 }),
    updatedBy: text(body.updatedBy, 'updatedBy', { max: 80 }),
    updatedAt: text(body.updatedAt, 'updatedAt', { max: 40 }),
    start,
    end,
    activity: activityEntry(body.activity),
  }
}

async function registerPrescription(sql, { prescription: p, doses, activity: a }) {
  // One statement, so the prescription, its doses and the activity entry are
  // saved atomically without needing a multi-statement transaction.
  await sql`
    with p as (
      insert into prescriptions (
        id, source, medication, strength, form, dose_quantity, dose_unit,
        frequency_count, duration_days, start_date, instructions, created_by
      ) values (
        ${p.id}, ${p.source}, ${p.medication}, ${p.strength}, ${p.form}, ${p.doseQuantity}, ${p.doseUnit},
        ${p.frequencyCount}, ${p.durationDays}, ${p.startDate}, ${p.instructions}, ${p.createdBy}
      )
      returning id
    ), d as (
      insert into doses (id, prescription_id, starts_at, ends_at)
      select u.id, p.id, u.starts_at, u.ends_at
      from p, unnest(
        ${doses.map((d) => d.id)}::text[],
        ${doses.map((d) => d.start)}::timestamptz[],
        ${doses.map((d) => d.end)}::timestamptz[]
      ) as u (id, starts_at, ends_at)
      returning 1
    )
    insert into activity (id, who, what, why, outcome, at)
    select ${a.id}, ${a.who}, ${a.what}, ${a.why}, ${a.outcome}, ${a.at}
    from p`
}

async function updateDose(sql, u) {
  const a = u.activity
  const rows = await sql`
    with updated as (
      update doses set
        status = coalesce(${u.status}, status),
        note = coalesce(${u.note}, note),
        updated_by = coalesce(${u.updatedBy}, updated_by),
        updated_at = coalesce(${u.updatedAt}, updated_at),
        starts_at = coalesce(${u.start}::timestamptz, starts_at),
        ends_at = coalesce(${u.end}::timestamptz, ends_at)
      where id = ${u.id}
      returning id
    ), logged as (
      insert into activity (id, who, what, why, outcome, at)
      select ${a.id}, ${a.who}, ${a.what}, ${a.why}, ${a.outcome}, ${a.at}
      where exists (select 1 from updated)
      returning 1
    )
    select count(*)::int as updated from updated`
  return rows[0]?.updated ?? 0
}

async function loadState(sql) {
  const [prescriptions, doses, activity] = await Promise.all([
    sql`
      select id, source, medication, strength, form, dose_quantity, dose_unit, frequency_type,
             frequency_count, duration_days, to_char(start_date, 'YYYY-MM-DD') as start_date,
             instructions, created_by, created_at
      from prescriptions order by created_at`,
    sql`
      select id, prescription_id, starts_at, ends_at, status, updated_by, updated_at, note
      from doses order by starts_at`,
    sql`select id, who, what, why, outcome, at from activity order by at desc limit 500`,
  ])

  return {
    prescriptions: prescriptions.map((r) => ({
      id: r.id,
      source: r.source,
      medication: r.medication,
      strength: r.strength,
      form: r.form,
      dose: r.dose_quantity == null ? null : { quantity: Number(r.dose_quantity), unit: r.dose_unit },
      frequency: { type: r.frequency_type, count: r.frequency_count },
      duration_days: r.duration_days,
      start_date: r.start_date,
      instructions: r.instructions,
      createdBy: r.created_by,
      createdAt: new Date(r.created_at).toISOString(),
    })),
    doses: doses.map((r) => ({
      id: r.id,
      prescriptionId: r.prescription_id,
      start: new Date(r.starts_at).toISOString(),
      end: new Date(r.ends_at).toISOString(),
      status: r.status,
      updatedBy: r.updated_by,
      updatedAt: r.updated_at,
      note: r.note,
    })),
    activity: activity.map((r) => ({
      id: r.id,
      who: r.who,
      what: r.what,
      why: r.why,
      outcome: r.outcome,
      at: new Date(r.at).toISOString(),
    })),
  }
}

export function createCareApi(sql) {
  let schemaReady = null
  function ensureSchema() {
    schemaReady ??= SCHEMA.reduce((prev, step) => prev.then(() => step(sql)), Promise.resolve()).catch((err) => {
      schemaReady = null
      throw err
    })
    return schemaReady
  }

  return async function handle(request) {
    try {
      if (request.method === 'GET') {
        await ensureSchema()
        return json(200, await loadState(sql))
      }

      if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })
      if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return json(413, { error: 'Request too large' })

      let body
      try {
        body = await request.json()
      } catch {
        return json(400, { error: 'Body must be JSON' })
      }

      await ensureSchema()
      if (body?.op === 'registerPrescription') {
        await registerPrescription(sql, parseRegister(body))
        return json(201, { ok: true })
      }
      if (body?.op === 'updateDose') {
        const updated = await updateDose(sql, parseUpdateDose(body))
        return updated ? json(200, { ok: true }) : json(404, { error: 'Dose not found' })
      }
      return json(400, { error: 'Unknown op' })
    } catch (err) {
      if (err instanceof BadRequest) return json(400, { error: err.message })
      if (err?.code === '23505') return json(409, { error: 'Already saved' })
      console.error('[careshare api]', err)
      return json(500, { error: 'Database error' })
    }
  }
}
