// Browser client for /api/care (see server/careApi.js).

const ENDPOINT = '/api/care'

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  // crypto.randomUUID only exists in secure contexts (HTTPS/localhost); a
  // phone opening the dev server over plain-HTTP LAN still needs an id.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function request(init) {
  const res = await fetch(ENDPOINT, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } })
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json() : null
  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`)
    err.status = res.status
    err.code = body?.error
    throw err
  }
  return body
}

// Returns null when there is no database to talk to (no DATABASE_URL, or the
// app is served without the API, e.g. `vite preview`), so the app can fall
// back to keeping changes in memory.
export async function loadCareState() {
  try {
    const res = await fetch(ENDPOINT, { headers: { accept: 'application/json' } })
    if (!res.headers.get('content-type')?.includes('application/json')) return null
    const body = await res.json()
    if (res.status === 503 && body?.error === 'not_configured') return null
    if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`)
    return body
  } catch (err) {
    if (err instanceof TypeError) return null // network error: no API reachable
    throw err
  }
}

const serialiseActivity = (a) => ({ ...a, at: a.at.toISOString() })

export function saveRegisteredPrescription({ prescription, source, who, doses, activity }) {
  return request({
    method: 'POST',
    body: JSON.stringify({
      op: 'registerPrescription',
      prescription,
      source,
      who,
      doses: doses.map((d) => ({ id: d.id, start: d.start.toISOString(), end: d.end.toISOString() })),
      activity: serialiseActivity(activity),
    }),
  })
}

export function saveDoseUpdate({ id, status, note, updatedBy, updatedAt, start, end, activity }) {
  return request({
    method: 'POST',
    body: JSON.stringify({
      op: 'updateDose',
      id,
      status,
      note: note || undefined,
      updatedBy,
      updatedAt,
      start: start?.toISOString(),
      end: end?.toISOString(),
      activity: serialiseActivity(activity),
    }),
  })
}
