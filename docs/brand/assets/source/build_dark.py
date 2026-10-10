"""Write dark-background versions of the brand drawings, for pages that switch on prefers-color-scheme (the README).

Each palette colour is swapped for its value in the Calm Studio warm-dark theme (next/src/components/livedesk/calm.css),
the same swap the app makes through its tokens: ink lines turn light, paper cards turn dark. Colours outside the palette
(a garment's sage, a skin tone) stay as drawn.

Usage: python3 docs/brand/assets/source/build_dark.py   (writes docs/brand/assets/dark/*.svg)
"""

from __future__ import annotations

import pathlib
import re

ASSETS = pathlib.Path(__file__).resolve().parents[1]
OUT = ASSETS / "dark"

DARK = {
    "#2A2522": "#F3ECE1",  # ink -> light line
    "#FBF9F5": "#2E2722",  # paper card
    "#9E3B2B": "#D4624A",  # brick, as in the dark logo
    "#C9B48A": "#8F7A58",  # kraft
    "#E4DACB": "#3D342D",  # photo ground
    "#D8D0C4": "#463C34",  # hairline
    "#F6F3EE": "#1F1A17",  # cream ground
    "#4F3D86": "#C4B5FF",  # simulated violet
    "#F0D9D0": "#4A2A22",  # soft brick
    "#EFE5CB": "#3B332D",  # sticky note
}


def main() -> None:
    OUT.mkdir(exist_ok=True)
    pattern = re.compile("|".join(re.escape(key) for key in DARK), re.IGNORECASE)
    files = sorted(ASSETS.glob("*.svg"))
    for svg in files:
        text = pattern.sub(lambda m: DARK[m.group(0).upper()], svg.read_text(encoding="utf-8"))
        (OUT / svg.name).write_text(text, encoding="utf-8")
    print(f"wrote {len(files)} dark drawings to {OUT.relative_to(ASSETS.parents[2])}")


if __name__ == "__main__":
    main()
