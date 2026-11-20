import express from 'express'
import { getState, getItem, applyItemUpdate, resetDemoData } from './db.js'

const PORT = process.env.PORT || 3001

const app = express()
app.use(express.json())

const VALID_STATUSES = new Set(['taken', 'missed', 'declined', 'unknown', 'due', 'complete', 'scheduled', 'attention', 'normal'])

function formatNow() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

app.get('/api/state', (req, res) => {
  res.json(getState())
})

// Mirrors the old UPDATE_STATUS reducer case in src/state/CareContext.jsx:
// updates the item's status (+ optional note, folded into notes/why) and
// appends a matching activity entry, both in one transaction.
app.patch('/api/items/:id/status', (req, res) => {
  const { id } = req.params
  const { status, who, note } = req.body || {}

  if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: 'status must be a known status string' })
  }
  if (typeof who !== 'string' || !who.trim()) {
    return res.status(400).json({ error: 'who is required' })
  }

  const existing = getItem(id)
  if (!existing) return res.status(404).json({ error: `No item with id "${id}"` })

  const trimmedNote = typeof note === 'string' ? note.trim() : ''
  const patch = {
    status,
    updatedBy: who,
    updatedAt: formatNow(),
    notes: trimmedNote || existing.notes,
    why: trimmedNote || existing.why,
  }
  const activityEntry = {
    id: crypto.randomUUID(),
    who,
    what: `Recorded "${existing.name || existing.title}" as ${status}`,
    at: new Date(),
    why: trimmedNote || undefined,
    outcome: 'Status updated',
  }

  const result = applyItemUpdate(id, patch, activityEntry)
  res.json(result)
})

// Mirrors the old RESCHEDULE reducer case: moves an item's start/end (from
// a FullCalendar drag/resize) and logs the move to the activity feed.
app.patch('/api/items/:id/schedule', (req, res) => {
  const { id } = req.params
  const { start, end, who } = req.body || {}

  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return res.status(400).json({ error: 'start and end must be valid dates' })
  }

  const existing = getItem(id)
  if (!existing) return res.status(404).json({ error: `No item with id "${id}"` })

  const patch = { start: startDate, end: endDate }
  const activityEntry = {
    id: crypto.randomUUID(),
    who: who || 'Sarah',
    what: `Rescheduled "${existing.name || existing.title}" to ${startDate.toLocaleString('en-GB', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    at: new Date(),
    outcome: 'Calendar updated',
  }

  const result = applyItemUpdate(id, patch, activityEntry)
  res.json(result)
})

// Wipes items/activity and regenerates the seed data anchored to "now", so
// the demo week always lines up with whatever day this is run on.
app.post('/api/reset', (req, res) => {
  res.json(resetDemoData(new Date()))
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`CareShare API listening on http://localhost:${PORT}`)
})
