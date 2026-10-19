/** The LiveLift mark, the team's logo redrawn flat: an L with a fold, a growth bar, a lift arrow and live-signal arcs. Same
 * geometry as docs/brand/logo (build_logo.py). Colours come from the theme tokens. */
export function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="270 190 780 780" width="36" height="36" aria-hidden="true" focusable="false">
      <path className="logo-ink" d="M530 248 V812 H430 C350 812 310 770 310 700 V440 C310 415 322 402 342 390 Z" />
      <path className="logo-ink" d="M310 760 C310 900 380 962 480 962 H975 L905 848 H520 C400 848 330 815 310 760 Z" />
      <path className="logo-acc" d="M700 342 V780 H570 V398 Z" />
      <path className="logo-acc" d="M520 815 C660 805 800 725 810 553 L733 553 L855 425 L975 553 L912 553 C905 700 800 815 640 818 Z" />
      <path className="logo-arc" d="M815 228 C910 230 985 300 1000 410" />
      <path className="logo-arc" d="M818 312 C870 315 915 350 922 405" />
    </svg>
  );
}


export function WordmarkText() {
  return (
    <span className="wordmark-text">
      Live<span className="wordmark-lift">L<span className="wordmark-i">ı</span>ft</span>
    </span>
  );
}
