/**
 * Today's insights as full-page slides. The arrow on Today opens this, not the chat.
 * The last slide is the only door into CareChat, and it carries the cards with it.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { baselineProgress } from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { useToday } from '../hooks/useToday';
import { carePath, journeyPhase } from '../services/carePath';
import { buildDailyStory, storyContext, type StorySlide } from '../services/dailyStory';
import { loadBaseline } from '../services/baselineStore';
import { loadProfile } from '../services/passport';
import '../styles/story.css';

export function StoryPage() {
  const nav = useNavigate();
  const { lang } = useLocale();
  const sw = lang === 'sw';
  const tx = (en: string, s: string) => (sw ? s : en);
  const g = useGuardian();
  const today = useToday('story');
  const [slides, setSlides] = useState<StorySlide[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [profile, hr] = await Promise.all([
        loadProfile().catch(() => null),
        loadBaseline('hr').catch(() => null),
      ]);
      if (cancelled) return;
      const phase = journeyPhase(today.stage, today.pregnancy?.weeks ?? null);
      const path = carePath(profile, g.triage?.level ?? null);
      setSlides(
        buildDailyStory({
          lang,
          phase,
          path,
          name: today.name ?? (sw ? 'Mama' : 'Mama'),
          weeks: today.pregnancy?.weeks ?? null,
          days: today.pregnancy?.days ?? 0,
          daysSinceBirth: today.recovery?.daysSinceBirth ?? null,
          medications: profile?.medications ?? [],
          conditions: profile?.conditions ?? [],
          baselineProgress: hr ? baselineProgress(hr) : null,
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, today.stage, today.pregnancy?.weeks, today.pregnancy?.days, today.recovery?.daysSinceBirth, today.name, g.triage?.level, sw]);

  const slide = slides[i];
  const last = slide && i === slides.length - 1;

  function goNext() {
    if (!slide) return;
    if (last) {
      nav('/care', { state: { insight: storyContext(slides) } });
      return;
    }
    setI((n) => n + 1);
  }

  return (
    <main className="story" data-step={i}>
      <header className="story__top">
        <button type="button" className="story__back" onClick={() => nav('/home')} aria-label={tx('Back to today', 'Rudi leo')}>
          <span aria-hidden>←</span>
        </button>
        <p className="story__count">
          {slides.length ? tx(`${i + 1} of ${slides.length}`, `${i + 1} kati ya ${slides.length}`) : ''}
        </p>
      </header>

      {slide ? (
        <article className="story__card" key={slide.id}>
          <p className="story__kicker">{slide.kicker}</p>
          <h1>{slide.title}</h1>
          <p className="story__body">{slide.body}</p>
        </article>
      ) : (
        <p className="story__body">{tx('Opening today’s cards…', 'Inafungua kadi za leo…')}</p>
      )}

      <footer className="story__foot">
        <div className="story__dots" aria-hidden>
          {slides.map((s, n) => (
            <span key={s.id} data-on={n === i} />
          ))}
        </div>
        <div className="story__actions">
          {i > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={() => setI((n) => n - 1)}>
              {tx('Back', 'Rudi')}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="btn btn-primary" disabled={!slide} onClick={goNext}>
            {slide?.next ?? tx('Next', 'Endelea')}
          </button>
        </div>
      </footer>
    </main>
  );
}
