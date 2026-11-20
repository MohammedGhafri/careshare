import { useEffect, useState } from 'react'

// Phones only — matches the `min-width: 640px` breakpoint already used in
// styles.css for the detail sheet, kept in one place so CSS and JS agree.
export const MOBILE_QUERY = '(max-width: 639px)'

// Tracks a CSS media query from React so components can switch behaviour
// (not just styling) on viewport changes — e.g. CalendarView's default
// FullCalendar view. No equivalent hook existed in the codebase.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
