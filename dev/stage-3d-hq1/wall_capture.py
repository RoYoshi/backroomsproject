#!/usr/bin/env python3
"""Stage 3D HQ1 - a wall death, as the players see it: is the blood ON the wallpaper?  (development only; SwiftShader)

  python3 -I dev/stage-3d-hq1/wall_capture.py --game DIR --out DIR [--side S] [--variant hound-C] [--late 30] [--skip 0] [--tag NAME]

Alice (admin, the victim) stands in front of a papered wall face of the given side (S, N, E or W; hq1lib.FACE_SPOT: lit by a
ceiling lamp, the wall 90 px behind her, room for the hound in front), facing away from it; Bob (god mode) watches from in front
of the face, off to one side (hq1lib.VIEW_SPOT).  Lights on (no blackout).  The death plays through the Death Lab at normal speed
(Hound C: driven into the wall).  Pictures of both screens:
  impact   0.6 s after the strongest wall contact of the death (the physics' own marks, dphys.marks)
  corpse   1.5 s after the death ends (the corpse in place)
  late     Carol joins LATE seconds after the death and stands where Bob stands
For each: the whole screen, and a x3 crop around the wall contact (marked with a thin cyan frame, outside the stain).  JSON:
the death id, the contact (position, normal), the face it resolves to, what the receiver holds (window.__l0v.surfaces), the
corpse records, where the camera was.  The server runs with a synthetic admin passcode."""
import os, sys, asyncio, argparse, time, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hq1lib as L
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=L.REPO); ap.add_argument('--out', required=True); ap.add_argument('--side', default='S')
ap.add_argument('--variant', default='hound-C'); ap.add_argument('--late', type=float, default=30); ap.add_argument('--skip', type=int, default=0); ap.add_argument('--tag', default='')
ap.add_argument('--query', default='', help="extra URL query for every page, e.g. lighting=high or remaster=off")
ap.add_argument('--spot', default='face', help='face (a papered face of --side), corner (an inner corner), pillar (a 56 px pillar)')
ap.add_argument('--viewer', default='front', help='front (in front of the face, off to one side) or behind (the far side of that wall)')
ap.add_argument('--at', default='', help='a fixed spot instead of a search: x,y,a,wx,wy,ox,oy (for a run with the remaster off, which has no face list)')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game); os.makedirs(A_.out, exist_ok=True)
W, H = 960, 640
KIND, VAR = A_.variant.split('-')
TAG = A_.tag or f'{A_.variant}_{A_.side}'
HOOK = """()=>{ if(!window.__camWrapped){ const o=window.__mp; window.__mp=a=>{ window.__cam0=a; return o&&o(a) }; window.__camWrapped=1 } }"""
CAM = "()=>window.__cam0?[window.__cam0.sc, window.__cam0.cam.x, window.__cam0.cam.y]:null"
MARKS = "()=>{ const d=__api.death(); const S=d&&d.ph; return S&&window.__dphys&&window.__dphys.marks ? window.__dphys.marks(S).map(m=>({t:+m.t.toFixed(3), x:+m.x.toFixed(1), y:+m.y.toFixed(1), nx:+m.nx.toFixed(3), ny:+m.ny.toFixed(3), sp:Math.round(m.sp)})) : [] }"
RECV = "()=>{ const L=window.__l0v; if(!L||!L.surfaces) return null; const G=window.__gore&&window.__gore.wallStains; return { on:L.on(), count:L.surfaces.count(), caps:L.surfaces.caps(), stains: G ? G.list() : null, stats: G&&G.stats ? G.stats() : null, bake: L.stats().bake, tier: L.stats().tier } }"
NOHUD = "()=>{ for (const id of ['caught','adminPanel']) { const e=document.getElementById(id); if(e) e.hidden=true } }"


def git_head(game):
    try: return subprocess.run(['git', '-C', game, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip() or 'export'
    except Exception: return 'export'


async def shot(P, name, cam_xy, R):
    await P.evaluate(NOHUD)
    fn = os.path.join(A_.out, f'{TAG}_{name}.png'); await P.screenshot(path=fn)
    cam = await P.evaluate(CAM); R['shots'][name] = {'file': os.path.basename(fn), 'cam': cam}
    if cam and cam_xy:
        sx, sy = W / 2 + (cam_xy[0] - cam[1]) * cam[0], H / 2 + (cam_xy[1] - cam[2]) * cam[0]
        R['shots'][name]['contactOnScreen'] = [round(sx), round(sy)]
        im = Image.open(fn).convert('RGB'); c = im.crop((int(sx - 70), int(sy - 50), int(sx + 70), int(sy + 50))).resize((420, 300), Image.LANCZOS)
        g = ImageDraw.Draw(c); g.rectangle((150, 105, 270, 195), outline=(0, 220, 255), width=1)   # the contact point's neighbourhood (frame only)
        c.save(fn.replace('.png', '_zoom.png'))


async def main():
    port = L.free_port(); srv = L.start_server(A_.game, port, os.path.join(A_.out, f'{TAG}_server.log')); errs = []
    R = {'tool': 'dev/stage-3d-hq1/wall_capture.py', 'game': A_.game, 'commit': git_head(A_.game), 'side': A_.side, 'variant': A_.variant, 'shots': {},
         'renderer': 'SwiftShader (Chromium software GL), 960x640', 'when': time.strftime('%Y-%m-%dT%H:%M:%S%z')}
    S = None
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS)
            ca, cb, cc = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(3)]
            Q = ('&' + A_.query) if A_.query else ''
            A = await L.join(ca, port, 'hq1wall', 'Alice', errs, Q); await L.admin_open(A)
            B = await L.join(cb, port, 'hq1wall', 'Bob', errs, Q)
            C = await L.prejoin(cc, port, 'hq1wall', 'Carol', errs, Q)                      # waits at the name prompt (the late joiner)
            bid = await B.evaluate("()=>__api.H.id"); await L.admin_cmd(A, {'c': 'god', 'id': bid}); await A.wait_for_timeout(300)
            await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(1500)   # (a monster may have got her while they were being removed)
            await L.ensure_alive(A)
            for P in (A, B): await P.evaluate(HOOK)
            for _ in range(80):
                if await A.evaluate("()=>window.__l0v&&window.__l0v.ready()"): break
                await A.wait_for_timeout(250)
            R['remaster'] = await A.evaluate("()=>window.__l0v?{on:window.__l0v.on(), tier:window.__l0v.stats().tier, disabled:window.__l0v.stats().disabled}:null")
            R['lighting'] = await A.evaluate("()=>window.__brRole?{on:window.__brRole.on(), quality:window.__brRole.quality()}:null")
            S = None
            if A_.at:
                x, y, a, wx, wy, ox, oy = [float(v) for v in A_.at.split(',')]; S = {'face': 'fixed', 'side': A_.side, 'x': x, 'y': y, 'a': a, 'wx': wx, 'wy': wy, 'ox': ox, 'oy': oy, 'lamp': None}
            else: S = await A.evaluate(L.FACE_SPOT if A_.spot == 'face' else L.CORNER_SPOT if A_.spot == 'corner' else L.PILLAR_SPOT, [A_.side, 90, A_.skip] if A_.spot == 'face' else [64 if A_.spot == 'corner' else 80, A_.skip]); R['spot'] = S
            if not S: raise SystemExit('no spot: ' + A_.spot + ' ' + A_.side)
            if A_.spot != 'face': R['side'] = S['side']
            V = await B.evaluate(L.VIEW_SPOT if A_.viewer == 'front' else L.BEHIND_SPOT, S); R['viewer'] = V; R['viewerKind'] = A_.viewer
            await L.place(A, S['x'], S['y'], S['a'], W, H)
            if V: await L.place(B, V[0], V[1], V[2], W, H)
            await A.wait_for_timeout(4000)
            await shot(A, 'before_victim', [S['wx'], S['wy']], R); await shot(B, 'before_spectator', [S['wx'], S['wy']], R)
            for P in (A, B): await L.lab(P, True, True)                                  # Death Lab paused on both screens: pictures at a chosen moment
            ok = await L.preview(A, KIND, VAR); R['previewOk'] = ok; R['previewLog'] = lib_last(A_.out)
            if not ok:                                                                   # harness: the server committed it but the page never showed it (a monster
                R['previewRetry'] = {'firstLog': R['previewLog']}                         # got her during set-up); stand her up, clear again and try once more
                aid = await A.evaluate("()=>__api.H.id"); await L.admin_cmd(A, {'c': 'revive', 'id': aid}); await A.wait_for_timeout(3000)
                await L.clear_monsters(A); await L.ensure_alive(A); await A.wait_for_timeout(4500)
                for P in (A, B): await L.lab(P, False, False)
                await L.place(A, S['x'], S['y'], S['a'], W, H)
                if V: await L.place(B, V[0], V[1], V[2], W, H)
                await A.wait_for_timeout(2000)
                for P in (A, B): await L.lab(P, True, True)
                ok = await L.preview(A, KIND, VAR); R['previewOk'] = ok; R['previewLog'] = lib_last(A_.out)
            if not ok: raise SystemExit('preview refused: ' + R['previewLog'])
            T0 = time.time()
            for _ in range(80):
                if await B.evaluate(L.SPEC): break
                await B.wait_for_timeout(100)
            # step the death until the physics has hit a wall, then 0.6 s more (both screens to the same death time)
            marks, t = [], 0.0
            while t < 4.6:
                t = round(t + .3, 2); await L.step_to(A, L.DSTATE, t); marks = await A.evaluate(MARKS)
                if marks: break
            T = round((max(m['t'] for m in marks) if marks else t) + .6, 2)
            await L.step_to(A, L.DSTATE, T); await L.step_to(B, L.SPEC, T); await A.wait_for_timeout(600)
            marks = await A.evaluate(MARKS); R['marks'] = marks
            top = max(marks, key=lambda m: m['sp']) if marks else None
            cxy = [top['x'], top['y']] if top else [S['wx'], S['wy']]
            R['contact'] = cxy; R['deathAtImpact'] = await A.evaluate(L.DSTATE); R['specAtImpact'] = await B.evaluate(L.SPEC)
            await shot(A, 'impact_victim', cxy, R); await shot(B, 'impact_spectator', cxy, R)
            R['receiverAtImpact'] = {'victim': await A.evaluate(RECV), 'spectator': await B.evaluate(RECV)}
            for P in (A, B): await L.lab(P, False, False)                                # the rest at normal speed (the server never waited)
            # the death ends; the lab's AUTO-REVIVE stands the victim up 1.3 s later where she was (BACK TO THIS SPOT): she sees her corpse
            while time.time() - T0 < 20:
                if await A.evaluate("()=>!__api.G.caught && __api.fall()<0") and await B.evaluate(L.BODIES): break
                await A.wait_for_timeout(150)
            await A.wait_for_timeout(1500)
            await L.place(A, S['x'] + S['ox'] * 40, S['y'] + S['oy'] * 40, S['a'] + 3.14159, W, H); await A.wait_for_timeout(1500)   # a step back from the corpse, facing the wall
            await shot(A, 'corpse_victim', cxy, R); await shot(B, 'corpse_spectator', cxy, R)
            R['bodies'] = {'victim': await A.evaluate(L.BODIES), 'spectator': await B.evaluate(L.BODIES)}
            R['receiverAtCorpse'] = {'victim': await A.evaluate(RECV), 'spectator': await B.evaluate(RECV)}
            await L.clear_monsters(A); await L.admin_cmd(A, {'c': 'god', 'id': await A.evaluate("()=>__api.H.id")})   # harness: no real monster kills her again before the late joiner looks
            # the late joiner presses ENTER LATE seconds after the death started, then stands where Bob stands
            wait = A_.late - (time.time() - T0)
            if wait > 0: await A.wait_for_timeout(int(wait * 1000))
            R['lateJoinAt'] = round(time.time() - T0, 1)
            await L.enter(C); await C.evaluate(HOOK); await C.wait_for_timeout(1500)
            if V: R['lateJoinPlaced'] = await L.place(C, V[0], V[1], V[2], W, H)
            await C.wait_for_timeout(5000)
            await shot(C, 'late_joiner', cxy, R); await shot(B, 'late_spectator', cxy, R)
            R['lateJoiner'] = {'shotAt': round(time.time() - T0, 1), 'bodies': await C.evaluate(L.BODIES), 'receiver': await C.evaluate(RECV)}
            await b.close()
    finally:
        L.stop_server(srv)
    R['errors'] = errs[:20]
    L.dump(os.path.join(A_.out, f'{TAG}.json'), R)
    # a contact sheet: rows victim / spectator (/ late joiner), columns before / impact / corpse, the zoomed crops
    cols = [('before', 'Before'), ('impact', 'Impact + 0.6 s (Death Lab paused there)'), ('corpse', 'Corpse (victim revived, a step back)')]
    sheet = Image.new('RGB', (420 * 3, 300 * 3 + 60), (16, 16, 16)); g = ImageDraw.Draw(sheet)
    g.text((8, 8), f"{TAG}  {R['commit'][:7]}  face {S['face'] if S else '-'}  contact {R.get('contact')}", fill=(230, 230, 230))
    for r, who in enumerate(('victim', 'spectator')):
        for c, (k, lab) in enumerate(cols):
            fn = os.path.join(A_.out, f'{TAG}_{k}_{who}_zoom.png')
            if os.path.exists(fn): sheet.paste(Image.open(fn), (c * 420, 30 + r * 300))
            g.text((c * 420 + 6, 34 + r * 300), f'{who} / {lab}', fill=(255, 255, 255))
    fn = os.path.join(A_.out, f'{TAG}_late_joiner_zoom.png')
    if os.path.exists(fn): sheet.paste(Image.open(fn), (0, 30 + 600)); g.text((6, 34 + 600), f"late joiner (entered at +{R.get('lateJoinAt')} s)", fill=(255, 255, 255))
    sheet.save(os.path.join(A_.out, f'{TAG}_sheet.jpg'), quality=90)
    print(json.dumps({'tag': TAG, 'contact': R.get('contact'), 'marks': R.get('marks'), 'receiver': R.get('receiverAtCorpse'), 'late': R.get('lateJoinAt'), 'errors': R['errors'][:3]})[:1500])


def lib_last(out):
    return L.lib3d.last_preview(os.path.join(out, f'{TAG}_server.log'))


asyncio.run(main())
