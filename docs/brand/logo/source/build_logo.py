"""Builds the LiveLift logo files (SVG, text converted to outlines) from Be Vietnam Pro Medium.
Run:  python3 build_logo.py   (needs fonttools + brotli; writes next to this file's parent folder)."""
import io, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
FONT = os.path.join(HERE, "..", "..", "..", "..", "next", "src", "components", "livedesk", "fonts", "be-vietnam-pro-latin-500-normal.woff2")

INK, CREAM, BRICK, KRAFT = "#2A2522", "#F6F3EE", "#9E3B2B", "#C9B48A"
PAPER = "#FBF9F5"
D_INK, D_PAPER, D_BRICK, D_LINE = "#2A2522", "#2A2522", "#D4624A", "#F3ECE1"

def outline(text, size, x, y, spacing=0.0):
    f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
    k = size / upm; pen_x = 0.0; paths = []
    for ch in text:
        g = cmap[ord(ch)]; p = SVGPathPen(gs)
        gs[g].draw(TransformPen(p, (k, 0, 0, -k, x + pen_x, y)))
        paths.append(p.getCommands()); pen_x += gs[g].width * k + spacing * size
    return " ".join(paths), pen_x

# The team's logo (an L with a fold, a growth bar, a curved lift arrow and two live-signal arcs), redrawn flat in the
# Calm Studio palette: no glow, no gradient. Source coordinates come from the team's artwork (1254 px square).
VB = "270 190 780 780"
def mark_shapes(ink, acc):
    return (f'<path d="M530 248 V812 H430 C350 812 310 770 310 700 V440 C310 415 322 402 342 390 Z" fill="{ink}"/>'
            f'<path d="M310 760 C310 900 380 962 480 962 H975 L905 848 H520 C400 848 330 815 310 760 Z" fill="{ink}"/>'
            f'<path d="M700 342 V780 H570 V398 Z" fill="{acc}"/>'
            f'<path d="M520 815 C660 805 800 725 810 553 L733 553 L855 425 L975 553 L912 553 C905 700 800 815 640 818 Z" fill="{acc}"/>'
            f'<path d="M815 228 C910 230 985 300 1000 410" fill="none" stroke="{acc}" stroke-width="36" stroke-linecap="round"/>'
            f'<path d="M818 312 C870 315 915 350 922 405" fill="none" stroke="{acc}" stroke-width="36" stroke-linecap="round"/>')

def mark(ink, acc, size=64, pad=0, ground=None):
    k = (size - 2 * pad) / 780
    g = f'<g transform="translate({pad - 270 * k:.3f} {pad - 190 * k:.3f}) scale({k:.5f})">{mark_shapes(ink, acc)}</g>'
    return (f'<rect width="{size}" height="{size}" fill="{ground}"/>' if ground else "") + g

def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')

def lockup(ink, paper, brick, lift, mono=False):
    size = 40; base = 47
    live, wl = outline("Live", size, 74, base, -0.01)
    lft, wf = outline("Lift", size, 74 + wl, base, -0.01)
    width = int(74 + wl + wf + 6)
    body = mark(ink, lift if not mono else ink) + f'<path d="{live}" fill="{ink}"/><path d="{lft}" fill="{lift}"/>'
    return svg(width, 64, body, "LiveLift"), width

def write(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh: fh.write(content)

write("logo-mark.svg", svg(64, 64, mark(INK, BRICK), "LiveLift"))
write("logo-mark-dark.svg", svg(64, 64, mark(D_LINE, D_BRICK), "LiveLift"))
write("logo-mark-mono.svg", svg(64, 64, mark(INK, INK), "LiveLift"))
s, w = lockup(INK, PAPER, BRICK, BRICK); write("logo-lockup.svg", s)
s, _ = lockup(D_LINE, D_PAPER, D_BRICK, D_BRICK); write("logo-lockup-dark.svg", s)
s, _ = lockup(INK, "none", INK, INK, mono=True); write("logo-lockup-mono.svg", s)
# favicon: on a cream tile with a little padding so it reads on dark browser tabs too
write("favicon.svg", svg(64, 64, mark(INK, BRICK, pad=7, ground=CREAM), "LiveLift"))
print("lockup width", w)
