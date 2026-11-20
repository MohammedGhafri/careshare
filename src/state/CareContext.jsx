import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { medications, visits, tasks, activity as seedActivity, todayDate } from '../data/mockData.js'
import { buildDoseItems, clockTime, describeSchedule, makeDoseItem } from '../lib/prescriptionParser.js'
import { loadCareState, newId, saveDoseUpdate, saveItemUpdate, saveRegisteredPrescription } from '../lib/careApi.js'

const CareStateContext = createContext(null)
const CareDispatchContext = createContext(null)

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function initialState() {
  return {
    items: [...medications, ...visits, ...tasks],
    activity: [...seedActivity],
    selectedDate: todayDate,
    selectedItemId: null,
    gcalEvents: [],
    prescriptions: [],
    // mode: 'loading' | 'database' (saved to Neon) | 'local' (in memory only)
    sync: { mode: 'loading', error: null },
  }
}

// Turns rows from /api/care back into prescriptions, calendar items and activity.
function fromSaved(data) {
  const prescriptions = new Map(data.prescriptions.map((p) => [p.id, p]))
  const items = data.doses
    .filter((d) => prescriptions.has(d.prescriptionId))
    .map((d) => {
      const p = prescriptions.get(d.prescriptionId)
      const item = makeDoseItem(p, { id: d.id, start: new Date(d.start), end: new Date(d.end), source: p.source })
      return {
        ...item,
        status: d.status,
        updatedBy: d.updatedBy,
        updatedAt: d.updatedAt,
        notes: d.note || '',
        why: d.note || item.why,
      }
    })
  const activity = data.activity.map((a) => ({ ...a, at: new Date(a.at), why: a.why || undefined }))
  return { prescriptions: data.prescriptions, items, activity }
}

// Re-applies saved status/note/time changes to the regenerated demo items.
function applyOverrides(items, overrides = []) {
  if (!overrides.length) return items
  const byKey = new Map(overrides.map((o) => [o.key, o]))
  return items.map((item) => {
    const o = item.overrideKey && byKey.get(item.overrideKey)
    if (!o) return item
    const start = o.start ? new Date(o.start) : item.start
    return {
      ...item,
      ...(o.status ? { status: o.status } : {}),
      ...(o.updatedBy ? { updatedBy: o.updatedBy } : {}),
      ...(o.updatedAt ? { updatedAt: o.updatedAt } : {}),
      ...(o.note ? { notes: o.note, why: o.note } : {}),
      start,
      end: o.end ? new Date(o.end) : item.end,
      ...(o.start && item.reminderTime ? { reminderTime: clockTime(start) } : {}),
    }
  })
}

const notIn = (list) => {
  const ids = new Set(list.map((x) => x.id))
  return (x) => !ids.has(x.id)
}

function reducer(state, action) {
  switch (action.type) {
    case 'SELECT_DATE':
      return { ...state, selectedDate: action.date }

    case 'SELECT_ITEM': {
      if (!action.id) return { ...state, selectedItemId: null }
      const isGcal = action.id.startsWith('gcal-')
      const item = isGcal
        ? state.gcalEvents.find((e) => `gcal-${e.id}` === action.id)
        : state.items.find((i) => i.id === action.id)
      // Selecting an item (e.g. clicking a calendar event on a different day
      // than the one currently shown) also jumps the checklist to that
      // item's day, so the two views always agree on what's selected.
      return {
        ...state,
        selectedItemId: action.id,
        selectedDate: item ? startOfDay(item.start) : state.selectedDate,
      }
    }

    case 'CLOSE_DETAIL':
      return { ...state, selectedItemId: null }

    case 'UPDATE_STATUS': {
      const items = state.items.map((item) =>
        item.id === action.id
          ? {
              ...item,
              status: action.status,
              updatedBy: action.who,
              updatedAt: action.updatedAt,
              notes: action.note || item.notes,
              why: action.note || item.why,
            }
          : item
      )
      return { ...state, items, activity: [action.activity, ...state.activity] }
    }

    case 'RESCHEDULE': {
      const items = state.items.map((item) =>
        item.id === action.id
          ? {
              ...item,
              start: action.start,
              end: action.end,
              ...(item.reminderTime ? { reminderTime: clockTime(action.start) } : {}),
            }
          : item
      )
      return { ...state, items, activity: [action.activity, ...state.activity] }
    }

    case 'REGISTER_PRESCRIPTION': {
      const { id, prescription, source, doses } = action
      return {
        ...state,
        prescriptions: [...state.prescriptions, { id, source, ...prescription }],
        items: [...state.items, ...doses],
        activity: [action.activity, ...state.activity],
        selectedDate: doses.length ? startOfDay(doses[0].start) : state.selectedDate,
      }
    }

    case 'HYDRATE': {
      // Anything registered while the initial load was in flight is already in state.
      const saved = fromSaved(action.data)
      return {
        ...state,
        prescriptions: [...state.prescriptions, ...saved.prescriptions.filter(notIn(state.prescriptions))],
        items: [...applyOverrides(state.items, action.data.overrides), ...saved.items.filter(notIn(state.items))],
        activity: [...state.activity, ...saved.activity.filter(notIn(state.activity))],
      }
    }

    case 'SYNC_STATUS':
      return { ...state, sync: { mode: action.mode ?? state.sync.mode, error: action.error ?? null } }

    case 'SET_GCAL_EVENTS':
      return { ...state, gcalEvents: action.events }

    default:
      return state
  }
}

function formatNow() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// Fills in everything that isn't a pure function of state (ids, timestamps,
// activity entries) before the reducer runs, so the exact same values are
// shown on screen and sent to the database.
function prepare(action, state) {
  switch (action.type) {
    case 'UPDATE_STATUS': {
      const item = state.items.find((i) => i.id === action.id)
      if (!item) return null
      const note = action.note?.trim() || undefined
      return {
        ...action,
        note,
        updatedAt: formatNow(),
        activity: {
          id: newId(),
          who: action.who,
          what: `Recorded "${item.name || item.title}" as ${action.status}`,
          at: new Date(),
          why: note,
          outcome: 'Status updated',
        },
      }
    }

    case 'RESCHEDULE': {
      const item = state.items.find((i) => i.id === action.id)
      if (!item) return null
      return {
        ...action,
        activity: {
          id: newId(),
          who: action.who || 'Sarah',
          what: `Rescheduled "${item.name || item.title}" to ${action.start.toLocaleString('en-GB', {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}`,
          at: new Date(),
          outcome: 'Calendar updated',
        },
      }
    }

    case 'REGISTER_PRESCRIPTION': {
      const id = newId()
      const source = action.source ?? 'scan'
      const { prescription } = action
      const doses = buildDoseItems(prescription, id, source)
      const name = [prescription.medication, prescription.strength].filter(Boolean).join(' ')
      return {
        ...action,
        id,
        source,
        doses,
        activity: {
          id: newId(),
          who: action.who,
          what: source === 'scan' ? `Added ${name} from a scanned label` : `Added ${name} to the medication schedule`,
          at: new Date(),
          why: `${describeSchedule(prescription)} — from ${prescription.start_date}`,
          outcome: `${doses.length} ${doses.length === 1 ? 'dose' : 'doses'} added to the calendar`,
        },
      }
    }

    default:
      return action
  }
}

// Saves added/scanned prescriptions and their doses, plus changes to the
// built-in demo items (stored as overrides keyed by item@date, because the
// demo items themselves are regenerated on every load).
function persist(action, state) {
  switch (action.type) {
    case 'REGISTER_PRESCRIPTION':
      return saveRegisteredPrescription({
        prescription: { id: action.id, ...action.prescription },
        source: action.source,
        who: action.who,
        doses: action.doses,
        activity: action.activity,
      })
    case 'UPDATE_STATUS':
    case 'RESCHEDULE': {
      const item = state.items.find((i) => i.id === action.id)
      const change =
        action.type === 'UPDATE_STATUS'
          ? { status: action.status, note: action.note, updatedBy: action.who, updatedAt: action.updatedAt, activity: action.activity }
          : { start: action.start, end: action.end, activity: action.activity }
      if (item?.prescriptionId) return saveDoseUpdate({ id: action.id, ...change })
      if (item?.overrideKey) return saveItemUpdate({ key: item.overrideKey, ...change })
      return null
    }
    default:
      return null
  }
}

export function CareProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, initialState)
  const stateRef = useRef(state)
  stateRef.current = state

  const dispatch = useCallback((action) => {
    const current = stateRef.current
    const prepared = prepare(action, current)
    if (!prepared) return
    rawDispatch(prepared)
    if (current.sync.mode === 'local') return
    persist(prepared, current)?.catch((err) => {
      if (err.code === 'not_configured') {
        rawDispatch({ type: 'SYNC_STATUS', mode: 'local' })
        return
      }
      rawDispatch({
        type: 'SYNC_STATUS',
        error: `Couldn't save your last change (${err.message}). It's shown here but will be lost when you refresh.`,
      })
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    loadCareState()
      .then((data) => {
        if (cancelled) return
        if (!data) {
          rawDispatch({ type: 'SYNC_STATUS', mode: 'local' })
          return
        }
        rawDispatch({ type: 'HYDRATE', data })
        rawDispatch({ type: 'SYNC_STATUS', mode: 'database' })
      })
      .catch((err) => {
        if (cancelled) return
        rawDispatch({
          type: 'SYNC_STATUS',
          mode: 'local',
          error: `Couldn't load saved medication (${err.message}). Changes will only be kept until you refresh.`,
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <CareStateContext.Provider value={state}>
      <CareDispatchContext.Provider value={dispatch}>{children}</CareDispatchContext.Provider>
    </CareStateContext.Provider>
  )
}

export function useCareState() {
  const ctx = useContext(CareStateContext)
  if (!ctx) throw new Error('useCareState must be used within CareProvider')
  return ctx
}

export function useCareDispatch() {
  const ctx = useContext(CareDispatchContext)
  if (!ctx) throw new Error('useCareDispatch must be used within CareProvider')
  return ctx
}

export function useSelectedItem() {
  const state = useCareState()
  return useMemo(() => {
    if (!state.selectedItemId) return null
    if (state.selectedItemId.startsWith('gcal-')) {
      return state.gcalEvents.find((e) => `gcal-${e.id}` === state.selectedItemId) || null
    }
    return state.items.find((i) => i.id === state.selectedItemId) || null
  }, [state.selectedItemId, state.items, state.gcalEvents])
}
