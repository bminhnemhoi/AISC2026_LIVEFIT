"""Turn the brand SVGs into theme-aware React components for the web app.

The SVGs in docs/brand/assets are drawn in the Calm Studio light colours. In the app each known colour becomes a class
(`bf-ink` for a fill, `bs-ink` for a stroke, and so on) that calm.css maps to a theme token, so the drawings follow the
light and dark themes. Colours outside the palette (a garment's sage, a skin tone) stay as they are. Titles and labels
are dropped: in the app every drawing is decoration, hidden from assistive tech. Outlined text that would not translate
(the "Chưa biết" note) becomes a <text> slot filled from the app's copy.

Usage: python3 docs/brand/assets/source/build_tsx.py   (writes next/src/components/livedesk/brand.tsx)
"""

from __future__ import annotations

import pathlib
import re
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[4]
ASSETS = ROOT / "docs" / "brand" / "assets"
OUT = ROOT / "next" / "src" / "components" / "livedesk" / "brand.tsx"

# Drawings the app uses, in file order: (file stem, component name).
DRAWINGS = [
    ("chong-the", "CardStack"),
    ("den-livestream", "RingLight"),
    ("dien-thoai-livestream", "HostPhone"),
    ("binh-luan-chip", "CommentChips"),
    ("gia-treo-do", "Rack"),
    ("gio-hang-them", "CartPlusOne"),
    ("the-gia", "PriceTag"),
    ("ghi-chu-chua-biet", "UnknownNote"),
    ("ghim-tron", "PushPin"),
    ("kep-giay", "PaperClip"),
    ("mui-ten-nghieng", "InkArrow"),
    ("bang-dinh-kraft", "KraftTape"),
    ("the-san-pham-ao-hoodie", "CardHoodie"),
    ("the-san-pham-quan-cargo", "CardCargo"),
    ("the-san-pham-tui-tote", "CardTote"),
    ("the-san-pham-ao-linen", "CardLinen"),
]

# The palette, by the token each colour stands for (see "brand drawings" in calm.css).
COLOURS = {
    "#2A2522": "ink",
    "#FBF9F5": "paper",
    "#9E3B2B": "brick",
    "#C9B48A": "kraft",
    "#E4DACB": "photo",
    "#D8D0C4": "line",
    "#F6F3EE": "cream",
    "#4F3D86": "violet",
    "#F0D9D0": "brick-soft",
    "#EFE5CB": "note",
}

ATTRS = {
    "stroke-width": "strokeWidth",
    "stroke-opacity": "strokeOpacity",
    "stroke-dasharray": "strokeDasharray",
    "stroke-linejoin": "strokeLinejoin",
    "stroke-linecap": "strokeLinecap",
    "fill-opacity": "fillOpacity",
    "fill-rule": "fillRule",
}
DROP = {"role", "aria-label", "xmlns"}  # the root svg is rewritten whole, so its width and height never reach the output


def tag(el: ET.Element) -> str:
    return el.tag.split("}")[-1]


def is_text_outline(el: ET.Element) -> bool:
    return tag(el) == "path" and len(el.get("d", "")) > 2000


def render(el: ET.Element, stem: str, depth: int) -> list[str]:
    name = tag(el)
    if name == "title":
        return []
    pad = "  " * depth
    if is_text_outline(el):
        # the note's handwriting, as text the app can translate
        return [f'{pad}<text x="84" y="80" textAnchor="middle" className="brand-note-text">{{label}}</text>']
    classes: list[str] = []
    attrs: list[str] = []
    for key, value in el.attrib.items():
        if key in DROP:
            continue
        if key in ("fill", "stroke") and value.upper() in COLOURS:
            classes.append(f"b{key[0]}-{COLOURS[value.upper()]}")
            continue
        if key == "id":
            value = f"{stem}-{value}"
        if value.startswith("url(#"):
            value = f"url(#{stem}-{value[5:]}"
        if key == "stroke-width":
            # strokes scale with the drawing; `strokeScale` thickens them where a drawing is shown small, so a 1 px hairline
            # does not dissolve into grey on a 1x screen
            attrs.append(f"strokeWidth={{{value} * strokeScale}}")
            continue
        attrs.append(f'{ATTRS.get(key, key)}="{value}"')
    if classes:
        attrs.append(f'className="{" ".join(classes)}"')
    head = f"<{name}{''.join(' ' + a for a in attrs)}"
    kids = [line for child in el for line in render(child, stem, depth + 1)]
    if not kids:
        return [f"{pad}{head} />"]
    return [f"{pad}{head}>", *kids, f"{pad}</{name}>"]


def component(stem: str, name: str) -> str:
    root = ET.parse(ASSETS / f"{stem}.svg").getroot()
    body = [line for child in root for line in render(child, stem, 3)]
    has_label = any(is_text_outline(el) for el in root.iter())
    has_stroke = any("stroke-width" in el.attrib for el in root.iter())
    # every drawing takes `strokeScale` so callers can treat them alike; one with no strokes simply ignores it
    scale = "strokeScale = 1" if has_stroke else "strokeScale: _strokeScale"
    props = (f"{{ className, label, {scale} }}: {{ className?: string; label: string; strokeScale?: number }}" if has_label
             else f"{{ className, {scale} }}: {{ className?: string; strokeScale?: number }}")
    return "\n".join([
        f"/** docs/brand/assets/{stem}.svg */",
        f"export function {name}({props}) {{",
        "  return (",
        f'    <svg viewBox="{root.get("viewBox")}" className={{`brand${{className ? ` ${{className}}` : ""}}`}} aria-hidden="true" focusable="false">',
        *body,
        "    </svg>",
        "  );",
        "}",
    ])


def main() -> None:
    parts = [
        "// Generated by docs/brand/assets/source/build_tsx.py from docs/brand/assets/*.svg. Do not edit by hand: change the",
        "// SVG or the script, then run it again. Colours are classes (bf-* fill, bs-* stroke) that calm.css maps to theme tokens.",
        'import React from "react";',
        "",
    ]
    parts += [component(stem, name) + "\n" for stem, name in DRAWINGS]
    text = "\n".join(parts).rstrip() + "\n"
    text = re.sub(r"\n{3,}", "\n\n", text)
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(DRAWINGS)} drawings)")


if __name__ == "__main__":
    main()
