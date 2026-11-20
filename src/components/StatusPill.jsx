import { getStatus } from '../lib/status.js'

// Always renders colour + icon + text together (US19: never colour alone).
export default function StatusPill({ status }) {
  const { tone, label, icon } = getStatus(status)
  return (
    <span className={`status-pill tone-${tone}`}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  )
}
