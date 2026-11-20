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
- **Persistent storage** — a small local API (`server/`) backed by SQLite, so
  status updates, notes and reschedules survive a refresh or restart instead
  of living only in memory. See "Data & persistence" below.

Everything else (role switching, alert rules/AI explanations, escalation) is
out of scope for this first pass and covered by later user stories.

## Run it

```bash
npm install
npm run dev
```

This starts **both** the API (`:3001`) and the Vite dev server (`:5173`) —
open the printed `localhost:5173` URL. Without any further setup, Google
Calendar runs in **demo mode**: "Add to Google Calendar" opens a prefilled
Google Calendar page in a new tab — no sign-in needed.

To build and test the installed PWA experience (the API still needs to be
running separately, or use `npm run dev` which already covers it):

```bash
npm run build
npm run preview
```

Run the unit tests (label parser) with `npm test`.

Then, in Chrome DevTools → Application, check the manifest and service
worker, and look for the install icon in the address bar.

## Data & persistence

All app data (medications, visits, tasks, activity log) lives in a local
SQLite database at `server/data/careshare.db`, served by a small Express API
in `server/`. The client (`src/lib/api.js`) talks to it via `/api/*`, which
Vite proxies to `http://localhost:3001` in both dev and preview — no CORS
setup needed.

- **First run**: the database is empty, so the server seeds it with the same
  synthetic Margaret scenario the POC always used (`server/seed.js`), anchored
  to whatever day you first run it.
- **Changes persist**: marking a medication Taken/Missed, adding a note, or
  dragging a visit to a new time is saved to SQLite and survives a refresh or
  an API restart.
- **Reset demo data**: the "↺ Reset demo data" button in the header (with a
  confirmation prompt) wipes the database and re-seeds it, re-anchored to
  today. Useful after a demo session leaves the data in a messy state.
- **Changing the database location**: set `CARESHARE_DB_PATH` in `.env.local`
  (copy from `.env.example`). Do this if you hit odd database errors — see
  the OneDrive note below.

⚠️ **This project folder is OneDrive-synced**, which has previously
corrupted/conflict-renamed generated build output here (see "Notes" below).
The same risk applies to the SQLite file. If you see database errors that
don't make sense, set `CARESHARE_DB_PATH` to a path outside any synced
folder, e.g. `~/.careshare/careshare.db`.

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
server/
  db.js                   SQLite (node:sqlite) schema + queries
  seed.js                 generateSeed(now) — Margaret's synthetic scenario
  index.js                Express API: GET /api/state, PATCH status/schedule,
                          POST /api/reset
src/
  data/mockData.js       Synthetic data for Margaret's care circle
  lib/status.js          Maps a status value to colour/label/icon
  lib/googleCalendar.js  Sign-in, read events, add events, template link fallback
  lib/prescriptionParser.js  OCR text -> prescription record; expands it into dose items
  components/            Header, SafetyBanner, StatusPill, Card, section views,
                          CalendarConnect, DetailSheet, ActivityFeed,
                          ScanMedicationSheet (camera capture + OCR + review form)
  lib/api.js              Client fetch wrapper for the API above
  lib/dates.js            isSameDay, todayDate, weekStartDate helpers
  components/             Header, SafetyBanner, StatusPill, Card, section views,
                          CalendarConnect, DetailSheet, ActivityFeed
  state/CareContext.jsx   Loads state from the API, optimistic update/reschedule/reset
  App.jsx                 Today Dashboard layout and state
```

## Notes

- This project lives in a OneDrive-synced folder — `node_modules` will sync
  too, which can be slow. Consider excluding `node_modules` from OneDrive
  sync if `npm install` feels sluggish.
- OneDrive has, more than once, conflict-renamed generated output mid-build
  (e.g. `dist` → `dist 2`). If a build/preview looks wrong, `rm -rf dist &&
  npm run build` first. See HANDOVER.md for more on this and the equivalent
  risk for the SQLite database file.
