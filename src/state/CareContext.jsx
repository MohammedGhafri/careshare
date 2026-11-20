import { createContext, useContext, useMemo, useReducer } from 'react'
import { medications, visits, tasks, activity as seedActivity, todayDate } from '../data/mockData.js'

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
  }
}

let activityCounter = 0
function nextActivityId() {
  activityCounter += 1
  return `activity-generated-${activityCounter}`
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
      const note = action.note?.trim()
      const items = state.items.map((item) =>
        item.id === action.id
          ? {
              ...item,
              status: action.status,
              updatedBy: action.who,
              updatedAt: formatNow(),
              notes: note || item.notes,
              why: note || item.why,
            }
          : item
      )
      const item = items.find((i) => i.id === action.id)
      const entry = {
        id: nextActivityId(),
        who: action.who,
        what: `Recorded "${item.name || item.title}" as ${action.status}`,
        at: new Date(),
        why: note || undefined,
        outcome: 'Status updated',
      }
      return { ...state, items, activity: [entry, ...state.activity] }
    }

    case 'RESCHEDULE': {
      const items = state.items.map((item) =>
        item.id === action.id ? { ...item, start: action.start, end: action.end } : item
      )
      const item = items.find((i) => i.id === action.id)
      const entry = {
        id: nextActivityId(),
        who: action.who || 'Sarah',
        what: `Rescheduled "${item.name || item.title}" to ${action.start.toLocaleString('en-GB', {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        at: new Date(),
        outcome: 'Calendar updated',
      }
      return { ...state, items, activity: [entry, ...state.activity] }
    }

    case 'SET_GCAL_EVENTS':
      return { ...state, gcalEvents: action.events }

    default:
      return state
  }
}

function formatNow() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function CareProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
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
