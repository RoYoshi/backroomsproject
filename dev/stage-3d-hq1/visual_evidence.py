#!/usr/bin/env python3
"""Stage 3D HQ1 - the focused visual evidence for STAGE_3D_HQ1_VISUAL_EVIDENCE.md, composed from the real captures (development only).

  python3 -I dev/stage-3d-hq1/visual_evidence.py [--out DIR] [--faces DIR] [--timeline DIR]      (in the repository; defaults: evidence/visual,
                                                                                                   evidence/hq1-3/hq1/faces and .../timeline)

Every picture here is a crop, a scale or a side-by-side of screenshots the capture tools took of the real game (SwiftShader, three
browser pages, the real server); nothing is drawn on the game's pixels except the labels in the black bars and the outline of the
band box (the part of the struck face the stain metric counts).  Sources:
  wall, south face, D7 against HQ1: evidence/hq1-0/red/red_houndC_S_* (D7, the RED capture) and evidence/hq1-3/hq1/faces/houndC_S_*
    (HQ1, captured by the final regression on the final commit)
  the four faces, corner, pillar, behind the wall, remaster off, MEDIUM / HIGH: evidence/hq1-1/faces, special, tiers (HQ1-1's runs)
  the light: evidence/hq1-3/hq1/timeline/houndA_flashlight* (final commit) and evidence/hq1-2/d7_baseline (D7)
The light chart's line is dphys.lightPower itself, evaluated in Node at 1 ms steps for the run's own profile; its dots are what each page
measured at the frozen light clock (the power handed to the renderers, BR-RoLE's probe, the screen's brightness)."""
import argparse, json, os, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ap = argparse.ArgumentParser(); ap.add_argument('--out', default='dev/stage-3d-hq1/evidence/visual')
ap.add_argument('--faces', default='dev/stage-3d-hq1/evidence/hq1-3/hq1/faces'); ap.add_argument('--timeline', default='dev/stage-3d-hq1/evidence/hq1-3/hq1/timeline'); A = ap.parse_args()
EV = Path('dev/stage-3d-hq1/evidence'); OUT = Path(A.out); OUT.mkdir(parents=True, exist_ok=True)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f = lambda n: ImageFont.truetype(FONT, n)
F13, F15, F18 = f(13), f(15), f(18)
BG, FG, DIM, ACC = (18, 17, 16), (236, 232, 222), (160, 154, 142), (120, 210, 230)
made = []

def label(g, x, y, s, font=F13, fill=FG): g.text((x, y), s, font=font, fill=fill)
def tile(p, size):
    im = Image.open(p).convert('RGB'); sc = min(size[0] / im.width, size[1] / im.height); im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
    can = Image.new('RGB', size, BG); can.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2)); return can
def save(im, name, q=90):
    p = OUT / name; im.save(p, quality=q) if name.endswith('.jpg') else im.save(p); made.append(str(p)); return p

def grid(title, sub, cols, rows, cell, header_h=58, col_h=24, row_w=150):
    """cols: column labels; rows: (row label, [path or None per column]); cell: (w, h)."""
    W = row_w + cell[0] * len(cols); H = header_h + col_h + cell[1] * len(rows)
    im = Image.new('RGB', (W, H), BG); g = ImageDraw.Draw(im)
    label(g, 12, 8, title, F18); label(g, 12, 33, sub, F13, DIM)
    for c, t in enumerate(cols): label(g, row_w + c * cell[0] + 8, header_h + 4, t, F13)
    for r, (rl, ps) in enumerate(rows):
        y = header_h + col_h + r * cell[1]
        for i, line in enumerate(rl.split('\n')): label(g, 10, y + 8 + i * 17, line, F13, FG if i == 0 else DIM)
        for c, p in enumerate(ps):
            x = row_w + c * cell[0]
            if p and Path(p).exists(): im.paste(tile(p, (cell[0] - 4, cell[1] - 4)), (x + 2, y + 2))
            else: g.rectangle((x + 2, y + 2, x + cell[0] - 2, y + cell[1] - 2), outline=(70, 66, 60)); label(g, x + 10, y + cell[1] // 2 - 8, 'not captured' if p else '', F13, DIM)
    return im

def commit_of(j, d7=False):
    try: c = json.loads(Path(j).read_text()).get('commit', '?')
    except Exception: c = '?'
    return 'ffe2b53, its export' if d7 and not all(ch in '0123456789abcdef' for ch in c[:7]) else c[:7]

# ---- 1  south face, Hound C, lit corridor: D7 (RED) against HQ1 (final commit), victim / spectator / late joiner
R0, R1, R3 = EV / 'hq1-0/red', EV / 'hq1-1', Path(A.faces)
shots = [('impact_victim', 'victim\nimpact + 0.6 s'), ('impact_spectator', 'spectator\nimpact + 0.6 s'), ('corpse_victim', 'victim\nthe corpse (revived,\na step back)'),
         ('corpse_spectator', 'spectator\nthe corpse'), ('late_joiner', 'late joiner\nentered 30 s+ later')]
c3 = commit_of(R3 / 'houndC_S.json'); c0 = commit_of(R0 / 'red_houndC_S.json', True)
save(grid('Blood on the wallpaper: Hound C into the south wall of a lit corridor',
          f'Left two columns: D7 ({c0}, the RED capture). Right two: HQ1 ({c3}). The cyan box is the band of the struck face the stain metric counts.',
          ['D7: the screen around the impact', 'D7: zoom', 'HQ1: the screen around the impact', 'HQ1: zoom'],
          [(rl, [R1 / 'red_band' / f'red_houndC_S_{s}_band.png', R0 / f'red_houndC_S_{s}_zoom.png', R3 / f'houndC_S_{s}_band.png', R3 / f'houndC_S_{s}_zoom.png']) for s, rl in shots],
          (300, 214)), '01_wall_south_D7_vs_HQ1.jpg')
# full screens, spectator, the corpse: where the stain sits on a whole screen
im = Image.new('RGB', (1940, 700), BG); g = ImageDraw.Draw(im)
label(g, 12, 8, 'The whole spectator screen, the corpse lying at the south wall', F18)
label(g, 12, 33, f'Left: D7 ({c0}). Right: HQ1 ({c3}). Same spot, same camera; the stain is above the corpse, on the paper face below the wall top.', F13, DIM)
for i, p in enumerate((R0 / 'red_houndC_S_corpse_spectator.png', R3 / 'houndC_S_corpse_spectator.png')):
    if p.exists(): im.paste(tile(p, (960, 640)), (6 + i * 974, 58))
save(im, '02_wall_south_whole_screen_D7_vs_HQ1.jpg')

# ---- 2  all four faces (HQ1-1), the zooms
faces = [('S', 'south face'), ('N', 'north face'), ('E', 'east face'), ('W', 'west face')]
fp = lambda side, s: (R3 if side == 'S' else R1 / 'faces') / f'houndC_{side}_{s}_zoom.png'
save(grid('The four wall orientations: the face is chosen from the contact normal',
          f'Hound C at a south, north, east and west wall; the south row from the final commit ({c3}), the others from HQ1-1. Zooms around the contact.',
          ['victim, impact', 'spectator, impact', 'spectator, the corpse', 'late joiner'],
          [(f'{side}: {nm}', [fp(side, 'impact_victim'), fp(side, 'impact_spectator'), fp(side, 'corpse_spectator'), fp(side, 'late_joiner')]) for side, nm in faces],
          (300, 214)), '03_wall_four_faces.jpg')

# ---- 3  corner, pillar, behind the wall, remaster off, quality tiers
SP_, TI = R1 / 'special', R1 / 'tiers'
rows = [('corner\n17 px from an inner\ncorner: the struck\nface, clipped at\nthe run\'s end', [SP_ / f'corner_{s}_zoom.png' for s in ('impact_victim', 'corpse_spectator', 'late_joiner')]),
        ('pillar\nno papered face:\nnoface, no stain', [SP_ / f'pillar_{s}_zoom.png' for s in ('impact_victim', 'corpse_spectator', 'late_joiner')]),
        ('behind the wall\nthe face is hidden\nfrom the far side:\nnothing shows there', [SP_ / f'behind_S_{s}_zoom.png' for s in ('impact_victim', 'corpse_spectator', 'late_joiner')]),
        ('remaster off\n(?remaster=off): no\nstamp, nothing in\nits place', [SP_ / f'remaster_off_S_{s}_zoom.png' for s in ('impact_victim', 'corpse_spectator', 'late_joiner')]),
        ('MEDIUM lighting', [TI / f'houndC_S_medium_{s}_zoom.png' for s in ('impact_victim', 'corpse_spectator', 'late_joiner')]),
        ('HIGH lighting', [TI / f'houndC_S_high_{s}_zoom.png' for s in ('impact_victim', 'corpse_spectator', 'late_joiner')])]
save(grid('Where a stain must not appear, or must be clipped; and the quality tiers',
          'HQ1-1 captures. "behind the wall": the spectator stands on the far side of the struck wall; the victim, in front of it, sees the stain.',
          ['victim, impact', 'spectator (or far side), the corpse', 'late joiner'], rows, (300, 214), row_w=170), '04_wall_corner_pillar_behind_off_tiers.jpg')

# ---- 4  the light: the failure in 0.1 s steps, timecoded, with the power curve
T3 = Path(A.timeline); TJ = T3 / 'houndA_flashlight.json'
if TJ.exists():
    R = json.loads(TJ.read_text()); lf = R['lf']; st = R.get('strip') or []; end = lf[0] + lf[1]
    curve = json.loads(subprocess.run(['node', '-e', f"global.window={{}};require(process.cwd()+'/dphys.js');const D=window.__dphys;const lf={json.dumps(lf)};const o=[];for(let i=0;i<=Math.round(({lf[1]}+1.2)*1000);i++){{const k=i/1000+{lf[0] - .6};o.push([+k.toFixed(3),D.lightPower(lf,k)])}}console.log(JSON.stringify(o))"],
                                      check=True, capture_output=True, text=True).stdout)
    cols = 8; cw, ch = 220, 147; rows_n = (len(st) + cols - 1) // cols; chart_h = 300
    W = cols * cw + 20; H = 70 + rows_n * (ch + 22) + chart_h + 60
    im = Image.new('RGB', (W, H), BG); g = ImageDraw.Draw(im)
    label(g, 12, 8, f"A dead flashlight failing: hold {lf[0]} s from its release, then {lf[1]} s of flicker and dimming, then off for good", F18)
    label(g, 12, 33, f"Hound A, the spectator's screen, the light clock frozen at release + k s on the page ({R['commit'][:7]}); each frame's label: k, and the power the page hands its renderers.", F13, DIM)
    for i, s in enumerate(st):
        x = 10 + (i % cols) * cw; y = 62 + (i // cols) * (ch + 22)
        p = T3 / s['file']; pw = max([d['pw'] for d in s['dead']]) if s['dead'] else 0.0
        if p.exists():
            fr = Image.open(p).convert('RGB'); cam = s.get('cam'); pt = (s.get('lens') or [0, 0])[:2]
            if cam: sc, cx, cy = cam; fx, fy = 480 + (pt[0] - cx) * sc, 320 + (pt[1] - cy) * sc; fr = fr.crop((int(fx - 165), int(fy - 110), int(fx + 165), int(fy + 110)))
            im.paste(fr.resize((cw - 6, ch - 6), Image.LANCZOS), (x, y))
        tag = 'hold' if s['k'] < lf[0] else ('OFF' if s['k'] >= end else 'failing')
        label(g, x, y + ch - 4, f"+{s['k']:.1f} s  power {pw:.2f}  {tag}", F13, FG if pw > 0 else DIM)
    # chart
    x0, y0, cwid = 70, 70 + rows_n * (ch + 22) + 20, W - 110; kmin, kmax = curve[0][0], curve[-1][0]
    X = lambda k: x0 + (k - kmin) / (kmax - kmin) * cwid; Y = lambda v: y0 + chart_h - 30 - v * (chart_h - 50)
    g.rectangle((x0, Y(1.05), x0 + cwid, Y(0)), outline=(70, 66, 60))
    for v in (0, .25, .5, .75, 1): g.line((x0 - 4, Y(v), x0, Y(v)), fill=DIM); label(g, x0 - 40, Y(v) - 8, f'{v:.2f}', F13, DIM)
    k = int(kmin * 2) / 2
    while k <= kmax:
        if k >= kmin: g.line((X(k), Y(0), X(k), Y(0) + 5), fill=DIM); label(g, X(k) - 14, Y(0) + 8, f'{k:.1f} s', F13, DIM)
        k += .5
    for kk, txt in ((lf[0], 'hold ends'), (end, 'off for good')): g.line((X(kk), Y(1.05), X(kk), Y(0)), fill=(110, 100, 90)); label(g, X(kk) + 4, Y(1.05) + 2, txt, F13, DIM)
    g.line([(X(k_), Y(v)) for k_, v in curve], fill=(240, 200, 120), width=2)
    lmax = max([s.get('lum') or 0 for s in st] or [1]) or 1
    for s in st:
        pw = max([d['pw'] for d in s['dead']]) if s['dead'] else 0.0
        g.ellipse((X(s['k']) - 4, Y(pw) - 4, X(s['k']) + 4, Y(pw) + 4), outline=ACC, width=2)
        br = (s.get('br') or {}).get('total')
        if br is not None and R['renderer'] != 'legacy': b1 = br / max(1e-9, max((x.get('br') or {}).get('total') or 0 for x in st)); g.rectangle((X(s['k']) - 3, Y(b1) - 3, X(s['k']) + 3, Y(b1) + 3), outline=(200, 120, 220))
        lu = (s.get('lum') or 0) / lmax; g.line((X(s['k']) - 4, Y(lu), X(s['k']) + 4, Y(lu)), fill=(140, 230, 140), width=2)
    label(g, x0, y0 + chart_h - 6, 'line: dphys.lightPower, 1 ms steps   circles: power each frame handed the renderers   squares: BR-RoLE probe (scaled to its brightest)   green ticks: screen brightness at the light (scaled)', F13, DIM)
    save(im, '05_light_failure_timecoded.jpg')
    # ---- 5  the same frames as a 10 fps clip (0.1 s of light clock per frame: real speed), timecode burned into the bar below
    frames = []
    for s in st:
        p = T3 / s['file']
        if not p.exists(): continue
        fr = Image.open(p).convert('RGB'); cam = s.get('cam'); pt = (s.get('lens') or [0, 0])[:2]
        if cam: sc, cx, cy = cam; fx, fy = 480 + (pt[0] - cx) * sc, 320 + (pt[1] - cy) * sc; fr = fr.crop((int(fx - 240), int(fy - 160), int(fx + 240), int(fy + 160)))
        fr = fr.resize((480, 320), Image.LANCZOS); can = Image.new('RGB', (480, 356), BG); can.paste(fr, (0, 0)); gg = ImageDraw.Draw(can)
        pw = max([d['pw'] for d in s['dead']]) if s['dead'] else 0.0
        gg.text((8, 330), f"release + {s['k']:.1f} s   power {pw:.2f}   {'hold' if s['k'] < lf[0] else ('OFF' if s['k'] >= end else 'failing')}", font=F15, fill=FG)
        gg.rectangle((300, 334, 300 + int(170 * pw), 346), fill=(240, 200, 120)); gg.rectangle((300, 334, 470, 346), outline=DIM)
        frames.append(can)
    if frames:
        gif = OUT / '06_light_failure_10fps.gif'
        frames[0].save(gif, save_all=True, append_images=frames[1:] + [frames[-1]] * 10, duration=100, loop=0); made.append(str(gif))
        tmp = OUT / '_frames'; tmp.mkdir(exist_ok=True)
        for i, fr in enumerate(frames): fr.save(tmp / f'f{i:03d}.png')
        mp4 = OUT / '06_light_failure_10fps.mp4'
        r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '10', '-i', str(tmp / 'f%03d.png'), '-vf', 'tpad=stop_mode=clone:stop_duration=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(mp4)], capture_output=True, text=True)
        if r.returncode == 0: made.append(str(mp4))
        else: print('ffmpeg:', r.stderr[:300])
        for p in tmp.iterdir(): p.unlink()
        tmp.rmdir()
    # ---- 6  real time, no test clock: HQ1 against D7
    D7 = EV / 'hq1-2/d7_baseline'
    im = Image.new('RGB', (1466, 1040), BG); g = ImageDraw.Draw(im)
    label(g, 12, 8, 'Real time, no test clock: the dead flashlight on the corpse, 30 s and more after the death', F18)
    label(g, 12, 33, f"Left: D7 ({commit_of(D7 / 'd7_houndA_flashlight.json', True)}), the light still on. Right: HQ1 ({R['commit'][:7]}), off for good. Top: the spectator; bottom: the late joiner.", F13, DIM)
    for c, (base, tag) in enumerate(((D7, 'd7_houndA_flashlight'), (T3, 'houndA_flashlight'))):
        for r, who in enumerate(('spectator', 'late')):
            p = base / f'{tag}_rt_corpse_{who}.png'
            if p.exists(): im.paste(tile(p, (720, 480)), (6 + c * 734, 58 + r * 490))
    save(im, '07_light_realtime_corpse_D7_vs_HQ1.jpg')
print('\n'.join(made))
