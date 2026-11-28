/**
 * On Health history: pick a period, then show a scannable code for a doctor or nurse.
 * The code is built on this phone. Nothing is sent over the internet.
 */

import { useMemo, useState } from 'react';
import type { AlertRecord, BpReading, Stage, SymptomReport, TriageLevel } from '@neema/core';
import type { Lang } from '../hooks/useLocale';
import type { MamaProfile } from '../services/passport';
import { buildDoctorShare, formatShareWindow, periodWindow, type SharePeriod } from '../services/doctorShare';
import type { ClinicalNoteRow, VisitRecord } from '../storage/db';
import { Segmented } from './Segmented';
import { SummaryQr } from './SummaryQr';

/** Same fields the nurse summary already honours. */
const SHARE = {
  includeBpTrend: true,
  includeAlerts: true,
  includeSymptoms: true,
  includeDueDate: true,
} as const;

export function DoctorShare({
  lang,
  ready,
  profile,
  bp,
  symptoms,
  alerts,
  visits,
  clinical,
  level,
}: {
  lang: Lang;
  ready: boolean;
  profile: MamaProfile | null;
  bp: BpReading[];
  symptoms: SymptomReport[];
  alerts: AlertRecord[];
  visits: VisitRecord[];
  clinical: ClinicalNoteRow[];
  level: TriageLevel;
}) {
  const sw = lang === 'sw';
  const tx = (en: string, swText: string) => (sw ? swText : en);
  const [period, setPeriod] = useState<SharePeriod>('7d');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [open, setOpen] = useState(false);

  const share = useMemo(() => {
    if (!ready) return null;
    const stage: Stage = profile?.stage ?? 'pregnancy';
    return buildDoctorShare({
      displayName: profile?.displayName?.trim() || 'Mama',
      stage,
      ...(profile?.gestationWeeks !== undefined ? { gestationWeeks: profile.gestationWeeks } : {}),
      ...(profile?.expectedDeliveryDate ? { expectedDeliveryDate: profile.expectedDeliveryDate } : {}),
      ...(stage === 'postpartum' && profile?.delivery
        ? { deliveryDate: profile.delivery.dateIso, deliveryMode: profile.delivery.mode }
        : {}),
      ...(profile?.healthNotes ? { healthNotes: profile.healthNotes } : {}),
      bp,
      symptoms,
      alerts,
      visits,
      clinical,
      share: SHARE,
      latestLevel: level,
      period,
      nowMs,
    });
  }, [ready, profile, bp, symptoms, alerts, visits, clinical, level, period, nowMs]);

  const dates = formatShareWindow(share?.window ?? periodWindow(period, nowMs), lang);
  const name = profile?.displayName?.trim() || 'Mama';
  const counts = share?.counts;

  return (
    <section className="home-card hist-share" aria-labelledby="hist-share-title" data-share-period={period}>
      <h2 id="hist-share-title">{tx('Share with a doctor', 'Shiriki na daktari')}</h2>
      <p className="hist-sub">
        {tx('Pick a time. They scan a code. Nothing is sent online.', 'Chagua muda. Watascan msimbo. Hakuna kinachotumwa mtandaoni.')}
      </p>
      <Segmented
        mode="radio"
        className="hist-share__periods"
        ariaLabel={tx('Time to share', 'Muda wa kushiriki')}
        value={period}
        onChange={(next) => {
          setPeriod(next);
          setNowMs(Date.now());
        }}
        options={[
          { value: '7d', label: tx('Last 7 days', 'Siku 7 zilizopita') },
          { value: '30d', label: tx('Last 30 days', 'Siku 30 zilizopita') },
          { value: 'all', label: tx('Everything on this phone', 'Yote kwenye simu hii') },
        ]}
      />
      <p className="hist-share__dates" id="hist-share-dates">
        {dates}
      </p>
      <button type="button" className="btn btn-primary btn-block" disabled={!ready} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? tx('Hide the code', 'Ficha msimbo') : tx('Show the code', 'Onyesha msimbo')}
      </button>
      {open && share?.empty ? (
        <div className="hist-share__empty" id="hist-share-empty" role="status">
          <p>{tx('Nothing saved in these dates.', 'Hakuna kilichohifadhiwa kwa tarehe hizi.')}</p>
          <p>
            <strong>{name}</strong>
          </p>
          <p>{dates}</p>
        </div>
      ) : null}
      {open && share && !share.empty ? (
        <div className="hist-share__qr">
          <SummaryQr payload={share.payload} label={tx('Code for the doctor', 'Msimbo kwa daktari')} />
          <p className="hist-share__who">
            <strong>{name}</strong>
            <span>{dates}</span>
          </p>
          {counts ? (
            <p className="hist-share__counts" id="hist-share-counts">
              {tx(
                `Included: ${counts.bp} blood pressure, ${counts.symptoms} symptoms, ${counts.alerts} alerts, ${counts.visits} visits, ${counts.notes} notes.`,
                `Imejumuishwa: shinikizo ${counts.bp}, dalili ${counts.symptoms}, tahadhari ${counts.alerts}, ziara ${counts.visits}, maelezo ${counts.notes}.`,
              )}
            </p>
          ) : null}
          {share.truncated ? (
            <p className="hist-sub">{tx('Some older rows were left out so the code can be scanned.', 'Mengine ya zamani yameachwa ili msimbo usomeke.')}</p>
          ) : null}
          <p className="hist-sub">{tx('Nothing is sent over the internet.', 'Hakuna kinachotumwa mtandaoni.')}</p>
        </div>
      ) : null}
    </section>
  );
}
