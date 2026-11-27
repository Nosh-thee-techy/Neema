# Backend work the redesign needs

The app is offline-first and everything lives on the mother's phone. The redesign brief asks for several things a phone alone cannot do. The screens are built so these slot in later; until then the app says honestly what is not available. This file lists each gap, what the app already stores, and the API we expect.

All endpoints below are proposals for the team to agree on. None exist yet.

## 1. Staff accounts and roles (CHW, nurse, supervisor)

**Today:** registration records who registered her (`profile.registeredBy = { role: 'self'|'chw'|'nurse', name, staffId? }`). Anyone holding the phone can choose "I'm a nurse". `/team` is hidden, not protected.

**Needed:** staff sign-in with roles, so only an authorised nurse can add clinical notes or clinical sign-off.

```
POST /api/staff/login            { phone, pin | otp }        → { token, role, facilityId, name }
GET  /api/staff/me               (Bearer)                    → { role, facilityId, name }
```

## 2. Registering a mother from a CHW's or nurse's device (sync)

**Today:** registration happens on the mother's phone. If she has no smartphone, a CHW can fill the wizard on a phone and record `phoneKind: 'basic' | 'none'`, but the record stays on that phone.

**Needed:** a server-side mother record that a CHW/nurse device can create and later sync to her phone (or keep for feature-phone mothers).

```
POST /api/mothers                (staff)  { profile, contacts, consent }   → { motherId }
GET  /api/mothers/:id            (staff or mother token)                  → { profile, contacts, consent, clinicalNotes }
PATCH /api/mothers/:id           (staff or mother)  partial profile
POST /api/mothers/:id/claim      (mother's phone) { otp sent by SMS }     → links the device to the record
```

Consent text version (`consent-sw-v2`) and timestamp travel with the record, together with `termsVersion` and `termsAcceptedAtMs`.

**Server-side validation:** `POST /api/mothers` must run the same rules as the app. They live in `@neema/core` `validateRegistration` (full name, gestational age or due date while pregnant, Terms accepted, valid phone numbers, a basic-phone mother needs a number, a health worker must give their name, no contradictory allergies). Reject with `422 { errors: { field: code } }` using the same field names and codes, so the app can show the same messages.

**Profile fields added in this round** (all optional in storage, no breaking change):

| Field | Type | Notes |
|---|---|---|
| `fullName` | string | required at registration |
| `allergyList` | `Array<{code: AllergyCode} \| {code: 'other', name: string}>` | replaces comma `allergies: string[]` |
| `noKnownAllergies` | boolean | never together with `allergyList` |
| `phoneKind`, `automatedCallsConsent` | see §3 | |

Consent record: `termsVersion` (string), `termsAcceptedAtMs` (number). A server table would store one allergy per row (`mother_id, code, other_name`).

## 3. Automated calls / SMS check-ins (feature-phone mothers)

**Today:** stored and ready: `profile.phoneForAlerts` (E.164), `profile.phoneKind`, `profile.automatedCallsConsent`. No calls are made.

**Needed:** a voice/SMS provider (e.g. Africa's Talking, which supports Kenyan numbers, USSD and IVR) behind a server.

```
POST /api/calls/schedule         (server job)  { motherId, kind: 'weekly_checkin'|'bp_reminder'|'missed_alert', at }
POST /api/calls/webhook          (provider)    { callId, dtmf | speech, status }  → stores answers, raises triage on danger signs
```

Danger-sign answers must go through the same `@neema/core` triage rules (no separate thresholds on the server).

## 4. Clinical notes that cannot be edited

**Today:** `clinicalNotes` table on the phone, read-only in the mother's screens, written only from registration (nurse) or `/team`. Not tamper-proof.

**Needed:** notes written by a signed-in nurse, signed by the server, synced down read-only.

```
POST /api/mothers/:id/clinical-notes   (nurse)   { text }  → { id, authorName, facility, tsMs, signature }
GET  /api/mothers/:id/clinical-notes   (mother or staff)
```

## 5. Notifications and reminders

**Today:** Profile shows "Reminders and notifications: Not available yet". The bell opens the active alert or the Alerts history.

**Needed:** Web Push (VAPID) subscription per device, or SMS for basic phones.

```
POST /api/push/subscribe         { motherId, subscription }
```

Reminder kinds: re-measure BP after a YELLOW, clinic appointment (`VisitRecord.nextAppointmentTsMs`), weekly card.

## 6. Provider / facility information

**Today:** free text the mother or nurse types (`profile.facilityName`, `profile.nurseName`, `birthPlan.facility`).

**Needed:** a facility list (Kenya Master Health Facility List) and the assigned nurse/CHP from the staff record.

```
GET /api/facilities?near=lat,lon
```

## 7. Reviewed content

Not an API, but it blocks field use: the triage thresholds need clinician sign-off, the Swahili alert messages and the 10 weekly cards need nurse/midwife review and a Swahili check. Field readiness (`/team`) lists every one.

## 8. Emergency number

`services/emergency.ts` sets `EMERGENCY_NUMBER = '999'`. Kenya also routes 112. The team should confirm the number (and whether a county ambulance line should be offered) before field use.


## 9. After birth (postpartum)

**Today:** the birth (`profile.delivery`), baby records (`babies` table) and recovery check-ins (`recoveryCheckins`) live on the phone.

**Needed:**
- The birth recorded by a nurse at the facility should create the record on the server and sync to the mother's phone, so she does not have to enter it.
- **Babies need their own records and clinical owner** (the child health clinic), linked to the mother but with separate permissions. Proposed: `POST /api/mothers/:id/babies` (nurse), `GET /api/babies/:id` (child-health staff, mother read-only).
- Postnatal check and baby vaccine reminders (WHO PNC: day 1, day 3, days 7–14, 6 weeks; KEPI: 6, 10, 14 weeks) by SMS or push, and a CHP prompt for a home visit when a check is missed.
- Check-ins with danger signs already raise an alert on the phone. A server could also notify the CHP's dashboard and track whether someone responded.

```
POST /api/mothers/:id/delivery      (nurse or mother)  { dateIso, time?, mode, place?, complications[], babiesCount }
POST /api/mothers/:id/recovery-checkins   (mother)    { dayAfterBirth, physical, mood, sleep?, bleeding?, dangerCodes[] }
```
