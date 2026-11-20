import { describe, expect, it } from 'vitest'
import { buildDoseItems, describeSchedule, missingFields, parsePrescription } from './prescriptionParser.js'

const TODAY = new Date(2026, 10, 20)

describe('parsePrescription', () => {
  it('reads a typical UK pharmacy label into the prescription record', () => {
    const text = `AMOXICILLIN 500MG CAPSULES
      Take ONE capsule THREE times a day for 5 days
      Mrs Margaret Smith   21 capsules   20/11/26`
    expect(parsePrescription(text, TODAY)).toEqual({
      medication: 'Amoxicillin',
      strength: '500 mg',
      form: 'capsule',
      dose: { quantity: 1, unit: 'capsule' },
      frequency: { type: 'times_per_day', count: 3 },
      duration_days: 5,
      start_date: '2026-11-20',
    })
  })

  it('handles abbreviations, OCR digit errors, weeks and unknown drug names', () => {
    const result = parsePrescription('Zentrocil 25O mg tablets\nTake 2 tablets BD for 2 weeks', TODAY)
    expect(result).toMatchObject({
      medication: 'Zentrocil',
      strength: '250 mg',
      form: 'tablet',
      dose: { quantity: 2, unit: 'tablet' },
      frequency: { count: 2 },
      duration_days: 14,
    })
  })

  it('converts "every N hours" into doses per day and reads liquid strengths', () => {
    const result = parsePrescription('Paracetamol 250mg/5ml oral suspension. Take 5ml every 6 hours for 3 days', TODAY)
    expect(result.strength).toBe('250 mg/5 mL')
    expect(result.dose).toEqual({ quantity: 5, unit: 'mL' })
    expect(result.frequency).toEqual({ type: 'times_per_day', count: 4 })
  })

  it('returns null for anything it cannot read, so the user is asked', () => {
    const result = parsePrescription('blurry nonsense', TODAY)
    expect(missingFields(result)).toEqual(['strength', 'form', 'dose', 'frequency', 'duration_days'])
  })
})

describe('buildDoseItems', () => {
  it('creates one due medication item per dose across the course', () => {
    const items = buildDoseItems(
      {
        medication: 'Amoxicillin',
        strength: '500 mg',
        form: 'capsule',
        dose: { quantity: 1, unit: 'capsule' },
        frequency: { type: 'times_per_day', count: 3 },
        duration_days: 5,
        start_date: '2026-11-20',
      },
      'rx1'
    )
    expect(items).toHaveLength(15)
    expect(items.map((i) => i.reminderTime).slice(0, 3)).toEqual(['08:00', '14:00', '20:00'])
    expect(items[0].start).toEqual(new Date(2026, 10, 20, 8, 0))
    expect(items[14].start).toEqual(new Date(2026, 10, 24, 20, 0))
    expect(items.every((i) => i.kind === 'medication' && i.status === 'due')).toBe(true)
  })

  it('handles manually added records with no per-dose amount but with instructions', () => {
    const manual = {
      medication: 'Paracetamol',
      strength: '500 mg',
      form: null,
      dose: null,
      frequency: { type: 'times_per_day', count: 2 },
      duration_days: 1,
      start_date: '2026-11-20',
      instructions: 'with food',
    }
    expect(describeSchedule(manual)).toBe('2× a day for 1 day, with food')
    const items = buildDoseItems(manual, 'rx2', 'manual')
    expect(items.map((i) => [i.name, i.reminderTime])).toEqual([
      ['Paracetamol 500 mg', '08:00'],
      ['Paracetamol 500 mg', '20:00'],
    ])
    expect(items[0].why).toBe('Added manually by the care circle.')
  })
})
