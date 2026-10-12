#!/usr/bin/env python3
"""Stage 3D HQ1 - a dead wanderer's light over time, as the players see it (development only; SwiftShader)

  python3 -I dev/stage-3d-hq1/light_capture.py --game DIR --out DIR [--variant hound-A] [--kind flashlight] [--lo 1] [--blackout on]
                                                [--times 1,4,7,12,30] [--late 40] [--tag NAME]

Alice (admin, the victim; light KIND, on or off at death) dies in an open room through the Death Lab at normal speed; Bob (god mode)
watches from 150 px with his own light OFF; with --blackout on the ceiling lamps are out, so the dead light is the only light.
After the death the lab's AUTO-REVIVE stands Alice up where she was and her own light is switched OFF too (the dead light alone).
At release + each of TIMES seconds (release: the moment the death's physics lets go of the light, dphys S.eqAt; a headlamp: the
death's start), both screens are captured and measured:
  peers     what the page hands its lighting (window.__peerLights: position, kind, on, and pw when the build has one)
  own       the victim's own death light while her death plays (the game's death torch) and its power when the build has one
  buffer    the light BR-RoLE added at a point 40 px in front of the dead light's lens (brRole.dev.light: 0..1)
  carried   how many carried lights BR-RoLE drew that frame
Carol joins LATE seconds after the death and stands where Bob stands.  Writes OUT/TAG.json, the screenshots and TAG_sheet.jpg."""
import os, sys, asyncio, argparse, time, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hq1lib as L
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=L.REPO); ap.add_argument('--out', required=True); ap.add_argument('--variant', default='hound-A')
ap.add_argument('--kind', default='flashlight'); ap.add_argument('--lo', type=int, default=1); ap.add_argument('--blackout', default='on')
ap.add_argument('--times', default='1,4,7,12,30'); ap.add_argument('--late', type=float, default=40); ap.add_argument('--tag', default=''); ap.add_argument('--query', default='')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game); os.makedirs(A_.out, exist_ok=True)
W, H = 960, 640
KIND, VAR = A_.variant.split('-')
TAG = A_.tag or f'{A_.variant}_{A_.kind}_{"on" if A_.lo else "off"}'
TIMES = [float(x) for x in A_.times.split(',')]
HOOK = """()=>{ if(!window.__camWrapped){ const o=window.__mp; window.__mp=a=>{ window.__cam0=a; return o&&o(a) }; window.__camWrapped=1 } }"""
NOCARD = "()=>{ if(!document.getElementById('hq1nocard')){ const s=document.createElement('style'); s.id='hq1nocard'; s.textContent='#caught{display:none!important}'; document.head.appendChild(s) } }"
REL = """()=>{ const d=__api.death(), S=d&&d.ph; if(!S) return null; const hl=S.ctx&&S.ctx.eqKind==='headlamp'; return { t:+d.elapsed.toFixed(3), rel: hl ? 0 : (S.eqAt!=null ? +S.eqAt.toFixed(4) : null), kind:S.ctx&&S.ctx.eqKind } }"""
SPECREL = """()=>{ const f=(window.__fxs||[]).find(f=>f.jl&&!f.gone); if(!f) return null; const S=f.jl.ph; return { t:+f.jl.elapsed.toFixed(3), real:+(performance.now()/1000-f.t0).toFixed(3), rel: S&&S.ctx&&S.ctx.eqKind==='headlamp' ? 0 : (S&&S.eqAt!=null ? +S.eqAt.toFixed(4) : null), de:f.de, lf:f.lf||null } }"""
OWN = """()=>{ const d=__api.death(); return d&&d.active ? { torch:d.torch?[+d.torch.x.toFixed(1),+d.torch.y.toFixed(1),+(d.torch.angle||0).toFixed(3)]:null, on:!!__api.lightOn(), pw: window.__deathLight&&window.__deathLight.own ? window.__deathLight.own() : null } : null }"""
BUF = """(pts)=>{ const B=window.__brRole; return B&&B.dev&&B.dev.light ? B.dev.light(pts) : null }"""
CARRIED = "()=>{ const B=window.__brRole; if(!B) return null; const s=B.stats(); return { carried:s.carried.last, peers:s.carried.peers, on:s.on } }"


def git_head(game):
    try: return subprocess.run(['git', '-C', game, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip() or 'export'
    except Exception: return 'export'


async def measure(P, who, name, R, lens):
    await P.evaluate(NOCARD)
    t = round(time.time() - R['t0wall'], 3)
    peers = await P.evaluate(L.PEERS); own = await P.evaluate(OWN)
    pts = None
    src = lens or (own and own['torch'] and own['torch'])
    if src:
        import math
        x, y, a = src; pts = [[x + math.cos(a) * 40, y + math.sin(a) * 40], [x + math.cos(a) * 90, y + math.sin(a) * 90], [x, y]]
    buf = await P.evaluate(BUF, pts) if pts else None
    fn = os.path.join(A_.out, f'{TAG}_{name}_{who}.png'); await P.screenshot(path=fn); ts = round(time.time() - R['t0wall'], 3)
    return {'file': os.path.basename(fn), 'measuredAt': t, 'shotAt': ts, 'peers': peers, 'own': own, 'buffer': buf, 'probe': pts, 'carried': await P.evaluate(CARRIED), 'cam': await P.evaluate("()=>window.__cam0?[window.__cam0.sc, window.__cam0.cam.x, window.__cam0.cam.y]:null")}


async def main():
    port = L.free_port(); srv = L.start_server(A_.game, port, os.path.join(A_.out, f'{TAG}_server.log')); errs = []
    R = {'tool': 'dev/stage-3d-hq1/light_capture.py', 'game': A_.game, 'commit': git_head(A_.game), 'variant': A_.variant, 'kind': A_.kind, 'lightOnAtDeath': bool(A_.lo),
         'blackout': A_.blackout, 'renderer': 'SwiftShader (Chromium software GL), 960x640', 'when': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'samples': []}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS)
            ca, cb, cc = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(3)]
            await ca.add_init_script(f"try{{localStorage.setItem('wanderer-light', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wanderer-light')||'{{}}'),{{kind:'{A_.kind}'}})))}}catch(e){{}}")
            Q = ('&' + A_.query) if A_.query else ''
            A = await L.join(ca, port, 'hq1light', 'Alice', errs, Q); await L.admin_open(A)
            B = await L.join(cb, port, 'hq1light', 'Bob', errs, Q)
            C = await L.prejoin(cc, port, 'hq1light', 'Carol', errs, Q)
            bid = await B.evaluate("()=>__api.H.id"); await L.admin_cmd(A, {'c': 'god', 'id': bid}); await A.wait_for_timeout(300)
            await L.admin_cmd(A, {'c': 'blackout', 'mode': A_.blackout}); await A.wait_for_timeout(1500)
            await L.ensure_alive(A)
            for P in (A, B): await P.evaluate(HOOK)
            R['equipment'] = await A.evaluate("()=>__api.H.equipment.kind")
            spot = await A.evaluate(L.lib3d.SPOTS, 'open'); R['spot'] = spot
            await L.place(A, spot[0], spot[1], spot[2], W, H)
            wb = await B.evaluate(L.lib3d.WATCH_FROM, spot); await L.aim(B, wb[2], W, H); R['viewer'] = wb
            # Bob's own light off; Alice's on or off as asked (the F key, as a player would)
            if await B.evaluate("()=>__api.lightOn()"): await B.keyboard.press('KeyF')
            if bool(await A.evaluate("()=>__api.lightOn()")) != bool(A_.lo): await A.keyboard.press('KeyF')
            await A.wait_for_timeout(2500)
            R['lightOnBefore'] = {'victim': await A.evaluate("()=>__api.lightOn()"), 'spectator': await B.evaluate("()=>__api.lightOn()")}
            ok = await L.preview(A, KIND, VAR); R['previewOk'] = ok
            if not ok: raise SystemExit('preview refused: ' + L.lib3d.last_preview(os.path.join(A_.out, f'{TAG}_server.log')))
            T0 = time.time(); R['t0wall'] = T0
            rel = None
            while time.time() - T0 < 6:
                r = await A.evaluate(REL)
                if r and r['rel'] is not None: rel = r; break
                await A.wait_for_timeout(50)
            R['release'] = rel
            relS = rel['rel'] if rel else 0.0
            for k in TIMES:
                target = relS + k                                                   # seconds after the death started (Alice's death clock / real time)
                while time.time() - T0 < target - .02: await A.wait_for_timeout(20)
                row = {'afterRelease': k, 'sinceDeath': round(time.time() - T0, 3), 'death': await A.evaluate(REL), 'replay': await B.evaluate(SPECREL)}
                if k > 6 and not row.get('revivedFixed'):                              # Alice stood up: her own light off, so only the dead light is left
                    if await A.evaluate("()=>!__api.G.caught && __api.fall()<0") and await A.evaluate("()=>__api.lightOn()"):
                        await A.keyboard.press('KeyF'); await A.wait_for_timeout(150)
                bodies = await B.evaluate(L.BODIES); lens = None
                cands = [p for p in (await B.evaluate(L.PEERS)) if not p['dead'] and p['kind'] == A_.kind]
                rep = await B.evaluate("()=>{ const f=(window.__fxs||[]).find(f=>f.jl&&!f.gone); return f&&f.jl.torch?[f.jl.torch.x,f.jl.torch.y,f.jl.torch.angle||0]:null }")
                body = await B.evaluate("()=>{ const b=(__api.bodyList()||[]).find(b=>b.cause!=='Vanish'&&b.dropped); if(!b) return null; const LEN=(window.__dphys&&window.__dphys.LEN)||{}, a=b.hands?b.dropped.angle-Math.PI/2:b.dropped.angle, l=b.hands?LEN[b.equipment.kind]||0:0; return [b.dropped.x+Math.cos(a)*l, b.dropped.y+Math.sin(a)*l, a] }")
                lens = rep or body
                row['lens'] = lens; row['bodies'] = bodies
                row['spectator'] = await measure(B, 'spectator', f'r{k:g}', R, lens)
                row['victim'] = await measure(A, 'victim', f'r{k:g}', R, lens)
                R['samples'].append(row); print(json.dumps({'k': k, 'since': row['sinceDeath'], 'specPeers': row['spectator']['peers'], 'specBuf': row['spectator']['buffer'], 'victimOwn': row['victim']['own'], 'victimBuf': row['victim']['buffer']})[:600], flush=True)
            wait = A_.late - (time.time() - T0)
            if wait > 0: await A.wait_for_timeout(int(wait * 1000))
            R['lateJoinAt'] = round(time.time() - T0, 1)
            await L.enter(C); await C.evaluate(HOOK); await C.wait_for_timeout(1500)
            R['lateJoinPlaced'] = await L.place(C, wb[0], wb[1], wb[2], W, H)
            if await C.evaluate("()=>__api.lightOn()"): await C.keyboard.press('KeyF')
            await C.wait_for_timeout(4000)
            body = await C.evaluate("()=>{ const b=(__api.bodyList()||[]).find(b=>b.cause!=='Vanish'&&b.dropped); if(!b) return null; const LEN=(window.__dphys&&window.__dphys.LEN)||{}, a=b.hands?b.dropped.angle-Math.PI/2:b.dropped.angle, l=b.hands?LEN[b.equipment.kind]||0:0; return [b.dropped.x+Math.cos(a)*l, b.dropped.y+Math.sin(a)*l, a] }")
            R['late'] = {'sinceDeath': round(time.time() - T0, 1), 'bodies': await C.evaluate(L.BODIES), 'joiner': await measure(C, 'late', 'late', R, body)}
            await b.close()
    finally:
        L.stop_server(srv)
    R['errors'] = errs[:20]
    L.dump(os.path.join(A_.out, f'{TAG}.json'), R)
    # the sheet: columns = the sample times (+ the late joiner), rows = spectator, victim; the full screens scaled down
    cols = [(f'r{row["afterRelease"]:g}', row) for row in R['samples']]
    sheet = Image.new('RGB', (320 * (len(cols) + 1), 214 * 2 + 40), (16, 16, 16)); g = ImageDraw.Draw(sheet)
    g.text((8, 8), f"{TAG}  {R['commit'][:7]}  blackout {A_.blackout}  release at {R.get('release')}", fill=(230, 230, 230))
    for c, (k, row) in enumerate(cols):
        for r, who in enumerate(('spectator', 'victim')):
            fn = os.path.join(A_.out, f'{TAG}_{k}_{who}.png')
            if os.path.exists(fn): sheet.paste(Image.open(fn).convert('RGB').resize((320, 214)), (c * 320, 30 + r * 214))
            m = row.get(who) or {}
            g.text((c * 320 + 6, 34 + r * 214), f"{who}: shot {m.get('shotAt', '?')} s after the death began", fill=(255, 255, 255))
    fn = os.path.join(A_.out, f'{TAG}_late_late.png')
    if os.path.exists(fn): sheet.paste(Image.open(fn).convert('RGB').resize((320, 214)), (len(cols) * 320, 30)); g.text((len(cols) * 320 + 6, 34), f"late joiner: shot {R.get('late', {}).get('joiner', {}).get('shotAt', '?')} s", fill=(255, 255, 255))
    sheet.save(os.path.join(A_.out, f'{TAG}_sheet.jpg'), quality=88)


asyncio.run(main())
