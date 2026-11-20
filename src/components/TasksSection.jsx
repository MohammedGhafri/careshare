import Card from './Card.jsx'

export default function TasksSection({ tasks, selectedItemId, onSelect }) {
  return (
    <section className="section">
      <h2>📋 Outstanding tasks</h2>
      <div className="card-list">
        {tasks.map((task) => (
          <Card
            key={task.id}
            id={task.id}
            title={task.title}
            subtitle={`Assigned to ${task.assignedTo} · Due ${task.due}`}
            status={task.status}
            isSelected={task.id === selectedItemId}
            onSelect={() => onSelect(task.id)}
          />
        ))}
        {tasks.length === 0 && <p className="card-sub">No tasks due this day.</p>}
      </div>
    </section>
  )
}
