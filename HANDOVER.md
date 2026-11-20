# CareShare — session handover

Context for picking this project back up in a new session. Source requirements
live in `docs/` (`PRD.txt`, `ProblemStatement.txt`, `Design.txt`,
`UserStories.txt`) — read those first for product intent; this file is about
implementation state and continuity.

## What this is

A POC for **CareShare** (the PRD calls it "CareCircle AI"), covering **US01 —
View today's care picture**, built out into a full Day/Week calendar linked
to a status checklist for a fictional supported person, Margaret, and her
care circle (Sarah/daughter/Family Coordinator, Priya/Carer, Tom/Trusted
Volunteer). Built as a PWA with optional Google Calendar read/write.

Stack: Vite + React (plain JS, no TypeScript), hand-rolled CSS (no framework),
`vite-plugin-pwa`, `@fullcalendar/react` for the calendar.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build && npm run preview   # production build + PWA check
```

No Google OAuth client is configured — the app runs in demo mode (see
README.md for how to wire up a real `VITE_GOOGLE_CLIENT_ID`).

## Repo state

- Git repo exists, branch `feature/dean-poc-attempt`, tracking
  `origin/feature/dean-poc-attempt` on `github.com/MohammedGhafri/careshare`.
- One commit so far: "Initial POC made using Claude with calendar view and
  task list".
- **Uncommitted changes at the time of this handover** (not yet committed):
  `src/App.jsx`, `src/components/CalendarView.jsx`,
  `src/components/ChecklistPanel.jsx`, `src/styles.css` — this is the most
  recent round of fixes (mobile sticky header, status filter chips, Today
  button fix — see "Latest changes" below). Review and commit these before
  starting new work, or they'll get tangled with whatever comes next.
- Minor cleanup worth doing: `dev-dist/` (vite-plugin-pwa's dev-mode service
  worker output) is tracked in git but is a generated artifact — add it to
  `.gitignore` and `git rm -r --cached dev-dist`.

## Architecture

```
src/
  data/mockData.js       Synthetic data: care circle, medications/visits/tasks
                          with real Date objects spanning the current Mon–Sun
                          week, plus a seed activity log. Exports isSameDay,
                          todayDate, weekStartDate helpers.
  lib/status.js           getStatus(key) -> {tone, label, icon}. tone is one
                          of complete/normal/attention/urgent — the single
                          source of truth for status colour+icon+label
                          everywhere (cards, calendar events, pills).
  lib/rules.js            deriveAlerts(items, now) — pure, deterministic
                          rules-based alerts (unknown/missed medication,
                          overdue visit). Recomputed from live item state, so
                          resolving the underlying item clears its alert.
  lib/prescriptionParser.js  parsePrescription(ocrText, today) — pure,
                          rules-based extraction of medication/strength/form/
                          dose/frequency/duration (null when unreadable);
                          buildDoseItems() expands a confirmed record into
                          per-dose medication items. Tested in
                          prescriptionParser.test.js (`npm test`, vitest).
  lib/googleCalendar.js   GIS sign-in, listEvents(start,end), addEvent,
                          templateLink (demo-mode fallback, no auth needed).
  state/CareContext.jsx   useReducer + context: the single source of truth
                          shared by the calendar and the checklist panel.
                          Actions: SELECT_DATE, SELECT_ITEM (also jumps
                          selectedDate to the item's day — see "Linking" bug
                          below), UPDATE_STATUS (status + optional note),
                          RESCHEDULE (drag/resize), CLOSE_DETAIL,
                          SET_GCAL_EVENTS.
  components/
    CalendarView.jsx      FullCalendar day/week grid. Colours set directly as
                          inline event props (TONE_COLORS), not just CSS
                          classes — FullCalendar's own defaults otherwise win
                          the cascade. customButtons.today overrides the
                          built-in Today button to also dispatch SELECT_DATE.
    AddMedicationSheet.jsx  "➕ Add medication" manual form: name, dose
                          (strength), how to take (times/day, days, start
                          date, optional instructions). Dispatches
                          REGISTER_PRESCRIPTION with source: 'manual'.
    ScanMedicationSheet.jsx  "📷 Scan medicine" flow: getUserMedia live
                          camera or <input capture="environment">, on-device
                          OCR via lazily-imported tesseract.js, editable review
                          form; confirming dispatches REGISTER_PRESCRIPTION
                          (stores state.prescriptions + adds dose items +
                          activity entry). In-memory only, like all state.
    ChecklistPanel.jsx    Day-scoped checklist: sticky header (close button +
                          heading + status filter chips) over a scrollable
                          list of Alerts/Medication/Visits/Tasks/Activity.
                          Filter chips toggle filtering the list by tone.
    DetailSheet.jsx       Modal opened from any card or calendar event. Status
                          action buttons (Taken/Missed/Declined/Unknown for
                          meds, Mark complete for visits/tasks) highlight
                          whichever matches the current status. Includes an
                          editable notes textarea. "Add to Google Calendar"
                          uses the real API when connected, else a template
                          link.
    AlertsSection / MedicationSection / VisitsSection / TasksSection /
    ActivityFeed / Card / StatusPill   Presentational list sections built on
                          the shared Card component.
    Header / SafetyBanner / CalendarConnect   Chrome: brand+date, the
                          mandatory "CareShare does not provide medical
                          advice…" banner, and the Google Calendar
                          connect/demo-mode banner.
  App.jsx                 CareProvider wrapper + AppShell: owns the Google
                          Calendar connect flow and the mobile drawer
                          open/close state, composes Header/SafetyBanner/
                          CalendarConnect/layout(CalendarView+ChecklistPanel)/
                          DetailSheet.
  styles.css              All styling. Design.txt's palette as CSS vars.
                          `.app` is a flex column pinned to 100dvh with
                          overflow:hidden — the calendar and checklist panel
                          scroll *internally* (contained scroll) rather than
                          the whole page scrolling.
```

Acting role is hardcoded to "Sarah" (Family Coordinator) throughout — US08
(role switching) hasn't been built yet, this was called out and deliberately
deferred.

## Important gotchas for the next session

1. **FullCalendar is pinned to exact v6.1.22** across `@fullcalendar/react`,
   `core`, `timegrid`, `interaction` (`--save-exact`, not `^`). FullCalendar
   v7 is a from-scratch rewrite (different plugin import paths *and* a
   completely different atomic-CSS theming system with no `.fc-*` class
   names) — upgrading will silently break all calendar styling. Don't let
   `npm update`/`npm install <pkg>` float these off v6.1.22 without
   deliberately re-doing the theming.
2. **This project lives in a OneDrive-synced folder.** OneDrive has, more
   than once during this build, conflict-renamed `dist/assets` to
   `dist/assets 2` mid-build, which breaks the build silently (the server
   returns 200 + the SPA's `index.html` for every asset request instead of a
   real 404, so a stale/broken build can look successful at a glance). If a
   build or preview looks wrong, `rm -rf dist && npm run build` first before
   debugging anything else. Dev server (`npm run dev`) doesn't have this
   problem since it doesn't write `dist/`.
3. Status tone colours are defined in **two places that must stay in sync**:
   `src/lib/status.js` (STATUS_MAP, used by StatusPill/cards) and
   `TONE_COLORS` in `CalendarView.jsx` (used for inline event colours,
   bypassing CSS specificity issues). If you add a new status/tone, update
   both.
4. Mock data dates are generated relative to `new Date()` at module load —
   "today" always lines up with whatever day the app is actually run on, the
   week always spans the real current Mon–Sun.

## Latest changes (uncommitted — see Repo state above)

In response to feedback on the Day/Week calendar:
- Fixed `.card.is-selected` / `.fc-event.is-selected` using `box-shadow`
  instead of `outline` (outline doesn't follow border-radius, looked broken
  on rounded cards/events).
- Fixed calendar event legibility: colours set as inline FC event props, not
  just CSS; `slotEventOverlap={false}` so same-time events split side-by-side
  instead of smearing; event text truncates with ellipsis.
- Restructured `.app` into a fixed-height flex shell so the calendar and
  checklist scroll internally instead of the whole page scrolling.
- Added an editable notes textarea to DetailSheet, wired into
  `UPDATE_STATUS`'s `note` param and the Activity Feed / alert "why" text.
- Status action buttons in DetailSheet now show which one is currently
  active.
- **Real regression found and fixed via Playwright** (see below): clicking a
  calendar event/day on a different day than the currently-selected one
  updated nothing visible in the checklist, because `SELECT_ITEM` didn't also
  move `selectedDate`. Now it does.
- Distinguished "today" (subtle persistent blue tint + underlined date,
  `--fc-today-bg-color`) from "selected day" (strong teal header + mint
  fill) so they're never visually identical.
- Mobile checklist: close button + heading + filter chips now form a sticky
  header (`.checklist-sticky-header`, `position: sticky`) that stays visible
  while the card list scrolls beneath it.
- Status chips (🚨/⚠️/✅) are now clickable filters, not just read-only
  counts — click to filter the list to that tone, click again (or "Clear
  filter") to reset.
- Today toolbar button fixed via FullCalendar's `customButtons` override —
  previously it only re-centred the calendar's visible range and left the
  checklist on whatever day was last selected.

## Verification approach that worked

Static reasoning about CSS/JS wasn't enough to catch the SELECT_ITEM/date
regression — it needed an actual click-through. This environment has no
browser available by default, but **Playwright works**: install scratch in
`/tmp` (`npm init -y && npm install playwright@1.65.1`, then
`npx playwright install chromium`) rather than adding it to the project's
`package.json`, point it at `npm run dev` (not `dist/`, to dodge the OneDrive
issue above), and drive real clicks. Recommended before trusting any future
"this should work" claim about interactive behaviour here.

## Suggested next steps

Per `docs/UserStories.txt`'s own prioritisation, P0 "must demo" stories not
yet covered: US02 (add medication — currently mock-data only, no add-new UI),
US07 (Care Circle view — no screen for this yet), US14 (escalation sequence),
US15 (resolve alert with outcome note — DetailSheet can record status but
there's no distinct "resolve" action separate from status change). P1:
US06/US11/US17/US19 partially covered (US19's 44px targets and colour+icon+
text are in place; US11 prioritisation/explanation and US17 AI summary are
not).

No AI/LLM integration exists yet — all "AI explains" behaviour in the PRD
(alert explanations, activity summaries) is still just the rules-engine
output (`deriveAlerts`) with static copy, not a real model call.
