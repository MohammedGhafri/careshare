import Card from './Card.jsx'
import { PersonChip } from './CardMeta.jsx'

export default function AlertsSection({ alerts, selectedItemId, onSelect }) {
  if (alerts.length === 0) {
    return (
      <section className="section">
        <h2>🚨 Active alerts</h2>
        <p className="card-sub">No active alerts for this day — everything is on track.</p>
      </section>
    )
  }

  return (
    <section className="section">
      <h2>🚨 Active alerts</h2>
      <div className="card-list">
        {alerts.map((alert) => (
          <Card
            key={alert.id}
            title={alert.title}
            note={alert.why}
            meta={
              <span className="meta-group">
                <span className="meta-label">To respond</span>
                <PersonChip name={alert.whoShouldRespond?.split(' (')[0]} />
              </span>
            }
            status={alert.status}
            isSelected={alert.itemId === selectedItemId}
            onSelect={() => onSelect(alert.itemId)}
          />
        ))}
      </div>
    </section>
  )
}
