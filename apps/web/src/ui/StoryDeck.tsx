/**
 * Today's insight slides: a picture, tappable facts, a watch line, and one action.
 * Copy comes from the guides already in the app. Taps only reveal that copy.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StoryChip, StoryIcon, StorySlide } from '../services/dailyStory';
import { BabyStageArt, NewbornArt } from './BabyStageArt';
import { BandArt } from './BandArt';
import {
  IconAlert,
  IconBand,
  IconBell,
  IconChat,
  IconCheck,
  IconFeel,
  IconHeart,
  IconMic,
  IconMoon,
  IconPressure,
  IconSpark,
  IconTemp,
  IconUser,
} from './icons';

const ICONS: Record<StoryIcon, () => ReactNode> = {
  heart: IconHeart,
  temp: IconTemp,
  feel: IconFeel,
  bell: IconBell,
  moon: IconMoon,
  alert: IconAlert,
  band: IconBand,
  spark: IconSpark,
  chat: IconChat,
  mic: IconMic,
  user: IconUser,
  check: IconCheck,
  pressure: IconPressure,
};

function ChipIcon({ name }: { name: StoryIcon }) {
  const Icon = ICONS[name];
  return <Icon />;
}

export function StoryDeck({
  slides,
  index,
  sw,
  onBack,
  onIndex,
  onDone,
}: {
  slides: StorySlide[];
  index: number;
  sw: boolean;
  onBack: () => void;
  onIndex: (n: number) => void;
  onDone: () => void;
}) {
  const tx = (en: string, s: string) => (sw ? s : en);
  const slide = slides[index];
  const last = Boolean(slide && index === slides.length - 1);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [waved, setWaved] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setPicked(null);
    setWaved(false);
  }, [slide?.id]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [slide?.id]);

  function go(delta: number) {
    if (!slide) return;
    if (delta > 0) {
      if (last) onDone();
      else onIndex(index + 1);
      return;
    }
    if (index > 0) onIndex(index - 1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button, a, input, textarea')) return;
    drag.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return;
    go(dx < 0 ? 1 : -1);
  }

  const chip = slide?.chips.find((c) => c.id === picked) ?? null;

  return (
    <main className="story story-deck" onKeyDown={onKeyDown}>
      <header className="story__top">
        <button type="button" className="story__back" onClick={onBack} aria-label={tx('Back to today', 'Rudi leo')}>
          <span aria-hidden>←</span>
        </button>
        <p className="story__count">
          {slides.length ? tx(`${index + 1} of ${slides.length}`, `${index + 1} kati ya ${slides.length}`) : ''}
        </p>
      </header>

      {slide ? (
        <div className="story-deck__stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          <Art slide={slide} waved={waved} sw={sw} onWave={() => setWaved(true)} />
          <article className="story-deck__copy" key={slide.id} aria-live="polite">
            <p className="story-deck__kicker">{slide.kicker}</p>
            <h1 ref={titleRef} tabIndex={-1}>
              {slide.title}
            </h1>
            <p className="story-deck__lead">{slide.lead}</p>

            <div className="story-deck__chips" role="group" aria-label={tx('Tap a fact', 'Gusa ukweli')}>
              {slide.chips.map((c) => (
                <Chip key={c.id} chip={c} on={picked === c.id} onPick={() => setPicked((id) => (id === c.id ? null : c.id))} />
              ))}
            </div>

            <div className={`story-react${waved || chip ? ' is-on' : ''}`}>
              <img src="/brand/neema-companion-cartoon.jpg" alt="" />
              <p>
                {chip
                  ? chip.note
                  : tx('Tap one. Neema reads back only what the guide already says.', 'Gusa moja. Neema anasoma tu kile mwongozo umeshaandika.')}
              </p>
            </div>

            {slide.watch ? (
              <aside className="story-watch">
                <span className="story-ico story-ico--alert" aria-hidden>
                  <IconAlert />
                </span>
                <div>
                  <strong>{tx('Worth a person', 'Inastahili mtu')}</strong>
                  <p>{slide.watch}</p>
                </div>
              </aside>
            ) : null}

            <div className="story-action">
              <span className="story-ico story-ico--do" aria-hidden>
                <IconCheck />
              </span>
              <div>
                <strong>{tx('One clear step', 'Hatua moja wazi')}</strong>
                <p>{slide.action}</p>
              </div>
            </div>

            {slide.draft ? (
              <p className="story-draft">{tx('Draft — a nurse still needs to sign this off.', 'Rasimu — muuguzi bado anahitaji kuthibitisha.')}</p>
            ) : null}
          </article>
        </div>
      ) : (
        <div className="story-deck__stage" aria-busy="true">
          <div className="story-skel story-skel--art" />
          <div className="story-skel-col">
            <div className="story-skel story-skel--line" />
            <div className="story-skel story-skel--title" />
            <div className="story-skel story-skel--chips" />
          </div>
          <p className="story-deck__loading">{tx('Opening today’s cards…', 'Inafungua kadi za leo…')}</p>
        </div>
      )}

      <footer className="story__foot">
        <div className="story__dots" role="tablist" aria-label={tx('Slides', 'Slaidi')}>
          {slides.map((s, n) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={n === index}
              aria-label={tx(`Slide ${n + 1}: ${s.title}`, `Slaidi ${n + 1}: ${s.title}`)}
              data-on={n === index}
              onClick={() => onIndex(n)}
            />
          ))}
        </div>
        <div className="story__actions">
          {index > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={() => onIndex(index - 1)}>
              {tx('Back', 'Rudi')}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="btn btn-primary" disabled={!slide} onClick={() => go(1)}>
            {slide?.next ?? tx('Next', 'Endelea')}
          </button>
        </div>
      </footer>
    </main>
  );
}

function Chip({ chip, on, onPick }: { chip: StoryChip; on: boolean; onPick: () => void }) {
  return (
    <button type="button" className="story-chip" aria-pressed={on} onClick={onPick}>
      <span className="story-ico" aria-hidden>
        <ChipIcon name={chip.icon} />
      </span>
      <span>{chip.label}</span>
    </button>
  );
}

function Art({
  slide,
  waved,
  sw,
  onWave,
}: {
  slide: StorySlide;
  waved: boolean;
  sw: boolean;
  onWave: () => void;
}) {
  const label = sw ? 'Neema, mlinzi. Gusa umsalimie' : 'Neema, your guardian. Tap to say hello';
  return (
    <button type="button" className={`story-art story-art--${slide.tone}${waved ? ' is-waved' : ''}`} onClick={onWave} aria-label={label}>
      <span className="story-art__blob" aria-hidden />
      {slide.art === 'baby' && slide.week ? (
        <BabyStageArt
          week={slide.week}
          label={sw ? `Mchoro wa mtoto wa karibu wiki ${slide.week}` : `Illustration of a baby at about ${slide.week} weeks, not to scale`}
        />
      ) : null}
      {slide.art === 'newborn' ? (
        <NewbornArt
          ageDays={slide.ageDays ?? 0}
          label={sw ? 'Mchoro wa mtoto mchanga' : 'Illustration of a newborn, not to scale'}
        />
      ) : null}
      {slide.art === 'band' ? <BandArt /> : null}
      {slide.art === 'neema' || slide.art === 'mood' ? (
        <img src="/brand/neema-companion-cartoon.jpg" alt="" />
      ) : null}
      {slide.art === 'portrait' ? <img className="story-art__photo" src="/brand/neema-companion.jpg" alt="" /> : null}
      <span className={`story-art__pill story-art__pill--${slide.tone}`}>
        {slide.tone === 'watch' ? (sw ? 'Angalia' : 'Watch') : slide.tone === 'learn' ? (sw ? 'Inajifunza' : 'Learning') : slide.tone === 'talk' ? (sw ? 'Ongea' : 'Talk') : sw ? 'Leo' : 'Today'}
      </span>
    </button>
  );
}
