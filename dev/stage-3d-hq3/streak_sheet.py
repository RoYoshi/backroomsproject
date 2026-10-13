#!/usr/bin/env python3
"""Stage 3D HQ3 QA correction 1 - the before/after sheet for the white gib streaks (development only; Pillow)

  python3 -I dev/stage-3d-hq3/streak_sheet.py

  evidence/h3-qa1/streak_fix_before_after.png
    top: the live game, Bob's screen, the same blast (the same server seed) before the fix (H3-3's gib_browser run on 486564d) and after it
         (this correction's run), at 0.15 s and settled, enlarged 2.5x;
    bottom: two of gib_streaks.py's explosions drawn at 4x by the shipped gore.js and by the fixed one.
Nothing is redrawn: each tile is a crop of one screenshot, scaled."""
import os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); EV = os.path.join(HERE, 'evidence')
F = lambda s, b=False: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if b else ''), s)
BG, FG, DIM = (14, 14, 12), (236, 228, 200), (170, 160, 130)
before, after = os.path.join(EV, 'h3-3', 'shots', 'gib_final'), os.path.join(EV, 'h3-qa1', 'shots', 'gib_browser')
live = (165, 80, 335, 250); T = 400
tiles = []
for f, when in (('blast_0.15s_bob.png', '0.15 s'), ('settled_bob.png', 'settled')):
    for d, tag in ((before, 'BEFORE'), (after, 'AFTER')):
        tiles.append((Image.open(os.path.join(d, f)).convert('RGB').crop(live).resize((T, T), Image.NEAREST), f'{tag} - live game, {when} (2.5x)'))
sh = os.path.join(EV, 'h3-qa1', 'shots')
for k, box in ((1, (300, 20, 600, 320)), (2, (600, 20, 900, 320))):
    for f, tag in (('streaks_shipped.png', 'BEFORE'), ('streaks_fixed.png', 'AFTER')):
        tiles.append((Image.open(os.path.join(sh, f)).convert('RGB').crop(box).resize((T, T), Image.LANCZOS), f'{tag} - explosion {k + 1} drawn at 4x'))
pad, cols = 14, 4; rows = (len(tiles) + cols - 1) // cols
W = cols * T + (cols + 1) * pad; H = 52 + rows * (T + 28 + pad) + 30
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
d.text((pad, 12), 'Stage 3D HQ3 - the white gib streaks, before and after the one-line gore.js fix', font=F(20, True), fill=FG)
for i, (t, label) in enumerate(tiles):
    x = pad + (i % cols) * (T + pad); y = 46 + (i // cols) * (T + 28 + pad)
    d.text((x, y), label, font=F(14), fill=DIM); im.paste(t, (x, y + 22))
d.text((pad, H - 24), 'Real screenshots (gib_browser.py; gib_streaks.py; SwiftShader). The pieces, hands, blood and light are the same; only the stray lines are gone.', font=F(13), fill=DIM)
out = os.path.join(EV, 'h3-qa1', 'streak_fix_before_after.png'); im.save(out, optimize=True); print(out, im.size)
