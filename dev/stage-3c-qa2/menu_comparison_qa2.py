#!/usr/bin/env python3
"""Stage 3C QA2 - the menu comparison sheet: QA1 -> QA2 (development only).

  python3 -I dev/stage-3c-qa2/menu_comparison_qa2.py QA2_DESKTOP.jpg QA2_PHONE.jpg QA2_PHONE_LANDSCAPE.jpg OUT.jpg

Top row, 1920 x 1080: QA1's main menu (dev/stage-3c-qa1/evidence/q5/captures/q5_1920x1080_menu.jpg, captured at 5f30e28) and QA2's.
Bottom row: QA1 then QA2 on a 390 x 844 phone, and QA1 then QA2 on a phone on its side (844 x 390)."""
import os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
Q1 = os.path.join(ROOT, 'dev', 'stage-3c-qa1', 'evidence', 'q5', 'captures')
def font(sz):
    f = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    return ImageFont.truetype(f, sz) if os.path.exists(f) else ImageFont.load_default()
def fit(path, w, h):
    im = Image.open(path).convert('RGB'); r = min(w / im.width, h / im.height)
    return im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
d2, p2, l2, out = sys.argv[1:5]
top = [(os.path.join(Q1, 'q5_1920x1080_menu.jpg'), 'QA1 (5f30e28) - 1920 x 1080'), (d2, 'QA2 - 1920 x 1080')]
bottom = [(os.path.join(Q1, 'q5_390x844m_menu.jpg'), 'QA1 - 390 x 844'), (p2, 'QA2 - 390 x 844'), (os.path.join(Q1, 'q5_844x390m_menu.jpg'), 'QA1 - 844 x 390'), (l2, 'QA2 - 844 x 390')]
W, PAD, LAB = 1600, 16, 30
tw = (W - 3 * PAD) // 2; th = round(tw * 1080 / 1920)
bh = 520; pw = round(bh * 390 / 844); lw = (W - 5 * PAD - 2 * pw) // 2; lh = round(lw * 390 / 844)
H = PAD + LAB + th + PAD + LAB + bh + PAD + 36
sheet = Image.new('RGB', (W, H), (24, 22, 18)); d = ImageDraw.Draw(sheet)
d.text((PAD, H - 30), 'The Far Backrooms - main menu, Stage 3C QA1 -> QA2 (the supplied logo; a fully black field)', font=font(16), fill=(236, 228, 198))
x = PAD
for path, lab in top:
    d.text((x, PAD + 4), lab, font=font(18), fill=(236, 228, 198)); im = fit(path, tw, th); sheet.paste(im, (x, PAD + LAB)); x += tw + PAD
y = PAD + LAB + th + PAD; x = PAD
for (path, lab), (bw, bhh) in zip(bottom, [(pw, bh), (pw, bh), (lw, lh), (lw, lh)]):
    d.text((x, y + 4), lab, font=font(16), fill=(236, 228, 198)); im = fit(path, bw, bhh); sheet.paste(im, (x, y + LAB)); x += bw + PAD
sheet.save(out, quality=88)
print(out)
