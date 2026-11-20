// Minimal Google Calendar integration using Google Identity Services (GIS)
// and the Calendar REST API directly (no extra SDK needed for a POC).
//
// Without a VITE_GOOGLE_CLIENT_ID configured, the app runs in "demo mode":
// isConfigured() is false, and the UI falls back to "Add to Google Calendar"
// template links instead of calling the API.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

let tokenClient = null
let accessToken = null

export function isConfigured() {
  return Boolean(CLIENT_ID)
}

export function isSignedIn() {
  return Boolean(accessToken)
}

function ensureTokenClient() {
  if (!window.google) {
    throw new Error('Google Identity Services script has not loaded yet.')
  }
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: () => {}, // overridden per-call in signIn()
    })
  }
  return tokenClient
}

export function signIn() {
  return new Promise((resolve, reject) => {
    if (!isConfigured()) {
      reject(new Error('Google Calendar is not configured (missing VITE_GOOGLE_CLIENT_ID).'))
      return
    }
    try {
      const client = ensureTokenClient()
      client.callback = (response) => {
        if (response.error) {
          reject(response)
          return
        }
        accessToken = response.access_token
        resolve(accessToken)
      }
      client.requestAccessToken({ prompt: accessToken ? '' : 'consent' })
    } catch (err) {
      reject(err)
    }
  })
}

async function apiFetch(path, options = {}) {
  if (!accessToken) {
    throw new Error('Not signed in to Google Calendar.')
  }
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Calendar API error ${res.status}: ${body}`)
  }
  return res.json()
}

// Returns events between `rangeStart` and `rangeEnd` (JS Date objects) from
// the primary calendar — used to populate whatever range the calendar view
// currently has visible (a day or a week).
export async function listEvents(rangeStart, rangeEnd) {
  const params = new URLSearchParams({
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  })

  const data = await apiFetch(`/calendars/primary/events?${params.toString()}`)
  return (data.items || []).map((event) => ({
    id: event.id,
    kind: 'google',
    title: event.summary || '(No title)',
    name: event.summary || '(No title)',
    start: new Date(event.start?.dateTime || event.start?.date),
    end: new Date(event.end?.dateTime || event.end?.date),
    status: 'scheduled',
    editable: false,
    source: 'google-calendar',
  }))
}

// Creates an event on the primary calendar. `start`/`end` are JS Date objects.
export async function addEvent({ title, description, start, end }) {
  const body = {
    summary: title,
    description,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  }
  return apiFetch('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// Fallback for demo mode: opens a prefilled "Add to Google Calendar" page,
// no sign-in required.
export function templateLink({ title, details, start, end }) {
  const fmt = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details: details || '',
    dates: `${fmt(start)}/${fmt(end)}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
