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
