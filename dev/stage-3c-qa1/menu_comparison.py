#!/usr/bin/env python3
"""Stage 3C QA1 - the menu comparison sheet: ROUGH DRAFT -> FIRST CANDIDATE -> QA1 (development only).

  python3 dev/stage-3c-qa1/menu_comparison.py QA1_DESKTOP.jpg QA1_PHONE.jpg QA1_PHONE_LANDSCAPE.jpg OUT.jpg [--label TEXT]

Top row, 1920x1080 scaled to the same size: the user's rough draft (dev/stage-3c-qa1/reference/MAIN_MENU_ROUGH_DRAFT.png), the
first Stage 3C candidate's menu (dev/stage-3c/evidence/c5/c5_resp_1920x1080_menu.jpg, captured at 76bcc4a), and QA1's menu.
Bottom row: the first candidate on a 390x844 phone, QA1 on the same phone, and QA1 on a phone on its side (844x390)."""
import sys, os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
DRAFT = os.path.join(HERE, 'reference', 'MAIN_MENU_ROUGH_DRAFT.png')
FIRST = os.path.join(ROOT, 'dev', 'stage-3c', 'evidence', 'c5', 'c5_resp_1920x1080_menu.jpg')
FIRST_PHONE = os.path.join(ROOT, 'dev', 'stage-3c', 'evidence', 'c5', 'c5_resp_390x844_menu.jpg')
def font(sz, bold=True):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',):
        if os.path.exists(f): return ImageFont.truetype(f, sz)
    return ImageFont.load_default()
def fit(im, w, h):
    im = im.convert('RGB'); r = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * r)), max(1, round(im.height * r))), Image.LANCZOS)
def main():
    a = sys.argv[1:]; label = ''
    if '--label' in a: i = a.index('--label'); label = a[i + 1]; del a[i:i + 2]
    qa1, qa1p, qa1l, out = a[:4]
    PW, PH, G, CAP, TOP = 960, 540, 24, 46, 70
    W = 3 * PW + 4 * G; ROW2 = 620
    H = TOP + CAP + PH + G + CAP + ROW2 + G
    sheet = Image.new('RGB', (W, H), (20, 18, 14)); d = ImageDraw.Draw(sheet)
    d.text((G, 18), 'THE FAR BACKROOMS - main menu: ROUGH DRAFT  ->  FIRST CANDIDATE  ->  QA1' + (('   ' + label) if label else ''), font=font(30), fill=(236, 228, 198))
    cols = [('ROUGH DRAFT (the user\'s, 1920x1080)', DRAFT), ('FIRST CANDIDATE (76bcc4a, 1920x1080)', FIRST), ('QA1 (1920x1080)', qa1)]
    for k, (cap, f) in enumerate(cols):
        x = G + k * (PW + G); y = TOP
        d.text((x, y + 8), cap, font=font(24), fill=(227, 199, 104) if k == 2 else (190, 182, 150))
        im = fit(Image.open(f), PW, PH); sheet.paste(im, (x + (PW - im.width) // 2, y + CAP))
        d.rectangle([x - 1, y + CAP - 1, x + PW, y + CAP + PH], outline=(90, 82, 54))
        if k < 2: d.text((x + PW + 2, y + CAP + PH // 2 - 18), '>', font=font(30), fill=(227, 199, 104))
    y2 = TOP + CAP + PH + G
    cols2 = [('FIRST CANDIDATE (390x844 phone)', FIRST_PHONE, 300), ('QA1 (390x844 phone)', qa1p, 300), ('QA1 (844x390 phone on its side)', qa1l, 1160)]
    x = G
    for cap, f, w in cols2:
        d.text((x, y2 + 8), cap, font=font(22), fill=(227, 199, 104) if cap.startswith('QA1') else (190, 182, 150))
        im = fit(Image.open(f), w, ROW2 - 6); sheet.paste(im, (x, y2 + CAP))
        d.rectangle([x - 1, y2 + CAP - 1, x + im.width, y2 + CAP + im.height], outline=(90, 82, 54))
        x += max(w, im.width, round(d.textlength(cap, font=font(22)))) + 3 * G
    sheet.save(out, quality=88)
    print(out, sheet.size)
if __name__ == '__main__': main()
