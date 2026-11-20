import { isConfigured } from '../lib/googleCalendar.js'

export default function CalendarConnect({ connected, loading, error, onConnect }) {
  if (!isConfigured()) {
    return (
      <div className="calendar-connect">
        <span className="note">
          📅 Demo mode — Google Calendar sign-in isn't configured. Visits still
          offer an "Add to Google Calendar" link. See README.md to connect a
          real account.
        </span>
      </div>
    )
  }

  if (connected) {
    return (
      <div className="calendar-connect">
        <span className="note">✅ Google Calendar connected — today's events are included below.</span>
      </div>
    )
  }

  return (
    <div className="calendar-connect">
      <span className="note">
        {error ? `Couldn't connect: ${error}` : "Connect Google Calendar to see today's events here too."}
      </span>
      <button type="button" className="btn btn-primary" onClick={onConnect} disabled={loading}>
        {loading ? 'Connecting…' : 'Connect Google Calendar'}
      </button>
    </div>
  )
}
