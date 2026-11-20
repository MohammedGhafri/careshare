import { useEffect, useRef, useState } from 'react'
import { useCareDispatch } from '../state/CareContext.jsx'
import { missingFields, parsePrescription, toIsoDate } from '../lib/prescriptionParser.js'

const ACTING_AS = 'Sarah'

const FORM_OPTIONS = ['capsule', 'tablet', 'oral solution', 'suspension', 'syrup', 'liquid', 'inhaler', 'drops', 'cream', 'ointment', 'patch', 'sachet', 'injection']
const UNIT_OPTIONS = [...FORM_OPTIONS, 'mL', 'puff']

const EMPTY_DRAFT = {
  medication: '',
  strength: '',
  form: '',
  doseQuantity: '',
  doseUnit: '',
  frequencyCount: '',
  durationDays: '',
  startDate: '',
}

function toDraft(p) {
  return {
    medication: p.medication ?? '',
    strength: p.strength ?? '',
    form: p.form ?? '',
    doseQuantity: p.dose?.quantity ?? '',
    doseUnit: p.dose?.unit ?? '',
    frequencyCount: p.frequency?.count ?? '',
    durationDays: p.duration_days ?? '',
    startDate: p.start_date ?? toIsoDate(new Date()),
  }
}

function toPrescription(d) {
  const num = (v) => (v === '' || v == null ? null : Number(v))
  return {
    medication: d.medication.trim() || null,
    strength: d.strength.trim() || null,
    form: d.form.trim() || null,
    dose: { quantity: num(d.doseQuantity), unit: d.doseUnit.trim() || null },
    frequency: { type: 'times_per_day', count: num(d.frequencyCount) },
    duration_days: num(d.durationDays),
    start_date: d.startDate,
  }
}

const canUseLiveCamera = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext

async function readText(image, onProgress) {
  // Loaded on demand so the OCR engine doesn't weigh down the initial app load.
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(image)
    return data.text
  } finally {
    await worker.terminate()
  }
}

export default function ScanMedicationSheet({ open, onClose }) {
  const dispatch = useCareDispatch()
  const [step, setStep] = useState('capture') // capture | reading | review | done
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [progress, setProgress] = useState(0)
  const [ocrText, setOcrText] = useState('')
  const [ocrError, setOcrError] = useState(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [autoMissing, setAutoMissing] = useState([])
  const [saved, setSaved] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  function reset() {
    stopCamera()
    setStep('capture')
    setCameraError(null)
    setPhoto(null)
    setProgress(0)
    setOcrText('')
    setOcrError(null)
    setDraft(EMPTY_DRAFT)
    setAutoMissing([])
    setSaved(null)
  }

  useEffect(() => {
    if (!open) reset()
    return stopCamera
  }, [open])

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraOn])

  if (!open) return null

  async function startCamera() {
    setCameraError(null)
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      setCameraOn(true)
    } catch (err) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was refused. Allow camera access in your browser, or use "Choose photo" instead.'
          : 'Could not start the camera. Use "Choose photo" instead.'
      )
    }
  }

  function captureFrame() {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    stopCamera()
    analyse(canvas.toDataURL('image/jpeg', 0.92))
  }

  function onFileChosen(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => analyse(reader.result)
    reader.readAsDataURL(file)
  }

  async function analyse(image) {
    setPhoto(image)
    setStep('reading')
    setProgress(0)
    setOcrError(null)
    try {
      const text = await readText(image, setProgress)
      setOcrText(text)
      const parsed = parsePrescription(text, new Date())
      setDraft(toDraft(parsed))
      setAutoMissing(missingFields(parsed))
    } catch (err) {
      setOcrError('The label could not be read. Please enter the details yourself.')
      setDraft(toDraft({ start_date: toIsoDate(new Date()) }))
      setAutoMissing(missingFields(toPrescription(EMPTY_DRAFT)))
    }
    setStep('review')
  }

  function enterManually() {
    stopCamera()
    setDraft(toDraft({ start_date: toIsoDate(new Date()) }))
    setAutoMissing([])
    setStep('review')
  }

  function update(field) {
    return (e) => setDraft((d) => ({ ...d, [field]: e.target.value }))
  }

  const prescription = toPrescription(draft)
  const stillMissing = missingFields(prescription)

  function register(e) {
    e.preventDefault()
    if (stillMissing.length) return
    dispatch({ type: 'REGISTER_PRESCRIPTION', prescription, who: ACTING_AS })
    setSaved(prescription)
    setStep('done')
  }

  function fieldClass(key) {
    return `input${stillMissing.includes(key) ? ' is-missing' : ''}`
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet scan-sheet" role="dialog" aria-modal="true" aria-label="Scan medicine" onClick={(e) => e.stopPropagation()}>
        <p className="card-sub" style={{ margin: 0 }}>Medication</p>
        <h2>📷 Scan medicine label</h2>

        {step === 'capture' && (
          <>
            <p className="card-sub">
              Photograph the pharmacy label on the box or bottle, with the name, strength and
              directions in view. The photo is read on this device and is not uploaded.
            </p>

            {cameraOn ? (
              <div className="scan-camera">
                <video ref={videoRef} autoPlay playsInline muted aria-label="Camera preview" />
                <div className="sheet-actions">
                  <button type="button" className="btn btn-primary" onClick={captureFrame}>📸 Take photo</button>
                  <button type="button" className="btn btn-ghost" onClick={stopCamera}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="sheet-actions">
                {canUseLiveCamera() && (
                  <button type="button" className="btn btn-primary" onClick={startCamera}>📷 Use camera</button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                  📱 Take or choose photo
                </button>
                <button type="button" className="btn btn-ghost" onClick={enterManually}>Enter manually</button>
              </div>
            )}
            {cameraError && <p className="scan-error" role="alert">{cameraError}</p>}

            {/* capture="environment" opens the rear camera directly on phones; desktops get a file picker. */}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFileChosen} />
          </>
        )}

        {step === 'reading' && (
          <div className="scan-reading" aria-live="polite">
            {photo && <img src={photo} alt="Captured medicine label" className="scan-photo" />}
            <p>Reading the label… {Math.round(progress * 100)}%</p>
            <progress max="1" value={progress} />
          </div>
        )}

        {step === 'review' && (
          <form onSubmit={register} noValidate>
            {photo && <img src={photo} alt="Captured medicine label" className="scan-photo" />}
            {ocrError && <p className="scan-error" role="alert">{ocrError}</p>}
            {!ocrError && photo && (
              <p className="card-sub">
                {autoMissing.length === 0
                  ? 'Check every detail below against the label before saving.'
                  : 'Some details could not be read and are highlighted — please fill them in from the label.'}
              </p>
            )}

            <div className="scan-grid">
              <label className="scan-field scan-wide">
                <span className="field-label">Medication</span>
                <input className={fieldClass('medication')} value={draft.medication} onChange={update('medication')} placeholder="e.g. Amoxicillin" />
              </label>
              <label className="scan-field">
                <span className="field-label">Strength</span>
                <input className={fieldClass('strength')} value={draft.strength} onChange={update('strength')} placeholder="e.g. 500 mg" />
              </label>
              <label className="scan-field">
                <span className="field-label">Form</span>
                <input className={fieldClass('form')} value={draft.form} onChange={update('form')} list="scan-forms" placeholder="e.g. capsule" />
              </label>
              <label className="scan-field">
                <span className="field-label">Dose (amount)</span>
                <input className={fieldClass('dose')} type="number" min="0.25" step="0.25" inputMode="decimal" value={draft.doseQuantity} onChange={update('doseQuantity')} />
              </label>
              <label className="scan-field">
                <span className="field-label">Dose (unit)</span>
                <input className={fieldClass('dose')} value={draft.doseUnit} onChange={update('doseUnit')} list="scan-units" placeholder="e.g. capsule" />
              </label>
              <label className="scan-field">
                <span className="field-label">Times per day</span>
                <input className={fieldClass('frequency')} type="number" min="1" max="12" step="1" inputMode="numeric" value={draft.frequencyCount} onChange={update('frequencyCount')} />
              </label>
              <label className="scan-field">
                <span className="field-label">Duration (days)</span>
                <input className={fieldClass('duration_days')} type="number" min="1" max="365" step="1" inputMode="numeric" value={draft.durationDays} onChange={update('durationDays')} />
              </label>
              <label className="scan-field scan-wide">
                <span className="field-label">Start date</span>
                <input className={fieldClass('start_date')} type="date" value={draft.startDate} onChange={update('startDate')} />
              </label>
            </div>
            <datalist id="scan-forms">{FORM_OPTIONS.map((f) => <option key={f} value={f} />)}</datalist>
            <datalist id="scan-units">{UNIT_OPTIONS.map((f) => <option key={f} value={f} />)}</datalist>

            {ocrText && (
              <details className="scan-details">
                <summary>Text read from the label</summary>
                <pre>{ocrText.trim()}</pre>
              </details>
            )}
            <details className="scan-details">
              <summary>Record to be saved</summary>
              <pre>{JSON.stringify(prescription, null, 2)}</pre>
            </details>

            <p className="safety-banner" style={{ fontSize: 13 }}>
              CareShare records what the label says — it does not provide medical advice. Always
              follow the prescriber's and pharmacist's instructions.
            </p>

            <div className="sheet-actions">
              <button type="submit" className="btn btn-primary" disabled={stillMissing.length > 0}>
                ✅ Confirm &amp; add medication
              </button>
              <button type="button" className="btn btn-secondary" onClick={reset}>Retake</button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
            {stillMissing.length > 0 && (
              <p className="card-sub">Fill in the highlighted fields to continue.</p>
            )}
          </form>
        )}

        {step === 'done' && saved && (
          <div aria-live="polite">
            <p>
              ✅ <strong>{saved.medication} {saved.strength}</strong> registered —{' '}
              {saved.frequency.count * saved.duration_days} doses added to the calendar from{' '}
              {new Date(`${saved.start_date}T00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.
            </p>
            <pre className="scan-json">{JSON.stringify(saved, null, 2)}</pre>
            <div className="sheet-actions">
              <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
              <button type="button" className="btn btn-secondary" onClick={reset}>Scan another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
