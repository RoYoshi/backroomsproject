#!/usr/bin/env python3
"""Stage 3D HQ2 - E09 on real screens: a NEW RUN blast in a blacked-out room, watched with reduced motion, by a muted spectator, and by a
player behind the wall whose browser never gave the page permission to play sound (development only; SwiftShader)

  python3 -I dev/stage-3d-hq2/e09_browser.py --game DIR --out FILE.json [--shots DIR]

Every page asks for reduced motion (the browser's prefers-reduced-motion: reduce; the game has no setting of its own for it).
  Alice  presses NEW RUN in front of a wall, her light OFF; her sound on (her page has had clicks and keys)
  Bob    watches from the side, in the same room, light OFF, his sound switched OFF with the game's own SOUND button
  Carol  stands on the far side of that wall, light OFF; her page never gets a user gesture (she joins and does everything by script),
         and runs in a browser told to need one before any sound (--autoplay-policy=document-user-activation-required).  Headless Chromium
         plays sound whatever that flag says, so her page is also given what such a browser does until the first gesture: every audio
         context it makes is suspended and resume() never gets it running
The room is blacked out (admin BLACKOUT ON) and the monsters are removed.  Measured on every page, every animation frame: where its own
player is, whether its own death camera is on, the camera module's zoom; and every frame Bob's and Carol's screens show (Chrome's
screencast of the composited page: the mean grey and the 99th percentile) before, during and after the blast, then - the control - with
Bob's own light switched on.  The game's blast sound (ents.js boomVoice) is watched on every page: whether it is asked for, and how many
audio nodes it really makes.
Checks (exit 1 if any fails):
  setup   the blackout is on, every light is off, every page asks for reduced motion, the NEW RUN is approved and every page plays the blast
  flash   no light from the blast on Bob's screen or Carol's (behind the wall): no frame during it brighter than the brightest before it
          (mean grey +0.3, share of pixels brighter than 12 +0.2 points); and the control is seen (Bob's light on afterwards: more than that)
  camera  no camera jump: Bob's and Carol's own players never move, their death cameras never start, the zoom stays; Alice stays exactly
          where she pressed until her run menu, with no death camera
  sound   the muted spectator makes no sound at all for the blast (0 audio nodes); Alice's own page does (the control); Carol's page,
          with no permission, plays the blast with its audio not running and no error
  errors  no page error on any page"""
import os, sys, asyncio, argparse, json, time, io, base64
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hq2lib as Q
L = Q.L
from playwright.async_api import async_playwright
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--out', required=True); ap.add_argument('--shots', default=None)
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 720, 480
ROOM = 'h25e09'
AUDIO = r"""(()=>{ const S=window.__h25au={nodes:0, boom:[]}; const B=(window.BaseAudioContext||window.AudioContext).prototype;
  for(const k of ['createOscillator','createBufferSource','createBiquadFilter','createGain']){ const f=B[k]; if(!f) continue; B[k]=function(){ S.nodes++; return f.apply(this,arguments) } } })()"""
# headless Chromium plays sound whatever --autoplay-policy says, so Carol's page also gets what such a browser does until the first
# gesture: every audio context it makes is suspended, and resume() never gets it running
NOPERM = r"""(()=>{ for(const k of ['AudioContext','webkitAudioContext']){ const AC=window[k]; if(!AC) continue;
  const F=function(...a){ const c=new AC(...a); try{ c.suspend() }catch(e){} c.resume=()=>new Promise(()=>{}); return c }; F.prototype=AC.prototype; window[k]=F } })()"""
HOOK = r"""()=>{ const S=window.__h25au, E=window.__ents; if(!E||!E.boomVoice||E.boomVoice.__h25) return !!(E&&E.boomVoice&&E.boomVoice.__h25);
  const f=E.boomVoice; E.boomVoice=function(x,y){ const n0=S.nodes, A=window.__api, Z=A&&A.audio&&A.audio(); let err=null; try{ return f.apply(this,arguments) }catch(e){ err=String(e); throw e }
    finally{ S.boom.push({ t:+(Date.now()/1000).toFixed(3), nodes:S.nodes-n0, state:Z&&Z.context?Z.context.state:'no context', sound:(document.getElementById('sound')||{}).textContent||null, err }) } };
  E.boomVoice.__h25=1; return true }"""
SAMPLER = r"""()=>{ if(window.__h25s) return 'already'; const S=window.__h25s={rows:[]};
  const L=()=>{ try{ const A=window.__api, d=A.death&&A.death(), c=window.__cam;
      S.rows.push([+(Date.now()/1000).toFixed(3), +A.H.x.toFixed(2), +A.H.y.toFixed(2), d&&d.active?1:0, c?+(+c.zoomCur).toFixed(4):null, document.getElementById('runMenu').hidden?0:1,
        (window.__fxs||[]).filter(f=>f.k==='boom').length]); if(S.rows.length>20000) S.rows.splice(0,5000) }catch(e){ S.err=String(e) } requestAnimationFrame(L) };
  requestAnimationFrame(L); return 'ok' }"""
ROWS = "(since)=>window.__h25s?window.__h25s.rows.filter(r=>r[0]>=since):null"
PRESS = "()=>{ const b=document.getElementById('reset'); if(!b) return false; b.click(); return true }"
STATE = "()=>({ light: __api.lightOn(), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, sound: (document.getElementById('sound')||{}).textContent||null, audio: (()=>{ const Z=__api.audio&&__api.audio(); return Z&&Z.context?Z.context.state:'no context' })(), blackout: !!(__api.V&&__api.V.blackout), id: __api.H.id, at:[Math.round(__api.H.x),Math.round(__api.H.y)] })"


def lum(png):
    """the mean grey, the 99th percentile, and the lit share: the fraction of pixels brighter than 12 (in a blacked-out room only the
    HUD's own text is; a beam or a flash adds to it)"""
    im = Image.open(io.BytesIO(png)).convert('L'); h = im.histogram(); n = sum(h); acc = 0; p99 = 255
    for v, c in enumerate(h):
        acc += c
        if acc >= .99 * n: p99 = v; break
    return round(sum(v * c for v, c in enumerate(h)) / n, 3), p99, round(sum(h[13:]) / n, 5)


async def join_untouched(ctx, port, room, name, errs):
    """into the game with no user gesture at all: every step by script (an untrusted click is no permission to play sound)"""
    P = await ctx.new_page()
    P.on('pageerror', lambda e: errs.append(name + ' pageerror: ' + str(e)[:300]))
    P.on('console', lambda m: errs.append(name + ' console: ' + m.text[:200]) if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'favicon' not in m.text and 'fonts.g' not in m.text else None)
    await P.goto(f'http://127.0.0.1:{port}/?room={room}', timeout=90000)
    await P.wait_for_function("()=>!!(window.__api && window.__api.H)", timeout=90000); await P.wait_for_timeout(1200)
    if await P.evaluate("()=>!!(window.__ui && window.__ui.version)"): await P.evaluate("()=>window.__ui.go('play')"); await P.wait_for_timeout(600)
    await P.evaluate("n=>{ document.getElementById('name').value=n; document.getElementById('enter').click() }", name)
    for _ in range(150):
        if await P.evaluate("()=>!!(window.__api && __api.started() && !document.getElementById('hud').hidden)"): break
        await P.wait_for_timeout(100)
    for _ in range(100):
        if await P.evaluate("()=>!!(window.__net && window.__net.on !== false)"): break
        await P.wait_for_timeout(100)
    await P.evaluate("p=>{window.__net && __net.testAuth && __net.testAuth(p)}", Q.PASS)
    for _ in range(100):
        if await P.evaluate("()=>__api.fall()<0"): break
        await P.wait_for_timeout(100)
    await P.wait_for_timeout(800)
    return P


async def place_untouched(P, x, y, a):
    for _ in range(4):
        await P.evaluate("([x,y,a])=>{__api.tp(x,y); __api.H.angle=a}", [x, y, a]); await P.wait_for_timeout(700)
        if await P.evaluate("([x,y])=>Math.hypot(__api.H.x-x,__api.H.y-y)<30", [x, y]): return True
    return False


async def main():
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    R = {'tool': 'dev/stage-3d-hq2/e09_browser.py', 'game': A_.game, 'shots': {}, 'checks': []}
    chk = lambda name, ok, info=None: R['checks'].append({'name': name, 'ok': bool(ok), 'info': info})
    if A_.shots: os.makedirs(A_.shots, exist_ok=True)
    try:
        async with async_playwright() as p:
            b1 = await p.chromium.launch(args=Q.ARGS)
            b2 = await p.chromium.launch(args=Q.ARGS + ['--autoplay-policy=document-user-activation-required'])
            ca = await b1.new_context(viewport={'width': W, 'height': H}, reduced_motion='reduce'); cb = await b1.new_context(viewport={'width': W, 'height': H}, reduced_motion='reduce')
            cc = await b2.new_context(viewport={'width': W, 'height': H}, reduced_motion='reduce')
            for c in (ca, cb, cc): await c.add_init_script(AUDIO)
            await cc.add_init_script(NOPERM)
            A = await L.join(ca, port, ROOM, 'Alice', errs); await L.admin_open(A); await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            B = await L.join(cb, port, ROOM, 'Bob', errs)
            C = await join_untouched(cc, port, ROOM, 'Carol', errs)
            ids = {k: await P.evaluate("()=>__api.H.id") for k, P in (('alice', A), ('bob', B), ('carol', C))}; R['ids'] = ids
            for k in ('alice', 'bob', 'carol'): await L.admin_cmd(A, {'c': 'god', 'id': ids[k]})   # (god mode: no monster coming back can interfere; NEW RUN does not look at it)
            await L.clear_monsters(A); await L.ensure_alive(A)
            for _ in range(80):
                if await A.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
                await A.wait_for_timeout(250)
            S = None
            for skip in range(6):
                for side in ('N', 'S', 'E', 'W'):
                    s = await A.evaluate(L.FACE_SPOT, [side, 64, skip])
                    if s and await A.evaluate(L.BEHIND_SPOT, s) and await A.evaluate(L.VIEW_SPOT, s): S = s; break
                if S: break
            R['spot'] = S
            V = await A.evaluate(L.VIEW_SPOT, S); Bh = await A.evaluate(L.BEHIND_SPOT, S); R['view'] = V; R['behind'] = Bh
            await L.place(A, S['x'], S['y'], S['a'], W, H); await L.place(B, V[0], V[1], V[2], W, H); await place_untouched(C, Bh[0], Bh[1], Bh[2])
            for P, trusted in ((A, True), (B, True), (C, False)):                 # every light off (Carol's by an untrusted key event: no gesture)
                for _ in range(3):
                    if not await P.evaluate("()=>__api.lightOn()"): break
                    await P.evaluate("()=>{ const e=document.activeElement; if(e&&e!==document.body&&e.blur) e.blur() }")   # (not into the admin panel's passcode field)
                    if trusted: await P.keyboard.press('KeyF')
                    else: await P.evaluate("()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',key:'f'}))"); await P.evaluate("()=>window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyF',key:'f'}))")
                    await P.wait_for_timeout(400)
            if 'OFF' not in (await B.evaluate("()=>document.getElementById('sound').textContent") or ''): await B.evaluate("()=>document.getElementById('sound').click()")   # (the game's own SOUND button; it sits in the menu, so its handler is clicked by script)
            await L.admin_cmd(A, {'c': 'blackout', 'mode': 'on'}); await A.wait_for_timeout(2500)
            for P in (A, B, C): await P.evaluate(HOOK); await P.evaluate(SAMPLER)
            await L.clear_monsters(A); await A.wait_for_timeout(1500)
            R['before'] = {k: await P.evaluate(STATE) for k, P in (('alice', A), ('bob', B), ('carol', C))}
            frames = {'bob': [], 'carol': []}; casts = {}
            for k, P, c in (('bob', B, cb), ('carol', C, cc)):                 # every frame the screen shows (Chrome's screencast: the composited page)
                cdp = await c.new_cdp_session(P); casts[k] = cdp
                async def got(ev, k=k, cdp=cdp):
                    try:
                        png = base64.b64decode(ev['data']); m, p99, lit = lum(png); t = ev['metadata'].get('timestamp') or time.time(); frames[k].append({'t': round(t, 3), 'mean': m, 'p99': p99, 'lit': lit})
                        if A_.shots and len(frames[k]) % 6 == 1: open(os.path.join(A_.shots, f"{k}_frame_{len(frames[k]):03d}.jpg"), 'wb').write(png)
                    finally:
                        await cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']})
                cdp.on('Page.screencastFrame', lambda ev, got=got: asyncio.ensure_future(got(ev)))
                await cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 70, 'everyNthFrame': 1})
            await A.wait_for_timeout(2500)
            q0 = await A.evaluate("()=>window.__nrDebug().q"); t0 = time.time(); await A.evaluate(PRESS)
            ok = None
            while time.time() - t0 < 4 and not ok:
                ok = await A.evaluate("(q)=>{ const d=window.__nrDebug(); return d.last && d.last.q>q ? d.last : null }", q0)
                if not ok: await A.wait_for_timeout(30)
            tOk = time.time(); R['approval'] = ok
            await A.wait_for_timeout(3400 + 1500)
            tL = time.time(); await B.keyboard.press('KeyF'); await A.wait_for_timeout(2500)          # the control: Bob switches his own light on - the measurement must see it
            for cdp in casts.values(): await cdp.send('Page.stopScreencast')
            await A.wait_for_timeout(500)
            for k in frames:
                for f in frames[k]: f['phase'] = 'before' if f['t'] < t0 else 'during' if f['t'] <= tOk + 3.4 else 'after' if f['t'] < tL else 'control'
            R['luminance'] = frames
            rows = {k: await P.evaluate(ROWS, t0 - 3) for k, P in (('alice', A), ('bob', B), ('carol', C))}
            R['audio'] = {k: await P.evaluate("()=>window.__h25au") for k, P in (('alice', A), ('bob', B), ('carol', C))}
            R['after'] = {k: await P.evaluate(STATE) for k, P in (('alice', A), ('bob', B), ('carol', C))}
            R['boomsSeen'] = {k: await P.evaluate("()=>(window.__fxs||[]).filter(f=>f.k==='boom').map(f=>({id:f.id, de:f.de}))") for k, P in (('alice', A), ('bob', B), ('carol', C))}
            R['rowCounts'] = {k: len(v or []) for k, v in rows.items()}
            for k, P in (('alice', A), ('bob', B), ('carol', C)):
                if A_.shots: await P.screenshot(path=os.path.join(A_.shots, f'{k}_end.png'))
            await b1.close(); await b2.close()
    finally:
        Q.lib3d.stop_server(srv)
    bf, af = R['before'], R['after']
    played = {k: any(r[6] for r in (rows[k] or [])) for k in rows}
    chk('setup: the blackout is on, every light is off, every page asks for reduced motion, the NEW RUN is approved and every page plays the blast',
        all(bf[k]['blackout'] and not bf[k]['light'] and bf[k]['reduced'] for k in bf) and R.get('approval') and R['approval'].get('ok') and all(played.values()),
        {'before': bf, 'approval': R.get('approval'), 'played': played})
    flash = {}
    for k in ('bob', 'carol'):
        pre = [s for s in frames[k] if s['phase'] == 'before']; dur = [s for s in frames[k] if s['phase'] == 'during']
        flash[k] = {'framesBefore': len(pre), 'framesDuring': len(dur), 'beforeMean': [min(s['mean'] for s in pre), max(s['mean'] for s in pre)] if pre else None, 'duringMean': [min(s['mean'] for s in dur), max(s['mean'] for s in dur)] if dur else None,
                    'beforeP99': [min(s['p99'] for s in pre), max(s['p99'] for s in pre)] if pre else None, 'duringP99': [min(s['p99'] for s in dur), max(s['p99'] for s in dur)] if dur else None,
                    'beforeLit': [min(s['lit'] for s in pre), max(s['lit'] for s in pre)] if pre else None, 'duringLit': [min(s['lit'] for s in dur), max(s['lit'] for s in dur)] if dur else None,
                    'ok': len(pre) >= 2 and len(dur) >= 3 and max(s['mean'] for s in dur) <= max(s['mean'] for s in pre) + .3 and max(s['lit'] for s in dur) <= max(s['lit'] for s in pre) + .002}
    ctl = [s for s in frames['bob'] if s['phase'] == 'control' and s['t'] >= tL + .4]
    flash['control'] = {'bobLightOnFrames': len(ctl), 'mean': [min(s['mean'] for s in ctl), max(s['mean'] for s in ctl)] if ctl else None, 'lit': [min(s['lit'] for s in ctl), max(s['lit'] for s in ctl)] if ctl else None,
                        'seen': bool(ctl) and bool(flash['bob']['beforeMean']) and max(s['mean'] for s in ctl) > flash['bob']['beforeMean'][1] + .3 and max(s['lit'] for s in ctl) > flash['bob']['beforeLit'][1] + .002}
    R['flash'] = flash
    chk('flash: no light from the blast on the spectator\'s screen (same room) or on Carol\'s (behind the wall): no frame during it brighter than the brightest before (mean grey +0.3, lit share +0.2 points); the control - Bob then switches his own light on - is seen by the same measure',
        flash['bob']['ok'] and flash['carol']['ok'] and flash['control']['seen'], flash)
    cam = {}
    for k in ('bob', 'carol'):
        rr = rows[k] or []; xs = [r[1] for r in rr]; ys = [r[2] for r in rr]; zs = [r[4] for r in rr if r[4] is not None]
        cam[k] = {'frames': len(rr), 'moved': round(max(xs) - min(xs) + max(ys) - min(ys), 2) if rr else None, 'deathCamera': any(r[3] for r in rr), 'zoom': [min(zs), max(zs)] if zs else None}
    ra = [r for r in (rows['alice'] or []) if r[0] >= t0 - .2]; menuAt = next((r[0] for r in ra if r[5]), None); upto = [r for r in ra if menuAt is None or r[0] < menuAt]
    cam['alice'] = {'frames': len(upto), 'moved': round(max(r[1] for r in upto) - min(r[1] for r in upto) + max(r[2] for r in upto) - min(r[2] for r in upto), 2) if upto else None,
                    'deathCamera': any(r[3] for r in ra), 'menuAfterS': round(menuAt - tOk, 2) if menuAt else None}
    R['camera'] = cam
    chk('camera: no camera jump - Bob\'s and Carol\'s players never move, no death camera, the zoom stays; Alice stays exactly where she pressed until her run menu, with no death camera',
        all(cam[k]['frames'] > 3 and cam[k]['moved'] is not None and cam[k]['moved'] <= .5 and not cam[k]['deathCamera'] and (k == 'alice' or cam[k]['zoom'] is None or cam[k]['zoom'][1] - cam[k]['zoom'][0] < .001) for k in cam) and cam['alice']['menuAfterS'] is not None, cam)
    au = R['audio']; ab = lambda k: (au.get(k) or {}).get('boom') or []
    R['sound'] = {k: ab(k) for k in au}
    chk('sound: the muted spectator makes no sound for the blast (the blast asks once; 0 audio nodes); Alice\'s own page does (the control: sound on, audio running)',
        len(ab('bob')) == 1 and ab('bob')[0]['nodes'] == 0 and not ab('bob')[0]['err'] and len(ab('alice')) == 1 and ab('alice')[0]['nodes'] > 0 and ab('alice')[0]['state'] == 'running', R['sound'])
    chk('sound: Carol\'s page, never given permission, plays the blast with its audio not running, and nothing throws',
        played['carol'] and af['carol']['audio'] != 'running' and all(not x['err'] for x in ab('carol')), {'carol': ab('carol'), 'audio': af['carol']['audio']})
    R['errors'] = errs[:30]
    chk('errors: no page error on any page', not [e for e in errs if 'pageerror' in e], errs[:10])
    R['ok'] = all(c['ok'] for c in R['checks']); R['passed'] = sum(c['ok'] for c in R['checks']); R['total'] = len(R['checks'])
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    for c in R['checks']: print(('PASS ' if c['ok'] else 'FAIL ') + c['name'] + '  ' + json.dumps(c['info'])[:400])
    print(f"{R['passed']}/{R['total']} checks passed"); sys.exit(0 if R['ok'] else 1)


asyncio.run(main())
