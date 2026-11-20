import Card from './Card.jsx'
import { PersonChip, TimeChip } from './CardMeta.jsx'
import { clock, relativeTime, useNow } from '../lib/cardMeta.js'

export default function TasksSection({ tasks, selectedItemId, onSelect }) {
  const now = useNow()
  return (
    <section className="section">
      <h2>📋 Outstanding tasks</h2>
      <div className="card-list">
        {tasks.map((task) => (
          <Card
            key={task.id}
            id={task.id}
            title={task.title}
            meta={
              <>
                <PersonChip name={task.assignedTo} />
                <TimeChip time={clock(task.start)} relative={relativeTime(task.start, task.status, now)} />
              </>
            }
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
