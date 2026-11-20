import { useEffect, useMemo, useState } from 'react'
import { useCareState, useCareDispatch } from '../state/CareContext.jsx'
import { isSameDay, todayDate } from '../data/mockData.js'
import { deriveAlerts } from '../lib/rules.js'
import { getStatus } from '../lib/status.js'
import AlertsSection from './AlertsSection.jsx'
import MedicationSection from './MedicationSection.jsx'
import VisitsSection from './VisitsSection.jsx'
import TasksSection from './TasksSection.jsx'
import ActivityFeed from './ActivityFeed.jsx'

const byStart = (a, b) => a.start - b.start

// Shows the selected day's picture: alerts, medication, visits, tasks and
// activity — all filtered to `selectedDate` and reading from the same
// CareContext state that CalendarView writes to, so the two views stay
// in sync (US01's checklist, now scoped per day instead of only "today").
//
// The close button, heading and status filter chips form a sticky header so
// they stay reachable while scrolling a long list, especially in the
// mobile drawer.
export default function ChecklistPanel({ onClose }) {
  const { items, activity, gcalEvents, selectedDate, selectedItemId } = useCareState()
  const dispatch = useCareDispatch()
  const [filterTone, setFilterTone] = useState(null)

  const dayItems = useMemo(
    () => items.filter((item) => isSameDay(item.start, selectedDate)),
    [items, selectedDate]
  )
  const dayGcal = useMemo(
    () => gcalEvents.filter((event) => isSameDay(event.start, selectedDate)),
    [gcalEvents, selectedDate]
  )
  const alerts = useMemo(() => deriveAlerts(dayItems, new Date()), [dayItems])

  const matchesFilter = (item) => !filterTone || getStatus(item.status).tone === filterTone

  const medications = useMemo(
    () => dayItems.filter((i) => i.kind === 'medication').filter(matchesFilter).sort(byStart),
    [dayItems, filterTone]
  )
  const visits = useMemo(
    () => dayItems.filter((i) => i.kind === 'visit').filter(matchesFilter).sort(byStart),
    [dayItems, filterTone]
  )
  const tasks = useMemo(
    () => dayItems.filter((i) => i.kind === 'task').filter(matchesFilter).sort(byStart),
    [dayItems, filterTone]
  )
  // Google events always show as "scheduled" (normal tone), which never
  // matches the urgent/attention/complete filters — hide them while a
  // filter is active rather than showing a tone they don't belong to.
  const visibleGcal = useMemo(() => (filterTone ? [] : dayGcal), [dayGcal, filterTone])
  const visibleAlerts = useMemo(
    () => alerts.filter((a) => !filterTone || getStatus(a.status).tone === filterTone),
    [alerts, filterTone]
  )
  const dayActivity = useMemo(
    () =>
      activity
        .filter((entry) => isSameDay(entry.at, selectedDate))
        .sort((a, b) => b.at - a.at),
    [activity, selectedDate]
  )

  const counts = useMemo(() => {
    const tones = dayItems.map((i) => getStatus(i.status).tone)
    return {
      urgent: tones.filter((t) => t === 'urgent').length,
      attention: tones.filter((t) => t === 'attention').length,
      complete: tones.filter((t) => t === 'complete').length,
    }
  }, [dayItems])

  function select(id) {
    dispatch({ type: 'SELECT_ITEM', id })
  }

  function toggleFilter(tone) {
    setFilterTone((current) => (current === tone ? null : tone))
  }

  // Scroll the matching card into view when an item is selected from the calendar.
  useEffect(() => {
    if (!selectedItemId) return
    const el = document.getElementById(`card-${selectedItemId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [selectedItemId])

  const dayLabel = selectedDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const isToday = isSameDay(selectedDate, todayDate)

  return (
    <div className="checklist-panel">
      <div className="checklist-sticky-header">
        <button type="button" className="btn btn-ghost drawer-close" onClick={onClose}>
          Close ✕
        </button>

        <h2 className="checklist-heading">
          Checklist · {dayLabel}
          {isToday && <span className="today-tag">Today</span>}
        </h2>

        <div className="summary-strip">
          <button
            type="button"
            className={`summary-chip urgent${filterTone === 'urgent' ? ' is-active' : ''}`}
            aria-pressed={filterTone === 'urgent'}
            onClick={() => toggleFilter('urgent')}
          >
            🚨 {counts.urgent} need urgent attention
          </button>
          <button
            type="button"
            className={`summary-chip attention${filterTone === 'attention' ? ' is-active' : ''}`}
            aria-pressed={filterTone === 'attention'}
            onClick={() => toggleFilter('attention')}
          >
            ⚠️ {counts.attention} need attention
          </button>
          <button
            type="button"
            className={`summary-chip complete${filterTone === 'complete' ? ' is-active' : ''}`}
            aria-pressed={filterTone === 'complete'}
            onClick={() => toggleFilter('complete')}
          >
            ✅ {counts.complete} done
          </button>
          {filterTone && (
            <button type="button" className="summary-chip clear" onClick={() => setFilterTone(null)}>
              ✕ Clear filter
            </button>
          )}
        </div>
      </div>

      <AlertsSection alerts={visibleAlerts} selectedItemId={selectedItemId} onSelect={select} />
      <MedicationSection medications={medications} selectedItemId={selectedItemId} onSelect={select} />
      <VisitsSection
        visits={visits}
        gcalEvents={visibleGcal}
        selectedItemId={selectedItemId}
        onSelect={select}
      />
      <TasksSection tasks={tasks} selectedItemId={selectedItemId} onSelect={select} />
      <ActivityFeed entries={dayActivity} />
    </div>
  )
}
