export default function Header() {
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
      <span className="role-badge">Viewing as: Family Coordinator</span>
    </header>
  )
}
