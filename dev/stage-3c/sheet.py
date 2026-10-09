#!/usr/bin/env python3
"""Stage 3C - screenshots to evidence (development only).

  python3 dev/stage-3c/sheet.py SRC_DIR OUT_DIR [--tag c1] [--width 1280] [--sheet NAME:pat1,pat2,... ...]

Every PNG in SRC_DIR becomes OUT_DIR/<name>.jpg (scaled to --width, quality 82), and each --sheet NAME:patterns writes
OUT_DIR/<tag>_<NAME>.jpg, a labelled contact sheet of the matching shots (substring match on the file name, in order)."""
import sys, os
from PIL import Image, ImageDraw, ImageFont

def font(sz):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()

def main():
    a = sys.argv[1:]; src, out = a[0], a[1]
    opt = lambda k, d=None: a[a.index('--' + k) + 1] if '--' + k in a else d
    tag, width = opt('tag', ''), int(opt('width', '1280'))
    sheets = [a[i + 1] for i, x in enumerate(a) if x == '--sheet']
    os.makedirs(out, exist_ok=True)
    pngs = sorted(f for f in os.listdir(src) if f.endswith('.png'))
    for f in pngs:
        im = Image.open(os.path.join(src, f)).convert('RGB')
        w = min(width, im.width) if im.width >= im.height else min(width // 2, im.width)
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im.save(os.path.join(out, f[:-4] + '.jpg'), quality=82, optimize=True)
    for s in sheets:
        name, pats = s.split(':', 1); pats = pats.split(',')
        files = [f for p in pats for f in pngs if p in f]
        files = list(dict.fromkeys(files))
        if not files: continue
        tiles = []
        for f in files:
            im = Image.open(os.path.join(src, f)).convert('RGB')
            th = 360; tw = round(im.width * th / im.height); im = im.resize((tw, th), Image.LANCZOS)
            tiles.append((f[:-4], im))
        cols = 3 if max(t[1].width for t in tiles) > 400 else 5
        cw = max(t[1].width for t in tiles); ch = 360 + 30
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * (cw + 12) + 12, rows * (ch + 12) + 12), (14, 12, 8))
        d = ImageDraw.Draw(sheet); fnt = font(16)
        for i, (lab, im) in enumerate(tiles):
            x = 12 + (i % cols) * (cw + 12); y = 12 + (i // cols) * (ch + 12)
            sheet.paste(im, (x, y + 30)); d.text((x + 2, y + 6), lab, fill=(227, 199, 104), font=fnt)
        sheet.save(os.path.join(out, (tag + '_' if tag else '') + name + '.jpg'), quality=80, optimize=True)
        print('sheet', name, len(tiles))

if __name__ == '__main__':
    main()
