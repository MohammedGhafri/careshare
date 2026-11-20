import { useEffect, useState } from 'react'
import StatusPill from './StatusPill.jsx'
import { useCareActions } from '../state/CareContext.jsx'

const ACTING_AS = 'Sarah' // demo always acts as the Family Coordinator (US08 role-switching is out of scope for now)

const MED_STATUSES = [
  { key: 'taken', label: 'Taken', icon: '✅' },
  { key: 'missed', label: 'Missed', icon: '⚠️' },
  { key: 'declined', label: 'Declined', icon: '⛔' },
  { key: 'unknown', label: 'Unknown', icon: '❓' },
]

function formatTime(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatWhen(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, ${formatTime(d)}`
}

function buildFields(item) {
  switch (item.kind) {
    case 'medication':
      return [
        { label: 'Schedule', value: item.schedule },
        { label: 'Reminder time', value: item.reminderTime },
        { label: 'Last updated', value: item.updatedBy ? `${item.updatedBy}, ${item.updatedAt}` : 'Not yet recorded' },
      ]
    case 'visit':
      return [
        { label: 'Assigned to', value: item.assignedTo },
        { label: 'When', value: formatWhen(item.start) },
        { label: 'Last updated', value: `${item.updatedBy}, ${item.updatedAt}` },
      ]
    case 'task':
      return [
        { label: 'Assigned to', value: item.assignedTo },
        { label: 'Due', value: item.due },
      ]
    case 'google':
      return [
        { label: 'Start', value: formatTime(item.start) },
        { label: 'End', value: formatTime(item.end) },
        { label: 'Source', value: 'Synced from your Google Calendar' },
      ]
    default:
      return []
  }
}

const KIND_LABEL = {
  medication: 'Medication',
  visit: 'Visit',
  task: 'Task',
  google: 'Google Calendar event',
}

export default function DetailSheet({ item, onClose, onAddToCalendar, calendarBusy, calendarMessage }) {
  const { updateStatus } = useCareActions()
  const [note, setNote] = useState('')

  // Reset the note draft whenever a different item is opened.
  useEffect(() => {
    setNote(item ? item.notes ?? item.why ?? '' : '')
  }, [item?.id])

  if (!item) return null

  const title = item.name || item.title
  const fields = buildFields(item)
  const canAddToCalendar = item.kind !== 'google'
  const canEditNotes = item.kind !== 'google'

  function setStatus(status) {
    updateStatus(item.id, { status, who: ACTING_AS, note })
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="card-sub" style={{ margin: 0 }}>{KIND_LABEL[item.kind] || item.kind}</p>
        <h2>{title}</h2>
        <StatusPill status={item.status} />

        <dl>
          {fields.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>

        {canEditNotes && (
          <div className="field">
            <label htmlFor="detail-note" className="field-label">Notes</label>
            <textarea
              id="detail-note"
              className="textarea"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note for the care circle (optional)"
            />
          </div>
        )}

        <p className="safety-banner" style={{ fontSize: 13 }}>
          CareShare shows what has been recorded. A human in the care circle
          decides what to do next.
        </p>

        {item.kind === 'medication' && (
          <div className="sheet-actions">
            {MED_STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`btn ${item.status === s.key ? 'btn-primary is-active' : 'btn-secondary'}`}
                aria-pressed={item.status === s.key}
                onClick={() => setStatus(s.key)}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        )}

        {(item.kind === 'visit' || item.kind === 'task') && item.status !== 'complete' && (
          <div className="sheet-actions">
            <button type="button" className="btn btn-primary" onClick={() => setStatus('complete')}>✅ Mark complete</button>
          </div>
        )}

        <div className="sheet-actions">
          {canAddToCalendar && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onAddToCalendar(item)}
              disabled={calendarBusy}
            >
              {calendarBusy ? 'Adding…' : '📅 Add to Google Calendar'}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {calendarMessage && <p className="card-sub">{calendarMessage}</p>}
      </div>
    </div>
  )
}
