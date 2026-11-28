/**
 * CHP chase list — open YELLOW/RED loops ranked by urgency.
 * Arrival can only be confirmed by a person (CHP or nurse).
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FollowUp } from '@neema/core';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { listChase, markArrival, tickFollowUps } from '../services/followUp';
import { getReadiness } from '../services/readiness';
import { db } from '../storage/db';
import { useLocale } from '../hooks/useLocale';
import { useWatchPlan } from '../hooks/useWatchPlan';

interface ChaseRow extends FollowUp {
  level?: string;
  reason?: string;
  alertTsMs?: number;
}

/** CHP-facing chase list for open alert loops. */
export function ChasePage() {
  const nav = useNavigate();
  const { t, lang } = useLocale();
  const [rows, setRows] = useState<ChaseRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [demoAdvance, setDemoAdvance] = useState(false);
  const { plan } = useWatchPlan();

  const loadRows = useCallback(async () => {
    const open = await listChase();
    const enriched: ChaseRow[] = [];
    for (const f of open) {
      const alert = await db.alerts.get(f.alertId);
      enriched.push({
        ...f,
        level: alert?.level,
        reason: alert?.firedRules[0],
        alertTsMs: alert?.tsMs,
      });
    }
    setRows(enriched);
  }, []);

  useEffect(() => {
    void loadRows();
    void getReadiness().then((r) => setDemoAdvance(!r.fieldReady));
    const id = window.setInterval(() => {
      void tickFollowUps().then(() => loadRows());
    }, 30_000);
    return () => window.clearInterval(id);
  }, [loadRows]);

  async function advanceNow() {
    // Demo helper: advance every open loop one step without waiting 5 minutes.
    await tickFollowUps(Date.now(), 0);
    setNote(lang === 'sw' ? 'Hatua moja mbele.' : 'Advanced one step.');
    await loadRows();
  }

  async function onArrive(alertId: string, by: 'chp' | 'nurse') {
    await markArrival(alertId, by);
    setNote(
      lang === 'sw'
        ? 'Kuwasili kumethibitishwa. Kitanzi kimefungwa.'
        : 'Arrival confirmed. Loop closed.',
    );
    await loadRows();
  }

  return (
    <main className="screen">
      <BrandMark />
      <h1 className="screen-title" style={{ marginTop: '1rem' }}>
        {t('chase_title')}
      </h1>
      <p className="screen-sub">
        {lang === 'sw'
          ? 'RED na YELLOW zilizofunguliwa. Mtu pekee ndiye anayefunga kwa kuwasili.'
          : 'Open RED and YELLOW loops. Only a person closes them by confirming arrival.'}
      </p>
      {plan && plan.items.length > 0 ? (
        <div className="watch-ask" role="note">
          <h2 className="watch-ask__title">{lang === 'sw' ? 'Anaangaliwa kwa karibu' : 'Watched more closely'}</h2>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {plan.items.map((i) => (
              <li key={i.id}>{lang === 'sw' ? i.reason.chpSw : i.reason.en}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {note ? <p className="soft-note">{note}</p> : null}

      {rows.length === 0 ? (
        <div className="panel">
          <p className="soft-note" style={{ margin: 0 }}>
            {lang === 'sw' ? 'Hakuna vitanzi vilivyo wazi sasa.' : 'No open loops right now.'}
          </p>
        </div>
      ) : (
        <div className="check-list" style={{ marginTop: '1rem' }}>
          {rows.map((row) => (
            <div key={row.alertId} className="panel" style={{ marginBottom: '0.75rem' }}>
              <strong>
                {row.level ?? '—'} · {row.stage}
              </strong>
              <p className="soft-note" style={{ margin: '0.35rem 0' }}>
                {row.reason ?? row.alertId.slice(0, 8)}
                {row.chaseCount > 0
                  ? lang === 'sw'
                    ? ` · ufuatiliaji ×${row.chaseCount}`
                    : ` · chased ×${row.chaseCount}`
                  : ''}
              </p>
              <div className="btn-row">
                <Button variant="primary" onClick={() => void onArrive(row.alertId, 'chp')}>
                  {lang === 'sw' ? 'CHP: amefika' : 'CHP: arrived'}
                </Button>
                <Button variant="secondary" onClick={() => void onArrive(row.alertId, 'nurse')}>
                  {lang === 'sw' ? 'Muuguzi: amefika' : 'Nurse: arrived'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row" style={{ marginTop: '1.25rem' }}>
        <Button variant="ghost" onClick={() => nav('/home')}>
          {t('go_home')}
        </Button>
        {demoAdvance ? (
          <Button variant="secondary" onClick={() => void advanceNow()}>
            {lang === 'sw' ? 'Sogeza hatua' : 'Advance step'}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => void loadRows()}>
          {lang === 'sw' ? 'Onyesha upya' : 'Refresh'}
        </Button>
      </div>
    </main>
  );
}
