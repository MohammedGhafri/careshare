import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { todayDate } from '../lib/dates.js'
import { buildDoseItems, describeSchedule } from '../lib/prescriptionParser.js'
import {
  fetchState,
  updateStatus as apiUpdateStatus,
  reschedule as apiReschedule,
  resetDemo as apiResetDemo,
} from '../lib/api.js'

const CareStateContext = createContext(null)
const CareDispatchContext = createContext(null)

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// Items/activity start empty and are populated once CareProvider's load
// effect fetches them from the CareShare API — see `status` below.
function initialState() {
  return {
    items: [],
    activity: [],
    selectedDate: todayDate,
    selectedItemId: null,
    gcalEvents: [],
    prescriptions: [],
    status: 'loading', // 'loading' | 'ready' | 'error' — covers the initial GET /api/state only
    error: null, // transient message from a failed action, or the load error; shown as a dismissible banner
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, status: 'loading', error: null }

    case 'LOAD_SUCCESS':
      return { ...state, status: 'ready', items: action.items, activity: action.activity, error: null }

    case 'LOAD_ERROR':
      return { ...state, status: 'error', error: action.error }

    case 'SET_ERROR':
      return { ...state, error: action.error }

    case 'CLEAR_ERROR':
      return { ...state, error: null }

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

    // Applied immediately (before the API call resolves) so the UI feels
    // instant; ITEM_SAVED then reconciles with whatever the server actually
    // persisted. If the request fails, useCareActions refetches the real
    // state, which overwrites this guess.
    case 'UPDATE_STATUS_OPTIMISTIC': {
      const items = state.items.map((item) =>
        item.id === action.id ? { ...item, status: action.status } : item
      )
      return { ...state, items }
    }

    case 'RESCHEDULE_OPTIMISTIC': {
      const items = state.items.map((item) =>
        item.id === action.id ? { ...item, start: action.start, end: action.end } : item
      )
      return { ...state, items }
    }

    case 'REGISTER_PRESCRIPTION': {
      const id = `rx-${state.prescriptions.length + 1}`
      const { prescription, source = 'scan' } = action
      const doses = buildDoseItems(prescription, id, source)
      const name = [prescription.medication, prescription.strength].filter(Boolean).join(' ')
      const entry = {
        id: nextActivityId(),
        who: action.who,
        what: source === 'scan' ? `Added ${name} from a scanned label` : `Added ${name} to the medication schedule`,
        at: new Date(),
        why: `${describeSchedule(prescription)} — from ${prescription.start_date}`,
        outcome: `${doses.length} doses added to the calendar`,
      }
      return {
        ...state,
        prescriptions: [...state.prescriptions, { id, source, ...prescription }],
        items: [...state.items, ...doses],
        activity: [entry, ...state.activity],
        selectedDate: doses.length ? startOfDay(doses[0].start) : state.selectedDate,
      }
    }

    // Server's canonical item (with updatedBy/updatedAt/notes/why etc. as it
    // actually recorded them) plus the activity entry it generated.
    case 'ITEM_SAVED': {
      const items = state.items.map((item) => (item.id === action.item.id ? action.item : item))
      return { ...state, items, activity: [action.activity, ...state.activity] }
    }

    case 'RESET_DATA':
      return { ...state, items: action.items, activity: action.activity, selectedItemId: null, error: null }

    case 'SET_GCAL_EVENTS':
      return { ...state, gcalEvents: action.events }

    default:
      return state
  }
}

export function CareProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'LOAD_START' })
    fetchState()
      .then(({ items, activity }) => {
        if (!cancelled) dispatch({ type: 'LOAD_SUCCESS', items, activity })
      })
      .catch((err) => {
        if (!cancelled) dispatch({ type: 'LOAD_ERROR', error: err.message })
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

// Wraps the mutating API calls (status change, reschedule, demo reset) with
// optimistic dispatch + server reconciliation, so components call these
// instead of building CareContext actions by hand.
export function useCareActions() {
  const dispatch = useCareDispatch()

  async function resyncAfterFailure(err) {
    try {
      const { items, activity } = await fetchState()
      dispatch({ type: 'LOAD_SUCCESS', items, activity })
      dispatch({ type: 'SET_ERROR', error: err.message })
    } catch {
      // Couldn't even refetch — surface the original error via LOAD_ERROR,
      // which switches the app into its full error state.
      dispatch({ type: 'LOAD_ERROR', error: err.message })
    }
  }

  async function updateStatus(id, { status, who, note }) {
    dispatch({ type: 'UPDATE_STATUS_OPTIMISTIC', id, status })
    try {
      const { item, activity } = await apiUpdateStatus(id, { status, who, note })
      dispatch({ type: 'ITEM_SAVED', item, activity })
    } catch (err) {
      await resyncAfterFailure(err)
    }
  }

  async function reschedule(id, { start, end, who }) {
    dispatch({ type: 'RESCHEDULE_OPTIMISTIC', id, start, end })
    try {
      const { item, activity } = await apiReschedule(id, { start, end, who })
      dispatch({ type: 'ITEM_SAVED', item, activity })
    } catch (err) {
      await resyncAfterFailure(err)
    }
  }

  async function resetDemo() {
    try {
      const { items, activity } = await apiResetDemo()
      dispatch({ type: 'RESET_DATA', items, activity })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }

  return { updateStatus, reschedule, resetDemo }
}
