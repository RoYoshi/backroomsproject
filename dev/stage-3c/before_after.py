#!/usr/bin/env python3
"""Stage 3C - before / after contact sheets (development only).

  python3 dev/stage-3c/before_after.py BEFORE_DIR AFTER_DIR OUT_DIR

BEFORE_DIR holds the Stage 3B parent's shots (parent_<surface>.jpg or .png, dev/stage-3c/evidence/c0), AFTER_DIR the final
build's (<tag>_<surface>.png). Writes OUT_DIR/before_after_desktop.jpg and before_after_touch.jpg: one row per surface, the
parent on the left, Stage 3C on the right."""
import os, sys
from PIL import Image, ImageDraw, ImageFont
B, A, O = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(O, exist_ok=True)
F = lambda n: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', n) if os.path.exists('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf') else ImageFont.load_default()
def find(d, prefix, surf):
    for f in sorted(os.listdir(d)):
        stem = os.path.splitext(f)[0]
        if stem.endswith('_' + surf) and stem.split('_', 1)[1] == surf and (prefix is None or stem.startswith(prefix)): return os.path.join(d, f)
    return None
DESK = [('boot', 'boot', 'Boot: the menu'), ('play', 'play', 'PLAY / entry'), ('hud', 'hud', 'HUD, lit'), ('darklight', 'darklight', 'HUD, dark (flashlight)'),
        ('dark', 'dark', 'HUD, true dark'), ('inventory', 'inventory', 'Inventory'), ('pause', 'pause', 'Pause'), ('caught', 'caught', 'Caught'),
        ('won', 'won', 'Win'), ('run', 'run', 'Run menu'), ('customize', 'customize_wanderer', 'Customize (wanderer)'), ('customize', 'customize_loadout', 'Customize (loadout)'),
        ('settings_custom', 'settings_hud', 'Settings: HUD'), ('settings_controls', 'settings_controls', 'Settings: controls'), ('settings_audio', 'settings_sound', 'Settings: sound'),
        ('reduced_boot', 'reduced_boot', 'Reduced motion: boot'), ('narrow_boot', 'narrow_boot', '700 x 900')]
TOUCH = [('mobile_boot', 'mobile_boot', 'Phone: boot'), ('mobile_hud', 'mobile_hud', 'Phone: HUD'), (None, 'mobile_pause', 'Phone: pause'), (None, 'mobile_inventory', 'Phone: inventory'),
         (None, 'mobile_cam', 'Phone: camcorder'), (None, 'landscape_boot', 'Phone sideways: menu'), (None, 'landscape_hud', 'Phone sideways: HUD')]
def sheet(rows, out, h):
    cells = []
    for b, a, lab in rows:
        pb = find(B, 'parent', b) if b else None; pa = find(A, None, a)
        if not pa: continue
        cells.append((lab, pb, pa))
    W = lambda p: round(Image.open(p).width * h / Image.open(p).height) if p else 0
    cw = max(max(W(c[1]), W(c[2])) for c in cells)
    img = Image.new('RGB', (12 + 2 * (cw + 12), 40 + len(cells) * (h + 40)), (14, 12, 8)); d = ImageDraw.Draw(img)
    d.text((12, 10), 'STAGE 3B PARENT', fill=(160, 155, 125), font=F(18)); d.text((24 + cw, 10), 'STAGE 3C', fill=(227, 199, 104), font=F(18))
    for i, (lab, pb, pa) in enumerate(cells):
        y = 40 + i * (h + 40); d.text((12, y + 8), lab, fill=(236, 228, 198), font=F(16))
        for j, p in enumerate((pb, pa)):
            x = 12 + j * (cw + 12)
            if p: im = Image.open(p).convert('RGB'); im = im.resize((W(p), h), Image.LANCZOS); img.paste(im, (x, y + 32))
            else: d.text((x + 8, y + 32 + h // 2), '(not in the parent capture: the parent had no touch PAUSE / INV and no landscape layout)', fill=(120, 115, 95), font=F(15))
    img.save(out, quality=80, optimize=True); print(out, len(cells))
sheet(DESK, os.path.join(O, 'before_after_desktop.jpg'), 300)
sheet(TOUCH, os.path.join(O, 'before_after_touch.jpg'), 420)
