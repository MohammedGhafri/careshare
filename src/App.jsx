import { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import SafetyBanner from './components/SafetyBanner.jsx'
import CalendarConnect from './components/CalendarConnect.jsx'
import SyncStatus from './components/SyncStatus.jsx'
import CalendarView from './components/CalendarView.jsx'
import ChecklistPanel from './components/ChecklistPanel.jsx'
import DetailSheet from './components/DetailSheet.jsx'
import ScanMedicationSheet from './components/ScanMedicationSheet.jsx'
import AddMedicationSheet from './components/AddMedicationSheet.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import { CareProvider, useCareState, useCareDispatch, useSelectedItem } from './state/CareContext.jsx'
import { supportedPerson, careCircle, weekStartDate } from './data/mockData.js'
import { deriveAlerts } from './lib/rules.js'
import { buildWeeklySummary, startOfWeek } from './lib/weeklySummary.js'
import { downloadSummaryPdf } from './lib/downloadSummaryPdf.js'
import {
  isConfigured,
  isSignedIn,
  signIn,
  listEvents,
  addEvent,
  templateLink,
} from './lib/googleCalendar.js'

function AppShell() {
  const { items, selectedItemId, activity, gcalEvents } = useCareState()
  const dispatch = useCareDispatch()
  const selectedItem = useSelectedItem()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [addMedOpen, setAddMedOpen] = useState(false)
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarError, setCalendarError] = useState(null)
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [calendarMessage, setCalendarMessage] = useState(null)
  const [visibleStart, setVisibleStart] = useState(weekStartDate)
  const [summaryBusy, setSummaryBusy] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  // Opening an item from the calendar should surface the linked checklist
  // entry — on mobile this is the drawer; on desktop it's just a no-op
  // because the panel is already visible inline.
  useEffect(() => {
    if (selectedItemId) setDrawerOpen(true)
  }, [selectedItemId])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const outstandingCount = deriveAlerts(items).length

  async function handleConnectCalendar() {
    setCalendarLoading(true)
    setCalendarError(null)
    try {
      await signIn()
      setCalendarConnected(true)
      const weekEnd = new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000)
      const events = await listEvents(weekStartDate, weekEnd)
      dispatch({ type: 'SET_GCAL_EVENTS', events })
    } catch (err) {
      setCalendarError(err.message || 'Something went wrong')
    } finally {
      setCalendarLoading(false)
    }
  }

  async function handleRangeChange(start, end) {
    setVisibleStart(start)
    if (!isConfigured() || !isSignedIn()) return
    try {
      const events = await listEvents(start, end)
      dispatch({ type: 'SET_GCAL_EVENTS', events })
    } catch (err) {
      setCalendarError(err.message || 'Could not refresh Google Calendar events')
    }
  }

  async function handleGenerateSummary() {
    setSummaryBusy(true)
    setSummaryError(null)
    try {
      const weekStart = startOfWeek(visibleStart)
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

      let gcalEventsForWeek = gcalEvents
      if (isConfigured() && isSignedIn()) {
        try {
          gcalEventsForWeek = await listEvents(weekStart, weekEnd)
        } catch {
          // Fall back to whatever's already in state rather than failing
          // the whole summary over a Google refresh error.
        }
      }

      const summary = buildWeeklySummary({
        items,
        activity,
        gcalEvents: gcalEventsForWeek,
        weekStart,
        person: supportedPerson,
        careCircle,
      })
      await downloadSummaryPdf(summary)
    } catch (err) {
      setSummaryError(err.message || 'Could not generate the summary')
    } finally {
      setSummaryBusy(false)
    }
  }

  async function handleAddToCalendar(item) {
    const payload = {
      title: item.name || item.title,
      description: item.kind === 'medication' ? `CareShare medication reminder — ${item.schedule}` : 'CareShare event',
      start: item.start,
      end: item.end,
    }

    if (isConfigured() && isSignedIn()) {
      setCalendarBusy(true)
      setCalendarMessage(null)
      try {
        await addEvent(payload)
        setCalendarMessage('Added to your Google Calendar.')
      } catch (err) {
        setCalendarMessage(`Could not add to calendar: ${err.message}`)
      } finally {
        setCalendarBusy(false)
      }
      return
    }

    window.open(templateLink(payload), '_blank', 'noopener')
    setCalendarMessage('Opened Google Calendar in a new tab.')
  }

  function closeDetail() {
    dispatch({ type: 'CLOSE_DETAIL' })
    setCalendarMessage(null)
  }

  function closeDrawer() {
    setDrawerOpen(false)
  }

  return (
    <div className="app">
      <Header
        onScanMedicine={() => setScanOpen(true)}
        onAddMedication={() => setAddMedOpen(true)}
        onGenerateSummary={handleGenerateSummary}
        summaryBusy={summaryBusy}
        summaryError={summaryError}
      />
      <SafetyBanner />

      <CalendarConnect
        connected={calendarConnected}
        loading={calendarLoading}
        error={calendarError}
        onConnect={handleConnectCalendar}
      />
      <SyncStatus />

      <div className="layout">
        <CalendarView onRangeChange={handleRangeChange} />

        <div className={`checklist-drawer-wrap${drawerOpen ? ' is-open' : ''}`}>
          <div className="drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />
          <div className="checklist-drawer">
            <ChecklistPanel onClose={closeDrawer} />
          </div>
        </div>
      </div>

      <button type="button" className="floating-checklist-btn" onClick={() => setDrawerOpen(true)}>
        📋 Checklist{outstandingCount > 0 ? ` (${outstandingCount} need attention)` : ''}
      </button>

      <DetailSheet
        item={selectedItem}
        onClose={closeDetail}
        onAddToCalendar={handleAddToCalendar}
        calendarBusy={calendarBusy}
        calendarMessage={calendarMessage}
      />

      <ScanMedicationSheet open={scanOpen} onClose={() => setScanOpen(false)} />
      <AddMedicationSheet open={addMedOpen} onClose={() => setAddMedOpen(false)} />
    </div>
  )
}

const SPLASH_SEEN_KEY = 'careshare-splash-seen'

function hasSeenSplash() {
  try {
    return sessionStorage.getItem(SPLASH_SEEN_KEY) === 'true'
  } catch {
    return false
  }
}

export default function App() {
  const [splashVisible, setSplashVisible] = useState(!hasSeenSplash())

  function dismissSplash() {
    try {
      sessionStorage.setItem(SPLASH_SEEN_KEY, 'true')
    } catch {
      // Private browsing etc. — just skip persisting, splash will show again.
    }
    setSplashVisible(false)
  }

  return (
    <CareProvider>
      <AppShell />
      {splashVisible && <SplashScreen onDismiss={dismissSplash} />}
    </CareProvider>
  )
}
