#!/usr/bin/env python3
"""Stage 3D - the eight deaths, as the victim sees them and as a spectator standing near sees them (development only).

  python3 dev/stage-3d/film_3d.py --game DIR --out DIR [--only hound-A] [--xray]

For each of Hound A-D and Smiler A-D: the victim (Alice) is killed through the admin DEATHS preview (the real capture and kill path);
Bob stands about 150 px away and watches the replay the server relays.  Both pages run the death lab's paused clock and are stepped
together to the same death times, so the frames are comparable between runs and between versions.  Written per variant:
  sheet_<kind><V>.jpg        top row: the victim's view; bottom row: the spectator's; the last column is the settled corpse
  trace_<kind><V>.json       the death's numbers at every sampled time on both pages (body, hands, gear, hat, attacker, phase,
                             sleep state, blood bursts, trail) and both corpse records
The server runs with a synthetic admin passcode (lib3d.PASS)."""
import os, sys, asyncio, argparse, time, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib3d
from playwright.async_api import async_playwright
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=lib3d.REPO); ap.add_argument('--out', required=True); ap.add_argument('--only', default='')
ap.add_argument('--xray', action='store_true'); ap.add_argument('--port', type=int, default=0); A_ = ap.parse_args()
os.makedirs(A_.out, exist_ok=True)
TIMES = [0, .1, .2, .3, .45, .6, .8, 1.0, 1.25, 1.5, 1.8, 2.1, 2.5, 3.0, 3.5, 4.0, 4.4, 4.75]
W, H = 760, 520
STATE = """()=>{ const d=__api.death(); if(!d) return null; const S=d.ph, r=v=>Math.round(v*10)/10;
  return { t:+d.elapsed.toFixed(4), fin:d.finished, kind:d.kind, v:d.variant, dur:d.duration, body:[r(d.body.x),r(d.body.y),+d.body.angle.toFixed(3),+d.body.scaleX.toFixed(3),+d.body.scaleY.toFixed(3),+d.body.alpha.toFixed(3)],
    hands:d.hands?d.hands.map(h=>[r(h.x),r(h.y)]):null, att:[r(d.attacker.x),r(d.attacker.y),+d.attacker.angle.toFixed(3)], torch:[r(d.torch.x),r(d.torch.y),+d.torch.angle.toFixed(3)],
    eq:S?[r(S.eq.x),r(S.eq.y),+S.eq.rot.toFixed(3),S.eq.held?1:0,S.eq.st]:null, hat:S?[r(S.hat.x),r(S.hat.y),S.hat.on?1:0,S.hat.st]:null, phase:d.phase, settle:d.settle,
    bursts:d.bursts.length, trail:(d.trail||[]).length, impact:+(d.impact||0).toFixed(3), black:+(d.black||0).toFixed(3), ev:S?S.ev.length:0 } }"""
SPEC = """()=>{ const f=(window.__fxs||[]).find(f=>f.jl); if(!f) return null; const d=f.jl, r=v=>Math.round(v*10)/10;
  return { t:+d.elapsed.toFixed(4), fin:d.finished, kind:d.kind, v:d.variant, body:[r(d.body.x),r(d.body.y),+d.body.angle.toFixed(3)], hands:d.hands?d.hands.map(h=>[r(h.x),r(h.y)]):null,
    att:[r(d.attacker.x),r(d.attacker.y)], bursts:d.bursts.length, settle:d.settle } }"""
BODIES = "()=>(__api.bodyList?__api.bodyList():[]).map(b=>({id:b.id, owner:b.ownerId, cause:b.cause, x:Math.round(b.x), y:Math.round(b.y), a:+(+b.angle).toFixed(3), hands:b.hands||null, dropped:b.dropped?[Math.round(b.dropped.x),Math.round(b.dropped.y)]:null, hat:b.hat?[Math.round(b.hat.x),Math.round(b.hat.y)]:null, hatOn:b.hatOn, blood:(b.blood||[]).length, trail:(b.trail||[]).length, remote:!!b.remote}))"


async def step_to(P, T, getter):
    st = await P.evaluate(getter)
    if not st: return None
    n = max(0, round((T - st['t']) * 60))
    if n: await P.evaluate("n=>{window.__dlab.step=n}", n)
    return n


async def main():
    port = A_.port or lib3d.free_port(); srv = lib3d.start_server(A_.game, port, os.path.join(A_.out, 'server.log')); errs_a, errs_b = [], []
    summary = {'game': A_.game, 'xray': A_.xray, 'times': TIMES, 'variants': {}}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=lib3d.ARGS)
            ca = await b.new_context(viewport={'width': W, 'height': H}); cb = await b.new_context(viewport={'width': W, 'height': H})
            A = await lib3d.join(ca, port, 'film3d', 'Alice', errs_a)
            await lib3d.admin_open(A)                                              # the monsters go before the spectator arrives
            B = await lib3d.join(cb, port, 'film3d', 'Bob', errs_b)
            bid = await B.evaluate("()=>__api.H.id"); await lib3d.admin_cmd(A, {'c': 'god', 'id': bid}); await A.wait_for_timeout(400)   # the spectator must not be the next victim
            spots = {k: await A.evaluate(lib3d.SPOTS, k) for k in ('open', 'wall')}
            summary['spots'] = spots
            for kind, v in [(k, v) for k in ('hound', 'smiler') for v in 'ABCD']:
                if A_.only and A_.only != f'{kind}-{v}': continue
                await lib3d.ensure_alive(A); await lib3d.ensure_alive(B)
                spot = spots['wall'] if (kind == 'hound' and v == 'C') else spots['open']
                for P in (A, B): await P.evaluate("()=>{window.__dlab={on:false,paused:false,speed:1,step:0,xray:false}}")
                await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", spot); await lib3d.aim(A, spot[2], W, H)
                wb = await B.evaluate(lib3d.WATCH_FROM, spot)                         # a clear spot ~150 px away, in line of sight, facing the victim
                await lib3d.aim(B, wb[2], W, H)
                await A.wait_for_timeout(3800)
                if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
                await lib3d.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(300)
                for P in (A, B): await P.evaluate("x=>{window.__dlab={on:true,paused:true,speed:1,step:0,xray:x}}", A_.xray)
                s0 = await A.evaluate("()=>__api.death().startAt"); started = False; why = []
                for attempt in range(3):                                           # a preview can be refused for a moment (the last death's entity still busy)
                    await lib3d.click(A, f'[data-c=preview][data-k={kind}][data-var={v}]')
                    t0 = time.time()
                    while time.time() - t0 < 6 and not started:
                        started = await A.evaluate("s=>__api.G.caught && __api.death().active && __api.death().startAt!==s", s0)
                        if not started: await A.wait_for_timeout(100)
                    if started: break
                    why.append(lib3d.last_preview(os.path.join(A_.out, 'server.log')))
                    await A.wait_for_timeout(2500); await lib3d.ensure_alive(A)
                    if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
                    await lib3d.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(300)
                    for P in (A, B): await P.evaluate("x=>{window.__dlab={on:true,paused:true,speed:1,step:0,xray:x}}", A_.xray)
                if not started:
                    summary['variants'][f'{kind}-{v}'] = {'error': 'the preview death did not start', 'server': why}; print(kind, v, 'DID NOT START', why, flush=True); continue
                if why: summary.setdefault('retries', {})[f'{kind}-{v}'] = why
                await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
                t0 = time.time()
                while time.time() - t0 < 6 and not await B.evaluate(SPEC): await B.wait_for_timeout(100)
                frames, trA, trB = [], [], []
                dur = (await A.evaluate(STATE) or {}).get('dur', 4.5)
                times = [t for t in TIMES if t < dur] + [dur]
                for i, T in enumerate(times):
                    await step_to(A, T, STATE); await step_to(B, T, SPEC); await A.wait_for_timeout(260)
                    fa, fb = os.path.join(A_.out, f'_a{i:02d}.jpg'), os.path.join(A_.out, f'_b{i:02d}.jpg')
                    await A.screenshot(path=fa, type='jpeg', quality=70); await B.screenshot(path=fb, type='jpeg', quality=70)
                    trA.append(await A.evaluate(STATE)); trB.append(await B.evaluate(SPEC)); frames.append((fa, fb))
                # let it finish: the corpse is made when the death ends; then watch it lie there
                for P in (A, B): await P.evaluate("()=>{window.__dlab={on:false,paused:false,speed:1,step:0,xray:false}}")
                await A.wait_for_timeout(2500)
                fa, fb = os.path.join(A_.out, '_a_rest.jpg'), os.path.join(A_.out, '_b_rest.jpg')
                await A.screenshot(path=fa, type='jpeg', quality=70); await B.screenshot(path=fb, type='jpeg', quality=70); frames.append((fa, fb))
                bodA = await A.evaluate(BODIES); bodB = await B.evaluate(BODIES)
                cw, ch = 360, 280; cols = len(frames); sheet = Image.new('RGB', (cw * cols, ch * 2))
                for i, (fa, fb) in enumerate(frames):
                    for row, fn in enumerate((fa, fb)):
                        im = Image.open(fn).crop((W // 2 - cw // 2, H // 2 - ch // 2, W // 2 + cw // 2, H // 2 + ch // 2)); sheet.paste(im, (i * cw, row * ch))
                tag = f'{kind}{v}' + ('_xray' if A_.xray else '')
                sheet.save(os.path.join(A_.out, f'sheet_{tag}.jpg'), quality=74)
                for fa, fb in frames: os.remove(fa); os.remove(fb)
                lib3d.dump(os.path.join(A_.out, f'trace_{tag}.json'), {'victim': trA, 'spectator': trB, 'times': times, 'bodiesVictim': bodA, 'bodiesSpectator': bodB, 'spot': spot})
                last = trA[-1] or {}
                summary['variants'][f'{kind}-{v}'] = {'frames': len(frames), 'dur': dur, 'end': last.get('body'), 'settle': last.get('settle'), 'specSeen': any(trB), 'corpses': len(bodA)}
                print(kind, v, 'frames', len(frames), 'end', last.get('body'), last.get('settle'), 'spectator saw it:', any(trB), flush=True)
                if not await lib3d.until_alive(A): await A.evaluate("()=>window.__net && __net.respawn && __net.respawn()"); await lib3d.until_alive(A)
            await b.close()
    finally:
        lib3d.stop_server(srv)
    summary['errors'] = {'victim': errs_a[:20], 'spectator': errs_b[:20]}
    lib3d.dump(os.path.join(A_.out, 'film_summary' + ('_xray' if A_.xray else '') + '.json'), summary)
    print('errors', errs_a[:5], errs_b[:5])

asyncio.run(main())
