/**
 * Dashboard sections shared by Home and the Band screen, so both look the same:
 * a row of ring gauges, the "Tonight" card (heart rate against her own normal),
 * and a trend chart. Every colour comes from the same thresholds the rules use.
 */

import { useState } from 'react';
import {
  calibrateSkinTempC,
  getDefaultTriageConfig,
  type BpReading,
  type Stage,
  type TriageResult,
  type VitalsSample,
} from '@neema/core';
import type { Lang } from '../hooks/useLocale';
import type { VitalsTrend } from '../hooks/useVitalsTrend';
import { RingGauge, type GaugeTone } from './RingGauge';
import { NormalArc } from './NormalArc';
import { TrendChart } from './TrendChart';
import { IconBand, IconHeart, IconPressure, IconTemp, IconUser } from './icons';

const config = getDefaultTriageConfig();
const FULL_TERM_WEEKS = 40;

const sw = (lang: Lang, swText: string, enText: string) => (lang === 'sw' ? swText : enText);
const fmt = (v: number, d = 0) => v.toFixed(d);

/** Calibrated temperature, the same number the rules see. */
export function displayTemp(sample: VitalsSample | null): number | null {
  return sample?.skinTempC != null ? calibrateSkinTempC(sample.skinTempC) : null;
}

function hrTone(hr: number | null, trend: VitalsTrend, triage: TriageResult | null): GaugeTone {
  if (hr === null) return 'muted';
  if (triage?.reasons.some((r) => r.includes('pulse'))) return triage.level === 'RED' ? 'alert' : 'watch';
  const band = trend.hr.range;
  if (band && (hr < band.low || hr > band.high)) return 'watch';
  return 'calm';
}

function tempTone(temp: number | null, triage: TriageResult | null): GaugeTone {
  if (temp === null) return 'muted';
  if (triage?.reasons.some((r) => r.includes('fever'))) return triage.level === 'RED' ? 'alert' : 'watch';
  return temp >= config.fever.tempC ? 'watch' : 'calm';
}

function bpTone(bp: BpReading | null): GaugeTone {
  if (!bp) return 'muted';
  if (bp.systolic >= config.bp.severeSys || bp.diastolic >= config.bp.severeDia) return 'alert';
  if (bp.systolic >= config.bp.raisedSys || bp.diastolic >= config.bp.raisedDia) return 'watch';
  return 'calm';
}

interface RingsProps {
  lang: Lang;
  sample: VitalsSample | null;
  connected: boolean;
  trend: VitalsTrend;
  triage: TriageResult | null;
  lastBp?: BpReading | null;
  stage?: Stage;
  gestationWeeks?: number | null;
  /** Which rings to show, in order. */
  show: ('hr' | 'temp' | 'bp' | 'weeks' | 'signal' | 'battery')[];
  onOpen?: (key: string) => void;
}

/** A horizontally scrolling row of ring gauges. */
export function VitalRings({ lang, sample, connected, trend, triage, lastBp = null, stage, gestationWeeks, show, onOpen }: RingsProps) {
  const hr = connected ? (sample?.heartRate ?? null) : null;
  const temp = connected ? displayTemp(sample) : null;
  const signal = connected ? (sample?.signalQuality ?? 0) : null;
  const battery = connected ? (sample?.batteryPct ?? null) : null;
  const hrBand = trend.hr.range;

  const rings = {
    hr: (
      <RingGauge
        key="hr"
        label={sw(lang, 'Mapigo', 'Heart')}
        value={hr === null ? '—' : String(Math.round(hr))}
        unit={hr === null ? undefined : 'bpm'}
        fraction={hr === null ? null : (hr - 40) / 120}
        tone={hrTone(hr, trend, triage)}
        icon={<IconHeart />}
        note={hrBand ? `${fmt(hrBand.low)}–${fmt(hrBand.high)}` : sw(lang, 'inajifunza', 'learning')}
        onClick={onOpen ? () => onOpen('hr') : undefined}
      />
    ),
    temp: (
      <RingGauge
        key="temp"
        label={sw(lang, 'Joto', 'Temp')}
        value={temp === null ? '—' : fmt(temp, 1)}
        unit={temp === null ? undefined : '°'}
        fraction={temp === null ? null : (temp - 35) / 5}
        tone={tempTone(temp, triage)}
        icon={<IconTemp />}
        note={`${sw(lang, 'homa', 'fever')} ≥${fmt(config.fever.tempC, 1)}`}
        onClick={onOpen ? () => onOpen('temp') : undefined}
      />
    ),
    bp: (
      <RingGauge
        key="bp"
        label={sw(lang, 'Shinikizo', 'BP')}
        value={lastBp ? `${lastBp.systolic}` : '—'}
        unit={lastBp ? `/${lastBp.diastolic}` : undefined}
        fraction={lastBp ? lastBp.systolic / config.bp.severeSys : null}
        tone={bpTone(lastBp)}
        icon={<IconPressure />}
        note={lastBp ? new Date(lastBp.tsMs).toLocaleTimeString(lang === 'sw' ? 'sw-KE' : 'en-KE', { hour: '2-digit', minute: '2-digit' }) : sw(lang, 'pima', 'add one')}
        onClick={onOpen ? () => onOpen('bp') : undefined}
      />
    ),
    weeks:
      stage === 'pregnancy' && gestationWeeks ? (
        <RingGauge
          key="weeks"
          label={sw(lang, 'Wiki', 'Week')}
          value={String(gestationWeeks)}
          fraction={gestationWeeks / FULL_TERM_WEEKS}
          tone="accent"
          icon={<IconUser />}
          note={sw(lang, `kati ya ${FULL_TERM_WEEKS}`, `of ${FULL_TERM_WEEKS}`)}
          onClick={onOpen ? () => onOpen('weeks') : undefined}
        />
      ) : null,
    signal: (
      <RingGauge
        key="signal"
        label={sw(lang, 'Bendi', 'Band')}
        value={signal === null ? '—' : String(signal)}
        unit={signal === null ? undefined : '%'}
        fraction={signal === null ? null : signal / 100}
        tone={signal === null ? 'muted' : signal >= 50 ? 'calm' : 'watch'}
        icon={<IconBand />}
        note={signal === null ? sw(lang, 'haijaunganishwa', 'not connected') : sw(lang, 'ishara', 'signal')}
        onClick={onOpen ? () => onOpen('signal') : undefined}
      />
    ),
    battery: (
      <RingGauge
        key="battery"
        label={sw(lang, 'Betri', 'Battery')}
        value={battery === null ? '—' : String(battery)}
        unit={battery === null ? undefined : '%'}
        fraction={battery === null ? null : battery / 100}
        tone={battery === null ? 'muted' : battery >= 25 ? 'accent' : 'watch'}
        note={battery !== null && battery < 25 ? sw(lang, 'chaji leo', 'charge today') : sw(lang, 'ya bendi', 'band')}
      />
    ),
  };

  return <div className="ring-row">{show.map((k) => rings[k]).filter(Boolean)}</div>;
}

interface TonightProps {
  lang: Lang;
  sample: VitalsSample | null;
  connected: boolean;
  trend: VitalsTrend;
}

/** "Tonight" card: heart rate now on an arc, with her normal band once it is learned. */
export function TonightCard({ lang, sample, connected, trend }: TonightProps) {
  const hr = connected ? (sample?.heartRate ?? null) : null;
  const temp = connected ? displayTemp(sample) : null;
  const band = trend.hr.range;
  const outside = hr !== null && band !== null && (hr < band.low || hr > band.high);
  const learningPct = Math.round(trend.hr.progress * 100);
  const validMinutes = trend.minutes.filter((m) => m.validFraction >= 0.5).length;

  const caption =
    hr === null
      ? sw(lang, 'Unganisha bendi', 'Connect the band')
      : band
        ? outside
          ? sw(lang, 'Nje ya kawaida yako', 'Outside your normal')
          : sw(lang, 'Ndani ya kawaida yako', 'Within your normal')
        : sw(lang, 'Mapigo sasa', 'Heart rate now');

  return (
    <section className="tonight" aria-label={sw(lang, 'Usiku huu', 'Tonight')}>
      <header className="tonight__head">
        <span className="tonight__eyebrow">{sw(lang, 'Usiku huu', 'Tonight')}</span>
        <span className="tonight__live" data-on={hr !== null}>
          {hr !== null ? sw(lang, 'Moja kwa moja', 'Live') : sw(lang, 'Imesimama', 'Paused')}
        </span>
      </header>
      <NormalArc
        min={40}
        max={160}
        value={hr}
        band={band}
        display={hr === null ? '—' : String(Math.round(hr))}
        caption={caption}
        minLabel="40"
        maxLabel="160 bpm"
      />
      <p className="tonight__text">
        {band
          ? sw(
              lang,
              `Kawaida yako usiku ni mapigo ${fmt(band.low)}–${fmt(band.high)}. Neema inaangalia mabadiliko kutoka kawaida yako, si namba moja.`,
              `Your night-time normal is ${fmt(band.low)}–${fmt(band.high)} bpm. Neema watches for change from your normal, not one fixed number.`,
            )
          : sw(
              lang,
              `Neema bado inajifunza kawaida yako (${learningPct}% ya siku 3). Hadi hapo, kanuni za kawaida pekee ndizo zinatumika.`,
              `Neema is still learning your normal (${learningPct}% of 3 days). Until then, only the fixed rules apply.`,
            )}
      </p>
      {!band ? (
        <div className="tonight__learn" aria-hidden>
          <span style={{ width: `${Math.max(3, learningPct)}%` }} />
        </div>
      ) : null}
      <dl className="tonight__stats">
        <div>
          <dt>{sw(lang, 'Kawaida yako', 'Your normal')}</dt>
          <dd>{band ? `${fmt(band.low)}–${fmt(band.high)}` : `${learningPct}%`}</dd>
        </div>
        <div>
          <dt>{sw(lang, 'Joto', 'Temp')}</dt>
          <dd>{temp === null ? '—' : `${fmt(temp, 1)}°`}</dd>
        </div>
        <div>
          <dt>{sw(lang, 'Dakika saa hii', 'Minutes this hour')}</dt>
          <dd>{validMinutes}</dd>
        </div>
      </dl>
    </section>
  );
}

interface TrendProps {
  lang: Lang;
  trend: VitalsTrend;
  windowMinutes?: number;
}

/** Trend card with a heart rate / temperature switch. */
export function TrendCard({ lang, trend, windowMinutes = 60 }: TrendProps) {
  const [signal, setSignal] = useState<'hr' | 'temp'>('hr');
  const now = Date.now();
  const points =
    signal === 'hr'
      ? trend.minutes.filter((m) => m.hrMean !== null).map((m) => ({ tsMs: m.tsMs, value: m.hrMean as number }))
      : trend.minutes.filter((m) => m.tempMeanC !== null).map((m) => ({ tsMs: m.tsMs, value: m.tempMeanC as number }));

  return (
    <section className="trend-card panel">
      <header className="trend-card__head">
        <div>
          <h2 className="trend-card__title">
            {signal === 'hr' ? sw(lang, 'Mapigo ya moyo', 'Heart rate') : sw(lang, 'Joto', 'Temperature')}
          </h2>
          <p className="soft-note">{sw(lang, `Dakika ${windowMinutes} zilizopita`, `Last ${windowMinutes} minutes`)}</p>
        </div>
        <div className="segmented" role="group" aria-label={sw(lang, 'Chagua kipimo', 'Choose reading')}>
          <button type="button" aria-pressed={signal === 'hr'} onClick={() => setSignal('hr')}>
            {sw(lang, 'Mapigo', 'Heart')}
          </button>
          <button type="button" aria-pressed={signal === 'temp'} onClick={() => setSignal('temp')}>
            {sw(lang, 'Joto', 'Temp')}
          </button>
        </div>
      </header>
      <TrendChart
        points={points}
        windowMinutes={windowMinutes}
        nowMs={now}
        band={signal === 'hr' ? trend.hr.range : trend.temp.range}
        limit={signal === 'temp' ? { value: config.fever.tempC, label: sw(lang, 'homa', 'fever') } : null}
        yMin={signal === 'hr' ? 60 : 36}
        yMax={signal === 'hr' ? 100 : 38.5}
        format={(v) => (signal === 'hr' ? fmt(v) : fmt(v, 1))}
        emptyLabel={sw(lang, 'Bado hakuna vipimo saa hii', 'No readings this hour yet')}
        nowLabel={sw(lang, 'sasa', 'now')}
        ariaLabel={signal === 'hr' ? sw(lang, 'Grafu ya mapigo ya moyo', 'Heart rate chart') : sw(lang, 'Grafu ya joto', 'Temperature chart')}
      />
      <p className="trend-card__legend">
        <span className="trend-card__swatch" />
        {(signal === 'hr' ? trend.hr.range : trend.temp.range)
          ? sw(lang, 'Eneo la kijani: kawaida yako', 'Green band: your normal')
          : sw(lang, 'Kawaida yako itaonekana baada ya siku 3', 'Your normal appears after 3 days')}
      </p>
    </section>
  );
}
