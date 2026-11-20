import Card from './Card.jsx'
import { DetailChip, PersonChip, TimeChip } from './CardMeta.jsx'
import { clock, duration, relativeTime, useNow } from '../lib/cardMeta.js'

const toDate = (value) => (value instanceof Date ? value : new Date(value))

export default function VisitsSection({ visits, gcalEvents, selectedItemId, onSelect }) {
  const now = useNow()
  return (
    <section className="section">
      <h2>📅 Visits &amp; check-ins</h2>
      <div className="card-list">
        {visits.map((visit) => (
          <Card
            key={visit.id}
            id={visit.id}
            title={visit.type}
            meta={
              <>
                <PersonChip name={visit.assignedTo} />
                <TimeChip
                  time={`${clock(visit.start)}–${clock(visit.end)}`}
                  relative={relativeTime(visit.start, visit.status, now)}
                />
                <DetailChip icon="⏳">{duration(visit.start, visit.end)}</DetailChip>
              </>
            }
            status={visit.status}
            isSelected={visit.id === selectedItemId}
            onSelect={() => onSelect(visit.id)}
          />
        ))}

        {gcalEvents.map((event) => {
          const fcId = `gcal-${event.id}`
          const start = toDate(event.start)
          const end = toDate(event.end)
          const valid = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
          return (
            <Card
              key={event.id}
              id={fcId}
              title={event.title}
              meta={
                valid && (
                  <>
                    <TimeChip time={`${clock(start)}–${clock(end)}`} relative={relativeTime(start, 'scheduled', now)} />
                    <DetailChip icon="⏳">{duration(start, end)}</DetailChip>
                  </>
                )
              }
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
