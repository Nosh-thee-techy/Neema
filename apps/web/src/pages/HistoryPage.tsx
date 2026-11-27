import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDefaultTriageConfig, reasonPhrase, topReason, type AlertRecord, type BpReading, type SymptomCode, type SymptomReport } from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { useVitalsTrend } from '../hooks/useVitalsTrend';
import { TonightCard, TrendCard } from '../ui/VitalsDashboard';
import { db, type VisitRecord } from '../storage/db';
import { listVisits, newVisit, saveVisit } from '../services/visits';
import { listClinicalNotes, type ClinicalNoteRow } from '../services/clinicalNotes';
import { loadProfile } from '../services/passport';

const CONFIG = getDefaultTriageConfig();

type Tab = 'readings' | 'alerts' | 'visits' | 'notes';

const SYMPTOMS: Record<SymptomCode, { en: string; sw: string }> = {
  headache: { en: 'Headache', sw: 'Kichwa kuuma' },
  blurred_vision: { en: 'Blurred vision', sw: 'Kuona ukungu' },
  upper_abdominal_pain: { en: 'Upper belly pain', sw: 'Maumivu juu ya tumbo' },
  heavy_bleeding: { en: 'Heavy bleeding', sw: 'Kutokwa damu nyingi' },
  fever_chills: { en: 'Fever / chills', sw: 'Homa / baridi' },
  baby_moving_less: { en: 'Baby moving less', sw: 'Mtoto anasonga kidogo' },
  swelling_face_hands: { en: 'Swelling face/hands', sw: 'Uvimbe uso/mikono' },
  low_mood: { en: 'Low mood', sw: 'Huzuni' },
  other: { en: 'Other', sw: 'Nyingine' },
};

/** Health History: readings, alerts, clinic visits, and notes (hers vs the nurse's). */
export function HistoryPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const g = useGuardian();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, swText: string) => (sw ? swText : en);
  const trend = useVitalsTrend(`${g.triage?.level ?? ''}:${g.demoStep ?? ''}`);

  const initial: Tab = loc.hash === '#alerts' ? 'alerts' : loc.hash === '#visits' ? 'visits' : loc.hash === '#notes' ? 'notes' : 'readings';
  const [tab, setTab] = useState<Tab>(initial);
  const [bp, setBp] = useState<BpReading[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomReport[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [clinical, setClinical] = useState<ClinicalNoteRow[]>([]);
  const [myNotes, setMyNotes] = useState<string>('');
  const [visitType, setVisitType] = useState<VisitRecord['type']>('antenatal');
  const [visitFacility, setVisitFacility] = useState('');
  const [visitDate, setVisitDate] = useState('');

  useEffect(() => {
    void (async () => {
      const [b, s, a, v, c, p] = await Promise.all([
        db.bp.orderBy('tsMs').reverse().limit(60).toArray(),
        db.symptoms.orderBy('tsMs').reverse().limit(40).toArray(),
        db.alerts.orderBy('tsMs').reverse().limit(40).toArray(),
        listVisits(),
        listClinicalNotes(),
        loadProfile().catch(() => null),
      ]);
      setBp(b);
      setSymptoms(s);
      setAlerts(a);
      setVisits(v);
      setClinical(c);
      setMyNotes(p?.healthNotes ?? '');
    })();
  }, [g.triage?.level, g.activeAlertId]);

  const loc2 = sw ? 'sw-KE' : 'en-KE';
  const dt = (ms: number) =>
    new Date(ms).toLocaleString(loc2, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const d = (ms: number) => new Date(ms).toLocaleDateString(loc2, { day: 'numeric', month: 'long', year: 'numeric' });

  function bpFlag(r: BpReading): { tone: string; text: string } {
    if (r.systolic >= CONFIG.bp.severeSys || r.diastolic >= CONFIG.bp.severeDia) return { tone: 'alert', text: tx('Very high', 'Juu sana') };
    if (r.systolic >= CONFIG.bp.raisedSys || r.diastolic >= CONFIG.bp.raisedDia) return { tone: 'watch', text: tx('High', 'Juu') };
    return { tone: 'calm', text: tx('Below alert level', 'Chini ya hatari') };
  }

  async function addVisit() {
    const ts = visitDate ? new Date(`${visitDate}T09:00`).getTime() : Date.now();
    const v = newVisit({ type: visitType, tsMs: ts, ...(visitFacility.trim() ? { facilityName: visitFacility.trim() } : {}) });
    await saveVisit(v);
    setVisits((prev) => [v, ...prev].sort((a, b) => b.tsMs - a.tsMs));
    setVisitFacility('');
    setVisitDate('');
  }

  const tabs: Array<[Tab, string]> = [
    ['readings', tx('Readings', 'Vipimo')],
    ['alerts', tx('Alerts', 'Tahadhari')],
    ['visits', tx('Visits', 'Kliniki')],
    ['notes', tx('Notes', 'Maelezo')],
  ];

  return (
    <main className="screen hist">
      <h1 className="screen-title">{tx('Health history', 'Historia ya afya')}</h1>
      <p className="screen-sub">{tx('Everything saved on this phone, newest first.', 'Kila kitu kilichohifadhiwa kwenye simu hii, kipya kwanza.')}</p>

      <div className="hist-tabs" role="tablist" aria-label={tx('History sections', 'Sehemu za historia')}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => {
              setTab(id);
              window.history.replaceState(null, '', `#${id}`);
            }}
          >
            {label}
            {id === 'alerts' && alerts.some((a) => a.level === 'RED' && !a.acknowledgedAtMs) ? <i className="hist-tabs__dot" aria-hidden /> : null}
          </button>
        ))}
      </div>

      {tab === 'readings' && (
        <section id="panel-readings" role="tabpanel" aria-labelledby="tab-readings" className="hist-panel">
          <div className="home-card">
            <div className="hist-head">
              <h2>{tx('Blood pressure', 'Shinikizo la damu')}</h2>
              <button type="button" className="home-link" onClick={() => nav('/bp')}>
                + {tx('Add', 'Ongeza')}
              </button>
            </div>
            {bp.length === 0 ? (
              <p className="hist-empty">{tx('No blood pressure saved yet.', 'Bado hakuna shinikizo lililohifadhiwa.')}</p>
            ) : (
              <ul className="hist-list">
                {bp.map((r) => {
                  const f = bpFlag(r);
                  return (
                    <li key={r.id} data-tone={f.tone}>
                      <span className="hist-list__main">
                        <strong>
                          {r.systolic}/{r.diastolic}
                        </strong>{' '}
                        <small>mmHg</small>
                      </span>
                      <span className="hist-list__flag">{f.text}</span>
                      <span className="hist-list__time">
                        {dt(r.tsMs)}
                        {r.source === 'clinic' ? ` · ${tx('clinic', 'kliniki')}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <TonightCard lang={lang} sample={g.sample} connected={g.connected} trend={trend} />
          <TrendCard lang={lang} trend={trend} />

          <div className="home-card">
            <div className="hist-head">
              <h2>{tx('Symptoms you logged', 'Dalili ulizoandika')}</h2>
              <button type="button" className="home-link" onClick={() => nav('/symptoms')}>
                + {tx('Add', 'Ongeza')}
              </button>
            </div>
            {symptoms.length === 0 ? (
              <p className="hist-empty">{tx('None logged.', 'Hakuna.')}</p>
            ) : (
              <ul className="hist-list">
                {symptoms.map((s) => (
                  <li key={s.id}>
                    <span className="hist-list__main">{s.codes.map((c) => (sw ? SYMPTOMS[c].sw : SYMPTOMS[c].en)).join(', ') || '—'}</span>
                    <span className="hist-list__time">{dt(s.tsMs)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === 'alerts' && (
        <section id="panel-alerts" role="tabpanel" aria-labelledby="tab-alerts" className="hist-panel">
          <div className="home-card">
            <h2 className="hist-h2">{tx('Alerts', 'Tahadhari')}</h2>
            {alerts.length === 0 ? (
              <p className="hist-empty">{tx('No alerts so far.', 'Hakuna tahadhari hadi sasa.')}</p>
            ) : (
              <ul className="hist-list">
                {alerts.map((a) => (
                  <li key={a.id} data-tone={a.level === 'RED' ? 'alert' : 'watch'}>
                    <span className="hist-list__main">
                      <strong>{a.level === 'RED' ? tx('Urgent', 'Dharura') : tx('Warning', 'Onyo')}</strong>
                      {a.reasons?.length ? ` · ${reasonPhrase(topReason(a.reasons), lang)}` : ''}
                    </span>
                    <span className="hist-list__flag">
                      {a.acknowledgedAtMs
                        ? tx('Someone acted', 'Mtu alichukua hatua')
                        : a.level === 'RED'
                          ? tx('Still open', 'Bado wazi')
                          : tx('Check again', 'Pima tena')}
                      {a.notified.length ? ` · ${tx('SMS opened', 'SMS ilifunguliwa')}: ${a.notified.length}` : ''}
                    </span>
                    <span className="hist-list__time">{dt(a.tsMs)}</span>
                  </li>
                ))}
              </ul>
            )}
            {alerts.some((a) => a.level === 'RED' && !a.acknowledgedAtMs) ? (
              <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => nav('/alert')}>
                {tx('Open the current alert', 'Fungua tahadhari ya sasa')}
              </button>
            ) : null}
          </div>
        </section>
      )}

      {tab === 'visits' && (
        <section id="panel-visits" role="tabpanel" aria-labelledby="tab-visits" className="hist-panel">
          <div className="home-card">
            <h2 className="hist-h2">{tx('Clinic visits', 'Ziara za kliniki')}</h2>
            {visits.length === 0 ? (
              <p className="hist-empty">{tx('No visits recorded.', 'Hakuna ziara.')}</p>
            ) : (
              <ul className="hist-list">
                {visits.map((v) => (
                  <li key={v.id}>
                    <span className="hist-list__main">
                      <strong>{v.type === 'antenatal' ? tx('Antenatal (ANC)', 'Kliniki ya ujauzito') : v.type === 'postnatal' ? tx('After birth (PNC)', 'Baada ya kujifungua') : tx('Other', 'Nyingine')}</strong>
                      {v.facilityName ? ` · ${v.facilityName}` : ''}
                    </span>
                    {v.clinicSystolic ? (
                      <span className="hist-list__flag">
                        BP {v.clinicSystolic}/{v.clinicDiastolic}
                      </span>
                    ) : null}
                    <span className="hist-list__time">{d(v.tsMs)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="home-card">
            <h2 className="hist-h2">{tx('Add a visit', 'Ongeza ziara')}</h2>
            <div className="field">
              <label htmlFor="visit-type">{tx('Type', 'Aina')}</label>
              <select id="visit-type" value={visitType} onChange={(e) => setVisitType(e.target.value as VisitRecord['type'])}>
                <option value="antenatal">{tx('Antenatal (ANC)', 'Kliniki ya ujauzito')}</option>
                <option value="postnatal">{tx('After birth (PNC)', 'Baada ya kujifungua')}</option>
                <option value="other">{tx('Other', 'Nyingine')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="visit-date">{tx('Date', 'Tarehe')}</label>
              <input id="visit-date" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="visit-fac">{tx('Clinic', 'Kliniki')}</label>
              <input id="visit-fac" value={visitFacility} onChange={(e) => setVisitFacility(e.target.value)} />
            </div>
            <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => void addVisit()}>
              {tx('Save visit', 'Hifadhi ziara')}
            </button>
          </div>
        </section>
      )}

      {tab === 'notes' && (
        <section id="panel-notes" role="tabpanel" aria-labelledby="tab-notes" className="hist-panel">
          <div className="home-card">
            <div className="hist-head">
              <h2>{tx('My notes', 'Maelezo yangu')}</h2>
              <button type="button" className="home-link" onClick={() => nav('/profile#health')}>
                {tx('Edit', 'Badilisha')}
              </button>
            </div>
            <p className="hist-note">{myNotes || tx('No notes yet.', 'Bado hakuna maelezo.')}</p>
          </div>
          <div className="home-card">
            <h2 className="hist-h2">{tx('Notes from your nurse', 'Maelezo ya muuguzi')}</h2>
            <p className="hist-sub">{tx('Written by your health team. You can read them but not change them.', 'Yameandikwa na timu ya afya. Unaweza kusoma lakini si kubadilisha.')}</p>
            {clinical.length === 0 ? (
              <p className="hist-empty">{tx('No clinical notes yet.', 'Bado hakuna maelezo ya kitabibu.')}</p>
            ) : (
              <ul className="hist-notes">
                {clinical.map((n) => (
                  <li key={n.id}>
                    <p>{n.text}</p>
                    <span>
                      {n.authorName} · {n.authorRole === 'nurse' ? tx('nurse', 'muuguzi') : 'CHW'}
                      {n.facilityName ? ` · ${n.facilityName}` : ''} · {d(n.tsMs)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
