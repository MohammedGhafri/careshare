import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { generateSeed } from './seed.js'

// node:sqlite ships unflagged from Node 22.13 / 23.4 onward (see
// package.json "engines"). Using it means no native module to compile and
// no ORM — a single file, matching the PRD's "Simple local/database
// storage" prototype constraint.
//
// DB_PATH defaults to server/data/careshare.db (gitignored). This folder
// lives inside the OneDrive-synced project directory, which HANDOVER.md
// already flags as a source of silent corruption for generated files
// (dist/assets has been conflict-renamed mid-build before). Set
// CARESHARE_DB_PATH in .env.local to a path outside OneDrive to avoid that
// risk — see README.md.
const DB_PATH = process.env.CARESHARE_DB_PATH || new URL('./data/careshare.db', import.meta.url).pathname

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('medication', 'visit', 'task')),
    title TEXT NOT NULL,
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    status TEXT NOT NULL,
    assigned_to TEXT,
    updated_by TEXT,
    updated_at TEXT,
    notes TEXT,
    why TEXT,
    editable INTEGER NOT NULL DEFAULT 0,
    details TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    who TEXT NOT NULL,
    what TEXT NOT NULL,
    at TEXT NOT NULL,
    why TEXT,
    outcome TEXT
  );
`)

// Kind-specific fields that don't have their own column — round-tripped
// through the `details` JSON blob instead of growing the schema per kind.
const DETAIL_FIELDS = {
  medication: ['name', 'schedule', 'reminderTime'],
  visit: ['type'],
  task: ['due'],
}

function pick(obj, keys) {
  const out = {}
  for (const key of keys) {
    if (obj[key] !== undefined) out[key] = obj[key]
  }
  return out
}

function itemToRow(item) {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    start: new Date(item.start).toISOString(),
    end: new Date(item.end).toISOString(),
    status: item.status,
    assigned_to: item.assignedTo ?? null,
    updated_by: item.updatedBy ?? null,
    updated_at: item.updatedAt ?? null,
    notes: item.notes ?? null,
    why: item.why ?? null,
    editable: item.editable ? 1 : 0,
    details: JSON.stringify(pick(item, DETAIL_FIELDS[item.kind] || [])),
  }
}

function rowToItem(row) {
  const details = JSON.parse(row.details || '{}')
  const item = {
    id: row.id,
    kind: row.kind,
    title: row.title,
    start: new Date(row.start),
    end: new Date(row.end),
    status: row.status,
    editable: !!row.editable,
    ...details,
  }
  if (row.assigned_to != null) item.assignedTo = row.assigned_to
  if (row.updated_by != null) item.updatedBy = row.updated_by
  if (row.updated_at != null) item.updatedAt = row.updated_at
  if (row.notes != null) item.notes = row.notes
  if (row.why != null) item.why = row.why
  return item
}

function activityToRow(entry) {
  return {
    id: entry.id,
    who: entry.who,
    what: entry.what,
    at: new Date(entry.at).toISOString(),
    why: entry.why ?? null,
    outcome: entry.outcome ?? null,
  }
}

function rowToActivity(row) {
  const entry = { id: row.id, who: row.who, what: row.what, at: new Date(row.at) }
  if (row.why != null) entry.why = row.why
  if (row.outcome != null) entry.outcome = row.outcome
  return entry
}

const insertItemStmt = db.prepare(`
  INSERT INTO items (id, kind, title, start, end, status, assigned_to, updated_by, updated_at, notes, why, editable, details)
  VALUES (@id, @kind, @title, @start, @end, @status, @assigned_to, @updated_by, @updated_at, @notes, @why, @editable, @details)
`)

const insertActivityStmt = db.prepare(`
  INSERT INTO activity (id, who, what, at, why, outcome)
  VALUES (@id, @who, @what, @at, @why, @outcome)
`)

function insertItem(item) {
  insertItemStmt.run(itemToRow(item))
}

function insertActivity(entry) {
  insertActivityStmt.run(activityToRow(entry))
}

function seedIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM items').get()
  if (count > 0) return
  const { items, activity } = generateSeed(new Date())
  withTransaction(() => {
    items.forEach(insertItem)
    activity.forEach(insertActivity)
  })
}

export function withTransaction(fn) {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

seedIfEmpty()

export function getState() {
  const items = db.prepare('SELECT * FROM items ORDER BY start ASC').all().map(rowToItem)
  const activity = db.prepare('SELECT * FROM activity ORDER BY at DESC').all().map(rowToActivity)
  return { items, activity }
}

export function getItem(id) {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id)
  return row ? rowToItem(row) : null
}

// Applies a partial update to an item and records a matching activity
// entry in the same transaction — mirrors the logic that used to live in
// CareContext's UPDATE_STATUS/RESCHEDULE reducer cases.
export function applyItemUpdate(id, patch, activityEntry) {
  return withTransaction(() => {
    const existing = getItem(id)
    if (!existing) return null
    const updated = { ...existing, ...patch }
    // node:sqlite's named-parameter binding is strict: every key passed to
    // .run() must match a placeholder in the query, so `kind` (immutable,
    // not part of this UPDATE) has to be dropped from itemToRow's output.
    const { kind, ...row } = itemToRow(updated)
    db.prepare(`
      UPDATE items SET
        title = @title, start = @start, end = @end, status = @status,
        assigned_to = @assigned_to, updated_by = @updated_by, updated_at = @updated_at,
        notes = @notes, why = @why, editable = @editable, details = @details
      WHERE id = @id
    `).run(row)
    insertActivity(activityEntry)
    return { item: getItem(id), activity: activityEntry }
  })
}

export function resetDemoData(now = new Date()) {
  return withTransaction(() => {
    db.exec('DELETE FROM items')
    db.exec('DELETE FROM activity')
    const { items, activity } = generateSeed(now)
    items.forEach(insertItem)
    activity.forEach(insertActivity)
    return getState()
  })
}
