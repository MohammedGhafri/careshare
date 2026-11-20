import Card from './Card.jsx'

function formatTime(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function VisitsSection({ visits, gcalEvents, selectedItemId, onSelect }) {
  return (
    <section className="section">
      <h2>📅 Visits &amp; check-ins</h2>
      <div className="card-list">
        {visits.map((visit) => (
          <Card
            key={visit.id}
            id={visit.id}
            title={`${visit.type} — ${visit.assignedTo}`}
            subtitle={`${formatTime(visit.start)} – ${formatTime(visit.end)}`}
            status={visit.status}
            isSelected={visit.id === selectedItemId}
            onSelect={() => onSelect(visit.id)}
          />
        ))}

        {gcalEvents.map((event) => {
          const fcId = `gcal-${event.id}`
          return (
            <Card
              key={event.id}
              id={fcId}
              title={event.title}
              subtitle={`${formatTime(event.start)} – ${formatTime(event.end)}`}
              status="scheduled"
              tag="From Google Calendar"
              isSelected={fcId === selectedItemId}
              onSelect={() => onSelect(fcId)}
            />
          )
        })}

        {visits.length === 0 && gcalEvents.length === 0 && (
          <p className="card-sub">No visits or check-ins scheduled for this day.</p>
        )}
      </div>
    </section>
  )
}
