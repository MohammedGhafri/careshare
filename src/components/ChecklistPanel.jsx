import { useEffect, useMemo } from 'react'
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
export default function ChecklistPanel() {
  const { items, activity, gcalEvents, selectedDate, selectedItemId } = useCareState()
  const dispatch = useCareDispatch()

  const dayItems = useMemo(
    () => items.filter((item) => isSameDay(item.start, selectedDate)),
    [items, selectedDate]
  )
  const dayGcal = useMemo(
    () => gcalEvents.filter((event) => isSameDay(event.start, selectedDate)),
    [gcalEvents, selectedDate]
  )
  const medications = useMemo(() => dayItems.filter((i) => i.kind === 'medication').sort(byStart), [dayItems])
  const visits = useMemo(() => dayItems.filter((i) => i.kind === 'visit').sort(byStart), [dayItems])
  const tasks = useMemo(() => dayItems.filter((i) => i.kind === 'task').sort(byStart), [dayItems])
  const alerts = useMemo(() => deriveAlerts(dayItems, new Date()), [dayItems])
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
      <h2 className="checklist-heading">
        Checklist · {dayLabel}
        {isToday && <span className="today-tag">Today</span>}
      </h2>

      <div className="summary-strip">
        <span className="summary-chip urgent">🚨 {counts.urgent} need urgent attention</span>
        <span className="summary-chip attention">⚠️ {counts.attention} need attention</span>
        <span className="summary-chip complete">✅ {counts.complete} done</span>
      </div>

      <AlertsSection alerts={alerts} selectedItemId={selectedItemId} onSelect={select} />
      <MedicationSection medications={medications} selectedItemId={selectedItemId} onSelect={select} />
      <VisitsSection
        visits={visits}
        gcalEvents={dayGcal}
        selectedItemId={selectedItemId}
        onSelect={select}
      />
      <TasksSection tasks={tasks} selectedItemId={selectedItemId} onSelect={select} />
      <ActivityFeed entries={dayActivity} />
    </div>
  )
}
