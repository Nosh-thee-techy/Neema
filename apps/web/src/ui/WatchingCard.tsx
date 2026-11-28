import { useNavigate } from 'react-router-dom';
import type { WatchItem, WatchItemId } from '@neema/core';
import type { WatchPlanSnapshot } from '../hooks/useWatchPlan';

/** What each item watches, in plain words. DRAFT wording: needs clinician and Swahili review. */
const WATCHES: Record<WatchItemId, { en: string; sw: string }> = {
  pp_bleeding: {
    en: 'Neema watches your pulse more closely, including a pulse that climbs slowly, and asks about bleeding and dizziness.',
    sw: 'Neema inaangalia mapigo yako ya moyo kwa karibu zaidi, hata yakipanda polepole, na inauliza kuhusu damu na kizunguzungu.',
  },
  pp_bp: {
    en: 'Neema asks for your blood pressure every 2 days, and about headaches, your eyes and upper tummy pain.',
    sw: 'Neema inaomba shinikizo lako la damu kila siku 2, na inauliza kuhusu kichwa, macho na maumivu juu ya tumbo.',
  },
  pp_infection: {
    en: 'Neema flags a raised temperature sooner, and asks about fever and discharge.',
    sw: 'Neema inaona joto likipanda mapema zaidi, na inauliza kuhusu homa na uchafu.',
  },
  pp_caesarean: {
    en: 'Neema asks about your wound and fever.',
    sw: 'Neema inauliza kuhusu kidonda chako na homa.',
  },
  preg_bp: {
    en: 'Neema asks for your blood pressure every 2 days, and about headaches, your eyes, upper tummy pain and swelling.',
    sw: 'Neema inaomba shinikizo lako la damu kila siku 2, na inauliza kuhusu kichwa, macho, maumivu juu ya tumbo na uvimbe.',
  },
  preg_after_loss: {
    en: 'Neema asks every day whether your baby is moving as usual.',
    sw: 'Neema inauliza kila siku kama mtoto wako anasonga kama kawaida.',
  },
  anaemia: {
    en: 'Neema asks about dizziness and shortness of breath.',
    sw: 'Neema inauliza kuhusu kizunguzungu na kukosa pumzi.',
  },
};

function untilText(item: WatchItem, sw: boolean): string | null {
  if (item.untilMs === null) return sw ? 'Mpaka mtoto azaliwe.' : 'Until your baby is born.';
  // untilMs is the start of the first day off; the last watched day is the day before.
  const last = new Date(item.untilMs - 1).toLocaleDateString(sw ? 'sw-KE' : 'en-KE', { day: 'numeric', month: 'long' });
  return sw ? `Mpaka ${last}.` : `Until ${last}.`;
}

/**
 * "What Neema is watching for you": her watch plan in plain words, with the reason
 * and the end date. Shows nothing when her plan is empty. Never says "high-risk".
 */
export function WatchingCard({ snap, sw }: { snap: WatchPlanSnapshot; sw: boolean }) {
  const nav = useNavigate();
  const plan = snap.plan;
  if (!plan || plan.items.length === 0) return null;
  const tx = (en: string, swText: string) => (sw ? swText : en);
  return (
    <section className="watch-card" aria-labelledby="watch-title">
      <h2 id="watch-title" className="watch-card__title">
        {tx('What Neema is watching for you', 'Neema inakuangalia nini')}
      </h2>
      {snap.bpDue ? (
        <button type="button" className="watch-card__due" onClick={() => nav('/bp')}>
          <span className="watch-card__dot" aria-hidden />
          <span>
            <strong>{tx('Blood pressure check due', 'Wakati wa kupima shinikizo la damu')}</strong>
            <span className="watch-card__due-sub">
              {snap.lastBpMs === null
                ? tx('No reading saved yet. Tap to add one.', 'Hakuna kipimo bado. Gusa kuongeza.')
                : tx('Tap to add today’s reading.', 'Gusa kuongeza kipimo cha leo.')}
            </span>
          </span>
        </button>
      ) : null}
      <ul className="watch-card__list">
        {plan.items.map((item) => (
          <li key={item.id} className="watch-card__item">
            <p className="watch-card__why">{sw ? item.reason.sw : item.reason.en}</p>
            <p className="watch-card__what">
              {sw ? WATCHES[item.id].sw : WATCHES[item.id].en} <span className="watch-card__until">{untilText(item, sw)}</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="watch-card__foot">
        {tx(
          'This only makes Neema more careful. Your CHP sees the same reason if Neema asks them to check on you.',
          'Hii inaifanya Neema iwe makini zaidi tu. CHP wako huona sababu hiyo hiyo Neema ikimwomba akuangalie.',
        )}
      </p>
    </section>
  );
}
