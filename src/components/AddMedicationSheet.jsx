import { useEffect, useState } from 'react'
import { useCareDispatch } from '../state/CareContext.jsx'
import { describeSchedule, doseTimesFor, toIsoDate } from '../lib/prescriptionParser.js'

const ACTING_AS = 'Sarah'
const TIMES_PER_DAY = [1, 2, 3, 4, 5, 6]
const INSTRUCTION_SUGGESTIONS = ['with food', 'before food', 'after food', 'with a glass of water', 'at bedtime', 'swallow whole']

const emptyDraft = () => ({
  name: '',
  dose: '',
  timesPerDay: '1',
  days: '',
  startDate: toIsoDate(new Date()),
  instructions: '',
})

function toPrescription(d) {
  return {
    medication: d.name.trim(),
    strength: d.dose.trim(),
    form: null,
    dose: null,
    frequency: { type: 'times_per_day', count: Number(d.timesPerDay) },
    duration_days: Number(d.days),
    start_date: d.startDate,
    instructions: d.instructions.trim() || null,
  }
}

function validate(d) {
  const errors = {}
  if (!d.name.trim()) errors.name = 'Enter the name of the medication.'
  if (!d.dose.trim()) errors.dose = 'Enter the dose, for example 500 mg.'
  const days = Number(d.days)
  if (!Number.isInteger(days) || days < 1 || days > 365) errors.days = 'Enter a number of days between 1 and 365.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startDate)) errors.startDate = 'Choose a start date.'
  return errors
}

const formatTimes = (count) =>
  doseTimesFor(count)
    .map(([hh, mm]) => `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
    .join(', ')

export default function AddMedicationSheet({ open, onClose }) {
  const dispatch = useCareDispatch()
  const [draft, setDraft] = useState(emptyDraft)
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState(null)

  function reset() {
    setDraft(emptyDraft())
    setSubmitted(false)
    setSaved(null)
  }

  useEffect(() => {
    if (!open) reset()
  }, [open])

  if (!open) return null

  const errors = validate(draft)
  const showError = (key) => submitted && errors[key]

  function update(field) {
    return (e) => setDraft((d) => ({ ...d, [field]: e.target.value }))
  }

  function save(e) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length) return
    const prescription = toPrescription(draft)
    dispatch({ type: 'REGISTER_PRESCRIPTION', prescription, source: 'manual', who: ACTING_AS })
    setSaved(prescription)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet scan-sheet" role="dialog" aria-modal="true" aria-label="Add medication" onClick={(e) => e.stopPropagation()}>
        <p className="card-sub" style={{ margin: 0 }}>Medication</p>
        <h2>➕ Add medication</h2>

        {!saved && (
          <form onSubmit={save} noValidate>
            <div className="scan-grid">
              <label className="scan-field scan-wide">
                <span className="field-label">Name of the medication</span>
                <input
                  className={`input${showError('name') ? ' is-missing' : ''}`}
                  value={draft.name}
                  onChange={update('name')}
                  placeholder="e.g. Amoxicillin"
                  aria-invalid={!!showError('name')}
                  autoFocus
                />
                {showError('name') && <span className="field-error">{errors.name}</span>}
              </label>

              <label className="scan-field scan-wide">
                <span className="field-label">Dose</span>
                <input
                  className={`input${showError('dose') ? ' is-missing' : ''}`}
                  value={draft.dose}
                  onChange={update('dose')}
                  placeholder="e.g. 500 mg"
                  aria-invalid={!!showError('dose')}
                />
                {showError('dose') && <span className="field-error">{errors.dose}</span>}
              </label>
            </div>

            <fieldset className="add-med-fieldset">
              <legend>How to take</legend>
              <div className="scan-grid">
                <label className="scan-field">
                  <span className="field-label">Times per day</span>
                  <select className="input" value={draft.timesPerDay} onChange={update('timesPerDay')}>
                    {TIMES_PER_DAY.map((n) => (
                      <option key={n} value={n}>{n === 1 ? 'Once a day' : n === 2 ? 'Twice a day' : `${n} times a day`}</option>
                    ))}
                  </select>
                </label>

                <label className="scan-field">
                  <span className="field-label">For how many days</span>
                  <input
                    className={`input${showError('days') ? ' is-missing' : ''}`}
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    inputMode="numeric"
                    value={draft.days}
                    onChange={update('days')}
                    placeholder="e.g. 5"
                    aria-invalid={!!showError('days')}
                  />
                  {showError('days') && <span className="field-error">{errors.days}</span>}
                </label>

                <p className="card-sub scan-wide" style={{ margin: '6px 0 0' }}>
                  Reminders at {formatTimes(Number(draft.timesPerDay))} — you can drag any dose on the calendar to change its time.
                </p>

                <label className="scan-field scan-wide">
                  <span className="field-label">Start date</span>
                  <input
                    className={`input${showError('startDate') ? ' is-missing' : ''}`}
                    type="date"
                    value={draft.startDate}
                    onChange={update('startDate')}
                    aria-invalid={!!showError('startDate')}
                  />
                  {showError('startDate') && <span className="field-error">{errors.startDate}</span>}
                </label>

                <label className="scan-field scan-wide">
                  <span className="field-label">Instructions (optional)</span>
                  <input
                    className="input"
                    value={draft.instructions}
                    onChange={update('instructions')}
                    list="add-med-instructions"
                    placeholder="e.g. with food"
                  />
                </label>
              </div>
              <datalist id="add-med-instructions">
                {INSTRUCTION_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </fieldset>

            <p className="safety-banner" style={{ fontSize: 13 }}>
              Enter the details exactly as prescribed. CareShare does not provide medical advice —
              always follow the prescriber's and pharmacist's instructions.
            </p>

            <div className="sheet-actions">
              <button type="submit" className="btn btn-primary">✅ Add medication</button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}

        {saved && (
          <div aria-live="polite">
            <p>
              ✅ <strong>{saved.medication} {saved.strength}</strong> added — {describeSchedule(saved)}.{' '}
              {saved.frequency.count * saved.duration_days}{' '}
              {saved.frequency.count * saved.duration_days === 1 ? 'dose' : 'doses'} added to the calendar from{' '}
              {new Date(`${saved.start_date}T00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.
            </p>
            <pre className="scan-json">{JSON.stringify(saved, null, 2)}</pre>
            <div className="sheet-actions">
              <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
              <button type="button" className="btn btn-secondary" onClick={reset}>Add another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
