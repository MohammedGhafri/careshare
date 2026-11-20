// Date helpers shared across the app. Used to live in src/data/mockData.js
// alongside the mock data generation — now that data comes from the
// CareShare API (src/lib/api.js), these are the only bits of that file
// still needed client-side.

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 Sun .. 6 Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diffToMonday)
  d.setHours(0, 0, 0, 0)
  return d
}

// "Today" and "this week" as the app first loaded — stable for the life of
// the session rather than recomputed on every call, matching how mockData.js
// used to behave (a `const today = new Date()` at module load).
export const todayDate = new Date()
export const weekStartDate = startOfWeek(todayDate)
