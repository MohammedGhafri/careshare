import { useEffect, useState } from 'react'
import { careCircle } from '../data/mockData.js'
import { getStatus } from './status.js'

// One consistent colour per care-circle member (Design.txt accent palette),
// so people are recognisable at a glance across every card.
const PERSON_COLORS = {
  sarah: { bg: '#EDE9FE', fg: '#6D28D9' },
  priya: { bg: '#FCE7F3', fg: '#BE185D' },
  tom: { bg: '#FEF3C7', fg: '#B45309' },
}
const FALLBACK = { bg: '#E0F2FE', fg: '#0369A1' }

export function person(name) {
  const member = careCircle.find((m) => m.name === name)
  return {
    name,
    initial: name?.charAt(0).toUpperCase() ?? '?',
    role: member?.role,
    ...(PERSON_COLORS[member?.id] || FALLBACK),
  }
}

export const clock = (date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// "in 2 h", "in 25 min", "now", "45 min ago" — only for today's open items;
// for anything done or on another day the clock time alone is clearer.
export function relativeTime(date, status, now = new Date()) {
  if (!date || !sameDay(date, now) || getStatus(status).tone === 'complete') return null
  const mins = Math.round((date - now) / 60000)
  const abs = Math.abs(mins)
  if (abs < 2) return 'now'
  const span = abs < 60 ? `${abs} min` : `${Math.round(abs / 60)} h`
  return mins > 0 ? `in ${span}` : `${span} ago`
}

export function duration(start, end) {
  const mins = Math.round((end - start) / 60000)
  if (!(mins > 0)) return null
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}`
}

// Re-renders once a minute so "in 25 min" countdowns stay accurate.
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
