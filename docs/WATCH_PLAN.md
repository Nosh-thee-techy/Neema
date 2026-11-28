# Neema watches each mother by her own story

*A plain-language note on the watch plan: what we built, why, and what we hope the band will do next.*

---

## The problem we found

Every mother who joins Neema tells us a little about herself. Has she lost a pregnancy before? Does she have high blood pressure? Did she bleed heavily when she gave birth?

Until now, Neema asked those questions and then treated every mother the same. The registration screen even said that past problems "do not change alerts." The Record birth form promised that her answers would "help your nurse and CHP watch you more closely," but nothing actually changed.

We tested this with a real-life example.

> **Wanjiku** bled heavily when she gave birth and needed blood. Two days later she is back at the market, because if she does not sell, her family does not eat. That afternoon her heartbeat creeps up, slowly, from about 86 to about 110 beats a minute. She has no fever, and no blood pressure cuff with her. A heartbeat that keeps climbing can be an early sign of bleeding again.
>
> **Before:** Neema stayed **green all afternoon**.
> **Now:** Neema asks her to check at **2:30 pm**, buzzes her band, and keeps asking until it settles. If it is still high, her community health worker (CHP) gets a message that says why Neema is watching her closely.

---

## What we built

### 1. Her watch plan

Neema now reads her own story and writes a short plan for her: **what to watch more closely, why, and until when.**

| What she told Neema | What Neema now does | For how long |
|---|---|---|
| Heavy bleeding or a blood transfusion at birth, or heavy bleeding after an earlier birth | Watches her heartbeat more closely, including a heartbeat that climbs slowly over hours. Asks about bleeding, fainting and breathing. | 6 weeks after birth |
| High blood pressure around the birth, or before | Asks for a blood pressure reading every 2 days. Asks about headaches, eyesight and upper tummy pain. | 6 weeks after birth, or the whole pregnancy |
| An infection or a long labour | Notices a rising temperature sooner. Asks about fever and discharge. | 6 weeks after birth |
| A caesarean | Asks about her wound and fever. | 6 weeks after birth |
| A past pregnancy loss | From 28 weeks, asks every day whether her baby is moving as usual. | Until the baby is born |
| Low blood (anaemia) | Asks about dizziness and shortness of breath. | Pregnancy and 6 weeks after birth |

### 2. A heartbeat check that does not forget

Neema already compared her heartbeat with "her usual." But "her usual" was re-learned every few minutes, so a heartbeat that rose slowly over an afternoon simply became the new "usual" and never stood out.

Neema now also keeps her **settled heartbeat**, a slow average over about a day. It starts fresh when the birth is recorded, because pregnancy raises the heartbeat. For mothers whose plan asks for it, two new checks run:

- **Her heartbeat stays fast while resting** (held for 20 minutes, not just one moment).
- **Her heartbeat keeps climbing** well above her settled heartbeat.

Both only ask her to check (yellow). Neema then asks how she feels, buzzes the band, and sends a quiet heads-up to her CHP if it does not settle. A single fast minute, or a gap in the band signal, is never treated as a fast heartbeat.

### 3. She can see what Neema is watching

Today has a new card: **"What Neema is watching for you."** It shows each reason in her words ("You bled heavily when you gave birth"), what Neema does about it, and the date it ends. It never says "high-risk" and never names an illness she did not tell us about.

When a blood pressure check is due, the card says so. One tap opens the blood pressure form.

Her own questions now come **first** on the Symptoms screen and in the after-birth check-in, with the reason beside them.

### 4. Her CHP knows why

When Neema sends the CHP a yellow heads-up, the message now adds why she is watched closely. For example:

> NEEMA: Mama Wanjiku yuko YELLOW. Sababu: homa. **Anaangaliwa kwa karibu: alitoka damu nyingi alipojifungua.** Tunapima tena. Tafadhali mfuatilie leo.

This line goes **only** in the yellow message, which goes to the CHP alone. A red emergency message also reaches family, so it does not include her history. The health-team list on the phone shows the same reasons.

### 5. The band taps her wrist

The phone is the brain and the band is the hand.

- **Yellow** (please check): yellow light and a short buzz. This existed already. It now follows her plan, so for Wanjiku it comes earlier.
- **Red** (get help now): red light and a strong SOS buzz, as before.
- **New, a check is due** (for example, blood pressure): one gentle buzz, at most once a day, only in the daytime.
- **New, "Quiet alerts when I am out"** (in Settings): for a mother at the market or at work. A yellow is felt on the band and shown on screen without the phone speaking out loud. **A red emergency is always loud.**

---

## The safety rules

1. **Her plan can only make Neema more careful, never less.** If two limits disagree, the stricter one wins. Nothing in the plan can loosen the general settings, even by mistake.
2. **Every change has a reason and an end date** that she can see.
3. **It updates itself.** Recording the birth, correcting it, or going back to pregnancy rebuilds the plan. After 6 weeks the after-birth items end, and Neema eases back to normal watching.
4. **Doctors set the numbers.** Every number in the plan is a **draft placeholder**, kept in the same place as Neema's other draft limits, until a clinician sets them. The current drafts are: heartbeat at rest 100 or more for 20 minutes; 15 beats above her settled heartbeat; fever at 37.8 °C instead of 38.0 °C; blood pressure every 2 days; 6 weeks after birth.
5. **Nothing leaves the phone except the alert SMS.** The plan is worked out on her phone from what is already saved there.

## How we checked it

- **156 automatic tests** pass, including 22 new ones for the plan: no history means no change; Wanjiku's afternoon (green before, yellow from 2:30 pm now); stricter always wins; items end after 6 weeks; pregnancy and after-birth items never mix; the CHP message; the once-a-day daytime buzz.
- **A new end-to-end walk-through** (`scripts/e2e_watch_plan.py`, 26 checks) registers a mother after a loss with past high blood pressure, records a caesarean birth with heavy bleeding, and checks the card, the questions, the CHP message, the quiet setting, and that everything ends after 6 weeks.
- **The existing walk-throughs** (demo 36, journeys 81, after birth 59) all pass.

## What we must be honest about

- **A clinician must set the real numbers** before Neema is used with mothers. Until then this is a working prototype.
- **Swahili wording** of the new reasons, card and SMS line needs a Swahili speaker's review.
- **The band cannot yet tell rest from hard work.** Carrying loads or walking far raises the heartbeat, and Neema may ask her to check when she is simply busy. It asks first, it does not call for help, but it could become tiring. Step 5 below addresses this.
- **For mothers without a plan, nothing changed.** With the general settings, a heartbeat that climbs slowly to about 110 after birth, with no fever, still stays green. Whether every mother should get the new heartbeat checks after birth, at gentler limits, is a decision for the clinicians. Our simulation is ready to show them.
- **The band needs the phone nearby.** The phone does all the thinking. If the phone is off, out of battery or too far away, the band is not watching her. Step 5 is about this.

---

## Step 5, for the future: the band carries her plan

*This is a proposal for the hardware team. Nothing below has been built.*

### Why

A mother earning her day's bread is out all day. Her phone may run out of battery with nowhere to charge it, be left at home, or switch the app off to save power. In those hours the band is still on her wrist and still feeling her heartbeat, but nobody is judging it. If something goes wrong then, nothing buzzes.

### The idea

When the phone and band are connected, the phone gives the band a short note about her:

> "For this mother, if her heartbeat stays above this number while she is resting, or her temperature goes above this, buzz red."

The band keeps that note. If the phone disappears, the band still has her most important limits and can **warn her by itself**. It also **writes down what happened** while the phone was away. When the phone comes back, the band hands over the record, Neema catches up, and her CHP is told if needed.

### What it would take

- **A new instruction from the phone to the band** carrying one or two of her limits (today the band understands only "light," "buzz" and "practice").
- **Simple checking on the band**: a heartbeat held high for a set time, or a high temperature. The full rules, the questions and the messages to her people stay on the phone.
- **A small memory on the band** for a few hours of readings, sent to the phone when it reconnects.
- **A movement sensor**, so the band knows whether she is resting or carrying a load. This would also stop hard work from being mistaken for danger. It is currently listed as out of scope, so it is a team decision.
- **Testing on the real band**: that it buzzes at the right time, how much faster the battery drains, that the stored record arrives safely, and that the band never stays silent when the phone is missing.
- **Clinicians set the limits**, as for everything else.

### How we would say it

> "Today the band is the hand and the phone is the brain. Next, we want the band to carry a small piece of the brain with it, so that even if her phone dies while she is out earning her day's bread, the band on her wrist still knows her story and can warn her."

---

### Where the work lives (for the team)

- Plan rules and stricter-wins merge: `packages/core/src/watchPlan.ts` (tests: `packages/core/test/watchPlan.test.ts`)
- New heartbeat checks R18 and R19 and the settled heartbeat: `packages/core/src/triage.ts`, `baseline.ts`, `config/triage.config.json`
- App: `services/watchPlan.ts`, `hooks/useWatchPlan.ts`, `ui/WatchingCard.tsx`, `services/quietMode.ts`, `services/bandFeedback.ts` (`nudgeIfCheckDue`), `services/alertChain.ts` (SMS line), `services/delivery.ts` (settled heartbeat restarts at birth)
