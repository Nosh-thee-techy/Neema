import { useId } from 'react';

/**
 * The Neema band, drawn: a soft strap loop with a sensor pod and three status lights.
 * An original illustration of our own hardware concept (ESP32 pod, MAX30102, DS18B20).
 */
export function BandArt({ className, compact = false }: { className?: string; compact?: boolean }) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 520 380" role="img" aria-label="Neema band">
      <defs>
        <linearGradient id={`${id}strap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4766" />
          <stop offset="0.5" stopColor="#24304d" />
          <stop offset="1" stopColor="#4a5a7f" />
        </linearGradient>
        <linearGradient id={`${id}inner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141c30" />
          <stop offset="1" stopColor="#2a3653" />
        </linearGradient>
        <linearGradient id={`${id}pod`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7f5f1" />
          <stop offset="0.45" stopColor="#d9dde5" />
          <stop offset="1" stopColor="#a9b0be" />
        </linearGradient>
        <linearGradient id={`${id}face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2740" />
          <stop offset="1" stopColor="#0f1626" />
        </linearGradient>
        <radialGradient id={`${id}glow`}>
          <stop offset="0" stopColor="#7fd6a8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#7fd6a8" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}shadow`} x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#121a2c" floodOpacity="0.28" />
        </filter>
      </defs>

      <g filter={`url(#${id}shadow)`} transform="rotate(-10 260 190)">
        {/* back of the strap */}
        <ellipse cx="260" cy="180" rx="178" ry="104" fill="none" stroke={`url(#${id}inner)`} strokeWidth="40" />
        {/* front of the strap: lower half drawn over the back */}
        <path
          d="M82 180 A178 104 0 0 0 438 180"
          fill="none"
          stroke={`url(#${id}strap)`}
          strokeWidth="44"
        />
        {/* stitched edge */}
        <path
          d="M98 196 A162 92 0 0 0 422 196"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1.5"
          strokeDasharray="5 7"
        />
        {/* sensor pod */}
        <g transform="translate(260 284)">
          <rect x="-74" y="-40" width="148" height="80" rx="30" fill={`url(#${id}pod)`} />
          <rect x="-58" y="-27" width="116" height="54" rx="20" fill={`url(#${id}face)`} />
          {/* status lights: green on */}
          <circle cx="-22" cy="0" r="16" fill={`url(#${id}glow)`} />
          <circle cx="-22" cy="0" r="5" fill="#7fd6a8" />
          <circle cx="0" cy="0" r="5" fill="#5b4a2a" />
          <circle cx="22" cy="0" r="5" fill="#5a2430" />
          {!compact ? (
            <path d="M-50 -38 Q0 -46 50 -38" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
          ) : null}
        </g>
      </g>
    </svg>
  );
}
