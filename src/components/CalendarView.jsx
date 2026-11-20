import { useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { getStatus } from '../lib/status.js'
import { useCareActions, useCareDispatch, useCareState } from '../state/CareContext.jsx'

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function toFcId(item) {
  return item.kind === 'google' ? `gcal-${item.id}` : item.id
}

// Matches StatusPill's tone colours (src/lib/status.js + styles.css) — set
// directly on each FullCalendar event (not just via CSS classes) so the
// colours always win regardless of FullCalendar's own default event styles.
const TONE_COLORS = {
  complete: { bg: '#DCFCE7', border: '#22C55E', text: '#15803D' },
  normal: { bg: '#DBEAFE', border: '#3B82F6', text: '#1D4ED8' },
  attention: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  urgent: { bg: '#FEE2E2', border: '#EF4444', text: '#B91C1C' },
}

// Day/Week calendar built on FullCalendar, sharing state with ChecklistPanel
// via CareContext so selecting, updating or rescheduling an item in either
// view is immediately reflected in the other.
export default function CalendarView({ onRangeChange }) {
  const { items, gcalEvents, selectedItemId, selectedDate } = useCareState()
  const dispatch = useCareDispatch()
  const { reschedule } = useCareActions()
  const calendarRef = useRef(null)

  const events = [...items, ...gcalEvents].map((item) => {
    const id = toFcId(item)
    const { tone, icon } = getStatus(item.status)
    const colors = TONE_COLORS[tone] || TONE_COLORS.normal
    const classNames = [`tone-${tone}`]
    if (item.kind === 'google') classNames.push('is-gcal')
    if (id === selectedItemId) classNames.push('is-selected')

    return {
      id,
      title: item.name || item.title,
      start: item.start,
      end: item.end,
      editable: item.editable === true,
      classNames,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      textColor: colors.text,
      extendedProps: {
        icon,
        assignedTo: item.assignedTo,
        isGcal: item.kind === 'google',
      },
    }
  })

  function handleEventClick(info) {
    dispatch({ type: 'SELECT_ITEM', id: info.event.id })
  }

  function handleDateClick(info) {
    dispatch({ type: 'SELECT_DATE', date: startOfDay(info.date) })
  }

  function handleDatesSet(arg) {
    if (arg.view.type === 'timeGridDay') {
      dispatch({ type: 'SELECT_DATE', date: startOfDay(arg.view.currentStart) })
    }
    onRangeChange?.(arg.start, arg.end)
  }

  function handleEventDrop(info) {
    reschedule(info.event.id, { start: info.event.start, end: info.event.end, who: 'Sarah' })
  }

  return (
    <div className="calendar-view">
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        initialDate={selectedDate}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridDay,timeGridWeek',
        }}
        customButtons={{
          today: {
            text: 'Today',
            click: () => {
              calendarRef.current?.getApi().today()
              dispatch({ type: 'SELECT_DATE', date: startOfDay(new Date()) })
            },
          },
        }}
        firstDay={1}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        slotDuration="01:00:00"
        scrollTime="07:00:00"
        scrollTimeReset={false}
        slotEventOverlap={false}
        nowIndicator
        height="100%"
        expandRows
        allDaySlot={false}
        locale="en-gb"
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        events={events}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        datesSet={handleDatesSet}
        eventDrop={handleEventDrop}
        eventResize={handleEventDrop}
        dayCellClassNames={(arg) =>
          startOfDay(arg.date).getTime() === startOfDay(selectedDate).getTime() ? ['is-selected-day'] : []
        }
        dayHeaderClassNames={(arg) =>
          startOfDay(arg.date).getTime() === startOfDay(selectedDate).getTime() ? ['is-selected-day'] : []
        }
        eventContent={(arg) => {
          const isWeek = arg.view.type === 'timeGridWeek'
          return (
            <div
              className="fc-event-main-custom"
              title={`${arg.event.title}${arg.event.extendedProps.assignedTo ? ' · ' + arg.event.extendedProps.assignedTo : ''}`}
            >
              <span aria-hidden="true">{arg.event.extendedProps.icon}</span>{' '}
              <span className="fc-event-title-custom">{arg.event.title}</span>
              {!isWeek && arg.event.extendedProps.assignedTo && (
                <span className="fc-event-assignee"> · {arg.event.extendedProps.assignedTo}</span>
              )}
              {arg.event.extendedProps.isGcal && <span className="gcal-tag">Google</span>}
            </div>
          )
        }}
      />
    </div>
  )
}
