// Thin client for the CareShare API (server/index.js). Requests go to
// same-origin relative paths; vite.config.js proxies /api/* to the API
// server in both dev and preview, so no base URL or CORS setup is needed
// here.
//
// JSON has no Date type, so every item/activity entry that round-trips
// through the API needs its start/end/at fields revived from ISO strings
// back into real Date objects — the rest of the app (isSameDay, FullCalendar,
// toLocaleString calls) assumes Date instances.

const BASE = '/api'

function reviveItem(item) {
  return { ...item, start: new Date(item.start), end: new Date(item.end) }
}

function reviveActivity(entry) {
  return { ...entry, at: new Date(entry.at) }
}

function reviveState({ items, activity }) {
  return { items: items.map(reviveItem), activity: activity.map(reviveActivity) }
}

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let message = `Request to ${path} failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // response body wasn't JSON — fall back to the generic message above
    }
    throw new Error(message)
  }
  return res.json()
}

export async function fetchState() {
  return reviveState(await request('/state'))
}

export async function updateStatus(id, { status, who, note }) {
  const { item, activity } = await request(`/items/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, who, note }),
  })
  return { item: reviveItem(item), activity: reviveActivity(activity) }
}

export async function reschedule(id, { start, end, who }) {
  const { item, activity } = await request(`/items/${encodeURIComponent(id)}/schedule`, {
    method: 'PATCH',
    body: JSON.stringify({ start, end, who }),
  })
  return { item: reviveItem(item), activity: reviveActivity(activity) }
}

export async function resetDemo() {
  return reviveState(await request('/reset', { method: 'POST' }))
}
