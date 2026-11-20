// Turns raw OCR text from a medicine box / pharmacy label into a structured
// prescription record. Deterministic, rules-based extraction only — any field
// that can't be read confidently is returned as null so a human fills it in
// on the review screen (PRD: "keeping people — not AI — in control").

const NUMBER_WORDS = {
  half: 0.5,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  fourteen: 14,
  twenty: 20,
  thirty: 30,
}

// Pharmacy-label Latin abbreviations -> doses per day.
const FREQUENCY_ABBREVIATIONS = {
  od: 1,
  qd: 1,
  bd: 2,
  bid: 2,
  tds: 3,
  tid: 3,
  qds: 4,
  qid: 4,
}

// Canonical form -> words that indicate it on a label.
const FORMS = [
  ['capsule', ['capsules', 'capsule', 'caps']],
  ['tablet', ['tablets', 'tablet', 'tabs']],
  ['oral solution', ['oral solution']],
  ['suspension', ['suspension']],
  ['syrup', ['syrup']],
  ['liquid', ['liquid']],
  ['inhaler', ['inhaler', 'puffs', 'puff']],
  ['drops', ['drops', 'drop']],
  ['cream', ['cream']],
  ['ointment', ['ointment']],
  ['patch', ['patches', 'patch']],
  ['sachet', ['sachets', 'sachet']],
  ['injection', ['injection']],
]

// Common medicines, matched first so a known name wins over the heuristics.
const KNOWN_MEDICATIONS = [
  'Amoxicillin', 'Paracetamol', 'Ibuprofen', 'Aspirin', 'Metformin', 'Amlodipine',
  'Levothyroxine', 'Atorvastatin', 'Simvastatin', 'Omeprazole', 'Lansoprazole',
  'Ramipril', 'Lisinopril', 'Bisoprolol', 'Furosemide', 'Warfarin', 'Apixaban',
  'Clopidogrel', 'Sertraline', 'Citalopram', 'Codeine', 'Tramadol', 'Prednisolone',
  'Flucloxacillin', 'Clarithromycin', 'Doxycycline', 'Nitrofurantoin', 'Trimethoprim',
  'Cetirizine', 'Loratadine', 'Salbutamol', 'Gabapentin', 'Naproxen', 'Losartan',
  'Donepezil', 'Mirtazapine', 'Colecalciferol', 'Ferrous Sulfate', 'Folic Acid',
]

const STOPWORDS = new Set([
  'take', 'each', 'with', 'water', 'food', 'daily', 'times', 'every', 'hours', 'days',
  'keep', 'reach', 'sight', 'children', 'pharmacy', 'patient', 'name', 'date', 'dispensed',
  'prescription', 'only', 'medicine', 'warning', 'store', 'below', 'swallow', 'whole',
  'oral', 'film', 'coated', 'hard', 'boots', 'lloyds', 'well', 'rowlands', 'for', 'the',
  'and', 'use', 'read', 'leaflet', 'qty', 'quantity', 'mrs', 'miss', 'margaret',
  ...FORMS.flatMap(([, words]) => words),
])

const NUM = '(\\d+(?:\\.\\d+)?|' + Object.keys(NUMBER_WORDS).join('|') + ')'

function toNumber(token) {
  if (token == null) return null
  const lower = String(token).toLowerCase()
  if (lower in NUMBER_WORDS) return NUMBER_WORDS[lower]
  const n = Number(lower)
  return Number.isFinite(n) ? n : null
}

function titleCase(word) {
  return word
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// OCR commonly reads "O" for "0" and "l"/"I" for "1" inside numbers.
function normalise(text) {
  return text
    .replace(/[|]/g, 'I')
    .replace(/(\d)[oO](?=\d|\s*mg|\s*mcg|\s*ml)/g, '$10')
    .replace(/(\d)[oO][oO]/g, '$100')
    .replace(/\s+/g, ' ')
    .trim()
}

export function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseStrength(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|g|ml|iu|units?)\b(?:\s*\/\s*(\d+(?:\.\d+)?\s*ml))?/i)
  if (!match) return null
  let unit = match[2].toLowerCase()
  if (unit === 'ug' || unit === 'µg') unit = 'mcg'
  if (unit === 'ml') unit = 'mL'
  if (unit === 'iu') unit = 'IU'
  const per = match[3] ? `/${match[3].replace(/\s*ml$/i, ' mL')}` : ''
  return `${match[1]} ${unit}${per}`
}

function parseForm(text) {
  const lower = text.toLowerCase()
  let best = null
  for (const [canonical, words] of FORMS) {
    for (const word of words) {
      const idx = lower.search(new RegExp(`\\b${word}\\b`))
      if (idx !== -1 && (best === null || idx < best.idx)) best = { canonical, idx }
    }
  }
  return best ? best.canonical : null
}

function parseMedication(text) {
  for (const name of KNOWN_MEDICATIONS) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return name
  }
  // Labels almost always print the name right before the strength: "Xyz 500mg".
  const beforeStrength = text.match(/([A-Za-z][A-Za-z-]{3,})\s+\d+(?:\.\d+)?\s*(?:mg|mcg|µg|ug|g|ml|iu|units?)\b/i)
  if (beforeStrength && !STOPWORDS.has(beforeStrength[1].toLowerCase())) {
    return titleCase(beforeStrength[1])
  }
  const firstWord = text.match(/[A-Za-z][A-Za-z-]{4,}/g)?.find((w) => !STOPWORDS.has(w.toLowerCase()))
  return firstWord ? titleCase(firstWord) : null
}

function parseDose(text, form) {
  const match = text.match(
    new RegExp(`\\b(?:take|use|apply|inhale|give)\\s+${NUM}\\s*(?:x\\s*)?([a-z]+)?`, 'i')
  )
  if (!match) return null
  const quantity = toNumber(match[1])
  if (quantity == null) return null
  const unitWord = match[2]?.toLowerCase()
  const unitForm = unitWord && FORMS.find(([, words]) => words.includes(unitWord))?.[0]
  const unit = unitForm || (unitWord === 'ml' ? 'mL' : null) || form
  return { quantity, unit }
}

function parseFrequency(text) {
  const lower = text.toLowerCase()

  const timesMatch = lower.match(new RegExp(`${NUM}\\s*(?:x|times)\\s*(?:a|per|each)?\\s*(?:day|daily)`))
  if (timesMatch) return { type: 'times_per_day', count: toNumber(timesMatch[1]) }

  if (/\btwice\s+(?:a\s+|per\s+|each\s+)?(?:day|daily)\b/.test(lower)) return { type: 'times_per_day', count: 2 }
  if (/\bonce\s+(?:a\s+|per\s+|each\s+)?(?:day|daily)\b/.test(lower)) return { type: 'times_per_day', count: 1 }

  const hoursMatch = lower.match(new RegExp(`every\\s+${NUM}\\s*(?:hours?|hrs?)`))
  if (hoursMatch) {
    const hours = toNumber(hoursMatch[1])
    if (hours && 24 % hours === 0) return { type: 'times_per_day', count: 24 / hours }
  }

  for (const [abbr, count] of Object.entries(FREQUENCY_ABBREVIATIONS)) {
    if (new RegExp(`\\b${abbr}\\b`).test(lower)) return { type: 'times_per_day', count }
  }

  if (/\b(?:in the morning|at night|at bedtime|each morning|every morning|every night)\b/.test(lower)) {
    return { type: 'times_per_day', count: 1 }
  }
  if (/\bdaily\b/.test(lower)) return { type: 'times_per_day', count: 1 }
  return null
}

function parseDuration(text) {
  const lower = text.toLowerCase()
  const match = lower.match(new RegExp(`(?:for|x)\\s+${NUM}\\s*(days?|weeks?|months?)\\b`))
  if (!match) return null
  const n = toNumber(match[1])
  if (n == null) return null
  if (match[2].startsWith('week')) return n * 7
  if (match[2].startsWith('month')) return n * 28
  return n
}

export function parsePrescription(rawText, today = new Date()) {
  const text = normalise(rawText || '')
  const form = parseForm(text)
  return {
    medication: parseMedication(text),
    strength: parseStrength(text),
    form,
    dose: parseDose(text, form),
    frequency: parseFrequency(text),
    duration_days: parseDuration(text),
    start_date: toIsoDate(today),
  }
}

// Default dose times per day, spread across waking hours. A human can adjust
// individual doses afterwards by dragging them on the calendar.
const DOSE_TIMES = {
  1: [[8, 0]],
  2: [[8, 0], [20, 0]],
  3: [[8, 0], [14, 0], [20, 0]],
  4: [[8, 0], [12, 0], [16, 0], [20, 0]],
}

export function doseTimesFor(count) {
  if (DOSE_TIMES[count]) return DOSE_TIMES[count]
  const times = []
  const span = 14 * 60 // 08:00 -> 22:00
  for (let i = 0; i < count; i++) {
    const minutes = 8 * 60 + Math.round((span * i) / Math.max(count - 1, 1))
    times.push([Math.floor(minutes / 60), minutes % 60])
  }
  return times
}

// One-line human summary, e.g. "1 capsule, 3× a day for 5 days, with food".
export function describeSchedule(p) {
  return [
    p.dose?.quantity && p.dose?.unit ? `${p.dose.quantity} ${p.dose.unit}` : null,
    `${p.frequency.count}× a day for ${p.duration_days} ${p.duration_days === 1 ? 'day' : 'days'}`,
    p.instructions || null,
  ]
    .filter(Boolean)
    .join(', ')
}

// Expands a confirmed prescription into one calendar/checklist item per dose.
export function buildDoseItems(prescription, id, source = 'scan') {
  const [y, m, d] = prescription.start_date.split('-').map(Number)
  const times = doseTimesFor(prescription.frequency.count)
  const name = [prescription.medication, prescription.strength].filter(Boolean).join(' ')
  const schedule = describeSchedule(prescription)
  const why = source === 'scan' ? 'Added from a scanned medicine label.' : 'Added manually by the care circle.'
  const items = []

  for (let day = 0; day < prescription.duration_days; day++) {
    times.forEach(([hh, mm], doseIdx) => {
      const start = new Date(y, m - 1, d + day, hh, mm, 0, 0)
      items.push({
        id: `med-${id}-${day}-${doseIdx}`,
        kind: 'medication',
        prescriptionId: id,
        name,
        title: name,
        schedule,
        reminderTime: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
        start,
        end: new Date(start.getTime() + 15 * 60 * 1000),
        status: 'due',
        updatedBy: null,
        updatedAt: null,
        why,
        editable: false,
      })
    })
  }
  return items
}

export function missingFields(p) {
  const missing = []
  if (!p.medication) missing.push('medication')
  if (!p.strength) missing.push('strength')
  if (!p.form) missing.push('form')
  if (!p.dose?.quantity || !p.dose?.unit) missing.push('dose')
  if (!p.frequency?.count || p.frequency.count < 1) missing.push('frequency')
  if (!p.duration_days || p.duration_days < 1) missing.push('duration_days')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.start_date || '')) missing.push('start_date')
  return missing
}
