function formatWhen(at) {
  const d = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function ActivityFeed({ entries }) {
  return (
    <section className="section">
      <h2>🕓 Recent activity</h2>
      <div className="card-list">
        {entries.map((entry) => (
          <div key={entry.id} className="card" style={{ cursor: 'default' }}>
            <span className="card-main">
              <span className="card-title">
                {entry.who} — {entry.what}
                {entry.isSystem && <span className="gcal-tag">Rules engine</span>}
              </span>
              <span className="card-sub">
                {formatWhen(entry.at)}
                {entry.why ? ` · ${entry.why}` : ''}
                {entry.outcome ? ` · ${entry.outcome}` : ''}
              </span>
            </span>
          </div>
        ))}
        {entries.length === 0 && <p className="card-sub">No activity recorded for this day.</p>}
      </div>
    </section>
  )
}
