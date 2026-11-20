export default function Header({ onScanMedicine, onAddMedication }) {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <header className="app-header">
      <div className="brand">
        <img src="/icon.png" alt="" />
        <div>
          <h1>CareShare</h1>
          <p className="subtitle">Margaret's care today · {today}</p>
        </div>
      </div>
      <div className="header-actions">
        <button type="button" className="btn scan-btn" onClick={onAddMedication}>
          ➕ Add medication
        </button>
        <button type="button" className="btn scan-btn" onClick={onScanMedicine}>
          📷 Scan medicine
        </button>
        <span className="role-badge">Viewing as: Family Coordinator</span>
      </div>
    </header>
  )
}
