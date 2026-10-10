# LiveLift decorative assets

Flat vector illustrations in the logo's vocabulary: paper cards, kraft tape, hairline ink, one brick accent. Each file is an SVG
(scales to any size, text already outlined) and a transparent PNG (longest side 1400 px). Use them on slides, the poster and the web.

| File | What it is | Good for |
|---|---|---|
| `the-san-pham-ao-hoodie`, `-quan-cargo`, `-tui-tote`, `-ao-linen` | Product card taped up, with a LIVE dot, in front of a stack | Hero spots, "pin the product" |
| `chong-the` | Fan of cards, top one taped | The "lift" idea, section dividers |
| `dien-thoai-livestream` | Host phone with LIVE badge, comments and a pinned card | Next to the Live Desk, audience view |
| `binh-luan-chip` | Comment rows with intent chips (no words) | Comments / intent step |
| `bieu-do-ghim` | Viewers line, pin markers, hatched "no pin" zone, bars | Analysis / insight step |
| `gia-treo-do`, `den-livestream`, `gio-hang-them`, `the-gia` | Rack, ring light, cart with +1, price tag (price left empty) | Seller world, collecting data |
| `ghi-chu-chua-biet` | Sticky note "Chưa biết" | The honest "what we don't know" box |
| `tem-simulated`, `nhan-live` | Violet SIMULATED stamp, brick LIVE tag | Marking simulated data |
| `bang-dinh-kraft`, `ghim-tron`, `kep-giay`, `mui-ten-nghieng`, `duong-ke-doi`, `nen-cham-kem` | Tape, push pin, clip, arrow, double rule, dotted cream tile | Glue between blocks |

**Rules.** Colours are the Calm Studio tokens (ink `#2A2522`, brick `#9E3B2B`, kraft `#C9B48A`, cream `#F6F3EE`, simulated violet `#4F3D86`);
do not recolour. Keep tilt to the cards, tape and stamp, as in the product. Use at most two or three per slide and let the whitespace work.
These are illustrations, not data: a chart or phone from here is a picture of the idea, never a result. Put the real, SIMULATED-labelled
screenshots (`docs/livedesk/screens/`) wherever a number or a real screen is being claimed. No real brand, person or product is depicted.

Regenerate with `python3 source/build_assets.py` (needs `fonttools` and `brotli`; fonts come from `next/src/components/livedesk/fonts`).
