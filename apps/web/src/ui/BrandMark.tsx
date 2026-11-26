import { useId } from 'react';
import { useLocale } from '../hooks/useLocale';

/** Neema mark: a crescent keeping watch, with one small light beside it. */
export function BrandMark({ showSub = false }: { showSub?: boolean }) {
  const { t } = useLocale();
  const id = useId();
  return (
    <div className="brand-mark">
      <svg viewBox="0 0 48 48" aria-hidden>
        <defs>
          <linearGradient id={`${id}g`} x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#33456B" />
            <stop offset="1" stopColor="#121A2C" />
          </linearGradient>
          <mask id={`${id}m`}>
            <rect width="48" height="48" fill="#fff" />
            <circle cx="28.5" cy="20.5" r="9.5" fill="#000" />
          </mask>
        </defs>
        <rect width="48" height="48" rx="14" fill={`url(#${id}g)`} />
        <circle cx="23" cy="25" r="11" fill="#EDE7DC" mask={`url(#${id}m)`} />
        <circle cx="33" cy="15" r="2.4" fill="#7FD6A8" />
      </svg>
      <div>
        <strong>Neema</strong>
        {showSub ? <span>{t('brand_sub')}</span> : null}
      </div>
    </div>
  );
}
