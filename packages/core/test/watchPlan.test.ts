import { describe, expect, it } from 'vitest';
import { evaluateTriage, getDefaultTriageConfig } from '../src/triage.js';
import { createBaseline, referenceValue, updateBaseline, updateReference, zScore } from '../src/baseline.js';
import { AFTER_BIRTH_WATCH_DAYS, applyStricter, bpCheckDue, buildWatchPlan, dueCheckNudge, type WatchPlanInput } from '../src/watchPlan.js';
import { buildAlertSmsText, topReason } from '../src/messages/reasons.js';
import type { TriageResult, VitalsMinute } from '../src/types.js';

const base = getDefaultTriageConfig();
const MIN = 60_000;
const DAY = 86_400_000;
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

function input(over: Partial<WatchPlanInput> = {}): WatchPlanInput {
  return { nowMs: at(2026, 11, 28), stage: 'pregnancy', gaWeeks: 30, pastComplications: [], conditions: [], ...over };
}

const wanjiku = (nowMs = at(2026, 11, 28, 16)): WatchPlanInput =>
  input({
    nowMs,
    stage: 'postpartum',
    gaWeeks: null,
    birth: { dateIso: '2026-11-26', mode: 'vaginal', complications: ['heavy_bleeding', 'transfusion'] },
  });

describe('watch plan', () => {
  it('no history: empty plan and the general settings, exactly as before', () => {
    const plan = buildWatchPlan(input(), base);
    expect(plan.items).toEqual([]);
    expect(plan.ask).toEqual([]);
    expect(plan.bpEveryDays).toBeNull();
    expect(plan.config).toEqual(base);
    expect(base.pulse.restingFastBpm).toBeNull();
    expect(base.pulse.slowRise.enabled).toBe(false);
  });

  it('Wanjiku (heavy bleeding + transfusion, day 2): pulse watched closely, with a reason and an end date', () => {
    const plan = buildWatchPlan(wanjiku(), base);
    expect(plan.items.map((i) => i.id)).toEqual(['pp_bleeding']);
    const item = plan.items[0]!;
    expect(item.reason.en).toBe('You bled heavily when you gave birth.');
    expect(item.reason.sw).toBeTruthy();
    expect(item.untilMs).toBe(at(2026, 11, 26, 0) + (AFTER_BIRTH_WATCH_DAYS + 1) * DAY);
    expect(plan.config.pulse.restingFastBpm).toBe(100);
    expect(plan.config.pulse.slowRise).toMatchObject({ enabled: true, bpmAboveReference: 15 });
    expect(plan.ask).toEqual(['bleeding_heavier', 'dizzy_faint', 'chest_pain_breathless']);
  });

  it('never changes the general settings object', () => {
    const before = JSON.stringify(base);
    buildWatchPlan(wanjiku(), base);
    expect(JSON.stringify(base)).toBe(before);
  });

  it('stricter wins, and a looser value is ignored', () => {
    const once = applyStricter(base, { feverTempC: 37.8, restingFastBpm: 100, slowRiseBpm: 15 });
    const looser = applyStricter(once, { feverTempC: 39, restingFastBpm: 120, slowRiseBpm: 30 });
    expect(looser.fever.tempC).toBe(37.8);
    expect(looser.pulse.restingFastBpm).toBe(100);
    expect(looser.pulse.slowRise).toMatchObject({ enabled: true, bpmAboveReference: 15 });
    const loosenGeneral = applyStricter(base, { feverTempC: 40 });
    expect(loosenGeneral.fever.tempC).toBe(base.fever.tempC);
  });

  it('two items on the same thing keep the stricter one and merge questions without repeats', () => {
    const plan = buildWatchPlan(
      input({
        nowMs: at(2026, 11, 28),
        stage: 'postpartum',
        gaWeeks: null,
        conditions: ['anaemia'],
        birth: { dateIso: '2026-11-20', mode: 'caesarean', complications: ['heavy_bleeding', 'infection', 'high_bp'] },
      }),
      base,
    );
    expect(plan.items.map((i) => i.id)).toEqual(['pp_bleeding', 'pp_bp', 'pp_infection', 'pp_caesarean', 'anaemia']);
    expect(plan.config.fever.tempC).toBe(37.8);
    expect(plan.bpEveryDays).toBe(2);
    expect(new Set(plan.ask).size).toBe(plan.ask.length);
    expect(plan.ask.filter((c) => c === 'dizzy_faint')).toHaveLength(1);
  });

  it('after-birth items end after 6 weeks', () => {
    const born = at(2026, 11, 26, 0);
    const day42 = buildWatchPlan(wanjiku(born + 42 * DAY + 12 * 3600_000), base);
    const day43 = buildWatchPlan(wanjiku(born + 43 * DAY + 1), base);
    expect(day42.items).toHaveLength(1);
    expect(day43.items).toEqual([]);
    expect(day43.config).toEqual(base);
  });

  it('a pregnant mother never gets after-birth items, and the reverse', () => {
    const pregnant = buildWatchPlan(
      input({ birth: { dateIso: '2026-11-26', mode: 'caesarean', complications: ['heavy_bleeding'] } }),
      base,
    );
    expect(pregnant.items).toEqual([]);
    const after = buildWatchPlan(
      input({ stage: 'postpartum', pastComplications: ['loss'], gaWeeks: 39, birth: { dateIso: '2026-11-26', mode: 'vaginal', complications: [] } }),
      base,
    );
    expect(after.items.map((i) => i.id)).not.toContain('preg_after_loss');
  });

  it('after a past loss, baby movement is asked every day from 28 weeks, not before', () => {
    expect(buildWatchPlan(input({ pastComplications: ['loss'], gaWeeks: 20 }), base).ask).not.toContain('baby_moving_less');
    const at30 = buildWatchPlan(input({ pastComplications: ['loss'], gaWeeks: 30 }), base);
    expect(at30.items.map((i) => i.id)).toEqual(['preg_after_loss']);
    expect(at30.ask).toEqual(['baby_moving_less']);
  });

  it('high blood pressure before: blood pressure every two days, in pregnancy and after birth', () => {
    const preg = buildWatchPlan(input({ conditions: ['high_bp'] }), base);
    expect(preg.items.map((i) => i.id)).toEqual(['preg_bp']);
    expect(preg.bpEveryDays).toBe(2);
    const after = buildWatchPlan(
      input({ stage: 'postpartum', pastComplications: ['high_bp'], birth: { dateIso: '2026-11-26', mode: 'vaginal', complications: [] } }),
      base,
    );
    expect(after.items.map((i) => i.id)).toEqual(['pp_bp']);
  });

  it('a past heavy bleed (earlier birth) also watches the pulse after this birth, with its own reason', () => {
    const plan = buildWatchPlan(
      input({ stage: 'postpartum', pastComplications: ['bleeding'], birth: { dateIso: '2026-11-26', mode: 'vaginal', complications: [] } }),
      base,
    );
    expect(plan.items[0]?.reason.en).toBe('You bled heavily after an earlier birth.');
  });

  it('after birth with no usable birth date, nothing is guessed', () => {
    const plan = buildWatchPlan(input({ stage: 'postpartum', birth: { dateIso: 'not-a-date', mode: 'vaginal', complications: ['heavy_bleeding'] } }), base);
    expect(plan.items).toEqual([]);
  });

  it('every reason has Swahili and never says high-risk or names an illness', () => {
    const plan = buildWatchPlan(
      input({
        stage: 'postpartum',
        conditions: ['anaemia', 'high_bp'],
        pastComplications: ['bleeding'],
        birth: { dateIso: '2026-11-26', mode: 'caesarean', complications: ['infection'] },
      }),
      base,
    );
    for (const item of plan.items) {
      expect(item.reason.sw.length).toBeGreaterThan(5);
      expect(item.reason.en.toLowerCase()).not.toMatch(/high-risk|high risk|pre-?eclampsia|haemorrhage|sepsis/);
    }
  });

  it('blood pressure is due when her last reading is older than the plan asks', () => {
    const plan = buildWatchPlan(input({ conditions: ['high_bp'] }), base);
    const now = at(2026, 11, 28);
    expect(bpCheckDue(plan, null, now)).toBe(true);
    expect(bpCheckDue(plan, now - 1 * DAY, now)).toBe(false);
    expect(bpCheckDue(plan, now - 2 * DAY, now)).toBe(true);
    expect(bpCheckDue(buildWatchPlan(input(), base), null, now)).toBe(false);
  });
});

/**
 * Wanjiku's afternoon. Three quiet days at about 86 bpm, then from noon her pulse
 * creeps up to about 112 by 4 pm. No fever, no blood pressure reading.
 */
function afternoon(config = base): { time: string; result: TriageResult }[] {
  const start = at(2026, 11, 25, 12);
  const riseStart = at(2026, 11, 28, 12);
  const end = at(2026, 11, 28, 16);
  const noise = (k: number) => 3 * Math.sin(k * 1.7) * Math.cos(k * 0.31);
  let fast = createBaseline('hr', start);
  let settled = createBaseline('hr_ref', start);
  const minutes: VitalsMinute[] = [];
  const out: { time: string; result: TriageResult }[] = [];
  for (let t = start, k = 0; t <= end; t += MIN, k++) {
    const trend = t < riseStart ? 86 : 86 + 26 * ((t - riseStart) / (end - riseStart));
    const hr = Math.round(trend + noise(k));
    minutes.push({ tsMs: t, hrMean: hr, hrMin: hr - 2, hrMax: hr + 2, tempMeanC: 36.7, validFraction: 1 });
    fast = updateBaseline(fast, hr, t).state;
    settled = updateReference(settled, hr, t).state;
    if (t >= riseStart && (t - riseStart) % (15 * MIN) === 0) {
      const result = evaluateTriage(
        {
          nowMs: t,
          stage: 'postpartum',
          vitals: minutes.filter((v) => t - v.tsMs <= 30 * MIN),
          bp: [],
          symptoms: [],
          sosActive: false,
          markedResting: true,
          baselineZ: { hr: zScore(fast, hr), temp: null },
          hrReference: referenceValue(settled),
          timeZone: 'Africa/Nairobi',
        },
        config,
      );
      const d = new Date(t);
      out.push({ time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`, result });
    }
  }
  return out;
}

describe("Wanjiku's afternoon at the market", () => {
  it('general settings: a slow climb to about 110 bpm stays GREEN all afternoon (the gap)', () => {
    const checks = afternoon();
    expect(checks.every((c) => c.result.level === 'GREEN')).toBe(true);
  });

  it('her plan: Neema asks her to check by mid-afternoon, and keeps asking', () => {
    const checks = afternoon(buildWatchPlan(wanjiku(), base).config);
    const first = checks.findIndex((c) => c.result.level === 'YELLOW');
    expect(first).toBeGreaterThan(-1);
    expect(checks[first]!.time).toBe('14:30');
    expect(checks.slice(first).every((c) => c.result.level === 'YELLOW')).toBe(true);
    const last = checks[checks.length - 1]!.result;
    expect(last.firedRules).toEqual(expect.arrayContaining(['R18_PULSE_FAST_AT_REST', 'R19_PULSE_RISING']));
    expect(last.messageKey).toBe('yellow_pulse_baseline');
    expect(['pulse_rising', 'pulse_fast_resting']).toContain(topReason(last.reasons));
  });
});

describe('new pulse checks', () => {
  const now = at(2026, 11, 28, 15);
  const steady = (hr: number, count = 20): VitalsMinute[] =>
    Array.from({ length: count }, (_, i) => ({ tsMs: now - (count - 1 - i) * MIN, hrMean: hr, hrMin: hr, hrMax: hr, tempMeanC: 36.7, validFraction: 1 }));
  const inp = (vitals: VitalsMinute[], hrReference: number | null = 85) => ({
    nowMs: now,
    stage: 'postpartum' as const,
    vitals,
    bp: [],
    symptoms: [],
    sosActive: false,
    markedResting: true,
    baselineZ: { hr: null, temp: null },
    hrReference,
  });
  const on = applyStricter(base, { restingFastBpm: 100, slowRiseBpm: 15 });

  it('one fast minute is not enough: the pulse must stay up', () => {
    const vitals = [...steady(86, 19), { tsMs: now, hrMean: 130, hrMin: 128, hrMax: 132, tempMeanC: 36.7, validFraction: 1 }];
    expect(evaluateTriage(inp(vitals), on).firedRules).not.toContain('R18_PULSE_FAST_AT_REST');
  });

  it('a gap in the band signal is not read as a pulse', () => {
    expect(evaluateTriage(inp(steady(110, 8)), on).firedRules).not.toContain('R18_PULSE_FAST_AT_REST');
  });

  it('slow rise needs her settled pulse; without it, only the fast-at-rest limit can fire', () => {
    const r = evaluateTriage(inp(steady(104), null), on);
    expect(r.firedRules).toContain('R18_PULSE_FAST_AT_REST');
    expect(r.firedRules).not.toContain('R19_PULSE_RISING');
  });

  it('the new checks only ever ask her to check (YELLOW); fever with a fast pulse after birth stays RED', () => {
    const hot = steady(112).map((v) => ({ ...v, tempMeanC: 38.4 }));
    expect(evaluateTriage(inp(hot), on).level).toBe('RED');
    expect(evaluateTriage(inp(steady(112)), on).level).toBe('YELLOW');
  });
});

describe('the CHP heads-up', () => {
  it('a YELLOW SMS says why she is watched closely; RED (which also reaches family) does not', () => {
    const reason = buildWatchPlan(wanjiku(), base).items[0]!.reason.chpSw;
    const yellow = buildAlertSmsText({ level: 'YELLOW', motherName: 'Wanjiku', reasons: ['pulse_rising'], watching: reason });
    expect(yellow).toBe(
      'NEEMA: Mama Wanjiku yuko YELLOW. Sababu: mapigo ya moyo yanaendelea kupanda. Anaangaliwa kwa karibu: alitoka damu nyingi alipojifungua. Tunapima tena. Tafadhali mfuatilie leo.',
    );
    const red = buildAlertSmsText({ level: 'RED', motherName: 'Wanjiku', reasons: ['sos'], watching: reason });
    expect(red).not.toContain('Anaangaliwa');
    const plain = buildAlertSmsText({ level: 'YELLOW', motherName: 'Wanjiku', reasons: ['fever'] });
    expect(plain).not.toContain('Anaangaliwa');
  });
});

describe('gentle band buzz when a check is due', () => {
  const plan = buildWatchPlan(input({ conditions: ['high_bp'] }), base);
  const morning = at(2026, 11, 28, 9);

  it('buzzes once a day in daytime when blood pressure is due', () => {
    expect(dueCheckNudge(plan, null, morning, null)).toEqual({ nudge: true, dayIso: '2026-11-28' });
    expect(dueCheckNudge(plan, null, morning + 3600_000, '2026-11-28').nudge).toBe(false);
    expect(dueCheckNudge(plan, null, morning + DAY, '2026-11-28').nudge).toBe(true);
  });

  it('never at night, never when the check was done, never without a plan asking', () => {
    expect(dueCheckNudge(plan, null, at(2026, 11, 28, 22), null).nudge).toBe(false);
    expect(dueCheckNudge(plan, null, at(2026, 11, 28, 5), null).nudge).toBe(false);
    expect(dueCheckNudge(plan, morning - 3600_000, morning, null).nudge).toBe(false);
    expect(dueCheckNudge(buildWatchPlan(input(), base), null, morning, null).nudge).toBe(false);
  });
});
