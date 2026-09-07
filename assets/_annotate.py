#!/usr/bin/env python
"""Annotate a product screenshot: ring the feature, magnify it, join the two.

At panel size a 12px icon on a 1892px screenshot is invisible, so the reader
cannot tell where the feature lives. This draws a ring around the real icon, a
magnified inset of it, and a leader line between them.

    python _annotate.py

Icon x-centres in shot-hero-loadboard.webp, per load row (y ~652):
    316 activity/price history · 346 map/Real Miles · 376 truck/Post Truck · 406 swap/Backhaul
"""
from PIL import Image, ImageDraw, ImageFont
import pathlib

HERE  = pathlib.Path(__file__).parent
FONTS = pathlib.Path(r"C:\Users\caleb\AppData\Local\Microsoft\Windows\Fonts")
BLUE, INK, WHITE = (51, 102, 255), (22, 22, 22), (255, 255, 255)

def annotate(src, out, icon_xy, crop, label, zoom=7, ring_r=15):
    """crop = region of the source to show; icon_xy = icon centre in SOURCE coords."""
    im = Image.open(HERE / src).convert("RGB")
    x0, y0, x1, y1 = crop
    base = im.crop(crop)
    W, H = base.size

    r = 19                                     # tight on the single icon
    mag = im.crop((icon_xy[0]-r, icon_xy[1]-r, icon_xy[0]+r, icon_xy[1]+r))
    mag = mag.resize((r*2*zoom, r*2*zoom), Image.LANCZOS)

    M, LABEL_H = 28, 46                        # margin, room for the caption
    canvas = Image.new("RGB", (W, H + mag.height + M*2 + LABEL_H), WHITE)
    canvas.paste(base, (0, 0))
    d = ImageDraw.Draw(canvas)

    cx, cy = icon_xy[0] - x0, icon_xy[1] - y0
    d.ellipse([cx-ring_r, cy-ring_r, cx+ring_r, cy+ring_r], outline=BLUE, width=4)

    ix = W - mag.width - M                     # inset sits below the board, right-aligned
    iy = H + M
    d.line([(cx, cy+ring_r), (ix + mag.width//2, iy)], fill=BLUE, width=4)
    d.rounded_rectangle([ix-7, iy-7, ix+mag.width+7, iy+mag.height+7],
                        radius=16, fill=WHITE, outline=BLUE, width=5)
    canvas.paste(mag, (ix, iy))

    f = ImageFont.truetype(str(FONTS / "Inter-SemiBold.otf"), 30)
    tw = d.textlength(label, font=f)
    d.text((ix + (mag.width-tw)/2, iy + mag.height + 18), label, font=f, fill=BLUE)

    canvas.save(HERE / out, "WEBP", quality=92, method=6)
    print(f"  {out}  {canvas.size}")

if __name__ == "__main__":
    SRC = "shot-hero-loadboard.webp"
    ROWS = (150, 578, 1500, 672)          # the load row and its action icons, nothing else
    annotate(SRC, "shot-realmiles.webp",  (346, 652), ROWS, "Open in Google Maps")
    annotate(SRC, "shot-backhaul-icon.webp", (406, 652), ROWS, "Find backhaul")
    annotate(SRC, "shot-posttruck-icon.webp", (376, 652), ROWS, "Post truck")
