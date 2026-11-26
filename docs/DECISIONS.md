# Decisions and assumptions

Recorded while implementing from the Backend Cursor brief.

## Assumptions

1. **BLE packet layout** — Migrated to the Nov 2025 brief contract in `packages/core/src/protocol.ts`: 12-byte vitals notify (version, flags, uint16 HR, int16 temp×100, seq, battery, signal, reserved), 2-byte commands, UUIDs `7a1c0001/2/3-5e3b-…`, device name prefix `Neema-`. Firmware mirrors this. Older 10-byte/`6e65656d-…` packets are **not** accepted.
2. **Sleep window timezone** — Rest-context uses `Africa/Nairobi` by default via `Intl` (`TriageInput.timeZone`).
3. **Baseline learning period** — ~3 days of minute samples before R8 z-scores are trusted.
4. **Web app first** — Vite/React PWA; native Flutter shell is roadmap.
5. **SMS** — Prototype opens a prefilled `sms:` link; no silent SMS or gateway. Copy must say “open the message”, never “we have messaged”.
6. **Clinical thresholds** — Nested placeholders in `triage.config.json` (brief shape + sleep window / calibration / warning symptoms). Pending clinician review.
7. **R10 gestation gate** — Brief table fires for any pregnancy; when `gestationWeeks` is provided we still require ≥ `reducedMovementMinGestationWeeks` (default 28).
8. **Follow-up step interval** — Default 5 minutes between watch → warn → act → chase. Chase page has a demo “Advance step” control.
9. **EPDS reverse items** — Items 1, 2, and 4 (1-indexed) are reverse-scored per the published English EPDS. Cut-offs: pregnancy 13, postpartum 10 (brief placeholders). EPDS never becomes a triage colour.
10. **Offline shell** — `public/sw.js` caches the app shell only. No remote logging. First visit still needs network; later visits can open offline. Data already lives in IndexedDB.
11. **SigningSlot** — Placeholder UI labelled “not KSL”. Production needs licensed Kenyan Sign Language clips.

## Explicitly out of scope (per brief)

SpO2, motion, speech recognition, cloud DB, analytics, silent SMS, diagnosis wording, invented first-aid text.

## Demo-chain fixes (fix/demo-chain)

7. **Band feedback never sets SOS** — `vibrate: 'sos'` is only a vibration pattern. The simulator used to latch SOS on it, so RED re-raised itself forever. SOS now comes only from the band long-press, the simulator's `pressSos()`, or the app SOS button (hold 2 s).
8. **Stage comes from the Passport** — live triage reads `stage` / `gestationWeeks` from the profile (demo steps override it). ASSUMPTION: an encrypted profile can't be read without the PIN, so it falls back to pregnancy with no gestation week (R10 stays silent).
9. **Sustained signs mean sustained** — R6/R7/R8 need valid readings spanning the full window (fever on two readings 10 minutes apart), and band data older than `vitalsStaleMinutes` (5) is UNKNOWN.
10. **SMS reasons in plain words** — `packages/core/src/messages/reasons.ts` maps reason codes to short Swahili/English phrases (draft, needs native + CHP review) and picks the most urgent reason. YELLOW SMS goes to the CHP only; RED goes to the CHP and one family contact, each as a separate SMS (a group text would become MMS and need data).
11. **Who may clear RED** — `acknowledgeRed(id, at, by)` with `by` = `chp_replied` | `mother_on_the_way` | `clinician_cleared`. After acknowledgement the same evidence doesn't raise a new alert for 30 minutes; a new rule (e.g. SOS) does.
12. **Contract change** — `AlertRecord` gains optional `reasons` and `acknowledgedBy`; `triage.config.json` gains `vitalsStaleMinutes`.
13. **Stage demo player** — Settings → Stage demo seeds scenarios A, B1, B2, C, D from `DEMO_SCENARIOS` into IndexedDB and runs the real chain. It is hidden once the app is field-ready. In demo mode the CHP "replies" (scripted, labelled as such) 6 s after the mother opens the CHP SMS.

## CHP alerting (fix/demo-chain, part 2)

14. **No invented contacts** — the alert chain no longer creates demo contacts with placeholder numbers. Contacts with fake-looking numbers (`isPlaceholderPhone`) are never used for alerts. With no usable contact, the alert screen offers "choose who to text" (an `sms:` link with the text and no recipient) and a shortcut to add a CHP.
15. **Phone numbers are validated** — `normalizePhone` stores Kenyan numbers as +254… and rejects anything that can't be a mobile number. Field readiness now also requires a real CHP number.
16. **Contacts in setup** — after the first PIN, the app asks for the CHP (required to continue, or "Later") and suggests a family member. Home shows a warning while no real CHP number is saved.
17. **Escalation is real** — `planEscalation` (core) picks the next contact not yet texted at 5 minutes and the CHP supervisor at 10 minutes. Each step adds an SMS button for that person, sounds a Web Audio alarm, vibrates the phone and the band, and shows "No one has confirmed yet". A countdown shows when the next step is due. In the stage demo the timing is 30 s / 60 s.
18. **Alerts survive reloads** — `AlertRecord.smsBody` keeps the prepared text on the phone, so after a reload the SMS buttons, which ones were opened, and the escalation timer (counted from the alert's own time) are restored.

## Linen & night redesign (redesign/oura-style)

19. **Look, not brand** — the visual language follows premium wearable sites (warm off-white, deep navy, light serif headlines, pill buttons, hairline cards), but every name, mark, illustration and line of copy is Neema's own. No third-party logos, product photos or text.
20. **Public band page at `/`** — `LandingPage` (hero with the drawn band, feature strip, band + phone, four cards, how it works with the GREEN/YELLOW/RED/UNKNOWN legend, honest-claims section, footer disclaimer). The care entry flow moved to `/start`; the installed app still opens at `/home` (manifest `start_url`), and the page redirects to `/start` when opened as the installed app. Copy follows the doc's "say / do not say" table: "all raw data stays on the phone", "decision support, not a diagnosis", "prototype sensors, validation planned". Swahili copy is a draft.
21. **Theme in its own file** — `styles/theme-linen.css` loads after `app.css` and only overrides the look, so feature work in `app.css` keeps merging cleanly. Display font: Instrument Serif (OFL), self-hosted via `@fontsource/instrument-serif` so it works offline.
22. **Status stays the hero** — the home card is a night-navy card with a thin status ring (amber card for YELLOW, crimson for RED, dashed outline for UNKNOWN); the alert screen is a dark disc inside a coloured ring. No invented 0–100 scores.
23. **The band on the Band screen** — `ui/BandArt.tsx` (shared with the landing page) shows the band, greyed when disconnected.
