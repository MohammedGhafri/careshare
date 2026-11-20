# CareShare — POC (US01: Today Dashboard)

A first-pass proof of concept of **CareShare** (formerly "CareCircle AI" in the
PRD), built around **US01 — View today's care picture**. A family coordinator
opens Margaret's dashboard and sees today's medication, visits/check-ins,
tasks, alerts and recent activity in one place, colour-coded per
`Design.txt` (green = complete, blue = normal, amber = attention, red =
urgent). All data is synthetic/mock, per the prototype constraints in
`PRD.txt`.

This pass also includes:
- **PWA support** — installable, works offline for the app shell.
- **Google Calendar integration** — read today's events into the Visits
  section, and "Add to Google Calendar" from any visit or medication
  reminder's detail view.
- **Add medication** — "➕ Add medication" in the header. Enter the name,
  the dose (strength, e.g. `500 mg`) and how to take it (times per day,
  number of days, start date, optional instructions such as "with food").
  It is saved in the same record shape as a scanned label (with `form`/`dose`
  set to `null` plus an `instructions` field) and its doses are added to the
  calendar and checklist using the same time slots listed below.
- **Scan medicine label** — "📷 Scan medicine" in the header. Take a photo
  with the device camera (live preview on laptops; native rear camera on
  phones via "Take or choose photo") or upload one. The label is read
  **on-device** with tesseract.js (the photo is never uploaded), parsed into a
  prescription record, and shown in an editable review form. Nothing is saved
  until a person confirms; fields that couldn't be read are highlighted and
  must be filled in. Confirming registers the record:

  ```json
  { "medication": "Amoxicillin", "strength": "500 mg", "form": "capsule",
    "dose": { "quantity": 1, "unit": "capsule" },
    "frequency": { "type": "times_per_day", "count": 3 },
    "duration_days": 5, "start_date": "2026-11-20" }
  ```

  and adds one "Due" dose per time slot (1×: 08:00 · 2×: 08:00/20:00 ·
  3×: 08:00/14:00/20:00 · 4×: 08:00/12:00/16:00/20:00) for every day of the
  course to the calendar and checklist. The live-camera button needs a
  secure context (`localhost` or HTTPS); over plain-HTTP LAN on a phone, use
  "Take or choose photo", which opens the camera directly. The OCR engine and
  English language data are downloaded from a CDN on first scan, so the first
  scan needs a connection.

Everything else (role switching, recording medication status, alert rules/AI
explanations, escalation) is out of scope for this first pass and covered by
later user stories.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL. Without any further setup, Google Calendar
runs in **demo mode**: "Add to Google Calendar" opens a prefilled Google
Calendar page in a new tab — no sign-in needed.

To build and test the installed PWA experience:

```bash
npm run build
npm run preview
```

Run the unit tests (label parser) with `npm test`.

Then, in Chrome DevTools → Application, check the manifest and service
worker, and look for the install icon in the address bar.

## Connecting a real Google Calendar (optional)

By default there's no OAuth client configured, so the app falls back to
demo mode described above. To connect a real Google account:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project (or use an existing one) and enable the **Google Calendar API**.
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth client
   ID**, type **Web application**.
3. Add these as **Authorised JavaScript origins**:
   - `http://localhost:5173` (dev)
   - `http://localhost:4173` (preview)
4. On the **OAuth consent screen**, add yourself as a test user (while the
   app is unpublished).
5. Copy the client ID and create `.env.local` in this folder:

   ```bash
   cp .env.example .env.local
   # then edit .env.local:
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```
6. Restart `npm run dev`. The dashboard will show a "Connect Google
   Calendar" button; once connected, today's events appear in the Visits
   section tagged "From Google Calendar", and "Add to Google Calendar"
   creates a real event instead of opening the template link.

## Project structure

```
src/
  data/mockData.js       Synthetic data for Margaret's care circle
  lib/status.js          Maps a status value to colour/label/icon
  lib/googleCalendar.js  Sign-in, read events, add events, template link fallback
  lib/prescriptionParser.js  OCR text -> prescription record; expands it into dose items
  components/            Header, SafetyBanner, StatusPill, Card, section views,
                          CalendarConnect, DetailSheet, ActivityFeed,
                          ScanMedicationSheet (camera capture + OCR + review form)
  App.jsx                Today Dashboard layout and state
```

## Notes

- This project lives in a OneDrive-synced folder — `node_modules` will sync
  too, which can be slow. Consider excluding `node_modules` from OneDrive
  sync if `npm install` feels sluggish.
