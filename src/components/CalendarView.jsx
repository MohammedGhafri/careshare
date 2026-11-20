import { useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { getStatus, TONE_COLORS } from '../lib/status.js'
import { useCareDispatch, useCareState } from '../state/CareContext.jsx'
import { useMediaQuery, MOBILE_QUERY } from '../lib/useMediaQuery.js'

// Swipe must be mostly-horizontal and clear this many pixels to count as a
// deliberate "change day/week" gesture rather than a vertical scroll of the
// time grid.
const SWIPE_THRESHOLD_PX = 60

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function toFcId(item) {
  return item.kind === 'google' ? `gcal-${item.id}` : item.id
}

// TONE_COLORS lives in lib/status.js so WeeklySummaryPdf can reuse the same
// mapping — set directly on each FullCalendar event (not just via CSS
// classes) so the colours always win regardless of FullCalendar's defaults.

// Day/Week calendar built on FullCalendar, sharing state with ChecklistPanel
// via CareContext so selecting, updating or rescheduling an item in either
// view is immediately reflected in the other.
export default function CalendarView({ onRangeChange }) {
  const { items, gcalEvents, selectedItemId, selectedDate } = useCareState()
  const dispatch = useCareDispatch()
  const calendarRef = useRef(null)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const touchStart = useRef(null)

  // Switch view when crossing the mobile breakpoint (rotation, resizing the
  // window) rather than only on mount — initialView alone won't react to that.
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    const nextView = isMobile ? 'timeGridDay' : 'timeGridWeek'
    if (api.view.type !== nextView) api.changeView(nextView, selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile])

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
    dispatch({
      type: 'RESCHEDULE',
      id: info.event.id,
      start: info.event.start,
      end: info.event.end,
    })
  }

  // Tapping a day-of-week header in mobile Week view jumps straight to that
  // day's Day view — the main way to browse a whole week on a phone.
  function handleNavLinkDayClick(date) {
    calendarRef.current?.getApi().changeView('timeGridDay', date)
    dispatch({ type: 'SELECT_DATE', date: startOfDay(date) })
  }

  // Swipe left/right over the grid moves to the next/previous day (or week,
  // in desktop's Week view). Ignores touches starting on an event so
  // long-press drag-to-reschedule still works, and ignores mostly-vertical
  // swipes so scrolling the time grid isn't hijacked.
  function handleTouchStart(e) {
    if (e.touches.length !== 1) return
    if (e.target.closest('.fc-event')) {
      touchStart.current = null
      return
    }
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(e) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return
    const api = calendarRef.current?.getApi()
    if (!api) return
    if (dx < 0) api.next()
    else api.prev()
  }

  return (
    <div className="calendar-view" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
        initialDate={selectedDate}
        headerToolbar={
          isMobile
            ? { left: 'prev,next', center: 'title', right: 'goToday timeGridDay,timeGridWeek' }
            : { left: 'prev,next goToday', center: 'title', right: 'timeGridDay,timeGridWeek' }
        }
        titleFormat={isMobile ? { day: 'numeric', month: 'short' } : undefined}
        navLinks={isMobile}
        navLinkDayClick={handleNavLinkDayClick}
        // Named `goToday`, not `today` — FullCalendar hard-codes the built-in
        // "today" button name to auto-disable whenever its visible range
        // already contains the current date, even when it's a customButtons
        // override. Our checklist's "selected day" is separate state that
        // FullCalendar doesn't know about, so e.g. picking another day in the
        // same week left the button permanently disabled. Any other name
        // sidesteps that disabling logic.
        customButtons={{
          goToday: {
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
        expandRows={!isMobile}
        allDaySlot={false}
        locale="en-gb"
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotLabelFormat={
          isMobile ? { hour: '2-digit', hour12: false } : { hour: '2-digit', minute: '2-digit', hour12: false }
        }
        dayHeaderFormat={isMobile ? { weekday: 'narrow', day: 'numeric' } : undefined}
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
          // Mobile Week view is tight on space — show just the icon and
          // title there; assignee and the "Google" tag still show in Day
          // view (mobile or desktop) and desktop Week view.
          const isCramped = isMobile && isWeek
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
              {!isCramped && arg.event.extendedProps.isGcal && <span className="gcal-tag">Google</span>}
            </div>
          )
        }}
      />
    </div>
  )
}
