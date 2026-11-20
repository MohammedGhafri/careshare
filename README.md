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
  components/            Header, SafetyBanner, StatusPill, Card, section views,
                          CalendarConnect, DetailSheet, ActivityFeed
  App.jsx                Today Dashboard layout and state
```

## Notes

- This project lives in a OneDrive-synced folder — `node_modules` will sync
  too, which can be slow. Consider excluding `node_modules` from OneDrive
  sync if `npm install` feels sluggish.
