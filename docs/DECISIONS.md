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

## Care coach (WHO partner cards)

31. **WHO as interim partner corpus** — until a hospital supplies standing orders, coaching answers come from versioned `careCards.who.json` (WHO hypertensive / ANC danger-sign framing). `/care` avatar chat (voice / text / sign mode) retrieves cards from triage level + reasons + question; optional OpenRouter only **rephrases** those cards. Guardrails: RED always handoff + go-now; UNKNOWN ≠ fine; no “you have preeclampsia.” Sign mode opens the allowlisted signer; free speech→sign is still out.

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
21. **Theme in its own file** — `styles/theme-linen.css` loads after `app.css` and only overrides the look, so feature work in `app.css` keeps merging cleanly. Type: warm rounded **Nunito** for UI and soft **Fraunces** for display (both OFL, self-hosted via `@fontsource-variable/*` so they work offline).
22. **Status stays the hero** — the home card is a night-navy card with a thin status ring (amber card for YELLOW, crimson for RED, dashed outline for UNKNOWN); the alert screen is a dark disc inside a coloured ring. No invented 0–100 scores.
23. **The band on the Band screen** — `ui/BandArt.tsx` (shared with the landing page) shows the band, greyed when disconnected.

## Richer dashboards (dash/richer)

24. **Ring gauges show real readings only** — heart rate, calibrated temperature, last BP, pregnancy week and band signal (Band screen: battery instead of BP and week). Ring colour comes from the same thresholds the rules use (`getDefaultTriageConfig`) or from her baseline band; no invented scores.
25. **"Tonight" card** — heart rate on a half-circle gauge with her normal band (mean ± 2 SD from the personal baseline, `normalRange`). While the baseline is learning it says so and shows progress (`baselineProgress`), and only the fixed rules apply.
26. **Trend card** — last 60 stored minutes for heart rate or temperature, with her normal band and the fever line.
27. **Stage demo seeds a learned baseline** — so the demo can show "her normal" (project doc demo script, 0:30). Reset clears it. Real phones learn it over ~3 days.
28. **Contacts as a table** — summary tiles, role filter chips, initials avatars, role and status chips, the first person alerted highlighted; real columns on wide screens. Role is chosen with buttons.
29. **Displayed skin temperature is calibrated** — dashboards show the same calibrated value the rules use, not the raw skin reading.
30. **Shared parts** — `ui/VitalsDashboard.tsx` (rings, Tonight, trend) is used by Home and Band so they match; styles live in `styles/dashboard.css`, not `app.css`.

## Mother-first redesign (redesign/mother-first)

- **Registration** (`/register`) replaces the old consent screen. One wizard for three registrars: the mother herself, a CHW, or a nurse. Steps: who → about → pregnancy → health → contacts → (nurse: clinical note) → consent → review. Nothing is saved until Finish. Older installs that already gave consent count as registered.
- **Pregnancy dating**: we store the clinic's weeks + days *and the day they were recorded* (`gaRecordedOnMs`), or a due date. Week, trimester and due date are calculated each day (`@neema/core` `pregnancyProgress`, 280-day term, trimesters <14 w, <28 w, 28 w+). The old static `gestationWeeks` is kept in sync for older code but is never the source.
- **Weekly cards** (`@neema/core` `weeklyInsights.ts`): 10 cards (weeks 4–42), English + Swahili, written in our own words from the NHS week-by-week guide (re-use permitted under NHS terms / OGL). UK-only advice removed; medicines and vaccines say "ask your clinic". Every card is `status: 'draft'` and shows a "Draft: awaiting nurse review" tag; field readiness lists them as a blocker until a nurse/midwife reviews them and a Swahili speaker checks them.
- **Clinical notes** live in their own table (Dexie v6 `clinicalNotes`), separate from the mother's `healthNotes`. The mother's screens only read them. A nurse adds them at registration or in `/team`. They are not tamper-proof (on-device only) until a clinic backend signs and syncs them.
- **Home** shows only: greeting, bell, hold-to-call emergency, an alert banner *only when* RED / YELLOW / band problem / no CHP, pregnancy progress, this week, daily check-in (→ CareChat, plus "Log a symptom"), and readings. Reading flags use the triage config thresholds (`bp.raisedSys/Dia`, `bp.severeSys/Dia`, `fever.tempC`) and triage reasons; nothing is hard-coded on the page. The old BP sparkline drew made-up points; the new one only draws saved readings.
- **Emergency**: the header button needs a 2-second hold. It raises the app SOS (rule R9: SMS to CHP/family as before), opens `/alert?sos=1`, and opens the phone dialer with **999**. A web app cannot place the call itself; she still presses the green button, and the alert page says so and offers a plain "Call 999 now" button. The number is one constant (`services/emergency.ts`) for the team to confirm (999 and 112 both work in Kenya).
- **Navigation**: four tabs: Home, CareChat, History, Profile. The plus button, quick-add sheet, floating Neema portrait, Today list (`/todo`) and Passport page were removed; their jobs moved to Home (check-in, add BP, log symptom), History (visits) and Profile (passport fields, birth plan, EPDS). `/passport`, `/settings` and `/todo` redirect.
- **Team tools** (readiness blockers, stage demo, sign-off, chase list, sign-talk lab, hardware QA, add clinical note) moved to `/team`. Mothers reach it only by tapping the version line on Profile five times. This hides it; it does not secure it (that needs staff accounts).
- **PIN**: one real input per digit (caret, auto-advance, backspace, arrows, paste), confirm step when setting, 4 or 6 digits, length stored so unlock shows the right number of boxes. Change PIN asks for the current PIN first. `setPin` / `unlockWithPin` are unchanged.
- **Notifications** are shown as "Not available yet" rather than a switch that does nothing.
- **Known gaps** are listed in `docs/BACKEND_CONTRACT.md`.

## UI refinement round (redesign/ui-refine)

- **One design system** in `apps/web/src/styles/system.css` (loaded last), plus `ui/Segmented.tsx` (tabs and single-choice groups, with arrow-key support) and `ui/FormField.tsx` (label, required mark, hint, field error). Buttons: primary = navy fill; secondary = outlined; "ghost" = soft filled pill, so no action looks like plain text; `btn-sm` keeps a 44 px tap height. Underlined text is reserved for real links (Terms, sources, "View health history"). Labels and section titles use `--n-label` #2c4a7e (7.8:1 contrast on linen). Focus rings are always visible.
- **Required at registration**: full name, how far along (weeks + days, or due date; the "don't know" option was removed), and acceptance of the Terms and Conditions (never pre-ticked; read in a pop-up so the form is not lost, also at `/terms`). Required fields show a red asterisk with "(required)" for screen readers. Errors are per field and move focus to the first problem.
- **Shared validation**: `@neema/core` `validateRegistration` holds the rules so a future server can refuse the same incomplete records (see BACKEND_CONTRACT.md §2). The display name is now optional and defaults to the first name.
- **Terms acceptance** is saved on the consent record: `termsVersion` (`TERMS_VERSION` in core, bump it when the text changes) and `termsAcceptedAtMs`. The Terms text is a plain-language draft awaiting legal review.
- **Allergies are structured**: `profile.allergyList: AllergyEntry[]` (`{code}` for listed allergies, `{code:'other', name}` for others) and `profile.noKnownAllergies: true`. They can never both be set. Empty = not answered. The old comma `allergies: string[]` is read once and converted (`allergyAnswerOf`), then dropped on the next save. Sulfa medicines are listed because SP (sulfadoxine-pyrimethamine) is used for malaria prevention in pregnancy.
- **Home order** follows the brief: greeting → daily check-in ("Start Daily Check-in" → CareChat) → one pregnancy card (week, trimester, estimated due date, progress, an illustration for the week, your baby / what you may feel / what to expect / get help) → latest readings with a link to history. Exception kept on purpose: an active RED/YELLOW alert, a band problem, or a missing CHP number shows directly under the greeting, because an emergency must never sit below other content.
- **Baby illustration** (`ui/BabyStageArt.tsx`) is an original, simple drawing that grows a little every day (size, proportions and limbs blended between weekly keyframes; turns head-down gradually from 28 to 34 weeks), labelled for screen readers as an illustration, not to scale. No outside images were copied.
- **"What to expect"** shows the next recommended clinic contact from the WHO 2016 ANC model (8 contacts: by 12 weeks, then 20, 26, 30, 34, 36, 38, 40), with "your clinic gives your real date".

## After birth: postpartum recovery (postpartum/recovery-dashboard)

- **One app, two stages.** "Record the birth" (`/record-birth`, from Home at any week, prominently from 36 weeks, from Profile, or `/team` for nurses and CHWs) saves `profile.delivery` (date, optional time, normal / assisted / caesarean, place, complications, number of babies, who recorded it) and switches `stage` to `postpartum`. Pregnancy fields are never deleted; the pregnancy length at birth is saved for history. A mother registering after birth gives the birth date and type in the wizard instead of weeks. "Recorded by mistake? Undo" in Profile goes back to pregnancy care.
- **Babies are separate records** (Dexie v7 `babies`), not fields on the mother's profile. The dashboard's baby section can be turned off by the mother (no question asks why; this also protects mothers whose baby is not with them).
- **Days since birth** (`@neema/core` `postpartumProgress`) drive everything: day 0 is the birth day, counted on the phone's calendar.
- **Recovery dashboard** (Home when `stage === 'postpartum'`): greeting with days since birth and the baby's age; daily check-in card ("How are you and your body feeling today?" → `/recovery-check`, CareChat stays one tap away); "Your Recovery: What to Expect" for her stage with Earlier/Later to explore other stages; readings (heart rate, blood pressure, skin temperature clearly labelled as from the band, sleep as she reported it) with a link to the check-in when a reading needs attention; "Your Baby's First Weeks" last and closed by default. Navigation after birth: Recovery, Sleep & mood, CareChat, History, Profile.
- **Recovery guide** (`recoveryTimeline.ts`): six stages covering the first 8 weeks (first 24 hours, days 2–7, week 2, weeks 3–4, weeks 5–6, weeks 7–8 and beyond), each with what may be normal, then two clearly separate lists: **emergency** (go now / call 999) and **contact your CHP or clinic today**. A test makes sure no danger sign ever appears in a "normal" list. Caesarean-specific notes show only after a caesarean. Written in our own words from NHS and WHO 2022 postnatal guidance; status `draft` until clinicians approve; listed in field readiness.
- **Guided check-in** (`/recovery-check`): five short screens (body + pain/dizziness if not good, bleeding in the first 8 weeks, a danger-sign screen every day, mood with follow-ups only when low or every third day, sleep with follow-ups only after a short night). Answers are saved as a check-in (Dexie v7 `recoveryCheckins`). **Danger signs are saved as symptoms**, so the existing triage rules and alert chain (SMS to CHP/family, escalation) run with no new alert system.
- **New symptom codes and DRAFT rules** in core triage: R15 emergency signs (fainting, chest pain/breathlessness, fits, severe tummy pain; after birth also headache with blurred vision) → RED; R16 thoughts of harming herself or her baby → RED with a "talk to someone now" message, 1199 / Befrienders Kenya / her CHP, and an SMS that does not say why; R17 same-day review signs (bad-smelling discharge, wound problems, one painful swollen leg, red painful breast, urine problems, bleeding heavier again) → YELLOW. These need clinician sign-off like all thresholds.
- **Schedules shown as guides only:** WHO postnatal checks (within 24 h, day 3, days 7–14, 6 weeks) and the Kenya KEPI baby vaccine visits (birth, 6, 10, 14 weeks, 9 months). Team to confirm both against current MoH guidance.
- **Sleep & mood** (`/wellbeing`): the last two weeks of what she reported (never invented), the EPDS mood check (suggested around 2 and 6 weeks) and support lines. Kenya Red Cross 1199 and Befrienders Kenya numbers must be confirmed by the team before field use.
- **Nurse summary** now includes the birth date and type after birth, with after-birth questions for the nurse.

## Today screen and Settings (redesign/today-and-settings)

- **Today** (was Home) follows the reference the team chose: a header with the avatar (opens Settings), the date and greeting, the bell and the hold-to-call emergency button; a week strip with today circled; a large **floating** illustration (gentle up-and-down motion, switched off for people who ask their phone to reduce motion); "24 weeks, 3 days ›" (or the baby's age after birth); Start Daily Check-in; four round quick actions; "My daily insights" cards that change with the week or day; then the readings.
- **After birth** the illustration becomes a swaddled newborn that grows a little with age, opens its eyes from about 3 weeks and smiles from about 5 weeks, matching the new **baby development** guide (`@neema/core` `babyDevelopment.ts`, four stages to about 4 months, from CDC and NHS guidance, draft, listed in field readiness).
- **Insights** (new tab) holds the full guides: pregnancy week by week (explorable), or after birth "Your recovery" and "Your baby" tabs. Navigation: Today, Insights, CareChat, History (+ Sleep & mood after birth).
- **Settings** (avatar on Today): avatar, name and phone, **View profile** (personal details, pregnancy/birth, contacts, health notes, nurse notes, birth plan, clinic), **Your Neema experience** with only *Track pregnancy* and *Track after birth* (no cycle or perimenopause tracking), then app, security and privacy settings. Choosing *Track after birth* opens Record the birth; choosing *Track pregnancy* after birth asks for confirmation and removes the birth record (pregnancy data was never removed).
- **No CHP / record-birth cards on Today.** The missing-CHP warning moved to Settings, and a red dot on the avatar shows until a real CHP number is saved. Safety alerts (RED, YELLOW, band problems) still appear on Today directly under the header.
