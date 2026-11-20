import { useCareState } from '../state/CareContext.jsx'

export default function SyncStatus() {
  const { sync } = useCareState()
  if (sync.mode === 'loading' && !sync.error) return null

  return (
    <div className={`calendar-connect sync-status${sync.error ? ' has-error' : ''}`} role={sync.error ? 'alert' : 'status'}>
      <span className="note">
        {sync.error
          ? `⚠️ ${sync.error}`
          : sync.mode === 'database'
            ? '💾 Saved to the database — medication you add or scan, and every status, note and time change, is kept for the whole care circle.'
            : "💾 Demo mode — no database connected. Changes are kept until you refresh. See README.md to connect Neon."}
      </span>
    </div>
  )
}
