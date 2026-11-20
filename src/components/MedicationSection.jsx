import Card from './Card.jsx'

export default function MedicationSection({ medications, selectedItemId, onSelect }) {
  return (
    <section className="section">
      <h2>💊 Medication due today</h2>
      <div className="card-list">
        {medications.map((med) => (
          <Card
            key={med.id}
            id={med.id}
            title={med.name}
            subtitle={`Reminder ${med.reminderTime} · ${med.schedule}`}
            status={med.status}
            isSelected={med.id === selectedItemId}
            onSelect={() => onSelect(med.id)}
          />
        ))}
        {medications.length === 0 && <p className="card-sub">No medication scheduled for this day.</p>}
      </div>
    </section>
  )
}
