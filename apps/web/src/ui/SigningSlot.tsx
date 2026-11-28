/**
 * Signing slot keyed by triage/EPDS messageKey.
 * Demo plays How2Sign ASL research clips (CareLoop pattern) with an honesty label.
 * Production needs reviewed Kenyan Sign Language (KSL) clips — never invent signs.
 */

import { useEffect, useState } from 'react';
import { AslPlayer } from './signing/AslPlayer';
import { ASL_LABEL, MESSAGE_TO_ASL_CLIP } from './signing/aslLibrary';

const TITLES: Record<string, { titleEn: string; titleSw: string }> = {
  green_calm: { titleEn: 'You are okay', titleSw: 'Uko salama' },
  yellow_recheck_bp: { titleEn: 'Recheck blood pressure', titleSw: 'Pima shinikizo tena' },
  yellow_fever: { titleEn: 'Raised temperature', titleSw: 'Joto limepanda' },
  yellow_pulse_baseline: { titleEn: 'Heart rate above usual', titleSw: 'Mapigo juu ya kawaida' },
  yellow_baby_movement: { titleEn: 'Baby moving less', titleSw: 'Mtoto anatembea kidogo' },
  yellow_signal_lost: { titleEn: 'Weak band with symptoms', titleSw: 'Ishara dhaifu na dalili' },
  red_go_now: { titleEn: 'Go to a facility now', titleSw: 'Nenda kituo sasa' },
  red_bleeding: { titleEn: 'Heavy bleeding — go now', titleSw: 'Kutokwa damu nyingi — nenda sasa' },
  red_sos: { titleEn: 'SOS — seek help', titleSw: 'SOS — tafuta msaada' },
  unknown_check_band: { titleEn: 'Check your band', titleSw: 'Angalia bendi yako' },
  epds_ok: { titleEn: 'Answers kept private', titleSw: 'Majibu yamehifadhiwa kwa faragha' },
  epds_talk_to_person: { titleEn: 'Talk to your health worker', titleSw: 'Zungumza na mhudumu' },
};

const aslDemoEnabled = import.meta.env.VITE_ENABLE_ASL_DEMO !== 'false';

/** Plays a research ASL clip for a message key, or a labelled placeholder. */
export function SigningSlot({
  messageKey,
  lang = 'en',
  autoShow = true,
}: {
  messageKey: string;
  lang?: 'en' | 'sw';
  autoShow?: boolean;
}) {
  const [visible, setVisible] = useState(autoShow);
  const titles = TITLES[messageKey];
  const clipId = MESSAGE_TO_ASL_CLIP[messageKey];

  useEffect(() => {
    setVisible(autoShow);
  }, [messageKey, autoShow]);

  if (!titles || !visible) return null;

  return (
    <div className="signing-slot" role="region" aria-label={lang === 'sw' ? 'Ishara' : 'Sign language'}>
      <div className="signing-slot__body">
        <strong>{lang === 'sw' ? titles.titleSw : titles.titleEn}</strong>
        {aslDemoEnabled && clipId ? (
          <AslPlayer clipId={clipId} showCaption={false} />
        ) : (
          <div className="signing-slot__frame" aria-hidden>
            <svg viewBox="0 0 48 48" width="40" height="40">
              <path
                d="M18 34 V16 a3 3 0 0 1 6 0 v10 M24 26 V14 a3 3 0 0 1 6 0 v12 M30 26 V18 a3 3 0 0 1 6 0 v12 c0 6-4 10-10 10 h-2 c-6 0-10-4-10-10 V28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
        <p className="soft-note" style={{ margin: '0.35rem 0 0' }}>
          {ASL_LABEL}
          {lang === 'sw' ? ' · KSL iliyoidhinishwa itakuja' : ' · Approved KSL clips coming'}
        </p>
      </div>
      <button type="button" className="btn btn-ghost" onClick={() => setVisible(false)}>
        {lang === 'sw' ? 'Ficha' : 'Hide'}
      </button>
    </div>
  );
}
