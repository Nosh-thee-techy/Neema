/**
 * Floating Neema companion — small bottom-right cartoon icon that opens Talk (/care).
 */

import { useNavigate } from 'react-router-dom';
import { avatarState } from '@neema/core';
import { useGuardian } from '../hooks/useGuardian';
import { useLocale } from '../hooks/useLocale';
import { AvatarCompanion } from './AvatarCompanion';

/** Compact cartoon Neema bubble; tap opens the care chat page. */
export function NeemaFab() {
  const nav = useNavigate();
  const g = useGuardian();
  const { lang } = useLocale();
  const level = g.triage?.level ?? 'UNKNOWN';
  const state = avatarState(level, false);

  return (
    <button
      type="button"
      className="neema-fab"
      aria-label={lang === 'sw' ? 'Ongea na Neema' : 'Talk with Neema'}
      onClick={() => nav('/care')}
    >
      <AvatarCompanion state={state} lang={lang} size="sm" variant="cartoon" showHands={false} showName={false} />
    </button>
  );
}
