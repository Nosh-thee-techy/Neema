/**
 * One icon set: 24px grid, 1.8 stroke, round caps. Decorative by default.
 */

import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconHome() {
  return (
    <Svg>
      <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z" />
    </Svg>
  );
}

export function IconBand() {
  return (
    <Svg>
      <rect x="7" y="7" width="10" height="10" rx="3" />
      <path d="M9.5 7V3.5h5V7M9.5 17v3.5h5V17" />
      <path d="M9.5 12h1.2l.9-1.6 1.1 3 .8-1.4h1" />
    </Svg>
  );
}

export function IconUser() {
  return (
    <Svg>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.9-3.7 3.7-5.4 7-5.4s6.1 1.7 7 5.4" />
    </Svg>
  );
}

export function IconMore() {
  return (
    <Svg>
      <path d="M5 7h14M5 12h14M5 17h9" />
    </Svg>
  );
}

export function IconPlus() {
  return (
    <Svg>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconMic() {
  return (
    <Svg>
      <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Svg>
  );
}

export function IconHeart() {
  return (
    <Svg>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </Svg>
  );
}

export function IconPressure() {
  return (
    <Svg>
      <path d="M4.6 17a8 8 0 1 1 14.8 0" />
      <path d="m12 14 3.4-4.2" />
      <circle cx="12" cy="14" r="1.1" />
    </Svg>
  );
}

export function IconTemp() {
  return (
    <Svg>
      <path d="M10 13.6V5a2 2 0 1 1 4 0v8.6a4 4 0 1 1-4 0Z" />
      <path d="M12 9v7" />
    </Svg>
  );
}

export function IconBell() {
  return (
    <Svg>
      <path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function IconChevron() {
  return (
    <Svg>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function IconCheck() {
  return (
    <Svg>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function IconFeel() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 14.4c1.6 1.6 4.4 1.6 6 0M9.5 10h.01M14.5 10h.01" />
    </Svg>
  );
}

export function IconQr() {
  return (
    <Svg>
      <rect x="4" y="4" width="6" height="6" rx="1.2" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" />
      <path d="M14 14h2.5v2.5H14zM20 14v2M17.5 20H20v-1.5M14 20v-1" />
    </Svg>
  );
}

export function IconAlert() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v5M12 16.5h.01" />
    </Svg>
  );
}

export function IconList() {
  return (
    <Svg>
      <path d="M9 7h10M9 12h10M9 17h10" />
      <path d="M5 7h.01M5 12h.01M5 17h.01" />
    </Svg>
  );
}

export function IconChat() {
  return (
    <Svg>
      <path d="M5 7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5v5A3.5 3.5 0 0 1 15.5 16H10l-4 3.2V16H8.5A3.5 3.5 0 0 1 5 12.5v-5Z" />
    </Svg>
  );
}

export function IconSend() {
  return (
    <Svg>
      <path d="M4.5 11.5 19 5l-5.5 15-2.2-6.3L4.5 11.5Z" />
    </Svg>
  );
}

export function IconDots() {
  return (
    <Svg>
      <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconSpark() {
  return (
    <Svg>
      <path d="M12 4.5v3.2M12 16.3v3.2M4.5 12h3.2M16.3 12h3.2M7.1 7.1l2.2 2.2M14.7 14.7l2.2 2.2M16.9 7.1l-2.2 2.2M9.3 14.7l-2.2 2.2" />
    </Svg>
  );
}

export function IconCopy() {
  return (
    <Svg>
      <rect x="8" y="8" width="10" height="12" rx="2" />
      <path d="M6 16V6a2 2 0 0 1 2-2h8" />
    </Svg>
  );
}

export function IconThumb() {
  return (
    <Svg>
      <path d="M8 11v9M8 11H5.5A1.5 1.5 0 0 0 4 12.5V18a1.5 1.5 0 0 0 1.5 1.5H8M8 11l2.2-5.2A1.8 1.8 0 0 1 11.9 4.8c.9 0 1.6.7 1.6 1.6V11h4.2a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 16.7 21H8" />
    </Svg>
  );
}

export function IconSpeaker() {
  return (
    <Svg>
      <path d="M4 10v4h3l4 3V7L7 10H4Z" />
      <path d="M15.5 9.5a3.2 3.2 0 0 1 0 5M17.8 7.2a6 6 0 0 1 0 9.6" />
    </Svg>
  );
}

export function IconRefresh() {
  return (
    <Svg>
      <path d="M19 8.5A7 7 0 1 0 19.5 14" />
      <path d="M19 4.5v4h-4" />
    </Svg>
  );
}

export function IconMoon() {
  return (
    <Svg>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </Svg>
  );
}

/** A drop, for “drink water”. */
export function IconWater() {
  return (
    <Svg>
      <path d="M12 3.5 6.8 11a5.2 5.2 0 1 0 10.4 0L12 3.5Z" />
    </Svg>
  );
}

/** Lying down, for rest. */
export function IconRest() {
  return (
    <Svg>
      <path d="M3.5 18.5h17" />
      <circle cx="7" cy="8" r="2" />
      <path d="M9.2 9.6 16.5 12.2c.8.3 1.2 1 1 1.8" />
      <path d="M14.2 12.6 16 17" />
    </Svg>
  );
}

/** Slow breath: two rising curves. */
export function IconBreath() {
  return (
    <Svg>
      <path d="M3.5 15c2.2-5 4.2-5 6.4 0s4.2 5 6.4 0 4.2-5 4.2 0" />
      <path d="M3.5 9.5c2.2-4 4.2-4 6.4 0s4.2 4 6.4 0" />
    </Svg>
  );
}

/** On her side. */
export function IconSide() {
  return (
    <Svg>
      <circle cx="8" cy="7.5" r="2.1" />
      <path d="M6.2 18.5c.2-3.2 1.4-5.2 3.6-6.2 2.2-1 5.4-1.1 8.2-.4" />
      <path d="M14.5 12.4 17.2 16" />
    </Svg>
  );
}

/** Open hand, for sign language. */
export function IconHands() {
  return (
    <Svg>
      <path d="M8 11.2V6.6a1.25 1.25 0 0 1 2.5 0v4.6" />
      <path d="M10.5 10.4V5.6a1.25 1.25 0 0 1 2.5 0V11" />
      <path d="M13 10.8V7.4a1.25 1.25 0 0 1 2.5 0V13c0 3.2-2.1 5.5-5.4 5.5-2.8 0-4.8-1.7-4.8-4.4V9a1.25 1.25 0 0 1 2.5 0" />
    </Svg>
  );
}

/** Settings cog: eight teeth around a hub. */
export function IconSettings() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7" />
      <circle cx="12" cy="12" r="6.6" />
    </Svg>
  );
}
