#!/usr/bin/env python3
"""Stage 3D - from the end of a death to a corpse that lies there: continuity, drying, culling, late joiners (development only).

  python3 dev/stage-3d/corpse_check.py --game DIR --out DIR [--variant hound-A]

Alice (admin, the victim) and Bob (a spectator ~150 px away, god mode) in one room, monsters removed; the death runs through the admin
death lab, paused and stepped, on both screens:
  1. the last frame of the death (duration - 2 frames) and the first frames of the corpse (+6 frames, +1 s): screenshots of both
     screens; the mean pixel change across the corpse's part of the screen is the 'pop' of the hand-over (lower is better);
  2. the corpse drying: Alice's screen at 1, 5 and 20 s of corpse age;
  3. culling: Alice is moved 3,000 px away - the corpse view must stop being drawn (and give back its texture, when it has one) - and back;
  4. a late joiner, Carol, arrives 20 s after the death: the corpse must reach her with its age (she sees the same dry corpse).
Writes OUT/corpse_check.json and OUT/handover_<variant>.jpg (rows: Alice, Bob; columns: last frame, +6 frames, +1 s, 5 s, 20 s).
The server runs with a synthetic admin passcode (lib3d.PASS).  SwiftShader rendering: pixel numbers compare versions on one machine."""
import os, sys, asyncio, argparse, time, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib3d
from PIL import Image, ImageChops, ImageStat
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=lib3d.REPO); ap.add_argument('--out', required=True); ap.add_argument('--variant', default='hound-A')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game); os.makedirs(A_.out, exist_ok=True)
W, H = 760, 520
KIND, VAR = A_.variant.split('-')
HOOK = """()=>{ const G=window.__gore; if(G && G.cull && !G.__wrapped){ const c=G.cull; G.cull=(r,s)=>{ window.__scn=s; return c(r,s) }; G.__wrapped=1 }
  if(!window.__camWrapped){ const o=window.__mp; window.__mp=a=>{ window.__cam0=a; return o&&o(a) }; window.__camWrapped=1 } }"""
CAM = "()=>window.__cam0?[window.__cam0.sc, window.__cam0.cam.x, window.__cam0.cam.y]:null"
# the corpse's age on a page, frozen for the pictures (gore.js reads window.__goreNow when a test sets it; older builds ignore it)
AGE = """a=>{ const b=(__api.bodyList()||[]).find(b=>b.cause!=='Vanish'); const born=b?(b.born!=null?b.born:b.createdAt):null; if(born==null) return null;
  window.__goreNow=()=>born+a; return a }"""
VIEWS = """()=>{ const s=window.__scn; if(!s) return null; return [...s.corpseViews.values()].map(v=>({id:String(v.record&&v.record.id), cause:v.record&&v.record.cause, visible:v.visible, cached:!!v.isCachedAsTexture})) }"""
DSTATE = "()=>{ const d=__api.death(); return d ? { t:+d.elapsed.toFixed(4), fin:d.finished, dur:d.duration, x:d.body.x, y:d.body.y, corpse:d.corpseId } : null }"
SPEC = "()=>{ const f=(window.__fxs||[]).find(f=>f.jl); return f ? { t:+f.jl.elapsed.toFixed(4), fin:f.jl.finished } : null }"
BODY = "()=>(__api.bodyList?__api.bodyList():[]).filter(b=>b.cause!=='Vanish').map(b=>({id:b.id, owner:String(b.ownerId), remote:!!b.remote, x:Math.round(b.x), y:Math.round(b.y), age:window.__gore&&window.__gore.ageOf?+window.__gore.ageOf(b).toFixed(1):null, born:b.born!=null}))"


async def step(P, getter, T):
    st = await P.evaluate(getter)
    if st:
        n = max(0, round((T - st['t']) * 60))
        if n: await P.evaluate("n=>{window.__dlab.step=n}", n)


def crop(fn, cx, cy, w=360, h=280):
    return Image.open(fn).convert('RGB').crop((int(cx - w / 2), int(cy - h / 2), int(cx + w / 2), int(cy + h / 2)))


def pop(a, b):
    return round(sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3, 2)


async def main():
    port = lib3d.free_port(); srv = lib3d.start_server(A_.game, port, os.path.join(A_.out, 'server.log')); errs = []
    R = {'tool': 'dev/stage-3d/corpse_check.py', 'game': A_.game, 'variant': A_.variant}
    shots = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=lib3d.ARGS)
            ca, cb, cc = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(3)]
            A = await lib3d.join(ca, port, 'corpse3d', 'Alice', errs); await lib3d.admin_open(A)
            B = await lib3d.join(cb, port, 'corpse3d', 'Bob', errs)
            bid = await B.evaluate("()=>__api.H.id"); await lib3d.admin_cmd(A, {'c': 'god', 'id': bid}); await A.wait_for_timeout(400)
            await lib3d.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(400)          # no random light failure in the pictures
            for P in (A, B): await P.evaluate(HOOK)
            spot = await A.evaluate(lib3d.SPOTS, 'wall' if (KIND == 'hound' and VAR == 'C') else 'open')
            await A.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", spot); await lib3d.aim(A, spot[2], W, H)
            wb = await B.evaluate(lib3d.WATCH_FROM, spot); await lib3d.aim(B, wb[2], W, H)
            await A.wait_for_timeout(3500)
            if await A.evaluate("()=>document.getElementById('adminPanel').hidden"): await A.keyboard.press('Backquote'); await A.wait_for_timeout(300)
            await lib3d.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(300)
            for P in (A, B): await P.evaluate("()=>{window.__dlab={on:true,paused:true,speed:1,step:0,xray:false}}")
            T0 = time.time(); R['timeline'] = [['preview', 0, await A.evaluate("()=>performance.now()/1000")]]
            s0 = await A.evaluate("()=>__api.death().startAt")
            await lib3d.click(A, f'[data-c=preview][data-k={KIND}][data-var={VAR}]')
            t0 = time.time()
            while time.time() - t0 < 8 and not await A.evaluate("s=>__api.G.caught && __api.death().active && __api.death().startAt!==s", s0): await A.wait_for_timeout(100)
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            t0 = time.time()
            while time.time() - t0 < 6 and not await B.evaluate(SPEC): await B.wait_for_timeout(100)
            dur = (await A.evaluate(DSTATE))['dur']; R['dur'] = dur
            # the victim's body on Bob's screen (Bob does not move): its screen position from Bob's camera
            bc = await B.evaluate("()=>[__api.H.x, __api.H.y]")
            for label, T in (('last', dur - 2 / 60), ('plus6f', dur + 6 / 60)):
                await step(A, DSTATE, T); await step(B, SPEC, T)
                await B.evaluate("()=>{ for (const f of window.__fxs||[]) if (f.att) f.att.renderable=false }")   # the replayed attacker leaves with the replay: not part of the hand-over
                await A.wait_for_timeout(500)
                if label == 'plus6f':                                 # the death is over: the corpse is made on the next game frame
                    for _ in range(30):
                        if (await A.evaluate(DSTATE) or {}).get('corpse'): break
                        await A.wait_for_timeout(100)
                    await A.evaluate("()=>{const c=document.getElementById('caught'); if(c) c.hidden=true}")   # the death screen would cover the corpse: test view only
                    for _ in range(50):
                        if await B.evaluate(BODY): break
                        await B.wait_for_timeout(100)
                    for P in (A, B): await P.evaluate(AGE, 0)                  # the corpse as it is the moment it is made
                    await A.wait_for_timeout(700)
                R['timeline'].append([label, round(time.time() - T0, 1), await A.evaluate("()=>[performance.now()/1000, (__api.bodyList()||[]).map(b=>b.createdAt)]")])
                for P, who in ((A, 'A'), (B, 'B')):
                    fn = os.path.join(A_.out, f'_{who}_{label}.png'); await P.screenshot(path=fn); shots[(who, label)] = fn
            R['timeline'] = R.get('timeline', []) + [['afterEnd', round(time.time() - T0, 1), await A.evaluate("()=>performance.now()/1000")]]
            R['afterEnd'] = {'victimState': await A.evaluate(DSTATE), 'victimBodies': await A.evaluate(BODY), 'spectatorBodies': await B.evaluate(BODY)}
            for P in (A, B): await P.evaluate("()=>{window.__dlab={on:false,paused:false,speed:1,step:0,xray:false}}")
            await A.wait_for_timeout(1000); await A.evaluate("()=>{const c=document.getElementById('caught'); if(c) c.hidden=true}")
            for P in (A, B): await P.evaluate(AGE, 1)
            await A.wait_for_timeout(600)
            for P, who in ((A, 'A'), (B, 'B')):
                fn = os.path.join(A_.out, f'_{who}_plus1s.png'); await P.screenshot(path=fn); shots[(who, 'plus1s')] = fn
            R['at1s'] = {'victimBodies': await A.evaluate(BODY), 'spectatorBodies': await B.evaluate(BODY), 'victimViews': await A.evaluate(VIEWS), 'spectatorViews': await B.evaluate(VIEWS)}
            # where the corpse is on each screen: Alice's camera is on her body (the corpse), Bob's on Bob
            vb = (await A.evaluate(BODY)) or (await B.evaluate(BODY))
            cx, cy = (vb[0]['x'], vb[0]['y']) if vb else (spot[0], spot[1])
            sc = await B.evaluate(CAM)
            bpos = (W / 2 + (cx - sc[1]) * sc[0], H / 2 + (cy - sc[2]) * sc[0]) if sc else (W / 2, H / 2)
            asc = await A.evaluate(CAM)
            apos = (W / 2 + (cx - asc[1]) * asc[0], H / 2 + (cy - asc[2]) * asc[0]) if asc else (W / 2, H / 2)
            R['screen'] = {'corpse': [cx, cy], 'aliceScale': asc, 'bobScale': sc}
            for age in (5, 20):
                for P in (A, B): await P.evaluate(AGE, age)
                await A.wait_for_timeout(1200); await A.evaluate("()=>{const c=document.getElementById('caught'); if(c) c.hidden=true}")
                for P, who in ((A, 'A'), (B, 'B')):
                    fn = os.path.join(A_.out, f'_{who}_age{age}.png'); await P.screenshot(path=fn); shots[(who, f'age{age}')] = fn
            R['at20s'] = {'victimBodies': await A.evaluate(BODY), 'spectatorBodies': await B.evaluate(BODY)}
            # culling: far away and back (Alice is dead: the respawn moves her; Bob is god and alive - he walks away instead)
            for P in (A, B): await P.evaluate("()=>{ delete window.__goreNow }")
            await B.evaluate("()=>{__api.tp(__api.H.x+3000, __api.H.y)}"); await B.wait_for_timeout(1500)
            R['farAway'] = await B.evaluate(VIEWS)
            await B.evaluate("([x,y])=>{__api.tp(x,y)}", wb); await B.wait_for_timeout(1500)
            R['back'] = await B.evaluate(VIEWS)
            # a late joiner
            C = await lib3d.join(cc, port, 'corpse3d', 'Carol', errs); await C.evaluate(HOOK)
            await C.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", wb); await C.wait_for_timeout(2000)
            R['lateJoiner'] = {'bodies': await C.evaluate(BODY), 'views': await C.evaluate(VIEWS)}
            fn = os.path.join(A_.out, '_C_late.png'); await C.screenshot(path=fn); shots[('C', 'late')] = fn
            await b.close()
    finally:
        lib3d.stop_server(srv)
    # the hand-over, measured where the corpse is
    try:
        cols = ['last', 'plus6f', 'plus1s', 'age5', 'age20']; sheet = Image.new('RGB', (360 * len(cols), 280 * 2))
        R['pop'] = {}
        for row, (who, pos) in enumerate((('A', apos), ('B', bpos))):
            ims = [crop(shots[(who, c)], *pos) for c in cols]
            for i, im in enumerate(ims): sheet.paste(im, (i * 360, row * 280))
        # the hand-over is judged on the spectator's screen (the victim's own screen fades to black as the death ends, then shows the death
        # screen), in a 200 x 200 square on the corpse
        ims = [crop(shots[('B', c)], *bpos, 200, 200) for c in cols]
        z = Image.new('RGB', (400 * len(cols), 400))
        for i, im in enumerate(ims): z.paste(im.resize((400, 400), Image.LANCZOS), (i * 400, 0))
        z.save(os.path.join(A_.out, f'handover_zoom_{A_.variant}.jpg'), quality=85)
        R['pop'] = {'spectator': {'last->plus6f': pop(ims[0], ims[1]), 'plus6f->plus1s': pop(ims[1], ims[2]), 'plus1s->age5': pop(ims[2], ims[3]), 'age5->age20': pop(ims[3], ims[4])}}
        sheet.save(os.path.join(A_.out, f'handover_{A_.variant}.jpg'), quality=80)
        Image.open(shots[('C', 'late')]).convert('RGB').save(os.path.join(A_.out, f'late_joiner_{A_.variant}.jpg'), quality=75)
    except Exception as e:
        R['sheetError'] = repr(e)
    for f in shots.values():
        try: os.remove(f)
        except OSError: pass
    R['errors'] = errs[:20]
    lib3d.dump(os.path.join(A_.out, 'corpse_check.json'), R)
    print(json.dumps({k: R.get(k) for k in ('pop', 'farAway', 'back', 'lateJoiner', 'errors')}, indent=1)[:3000])

asyncio.run(main())
