# LiveLift logo

**Source.** The team's own logo: an **L** with a fold at its foot, a **bar** (data), a **curved arrow** that lifts, and two **arcs**
(live signal). The first artwork was glossy blue and yellow on a glowing navy ground. Here it is redrawn flat in the web's
Calm Studio palette, with the same shapes: no glow, no gradient, no ground.

**Colours.** L in ink `#2A2522`; bar, arrow and arcs in brick `#9E3B2B`. On dark: L in `#F3ECE1`, accents `#D4624A`.
Wordmark: Be Vietnam Pro Medium, converted to outlines (no font needed), "Live" in ink and "Lift" in brick.

| File | Use |
|---|---|
| `logo-lockup.svg` / `.png` | Default: mark + name on cream or white (slides, poster, documents) |
| `logo-lockup-dark.svg` / `.png` | On dark backgrounds |
| `logo-lockup-mono.svg` / `.png` | One colour: print, stamps |
| `logo-mark.svg` / `-dark` / `-mono` (+ `.png`, 1024 px) | The mark alone: avatars, QR corner, social |
| `favicon.svg`, `favicon-32/180/512.png` | Browser tab and app icon (on a cream tile so it reads on dark tabs) |

**Rules.** Clear space of one arc-width (about a tenth of the mark) around it. Minimum size: lockup 120 px wide, mark 28 px; below that
the arcs blur, so use the favicon tile. Do not recolour the brick, tilt, outline, add shadows, glow or gradients, and do not put it on a photo
without a cream or ink panel. The one-colour mono version merges bar and arrow into the L on purpose; prefer the colour one when you can.

**Honest limit.** The mark was traced by eye from the team's 1254 px artwork, not from a vector master. If the team has the original vector file,
swap it in and keep the palette above.

In the app the mark is drawn inline in the header (`next/src/components/livedesk/Shell.tsx`, `LogoMark`, theme tokens) and
`next/src/app/icon.svg` is the favicon. Regenerate files with `python3 source/build_logo.py` (needs `fonttools` and `brotli`).
The product-card illustration from the first draft lives on as a decorative asset in `docs/brand/assets/`.
