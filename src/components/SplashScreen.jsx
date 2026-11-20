import { useState } from 'react'

// Shown once per browser session before the app itself. The "Enter" button
// is the documented way in; clicking anywhere else on the backdrop also
// dismisses it as a convenience. The fade-out is driven by `dismissing` so
// the CSS transition can finish before SplashScreen unmounts.
export default function SplashScreen({ onDismiss }) {
  const [dismissing, setDismissing] = useState(false)

  function handleDismiss() {
    if (dismissing) return
    setDismissing(true)
    setTimeout(onDismiss, 300)
  }

  return (
    <div className={`splash-screen${dismissing ? ' is-dismissing' : ''}`} onClick={handleDismiss}>
      <span className="splash-blob splash-blob-pink" aria-hidden="true" />
      <span className="splash-blob splash-blob-sky" aria-hidden="true" />
      <span className="splash-blob splash-blob-lilac" aria-hidden="true" />
      <span className="splash-blob splash-blob-amber" aria-hidden="true" />

      <div className="splash-content">
        <img src="/icon.png" alt="" className="splash-icon" />
        <h1>CareShare</h1>
        <p>Keeping Margaret's care circle on the same page.</p>
        <button type="button" className="splash-enter-btn" onClick={handleDismiss}>
          Enter CareShare →
        </button>
      </div>
    </div>
  )
}
