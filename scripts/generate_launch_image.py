"""
Generate launch screen PNG images matching the first frame of SplashScreen.tsx.
All dimensions are derived directly from the component's StyleSheet constants.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

# ── Palette (from SplashScreen.tsx) ───────────────────────────────────────────
C = {
    "sky":        (0xF2, 0xEB, 0xE4),
    "sun":        (0xC7, 0x7D, 0x7D),
    "sunHalo":    (0xF2, 0xDC, 0xC9),
    "sunRay":     (0xD9, 0x90, 0x5F),
    "hull":       (0x30, 0x4E, 0x78),
    "sail":       (0xE8, 0xA0, 0x73),
    "seaTop":     (0xA8, 0xBD, 0xD4),
    "seaBottom":  (0x7F, 0xA8, 0xD0),
    "reflection": (0xD9, 0xA0, 0x93),
    "text":       (0x30, 0x4E, 0x78),
    "textMuted":  (0x8A, 0x5A, 0x1E),
}

# ── Reference layout constants (1× = 390 × 844 pt) ───────────────────────────
REF_W, REF_H = 390, 844
SUN_SIZE   = 120   # sun diameter
SUN_HALO   = 150   # halo diameter
SEA_HEIGHT = 110
SHIP_WIDTH = 180
RAY_DIST   = 72    # from sun-centre to ray-centre
RAY_W, RAY_H = 6, 18
RAY_RADIUS    = 3


def alpha(rgb, a):
    return rgb + (int(255 * a),)


def draw_rounded_rect(draw, xy, radius, fill, corners=(True, True, True, True)):
    """Draw a rectangle with independent corner radii using Pillow."""
    x0, y0, x1, y1 = xy
    r = min(radius, (x1 - x0) / 2, (y1 - y0) / 2)
    draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    if corners[0]:  # top-left
        draw.ellipse([x0, y0, x0 + 2*r, y0 + 2*r], fill=fill)
    else:
        draw.rectangle([x0, y0, x0 + r, y0 + r], fill=fill)
    if corners[1]:  # top-right
        draw.ellipse([x1 - 2*r, y0, x1, y0 + 2*r], fill=fill)
    else:
        draw.rectangle([x1 - r, y0, x1, y0 + r], fill=fill)
    if corners[2]:  # bottom-right
        draw.ellipse([x1 - 2*r, y1 - 2*r, x1, y1], fill=fill)
    else:
        draw.rectangle([x1 - r, y1 - r, x1, y1], fill=fill)
    if corners[3]:  # bottom-left
        draw.ellipse([x0, y1 - 2*r, x0 + 2*r, y1], fill=fill)
    else:
        draw.rectangle([x0, y1 - r, x0 + r, y1], fill=fill)


def generate(out_path, width, height):
    sc = width / REF_W  # scale factor

    img = Image.new("RGBA", (width, height), C["sky"] + (255,))
    draw = ImageDraw.Draw(img, "RGBA")

    # ── Computed positions ────────────────────────────────────────────────────
    pad_top = height * 0.13
    sun_cx  = width / 2
    sun_cy  = pad_top + 105 * sc   # centre of sunWrap (210/2 = 105)

    sea_top_y = height - SEA_HEIGHT * sc
    sea_mid_y = sea_top_y + (SEA_HEIGHT / 2) * sc

    ship_bottom = height - (SEA_HEIGHT - 28) * sc   # bottom: SEA_HEIGHT-28

    # ── 1. Sun halo ───────────────────────────────────────────────────────────
    hr = (SUN_HALO / 2) * sc
    draw.ellipse([sun_cx - hr, sun_cy - hr, sun_cx + hr, sun_cy + hr],
                 fill=C["sunHalo"] + (255,))

    # ── 2. Sun rays (8, evenly spaced) ───────────────────────────────────────
    for i in range(8):
        angle_deg = i * 45
        angle_rad = math.radians(angle_deg)
        rx = sun_cx + RAY_DIST * sc * math.sin(angle_rad)
        ry = sun_cy - RAY_DIST * sc * math.cos(angle_rad)
        rw = int(RAY_W * sc)
        rh = int(RAY_H * sc)
        pad = int(RAY_DIST * sc * 1.6)
        tile = Image.new("RGBA", (pad * 2, pad * 2), (0, 0, 0, 0))
        td = ImageDraw.Draw(tile, "RGBA")
        cx, cy_t = pad, pad
        td.rounded_rectangle(
            [cx - rw // 2, cy_t - rh // 2, cx + rw // 2, cy_t + rh // 2],
            radius=max(1, int(RAY_RADIUS * sc)),
            fill=C["sunRay"] + (255,),
        )
        rotated = tile.rotate(-angle_deg, expand=False, resample=Image.BICUBIC)
        img.paste(rotated, (int(rx) - pad, int(ry) - pad), rotated)

    # ── 3. Sun disk ───────────────────────────────────────────────────────────
    sr = (SUN_SIZE / 2) * sc
    draw.ellipse([sun_cx - sr, sun_cy - sr, sun_cx + sr, sun_cy + sr],
                 fill=C["sun"] + (255,))

    # ── 4. Sea bands ──────────────────────────────────────────────────────────
    draw.rectangle([0, sea_top_y, width, sea_mid_y], fill=C["seaTop"] + (255,))
    draw.rectangle([0, sea_mid_y, width, height],    fill=C["seaBottom"] + (255,))

    # Reflections
    r1x = width * 0.35
    r1y = sea_top_y + 6 * sc
    draw.rounded_rectangle([r1x, r1y, r1x + 80 * sc, r1y + 2 * sc],
                            radius=sc, fill=alpha(C["reflection"], 0.7))
    r2x = width * 0.30
    r2y = sea_top_y + (SEA_HEIGHT / 2 + 8) * sc
    draw.rounded_rectangle([r2x, r2y, r2x + 90 * sc, r2y + 2 * sc],
                            radius=sc, fill=alpha(C["reflection"], 0.5))

    # ── 5. Mast ───────────────────────────────────────────────────────────────
    mast_bottom = ship_bottom - 30 * sc
    mast_top    = mast_bottom - 72 * sc
    mast_cx     = width / 2
    draw.rounded_rectangle(
        [mast_cx - 2 * sc, mast_top, mast_cx + 2 * sc, mast_bottom],
        radius=max(1, int(2 * sc)),
        fill=C["hull"] + (255,),
    )

    # ── 6. Sail ───────────────────────────────────────────────────────────────
    sail_left   = width / 2 + (SHIP_WIDTH / 2 + 2) * sc - SHIP_WIDTH * sc / 2
    # shipWrap left = (width - SHIP_WIDTH*sc)/2, sail left within wrap = (SHIP_WIDTH/2+2)*sc
    ship_left   = (width - SHIP_WIDTH * sc) / 2
    sail_left   = ship_left + (SHIP_WIDTH / 2 + 2) * sc
    sail_right  = sail_left + 36 * sc
    sail_bottom = ship_bottom - 34 * sc
    sail_top    = sail_bottom - 64 * sc

    # Draw sail using two overlapping rounded rectangles to approximate
    # asymmetric corners (TL=4, TR≈32, BR=20, BL=4)
    # Upper half (big right curve)
    draw_rounded_rect(draw,
                      [sail_left, sail_top, sail_right, (sail_top + sail_bottom) / 2 + 2 * sc],
                      radius=min(32 * sc, 36 * sc / 2),
                      fill=C["sail"] + (255,),
                      corners=(True, True, False, False))
    # Lower half (smaller curves)
    draw_rounded_rect(draw,
                      [sail_left, (sail_top + sail_bottom) / 2, sail_right, sail_bottom],
                      radius=min(20 * sc, 36 * sc / 2),
                      fill=C["sail"] + (255,),
                      corners=(False, False, True, True))
    # Fill gap between the two halves
    draw.rectangle([sail_left, (sail_top + sail_bottom) / 2 - sc,
                    sail_right, (sail_top + sail_bottom) / 2 + sc + 2 * sc],
                   fill=C["sail"] + (255,))

    # ── 7. Hull ───────────────────────────────────────────────────────────────
    hull_left  = ship_left
    hull_right = ship_left + SHIP_WIDTH * sc
    hull_top   = ship_bottom - 36 * sc
    # Top corners radius=4, bottom corners radius=26
    draw_rounded_rect(draw,
                      [hull_left, hull_top, hull_right, ship_bottom],
                      radius=4 * sc,
                      fill=C["hull"] + (255,),
                      corners=(True, True, False, False))
    draw_rounded_rect(draw,
                      [hull_left, hull_top, hull_right, ship_bottom],
                      radius=min(26 * sc, (ship_bottom - hull_top) / 2),
                      fill=C["hull"] + (255,),
                      corners=(False, False, True, True))
    # Fill the middle band that might gap
    draw.rectangle([hull_left, hull_top + 4 * sc, hull_right, ship_bottom - 26 * sc],
                   fill=C["hull"] + (255,))

    # ── 8. Text block ─────────────────────────────────────────────────────────
    text_bottom = height - (SEA_HEIGHT + 110) * sc  # bottom: SEA_HEIGHT+110=220

    # Try to load a font; fall back to Pillow's default if not found.
    title_size  = int(34 * sc)
    credit_size = int(11 * sc)

    font_candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-BoldItalic.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSerifBoldItalic.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    ]
    credit_candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSerif.ttf",
    ]

    title_font  = None
    credit_font = None
    for f in font_candidates:
        if os.path.exists(f):
            title_font = ImageFont.truetype(f, title_size)
            break
    for f in credit_candidates:
        if os.path.exists(f):
            credit_font = ImageFont.truetype(f, credit_size)
            break

    if title_font is None:
        title_font  = ImageFont.load_default(size=title_size)
    if credit_font is None:
        credit_font = ImageFont.load_default(size=credit_size)

    lines = [
        ("megálē várka",        title_font,  C["text"],      True),
        ("Powered by React Native", credit_font, C["textMuted"], False),
        ("Created by IssaShimoda",  credit_font, C["textMuted"], False),
    ]

    # Measure total block height (bottom-up layout from text_bottom)
    line_heights = []
    for text, font, _, _ in lines:
        bb = draw.textbbox((0, 0), text, font=font)
        line_heights.append(bb[3] - bb[1])

    gap_after_title  = int(10 * sc)
    gap_between_cred = int(2 * sc)
    total_h = (line_heights[0] + gap_after_title
               + line_heights[1] + gap_between_cred + line_heights[2])

    y = text_bottom - total_h
    for idx, (text, font, color, _) in enumerate(lines):
        bb = draw.textbbox((0, 0), text, font=font)
        tw = bb[2] - bb[0]
        tx = (width - tw) / 2 - bb[0]
        draw.text((tx, y - bb[1]), text, font=font, fill=color + (255,))
        y += line_heights[idx]
        if idx == 0:
            y += gap_after_title
        else:
            y += gap_between_cred

    # ── Save ──────────────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.convert("RGB").save(out_path, "PNG", optimize=True)
    print(f"  ✓ {out_path}  ({width}×{height})")


if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ios_set = os.path.join(base, "ios", "megale_varka", "Images.xcassets",
                           "LaunchImage.imageset")
    android_drawable = os.path.join(base, "android", "app", "src", "main",
                                    "res", "drawable")

    print("Generating launch images…")

    # iOS @1x  (375 × 667 – classic iPhone size)
    generate(os.path.join(ios_set, "launch_image.png"),          375,  667)
    # iOS @2x  (750 × 1334)
    generate(os.path.join(ios_set, "launch_image@2x.png"),       750, 1334)
    # iOS @3x  (1170 × 2532 – iPhone 12/13/14 class)
    generate(os.path.join(ios_set, "launch_image@3x.png"),      1170, 2532)
    # Android  (1080 × 2340 – FHD+)
    generate(os.path.join(android_drawable, "launch_image.png"), 1080, 2340)

    print("Done.")
