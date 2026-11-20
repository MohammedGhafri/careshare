import { person } from '../lib/cardMeta.js'

// Replaces a plain grey subtitle with scannable chips: a coloured avatar for
// who's responsible, a time with a friendly countdown, and detail chips.
export function PersonChip({ name }) {
  if (!name) return null
  const p = person(name)
  return (
    <span className="meta-chip meta-person" title={p.role ? `${p.name} · ${p.role}` : p.name}>
      <span className="meta-avatar" style={{ background: p.fg }} aria-hidden="true">{p.initial}</span>
      <span style={{ color: p.fg }}>{p.name}</span>
    </span>
  )
}

export function TimeChip({ time, relative }) {
  if (!time) return null
  return (
    <span className="meta-chip meta-time">
      <span aria-hidden="true">⏰</span>
      <span className="meta-strong">{time}</span>
      {relative && <span className={`meta-relative${relative.endsWith('ago') ? ' is-past' : ''}`}>· {relative}</span>}
    </span>
  )
}

export function DetailChip({ icon, children }) {
  if (!children) return null
  return (
    <span className="meta-chip">
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  )
}
