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
import { StoryDeck } from '../ui/StoryDeck';
import '../styles/story.css';

export function StoryPage() {
  const nav = useNavigate();
  const { lang } = useLocale();
  const sw = lang === 'sw';
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

  return (
    <StoryDeck
      slides={slides}
      index={Math.min(i, Math.max(slides.length - 1, 0))}
      sw={sw}
      onBack={() => nav('/home')}
      onIndex={setI}
      onDone={() => nav('/care', { state: { insight: storyContext(slides) } })}
    />
  );
}
