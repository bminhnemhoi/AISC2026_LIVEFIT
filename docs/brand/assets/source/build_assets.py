"""LiveLift decorative assets in the Calm Studio / taped-card vocabulary. Flat vector, no gradients, no text except
outlined labels (Be Vietnam Pro). Run: python3 build_assets.py  (needs fonttools + brotli)."""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
FDIR = os.path.join(HERE, "..", "..", "..", "..", "next", "src", "components", "livedesk", "fonts")
INK, CREAM, PAPER, BRICK, KRAFT = "#2A2522", "#F6F3EE", "#FBF9F5", "#9E3B2B", "#C9B48A"
CHIP, LINE, VIOLET, AMBER = "#E4DACB", "#D8D0C4", "#4F3D86", "#8A5A00"
PINK, BEIGE, SAGE = "#F0D9D0", "#E8E0C8", "#8A9A7B"

_fonts = {}
def _font(weight):
    if weight not in _fonts:
        _fonts[weight] = [TTFont(os.path.join(FDIR, f"be-vietnam-pro-{s}-{weight}-normal.woff2")) for s in ("latin", "latin-ext", "vietnamese")]
    return _fonts[weight]

def text_path(text, size, x, y, weight=500, spacing=0.0, anchor="start"):
    fonts = _font(weight)
    def glyph(ch):
        for f in fonts:
            c = f.getBestCmap()
            if ord(ch) in c: return f, c[ord(ch)]
        raise KeyError(ch)
    def width():
        w = 0.0
        for ch in text:
            f, g = glyph(ch); w += f.getGlyphSet()[g].width * size / f["head"].unitsPerEm + spacing * size
        return w
    total = width()
    px = x - (total / 2 if anchor == "middle" else total if anchor == "end" else 0)
    out = []
    for ch in text:
        f, g = glyph(ch); gs = f.getGlyphSet(); k = size / f["head"].unitsPerEm
        p = SVGPathPen(gs); gs[g].draw(TransformPen(p, (k, 0, 0, -k, px, y))); out.append(p.getCommands())
        px += gs[g].width * k + spacing * size
    return " ".join(out)

def svg(w, h, body, title, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{("<defs>"+defs+"</defs>") if defs else ""}{body}</svg>\n')

def write(name, w, h, body, title, defs=""):
    with open(os.path.join(OUT, name + ".svg"), "w", encoding="utf-8") as fh: fh.write(svg(w, h, body, title, defs))

def tape(x, y, w=44, h=18, rot=4, op=0.92):
    zig = lambda x0, sgn: " ".join(f"L{x0 + sgn * (2 if i % 2 else 0)} {y + i * h / 6}" for i in range(0, 7))
    d = f"M{x} {y} " + zig(x, 1)[1:] if False else None
    pts = [(x, y)]
    pts += [(x + w, y)]
    pts += [(x + w - (2.2 if i % 2 else 0), y + i * h / 6) for i in range(1, 7)]
    pts += [(x + (2.2 if i % 2 else 0), y + h - i * h / 6) for i in range(0, 6)]
    poly = " ".join(f"{a:.1f},{b:.1f}" for a, b in pts)
    return f'<polygon points="{poly}" fill="{KRAFT}" opacity="{op}" transform="rotate({rot} {x + w / 2} {y + h / 2})"/>'

def garment(kind, cx, cy, s, color):
    """A flat garment silhouette in a 60x60 box centred on (cx, cy), scaled by s."""
    shapes = {
        "hoodie": f'<path d="M20 14 Q30 -2 40 14 Q30 24 20 14 Z" fill="{color}"/><path d="M22 14 Q30 3 38 14 Q30 20 22 14 Z" fill="{PAPER}" opacity=".35"/>'
                  f'<path d="M20 14 L8 22 L12 34 L18 31 L18 52 L42 52 L42 31 L48 34 L52 22 L40 14 Q30 26 20 14 Z" fill="{color}"/>'
                  f'<path d="M26 22 V30 M34 22 V30" stroke="{PAPER}" stroke-width="1.8" opacity=".7"/><path d="M22 41 H38 V50 H22 Z" fill="none" stroke="{PAPER}" stroke-width="1.8" opacity=".5"/>',
        "shirt": f'<path d="M21 10 Q30 17 39 10 L53 18 L47 29 L42 26 L42 52 L18 52 L18 26 L13 29 L7 18 Z" fill="{color}"/>',
        "pants": f'<path d="M18 7 H42 L45 53 H33 L30 24 L27 53 H15 Z" fill="{color}"/><path d="M18 12 H42" stroke="{PAPER}" stroke-width="2" opacity=".5"/>',
        "tote": f'<path d="M22 26 C22 6 38 6 38 26" fill="none" stroke="{color}" stroke-width="3.2"/><rect x="12" y="25" width="36" height="29" fill="{color}"/>'
                f'<rect x="19" y="33" width="22" height="3" fill="{PAPER}" opacity=".55"/>',
    }
    return f'<g transform="translate({cx - 30 * s} {cy - 30 * s}) scale({s})">{shapes[kind]}</g>'

def product_card(kind, color, tilt=-5, stack=True):
    back = f'<rect x="7" y="24" width="64" height="82" fill="none" stroke="{INK}" stroke-width="1.6" transform="rotate(3 39 65)"/>' if stack else ""
    card = (f'<g transform="rotate({tilt} 54 58)"><rect x="20" y="12" width="68" height="88" fill="{PAPER}" stroke="{INK}" stroke-width="3"/>'
            f'<rect x="28" y="22" width="52" height="40" fill="{CHIP}"/>{garment(kind, 54, 42, 0.62, color)}'
            f'<circle cx="35" cy="29" r="3.6" fill="{BRICK}"/>'
            f'<rect x="28" y="72" width="52" height="4.4" fill="{INK}"/><rect x="28" y="82" width="26" height="4.4" fill="{INK}"/></g>')
    return back + card + tape(37, 3, 34, 15, 4)

for kind, color, name in [("hoodie", BRICK, "ao-hoodie"), ("pants", INK, "quan-cargo"), ("tote", KRAFT, "tui-tote"), ("shirt", SAGE, "ao-linen")]:
    write(f"the-san-pham-{name}", 112, 118, product_card(kind, color), f"Thẻ sản phẩm ghim băng dính: {name}")

# 02 stack of cards (the "lift"): three cards fanned, the top one taped
stack = ""
for i, (dx, dy, rot) in enumerate([(30, 36, -9), (22, 24, -2), (14, 12, 5)]):
    stack += f'<g transform="rotate({rot} {dx + 40} {dy + 50})"><rect x="{dx}" y="{dy}" width="80" height="100" fill="{PAPER}" stroke="{INK}" stroke-width="{3 if i == 2 else 1.8}"/></g>'
stack += f'<g transform="rotate(5 54 62)"><rect x="24" y="22" width="60" height="42" fill="{CHIP}"/>{garment("hoodie", 54, 43, .66, BRICK)}<circle cx="31" cy="29" r="3.4" fill="{BRICK}"/><rect x="24" y="76" width="60" height="4.4" fill="{INK}"/><rect x="24" y="86" width="30" height="4.4" fill="{INK}"/></g>'
stack += tape(42, 4, 38, 16, -3)
write("chong-the", 132, 152, stack, "Chồng thẻ sản phẩm, thẻ trên cùng được ghim")

# 03 host phone with LIVE
ph = (f'<rect x="4" y="4" width="132" height="232" rx="16" fill="{INK}"/><rect x="11" y="11" width="118" height="218" rx="10" fill="{CHIP}"/>'
      f'<rect x="11" y="11" width="118" height="70" fill="#CDBEA6"/><g fill="{SAGE}"><rect x="20" y="24" width="20" height="46"/></g><rect x="46" y="24" width="20" height="46" fill="#C98A6B"/><rect x="72" y="24" width="20" height="46" fill="#7F93AE"/><rect x="98" y="24" width="20" height="46" fill="{KRAFT}"/>'
      f'<circle cx="70" cy="104" r="17" fill="#E9CDB6"/><path d="M40 190 Q40 128 70 128 Q100 128 100 190 Z" fill="{PAPER}"/><path d="M58 138 L70 156 L82 138 Z" fill="{BRICK}"/>'
      f'<rect x="18" y="18" width="30" height="13" fill="{BRICK}"/><rect x="24" y="23" width="18" height="3" fill="{PAPER}"/><rect x="54" y="18" width="30" height="13" fill="{INK}" opacity=".78"/><rect x="100" y="18" width="22" height="13" fill="{INK}" opacity=".78"/>'
      f'<rect x="18" y="168" width="64" height="9" fill="{INK}" opacity=".75"/><rect x="18" y="181" width="48" height="9" fill="{INK}" opacity=".75"/>'
      f'<rect x="18" y="196" width="104" height="26" fill="{PAPER}"/><rect x="24" y="202" width="14" height="14" fill="{CHIP}"/><rect x="44" y="203" width="40" height="4" fill="{INK}"/><rect x="44" y="211" width="24" height="4" fill="{BRICK}"/><rect x="96" y="203" width="20" height="13" fill="{INK}"/>')
write("dien-thoai-livestream", 140, 240, ph, "Điện thoại người dẫn đang livestream")

# 04 comments with intent chips (no words)
rows = [(PINK, 30, 84), (BEIGE, 36, 60), (CHIP, 26, 96), (PINK, 30, 70)]
com = ""
for i, (chip, cw, tw) in enumerate(rows):
    y = 10 + i * 40
    com += f'<circle cx="16" cy="{y + 12}" r="9" fill="{INK}" opacity=".18"/><rect x="34" y="{y + 1}" width="{cw}" height="9" fill="{chip}" stroke="{INK}" stroke-width=".8" stroke-opacity=".45"/>'
    com += f'<rect x="34" y="{y + 15}" width="{tw + 40}" height="6" fill="{INK}"/><line x1="0" x2="190" y1="{y + 33}" y2="{y + 33}" stroke="{LINE}" stroke-width="1"/>'
write("binh-luan-chip", 190, 168, com, "Dòng bình luận có nhãn ý định")

# 05 chart motif: viewers line, pin markers, hatched no-pin region, bars
hatch = f'<pattern id="h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="{INK}" stroke-opacity=".35" stroke-width="1"/></pattern>'
ch = (f'<line x1="14" x2="314" y1="104" y2="104" stroke="{INK}" stroke-width="1.2"/><line x1="14" x2="314" y1="50" y2="50" stroke="{LINE}"/>'
      f'<path d="M14 104 L14 92 C50 88 70 80 96 76 S150 68 180 60 S250 50 314 36 L314 104 Z" fill="{CHIP}"/><path d="M14 92 C50 88 70 80 96 76 S150 68 180 60 S250 50 314 36" fill="none" stroke="{INK}" stroke-width="2.4"/>'
      f'<line x1="86" x2="86" y1="18" y2="168" stroke="{INK}" stroke-width="1.4" stroke-dasharray="4 4"/><line x1="216" x2="216" y1="18" y2="168" stroke="{INK}" stroke-width="1.4" stroke-dasharray="4 4"/>'
      f'<rect x="86" y="10" width="42" height="14" fill="{PAPER}" stroke="{INK}" stroke-width="1"/><rect x="216" y="10" width="42" height="14" fill="{PAPER}" stroke="{INK}" stroke-width="1"/>'
      f'<rect x="14" y="116" width="72" height="52" fill="url(#h)"/>'
      f'<rect x="88" y="150" width="30" height="18" fill="{BRICK}"/><rect x="120" y="138" width="30" height="30" fill="{BRICK}"/><rect x="152" y="130" width="30" height="38" fill="{BRICK}"/><rect x="184" y="144" width="30" height="24" fill="{BRICK}"/><rect x="218" y="124" width="30" height="44" fill="{BRICK}"/><rect x="250" y="134" width="30" height="34" fill="{BRICK}"/>'
      f'<line x1="14" x2="314" y1="168" y2="168" stroke="{INK}" stroke-width="1.2"/><circle cx="314" cy="36" r="4.4" fill="{INK}"/>')
write("bieu-do-ghim", 324, 180, ch, "Biểu đồ người xem, vạch ghim và vùng không ghim", defs=hatch)

# 06 clothes rack
rack = f'<line x1="14" x2="214" y1="30" y2="30" stroke="{INK}" stroke-width="4"/><line x1="14" x2="14" y1="30" y2="170" stroke="{INK}" stroke-width="4"/><line x1="214" x2="214" y1="30" y2="170" stroke="{INK}" stroke-width="4"/><line x1="2" x2="40" y1="170" y2="170" stroke="{INK}" stroke-width="4"/><line x1="188" x2="226" y1="170" y2="170" stroke="{INK}" stroke-width="4"/>'
for x, kind, col in [(50, "shirt", SAGE), (92, "hoodie", BRICK), (134, "pants", INK), (176, "tote", KRAFT)]:
    rack += f'<path d="M{x} 30 L{x} 38 M{x - 14} 48 L{x} 38 L{x + 14} 48 Z" fill="none" stroke="{INK}" stroke-width="2"/>' + garment(kind, x, 78, 1.05, col)
write("gia-treo-do", 228, 176, rack, "Giá treo quần áo của người bán")

# 07 ring light and tripod with phone
rl = (f'<circle cx="80" cy="76" r="62" fill="none" stroke="{INK}" stroke-width="7"/><circle cx="80" cy="76" r="50" fill="none" stroke="{LINE}" stroke-width="1.4"/>'
      f'<rect x="62" y="48" width="36" height="62" rx="5" fill="{INK}"/><rect x="66" y="53" width="28" height="52" rx="2" fill="{CHIP}"/><rect x="69" y="56" width="12" height="6" fill="{BRICK}"/>'
      f'<line x1="80" x2="80" y1="138" y2="176" stroke="{INK}" stroke-width="5"/><line x1="80" x2="44" y1="176" y2="224" stroke="{INK}" stroke-width="5"/><line x1="80" x2="116" y1="176" y2="224" stroke="{INK}" stroke-width="5"/><line x1="80" x2="80" y1="176" y2="228" stroke="{INK}" stroke-width="5"/>'
      f'<circle cx="138" cy="22" r="9" fill="{BRICK}"/>')
write("den-livestream", 160, 232, rl, "Đèn vòng và chân máy livestream")

# 08 cart with +1
cart = (f'<path d="M6 12 H24 L40 74 H100 L112 34 H30" fill="none" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/><circle cx="48" cy="92" r="8" fill="{INK}"/><circle cx="92" cy="92" r="8" fill="{INK}"/>'
        f'<rect x="76" y="2" width="42" height="26" fill="{BRICK}"/><path d="{text_path("+1", 20, 97, 22, 600, 0, "middle")}" fill="{PAPER}"/>')
write("gio-hang-them", 124, 104, cart, "Giỏ hàng có thêm một sản phẩm")

# 09 price tag (missing price stays missing: no number)
tag = (f'<path d="M10 52 L52 10 H108 V94 H52 Z" fill="{PAPER}" stroke="{INK}" stroke-width="3" stroke-linejoin="miter"/><circle cx="52" cy="52" r="6" fill="{CREAM}" stroke="{INK}" stroke-width="2.4"/>'
       f'<rect x="66" y="30" width="30" height="5" fill="{INK}"/><rect x="66" y="44" width="30" height="5" fill="{INK}"/><rect x="66" y="64" width="22" height="9" fill="none" stroke="{AMBER}" stroke-width="1.6" stroke-dasharray="3 2"/>'
       f'<path d="M52 46 C46 22 30 10 14 8" fill="none" stroke="{INK}" stroke-width="2"/>')
write("the-gia", 118, 104, tag, "Thẻ giá, ô giá chưa nhập để trống")

# 10 SIMULATED stamp
sp = text_path("SIMULATED", 20, 82, 38, 600, 0.16, "middle")
write("tem-simulated", 164, 60, f'<g transform="rotate(-4 82 30)"><rect x="4" y="8" width="156" height="44" fill="none" stroke="{VIOLET}" stroke-width="3"/><path d="{sp}" fill="{VIOLET}"/></g>', "Tem SIMULATED")
sp2 = text_path("LIVE", 18, 34, 31, 600, 0.12, "middle")
write("nhan-live", 68, 44, f'<rect x="2" y="4" width="64" height="32" fill="{BRICK}"/><circle cx="14" cy="20" r="4" fill="{PAPER}"/><path d="{text_path("LIVE", 15, 42, 25, 600, 0.1, "middle")}" fill="{PAPER}"/>', "Nhãn LIVE")

# 11 sticky note: "Chưa biết" (the honest box)
note_txt = text_path("Chưa biết", 24, 84, 78, 400, 0, "middle")
note = (f'<g transform="rotate(-3 84 70)"><rect x="8" y="14" width="152" height="112" fill="#EFE5CB" stroke="{INK}" stroke-width="1.4"/><rect x="16" y="22" width="136" height="96" fill="none" stroke="{INK}" stroke-width="1.2" stroke-dasharray="5 4"/>'
        f'<path d="{note_txt}" fill="{INK}"/><path d="M60 94 H108" stroke="{BRICK}" stroke-width="2.4"/></g>' + tape(54, 2, 56, 18, 3))
write("ghi-chu-chua-biet", 168, 134, note, "Ghi chú: Chưa biết")

# 12 push pin, 13 paper clip, 14 arrow, 15 hairline ornament
write("ghim-tron", 40, 52, f'<path d="M20 50 L20 28" stroke="{INK}" stroke-width="2.4"/><circle cx="20" cy="16" r="13" fill="{BRICK}" stroke="{INK}" stroke-width="2.4"/><path d="M14 12 A8 8 0 0 1 22 8" fill="none" stroke="{PAPER}" stroke-width="2.4" opacity=".7"/>', "Ghim tròn đỏ")
write("kep-giay", 30, 76, f'<path d="M20 22 V54 A9 9 0 0 1 2 54 V16 A7 7 0 0 1 16 16 V52" fill="none" stroke="{INK}" stroke-width="2.6" stroke-linecap="round" transform="translate(4 0)"/>', "Kẹp giấy")
write("mui-ten-nghieng", 120, 60, f'<path d="M4 46 C34 54 68 40 98 14" fill="none" stroke="{INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M80 12 L102 10 L98 32" fill="none" stroke="{INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>', "Mũi tên nét mực")
write("duong-ke-doi", 400, 14, f'<line x1="0" x2="400" y1="3" y2="3" stroke="{INK}" stroke-width="1.4"/><line x1="0" x2="400" y1="10" y2="10" stroke="{LINE}" stroke-width="1"/><rect x="190" y="0" width="20" height="14" fill="{CREAM}"/><circle cx="200" cy="7" r="3.4" fill="{BRICK}"/>', "Đường kẻ đôi có chấm đỏ")
write("bang-dinh-kraft", 160, 64, tape(8, 6, 144, 26, -2) + tape(20, 36, 110, 22, 1.5), "Hai dải băng dính kraft")

# 16 background tile and 17 hatch swatch (for fills)
write("nen-cham-kem", 200, 200, f'<rect width="200" height="200" fill="{CREAM}"/>' + "".join(f'<circle cx="{x}" cy="{y}" r="1.6" fill="{INK}" opacity=".16"/>' for x in range(20, 200, 40) for y in range(20, 200, 40)), "Nền kem chấm mờ")
print("assets written to", OUT)
