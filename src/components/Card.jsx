import { getStatus } from '../lib/status.js'
import StatusPill from './StatusPill.jsx'

// A large, tappable row used across every dashboard section.
// Clicking/activating it opens the DetailSheet (US01: navigate to details),
// and highlights in sync with the matching event in CalendarView.
export default function Card({ id, title, subtitle, status, tag, onSelect, isSelected }) {
  const { tone } = getStatus(status)
  return (
    <button
      type="button"
      id={id ? `card-${id}` : undefined}
      className={`card tone-${tone}${isSelected ? ' is-selected' : ''}`}
      onClick={onSelect}
    >
      <span className="card-main">
        <span className="card-title">
          {title}
          {tag && <span className="gcal-tag">{tag}</span>}
        </span>
        {subtitle && <span className="card-sub">{subtitle}</span>}
      </span>
      <StatusPill status={status} />
    </button>
  )
}
