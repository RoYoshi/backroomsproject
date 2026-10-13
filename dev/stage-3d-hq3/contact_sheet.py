#!/usr/bin/env python3
"""Stage 3D HQ3 - two labelled contact sheets from the real screenshots in the evidence (development only; Pillow)

  python3 -I dev/stage-3d-hq3/contact_sheet.py

  evidence/h3-3/hq3_gibs_two_browsers.png  gib_browser.py's final run (H3-3, the final game code): Bob's screen at 0.05 s, 0.15 s and settled,
                                           Carol's (a late joiner's) screen; full frames, and the pieces enlarged 2.5x (nearest-neighbour)
  evidence/h3-3/hq3_admin_toggle.png       admin_browser.py (H3-2): Alice's DEATHS tab OFF -> ON (after the server's answer) -> OFF, the refusal
                                           on her NEW RUN button after OFF, and Bob's panel (the passcode prompt only)
Nothing is redrawn: each tile is a crop of one screenshot, scaled."""
import os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); EV = os.path.join(HERE, 'evidence')
F = lambda s, b=False: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if b else ''), s)
BG, FG, DIM = (14, 14, 12), (236, 228, 200), (170, 160, 130)


def sheet(tiles, cols, title, note, out, pad=14):
    cw = max(t[0].width for t in tiles); rows = (len(tiles) + cols - 1) // cols
    rh = [max(t[0].height for t in tiles[r * cols:(r + 1) * cols]) for r in range(rows)]; top = [50 + sum(h + 30 + pad for h in rh[:r]) for r in range(rows)]
    W = cols * cw + (cols + 1) * pad; H = 58 + sum(h + 30 + pad for h in rh) + 34
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    d.text((pad, 12), title, font=F(20, True), fill=FG)
    for i, (t, label) in enumerate(tiles):
        x = pad + (i % cols) * (cw + pad); y = top[i // cols]
        d.text((x, y), label, font=F(14), fill=DIM); im.paste(t, (x, y + 22))
    d.text((pad, H - 26), note, font=F(13), fill=DIM)
    im.save(out, optimize=True); print(out, im.size)


g = os.path.join(EV, 'h3-3', 'shots', 'gib_final')
frames = [('blast_0.05s_bob.png', "Bob's screen, 0.05 s after the pop"), ('blast_0.15s_bob.png', "Bob's screen, 0.15 s"),
          ('settled_bob.png', "Bob's screen, settled"), ('late_joiner_carol.png', "Carol's screen (joined later)")]
box = (165, 80, 335, 250)                                                      # the pieces and the blood, at the blast spot
tiles = []
for f, label in frames:
    im = Image.open(os.path.join(g, f)).convert('RGB')
    tiles.append((im.resize((im.width * 2 // 3, im.height * 2 // 3), Image.LANCZOS), label))
for f, label in frames:
    im = Image.open(os.path.join(g, f)).convert('RGB'); off = (-22, 0) if 'carol' in f else (0, 0)   # (Carol's camera sits 22 px to the side)
    c = im.crop((box[0] + off[0], box[1] + off[1], box[2] + off[0], box[3] + off[1]))
    tiles.append((c.resize((c.width * 5 // 2, c.height * 5 // 2), Image.NEAREST), label + ' - enlarged 2.5x'))
sheet(tiles, 4, 'Stage 3D HQ3 - NEW RUN gibs: one server blast, the same pieces on two screens and for a late joiner',
      'Real screenshots (gib_browser.py, H3-3 run on the final game code; SwiftShader). Bob\'s Death Lab clock was paused and stepped for the first two frames.',
      os.path.join(EV, 'h3-3', 'hq3_gibs_two_browsers.png'))

a = os.path.join(EV, 'h3-2', 'shots')
panel = (38, 120, 402, 290)
tiles = []
for f, label in (('1_toggle_off_alice.png', 'Alice unlocks admin: OFF (as the server says)'), ('2_toggle_on_alice.png', 'Clicked: ON once the server answered'),
                 ('5_toggle_off_again_alice.png', 'Clicked again: OFF (the server answered)')):
    im = Image.open(os.path.join(a, f)).convert('RGB'); c = im.crop(panel); tiles.append((c.resize((c.width * 3 // 2, c.height * 3 // 2), Image.LANCZOS), label))
im = Image.open(os.path.join(a, '3_newrun2_menu_alice.png')).convert('RGB'); c = im.crop((250, 124, 710, 340))
tiles.append((c.resize((546, 256), Image.LANCZOS), 'ON: her second NEW RUN seconds later, approved'))
im = Image.open(os.path.join(a, '6_refused_wait_alice.png')).convert('RGB'); c = im.crop((60, 225, 430, 410))
tiles.append((c.resize((546, 273), Image.LANCZOS), 'After OFF: the next NEW RUN is refused (the wait)'))
im = Image.open(os.path.join(a, '4_bob_panel_bob.png')).convert('RGB'); c = im.crop((38, 120, 402, 258))
tiles.append((c.resize((546, 207), Image.LANCZOS), 'Bob (not an admin): only the passcode prompt'))
sheet(tiles, 3, 'Stage 3D HQ3 - UNLIMITED NEW RUN: admin-only, for her own NEW RUN, shown as the server states it',
      'Real screenshots (admin_browser.py, H3-2; SwiftShader). Two NEW RUNs a few seconds apart were both approved while ON; after OFF the 30 s wait was back.',
      os.path.join(EV, 'h3-3', 'hq3_admin_toggle.png'))
