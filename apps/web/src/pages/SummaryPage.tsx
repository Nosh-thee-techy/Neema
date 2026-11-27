import { useEffect, useMemo, useState } from 'react';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { BrandMark } from '../ui/BrandMark';
import { Button } from '../ui/Button';
import { SummaryQr } from '../ui/SummaryQr';
import { levelLabel } from '../ui/levelLabel';
import { buildSummaryForQr } from '../services/summaryQr';
import { loadProfile } from '../services/passport';
import { db } from '../storage/db';

/** Nurse handoff — explain why mom would show this. */
export function SummaryPage() {
  const g = useGuardian();
  const { t, lang } = useLocale();
  const [name, setName] = useState('Mama');
  const [payload, setPayload] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      const profile = await loadProfile().catch(() => null);
      if (profile?.displayName) setName(profile.displayName);
      const bp = await db.bp.orderBy('tsMs').toArray();
      const symptoms = await db.symptoms.orderBy('tsMs').toArray();
      const alerts = await db.alerts.orderBy('tsMs').toArray();
      const built = buildSummaryForQr({
        displayName: profile?.displayName ?? 'Mama',
        stage: profile?.stage ?? 'pregnancy',
        gestationWeeks: profile?.gestationWeeks,
        expectedDeliveryDate: profile?.expectedDeliveryDate,
        ...(profile?.stage === 'postpartum' && profile.delivery ? { deliveryDate: profile.delivery.dateIso, deliveryMode: profile.delivery.mode } : {}),
        bp,
        symptoms,
        alerts,
        recentVitals: [],
        latestLevel: g.triage?.level ?? 'UNKNOWN',
        share: {
          includeBpTrend: true,
          includeAlerts: true,
          includeSymptoms: true,
          includeDueDate: true,
        },
        generatedAtMs: Date.now(),
      });
      setPayload(built.payload);
    })();
  }, [g.triage?.level]);

  const preview = useMemo(() => {
    try {
      return JSON.parse(payload || '{}') as { level?: string; mother?: string };
    } catch {
      return {};
    }
  }, [payload]);

  return (
    <main className="screen">
      <BrandMark />
      <h1 className="screen-title" style={{ marginTop: '1rem' }}>
        {lang === 'sw' ? 'Kwa muuguzi' : 'For the nurse'}
      </h1>
      <p className="screen-sub">{t('nurse_why')}</p>
      <div className="panel" style={{ textAlign: 'center' }}>
        <div style={{ display: 'grid', placeItems: 'center', marginBottom: '1rem' }}>
          <SummaryQr payload={payload} />
        </div>
        <p style={{ margin: 0 }}>
          <strong>{preview.mother ?? name}</strong> · {levelLabel(g.triage?.level ?? 'UNKNOWN', lang)}
        </p>
      </div>
      <Button
        variant="primary"
        style={{ width: '100%', marginTop: '1rem' }}
        onClick={async () => {
          await navigator.clipboard?.writeText(payload);
          setCopied(true);
        }}
      >
        {copied
          ? lang === 'sw'
            ? 'Imenakiliwa'
            : 'Copied'
          : lang === 'sw'
            ? 'Nakili taarifa'
            : 'Copy summary'}
      </Button>
      <p className="trust-line">{t('saved_here')}</p>
    </main>
  );
}
