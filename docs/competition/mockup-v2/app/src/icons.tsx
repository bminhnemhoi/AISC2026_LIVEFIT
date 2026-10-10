// One icon set: 20 px grid, 1.75 stroke, round caps and joins. Decorative by default
// (aria-hidden); every control that uses one also carries a text label.

import type { JSX } from "preact";

type P = { size?: number; class?: string };

function Svg({ size = 20, class: cls, children }: P & { children: JSX.Element | JSX.Element[] }) {
  return (
    <svg
      class={`icon ${cls ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M12.5 2.75 17.25 7.5" />
    <path d="M13.9 3.9 9.6 8.2l-3.4-.4-1.95 1.95 6 6 1.95-1.95-.4-3.4 4.3-4.3" />
    <path d="m7.25 12.75-4.5 4.5" />
  </Svg>
);
export const IconUnpin = (p: P) => (
  <Svg {...p}>
    <path d="m3 3 14 14" />
    <path d="M13.9 3.9 11.5 6.3m-1.9 1.9-3.4-.4-1.95 1.95 6 6 1.95-1.95-.4-3.4" />
    <path d="m7.25 12.75-4.5 4.5" />
  </Svg>
);
export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 4.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L7.4 4.1a.6.6 0 0 0-.9.5Z" />
  </Svg>
);
export const IconPause = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5v11M13 4.5v11" />
  </Svg>
);
export const IconSkip = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5v9l6.5-4.5L4 5.5Z" />
    <path d="M10.5 5.5v9L17 10l-6.5-4.5Z" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="4.25" y="8.75" width="11.5" height="8" rx="2" />
    <path d="M6.75 8.75V6.5a3.25 3.25 0 0 1 6.5 0v2.25" />
  </Svg>
);
export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M10 2.75 4.25 5v4.6c0 3.6 2.45 6.4 5.75 7.65 3.3-1.25 5.75-4.05 5.75-7.65V5L10 2.75Z" />
    <path d="m7.5 10 1.75 1.75L12.75 8.5" />
  </Svg>
);
export const IconTag = (p: P) => (
  <Svg {...p}>
    <path d="M3.25 10.4V4.25a1 1 0 0 1 1-1h6.15l6.35 6.35a1 1 0 0 1 0 1.4l-5.75 5.75a1 1 0 0 1-1.4 0L3.25 10.4Z" />
    <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconRuler = (p: P) => (
  <Svg {...p}>
    <path d="m2.75 13.25 10.5-10.5 4 4-10.5 10.5-4-4Z" />
    <path d="m6 10 1.5 1.5M8.5 7.5 10 9M11 5l1.5 1.5" />
  </Svg>
);
export const IconBag = (p: P) => (
  <Svg {...p}>
    <path d="M4.25 7h11.5l-.85 9.1a1 1 0 0 1-1 .9H6.1a1 1 0 0 1-1-.9L4.25 7Z" />
    <path d="M7.25 7V5.75a2.75 2.75 0 0 1 5.5 0V7" />
    <path d="m7.75 11.75 1.6 1.6 3-3.1" />
  </Svg>
);
export const IconChat = (p: P) => (
  <Svg {...p}>
    <path d="M16.75 9.5c0 3.2-3 5.75-6.75 5.75-.9 0-1.75-.15-2.55-.4L3.5 16.25l1.2-3.2c-.9-1-1.45-2.2-1.45-3.55 0-3.2 3-5.75 6.75-5.75s6.75 2.55 6.75 5.75Z" />
  </Svg>
);
export const IconEye = (p: P) => (
  <Svg {...p}>
    <path d="M1.75 10S4.75 4.25 10 4.25 18.25 10 18.25 10 15.25 15.75 10 15.75 1.75 10 1.75 10Z" />
    <circle cx="10" cy="10" r="2.5" />
  </Svg>
);
export const IconSaved = (p: P) => (
  <Svg {...p}>
    <path d="M5.5 15.25a3.75 3.75 0 0 1-.4-7.48 5 5 0 0 1 9.7 1.23 3.13 3.13 0 0 1-.3 6.25H5.5Z" />
    <path d="m7.75 11.25 1.6 1.6 3-3" />
  </Svg>
);
export const IconRoute = (p: P) => (
  <Svg {...p}>
    <circle cx="4.75" cy="15.25" r="2" />
    <circle cx="15.25" cy="4.75" r="2" />
    <path d="M6.75 15.25h5.5a2.5 2.5 0 0 0 0-5h-4.5a2.5 2.5 0 0 1 0-5h5.5" />
  </Svg>
);
export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="3.25" />
    <path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1.05 1.05M14.25 14.25l1.05 1.05M4.7 15.3l1.05-1.05M14.25 5.75l1.05-1.05" />
  </Svg>
);
export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M16.5 12.1A6.75 6.75 0 0 1 7.9 3.5a6.75 6.75 0 1 0 8.6 8.6Z" />
  </Svg>
);
export const IconKeyboard = (p: P) => (
  <Svg {...p}>
    <rect x="2.25" y="5" width="15.5" height="10" rx="2" />
    <path d="M5.5 8.25h.01M8.5 8.25h.01M11.5 8.25h.01M14.5 8.25h.01M6.5 11.75h7" />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 9.25v4.5M10 6.5h.01" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="m5 5 10 10M15 5 5 15" />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M8.7 3.4 2.4 14.5a1.5 1.5 0 0 0 1.3 2.25h12.6a1.5 1.5 0 0 0 1.3-2.25L11.3 3.4a1.5 1.5 0 0 0-2.6 0Z" />
    <path d="M10 8v3.5M10 14h.01" />
  </Svg>
);
export const IconBolt = (p: P) => (
  <Svg {...p}>
    <path d="M11 2.75 4.5 11h5l-1 6.25L15.5 9h-5l.5-6.25Z" />
  </Svg>
);
export const IconSignal = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 16.5v-3M7.83 16.5V10M12.17 16.5V6.5M16.5 16.5V3.5" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="m12 4.5-5.5 5.5 5.5 5.5" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m8 4.5 5.5 5.5L8 15.5" />
  </Svg>
);
export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 11.5a3.25 3.25 0 0 0 4.6 0l2.65-2.65a3.25 3.25 0 0 0-4.6-4.6L10 5.4" />
    <path d="M11.5 8.5a3.25 3.25 0 0 0-4.6 0L4.25 11.15a3.25 3.25 0 0 0 4.6 4.6L10 14.6" />
  </Svg>
);
export const IconUpload = (p: P) => (
  <Svg {...p}>
    <path d="M10 13V3.5M6.25 7.25 10 3.5l3.75 3.75" />
    <path d="M3.5 12.5v2.75a1.25 1.25 0 0 0 1.25 1.25h10.5a1.25 1.25 0 0 0 1.25-1.25V12.5" />
  </Svg>
);
export const IconQuestion = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M7.9 7.75a2.15 2.15 0 0 1 4.2.6c0 1.45-2.1 1.9-2.1 3.15M10 14h.01" />
  </Svg>
);
export const IconStop = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="5" width="10" height="10" rx="2" />
  </Svg>
);
export const IconLogo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false" class="logo-mark">
    <rect width="28" height="28" rx="8" fill="var(--signal)" />
    <path d="M9 17.5 14 12.5l5 5" fill="none" stroke="var(--signal-ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="14" cy="8.25" r="1.75" fill="var(--signal-ink)" />
  </svg>
);
