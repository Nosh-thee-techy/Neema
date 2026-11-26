/**
 * Neema — named human companion. Mood from avatarState(level); never decides triage.
 * Portrait + living motion (blink / breath / speaking mouth).
 */

import type { AvatarState } from '@neema/core';

const LABEL: Record<AvatarState, { en: string; sw: string }> = {
  calm: { en: 'Neema is calm with you', sw: 'Neema yuko tulivu nawe' },
  watchful: { en: 'Neema is watching with you', sw: 'Neema anaangalia nawe' },
  urgent: { en: 'Neema — take the next step', sw: 'Neema — chukua hatua' },
  waiting: { en: 'Neema is waiting with you', sw: 'Neema anasubiri nawe' },
};

const PORTRAIT_PHOTO = '/brand/neema-companion.jpg';
const PORTRAIT_CARTOON = '/brand/neema-companion-cartoon.jpg';

/** Portrait Neema with living motion. */
export function AvatarCompanion({
  state,
  lang = 'en',
  speaking = false,
  size = 'md',
  showName = true,
  variant = 'photo',
  showHands = false,
}: {
  state: AvatarState;
  lang?: 'en' | 'sw';
  /** Drive lip sync while TTS / voice reply plays. */
  speaking?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  /** Cartoon for floating icon; photo for larger surfaces. */
  variant?: 'photo' | 'cartoon';
  showHands?: boolean;
}) {
  const portrait = variant === 'cartoon' ? PORTRAIT_CARTOON : PORTRAIT_PHOTO;

  return (
    <div
      className="companion companion--human"
      data-state={state}
      data-speaking={speaking}
      data-size={size}
      data-variant={variant}
      aria-live="polite"
    >
      <div className="companion__stage" aria-hidden={false}>
        <div className="companion__glow" aria-hidden="true" />

        <div className="companion__figure" role="img" aria-label={`Neema — ${LABEL[state][lang]}`}>
          <div className="companion__portrait-wrap">
            <img
              className="companion__portrait"
              src={portrait}
              alt=""
              width={320}
              height={420}
              decoding="async"
              draggable={false}
            />
            {variant === 'photo' ? (
              <>
                <span className="companion__blink companion__blink--left" aria-hidden="true" />
                <span className="companion__blink companion__blink--right" aria-hidden="true" />
                <span className="companion__lips companion__lips--rest" aria-hidden="true" />
                <span className="companion__lips companion__lips--talk" aria-hidden="true" />
              </>
            ) : null}
          </div>

          {showHands ? (
            <div className="companion__hands" aria-hidden="true">
              <span className="companion__hand companion__hand--left" />
              <span className="companion__hand companion__hand--right" />
            </div>
          ) : null}
        </div>
      </div>

      {showName ? (
        <div className="companion__meta">
          <strong className="companion__name">Neema</strong>
          <span className="companion__label">{LABEL[state][lang]}</span>
        </div>
      ) : null}
    </div>
  );
}
