#!/usr/bin/env python3
"""Stage 3D HQ4 - the two before/after pictures for the hand-off (development only; Pillow)

  python3 -I dev/stage-3d-hq4/delivery_sheets.py PACKDIR OUTDIR

  HQ4_fix_A_dark_ellipse.png   the user's two reference screenshots (PACKDIR/references, pixels untouched, enlarged 4x) above
                               evidence/h4-1/ellipse_before_after.png
  HQ4_fix_B_floor_shadow.png   evidence/h4-2/cast_rotation.png (the shadow alone) above the same scenes as on screen (the normal
                               captures at 0 and 315 degrees, before and after, brightened x1.8 so the floor shadow can be seen)
Nothing is redrawn; each tile is a crop of a real capture."""
import os, sys, json, math
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
HERE = os.path.dirname(os.path.abspath(__file__)); EV = os.path.join(HERE, 'evidence'); PACK, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
F = lambda s, b=False: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if b else ''), s)
BG, FG, DIM = (14, 14, 12), (236, 228, 200), (170, 160, 130)


def stack(top_tiles, title, sheet_path, note, out):
    sheet = Image.open(sheet_path).convert('RGB'); pad = 12
    th = max(t.height for t, _ in top_tiles); W = max(sheet.width, sum(t.width + pad for t, _ in top_tiles) + pad)
    im = Image.new('RGB', (W, 46 + th + 26 + pad + sheet.height + 26), BG); d = ImageDraw.Draw(im)
    d.text((pad, 12), title, font=F(19, True), fill=FG); x = pad
    for t, lab in top_tiles: d.text((x, 42), lab, font=F(13), fill=DIM); im.paste(t, (x, 62)); x += t.width + pad
    y = 62 + th + pad; im.paste(sheet, (0, y)); d.text((pad, y + sheet.height + 4), note, font=F(12), fill=DIM)
    im.save(out, optimize=True); print(out, im.size)


refs = [(Image.open(os.path.join(PACK, 'references', f)).convert('RGB'), f) for f in ('image_09_wanderer.png', 'image_10_wanderer.png')]
stack([(r.resize((r.width * 4, r.height * 4), Image.NEAREST), f'Your screenshot {f[6:8]} (4x)') for r, f in refs],
      'HQ4 fix A - the dark crescent in your screenshots (untouched), and that layer before and after', os.path.join(EV, 'h4-1', 'ellipse_before_after.png'),
      'Before/after: wanderer_lab.py captures of HQ3 QA1 (4934319) and HQ4 (H4-1) - the same frozen frame; HQ4 equals HQ3 with only that ellipse hidden, pixel for pixel.',
      os.path.join(OUT, 'HQ4_fix_A_dark_ellipse.png'))

lab = os.path.join(EV, 'h4-2', 'lab'); tiles = []
for var, tag in (('h41', 'BEFORE'), ('h42', 'AFTER')):
    R = json.load(open(os.path.join(lab, var, 'result.json')))
    for r in R['scenes']['rotation']:
        if r['heading'] in (0, 315) and r.get('shot'):
            im = Image.open(os.path.join(lab, var, r['shot']['file'])).convert('RGB'); c = im.width / 2
            im = im.crop((int(c - 45), int(c - 45), int(c + 95), int(c + 45))).resize((420, 270), Image.LANCZOS)
            tiles.append((ImageEnhance.Brightness(im).enhance(1.8), f'{tag}, turned {r["heading"]} deg (as on screen, x1.8 bright)'))
stack(tiles, 'HQ4 fix B - the floor shadow stays with the body as she turns', os.path.join(EV, 'h4-2', 'cast_rotation.png'),
      'Top: what you see (light at the left, her own light off). Below: the shadow alone. BEFORE = HQ3\'s BR-RoLE, AFTER = HQ4\'s; both with H4-1\'s bundle.',
      os.path.join(OUT, 'HQ4_fix_B_floor_shadow.png'))
