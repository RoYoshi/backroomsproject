#!/usr/bin/env python3
"""Stage 3D HQ1 - a dead wanderer's light failing, on three screens, timed and photographed (development only; SwiftShader)

  python3 -I dev/stage-3d-hq1/light_timeline.py --game DIR --out DIR [--variant hound-A] [--kind flashlight] [--lo 1]
                                                 [--labpause 1] [--late 30] [--query lighting=legacy] [--tag NAME]

Alice (admin; the victim; her light KIND, on or off at death) dies in an open room through the Death Lab; Bob (god mode, his own light
off) watches from 150 px; the ceiling lamps are out (blackout), so the dead light is the only light.  Carol joins LATE seconds after
the death (a late joiner: she gets the corpse only).

Every page records, every frame (an in-page sampler, no screenshots, so nothing slows it): the epoch time, the power of the victim's
own dying light (window.__deathLight.own), every dead light the page hands its lighting (window.__peerLights entries with pw) and how
many living lights it has.  The death light's anchor on each page (the moment its light was let go, on that page's clock) comes from
window.__deathLight.debug(); with each page's epoch it gives the moment the light goes off for good, compared across the three pages
and with the server's (the corpse record: its age 'ag' and the release time relative to its making, lf[3]).

  1  the death, with the Death Lab PAUSED on Alice's and Bob's screens from before it starts (--labpause 1): both hold the death's first
     frame, the light still in her hand; their pictures stop, the light's clock does not.  Real-time pictures at once (lit) and after
     the light's end (dark): the same held frame.  Then both are stepped to the same physical moment, release + 0.3 s, and stay there
  2  still paused: the FROZEN-CLOCK sequence (window.__deathLightNow, a test hook: the light's clock set to release + k on each page,
     a picture of each screen) through the hold, the failure and the end: the victim's own dying beam and the spectator's replay
  3  the lab released, the death ends, Alice is stood up (the lab's auto-revive, or the same revive from the admin panel when the
     paused lab outlasted it) and put back a step behind where she died, god mode, her own light off; Carol joins
  4  the frozen-clock sequence again on the corpse: Alice's own corpse, Bob's and Carol's copies of the server's; and a 0.1 s
     flicker strip on Bob's screen
  5  a survivor's light: Bob switches his own light on; Alice's and Carol's screens show it as before (a living light has no pw)
Real-time pictures: lit (release + 1 s), dark (after the end, still paused), and the corpse once Carol is in (30 s or more after the
death: the spectator's and the late joiner's screens).
At every picture: the power each page gives the light, what light.js samples 40 px in front of the lens, BR-RoLE's own probe and the
light it put in its buffer there (BR-RoLE on), and the screen's brightness around that point (any renderer, the game's own included).
Writes OUT/TAG.json, the pictures, TAG_sequence.jpg (frozen clock), TAG_strip.jpg (flicker) and TAG_realtime.jpg."""
import os, sys, asyncio, argparse, time, json, math, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hq1lib as L
from PIL import Image, ImageDraw, ImageStat
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=L.REPO); ap.add_argument('--out', required=True); ap.add_argument('--variant', default='hound-A')
ap.add_argument('--kind', default='flashlight'); ap.add_argument('--lo', type=int, default=1); ap.add_argument('--labpause', type=int, default=1)
ap.add_argument('--late', type=float, default=30); ap.add_argument('--tag', default=''); ap.add_argument('--query', default=''); ap.add_argument('--strip', type=int, default=1)
ap.add_argument('--reanalyse', default='', help='a TAG.json this tool wrote: its checks and sheets made again from what it recorded (no browser)')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game); os.makedirs(A_.out, exist_ok=True)
W, H = 960, 640
KIND, VAR = A_.variant.split('-')
TAG = A_.tag or f'{A_.variant}_{A_.kind}_{"on" if A_.lo else "off"}'
HOOK = """()=>{ if(!window.__camWrapped){ const o=window.__mp; window.__mp=a=>{ window.__cam0=a; return o&&o(a) }; window.__camWrapped=1 } }"""
NOCARD = "()=>{ if(!document.getElementById('hq1nocard')){ const s=document.createElement('style'); s.id='hq1nocard'; s.textContent='#caught{display:none!important}'; document.head.appendChild(s) } }"
SAMPLER = r"""()=>{ if(window.__hq1s) return 'already'; const S=window.__hq1s={rows:[]};
  const tick=()=>{ try{ const A=window.__api, d=A&&A.death&&A.death(), act=!!(d&&d.active), pl=window.__peerLights||[], dead=[]; let live=0;
      for(const p of pl){ if(!p) continue; if(p.pw!=null) dead.push([+(+p.pw).toFixed(4),p.kind]); else if(p.on&&!p.dead) live++ }
      const own=act&&window.__deathLight?+(+window.__deathLight.own()).toFixed(4):null;
      S.rows.push([+(Date.now()/1000).toFixed(3),own,dead,live,act?1:0,window.__deathLightNow?1:0]); if(S.rows.length>40000) S.rows.splice(0,10000) }catch(e){ S.err=String(e) }
    requestAnimationFrame(tick) };
  requestAnimationFrame(tick); return 'ok' }"""
ROWS = "()=>window.__hq1s?window.__hq1s.rows:null"
DEBUG = "()=>window.__deathLight&&window.__deathLight.debug?window.__deathLight.debug():null"
FREEZE = "(v)=>{ if(v==null){ delete window.__deathLightNow; return null } window.__deathLightNow=()=>v; return v }"
REL = """()=>{ const d=__api.death(), S=d&&d.ph; if(!S) return null; const hl=S.ctx&&S.ctx.eqKind==='headlamp'; return { t:+d.elapsed.toFixed(3), rel: hl ? 0 : (S.eqAt>=0 ? +S.eqAt.toFixed(4) : null), kind:S.ctx&&S.ctx.eqKind, active:d.active } }"""
LENS = """()=>{ const A=__api, d=A.death(), out={};
  if(d&&d.active&&d.torch) out.own=[d.torch.x,d.torch.y,d.torch.angle||0];
  const p=(window.__peerLights||[]).find(p=>p&&p.pw!=null); if(p) out.peer=[p.x,p.y,p.angle||0];
  const f=(window.__fxs||[]).find(f=>f.jl&&!f.gone&&f.jl.torch); if(f) out.replay=[f.jl.torch.x,f.jl.torch.y,f.jl.torch.angle||0];
  const LEN=(window.__dphys&&window.__dphys.LEN)||{}, b=(A.bodyList()||[]).find(b=>b.cause!=='Vanish'&&b.dropped);
  if(b){ const a=b.hands?b.dropped.angle-Math.PI/2:b.dropped.angle, l=b.hands?LEN[b.equipment.kind]||0:0; out.body=[b.dropped.x+Math.cos(a)*l, b.dropped.y+Math.sin(a)*l, a] }
  return out }"""
STATE = """(probe)=>{ const A=__api, d=A.death(), o={}, DL=window.__deathLight;
  o.active=!!(d&&d.active); o.own=o.active&&DL?+(+DL.own()).toFixed(4):null;
  o.dead=(window.__peerLights||[]).filter(p=>p&&p.pw!=null).map(p=>({x:Math.round(p.x),y:Math.round(p.y),kind:p.kind,pw:+(+p.pw).toFixed(4)}));
  o.living=(window.__peerLights||[]).filter(p=>p&&p.pw==null&&p.on&&!p.dead).map(p=>({x:Math.round(p.x),y:Math.round(p.y),kind:p.kind}));
  if(probe){ const Lj=window.__light; if(Lj&&Lj.sample){ const s=Lj.sample(probe[0],probe[1],!!A.lightOn()); o.lightjs={torch:+s.torch.toFixed(4),peers:+s.peers.toFixed(4),direct:+s.direct.toFixed(4)} }
    const B=window.__brRole; if(B&&B.on()){ const p=B.probe(probe[0],probe[1]); o.br=p?{total:+p.total.toFixed(4),carried:p.carried.map(c=>[c.own?1:0,+c.light.toFixed(4)])}:null; const v=B.dev&&B.dev.light?B.dev.light([probe]):null; o.buffer=v?v[0]:null; const st=B.stats(); o.brCarried=st.carried.last; o.ir=st.ir }
    else o.br=null }
  o.cam=window.__cam0?[window.__cam0.sc,window.__cam0.cam.x,window.__cam0.cam.y]:null; return o }"""


def git_head(game):
    try:
        h = subprocess.run(['git', '-C', game, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
        if not h: return 'export'
        dirty = subprocess.run(['git', '-C', game, 'status', '--porcelain', '--untracked-files=no'], capture_output=True, text=True).stdout.strip()
        return h + ('+working-tree' if dirty else '')                     # (a checkpoint's evidence is made on its tree before its commit)
    except Exception: return 'export'


def ahead(lens, k=40):
    return None if not lens else [lens[0] + math.cos(lens[2]) * k, lens[1] + math.sin(lens[2]) * k]


def lum(path, pt, cam, r=14):
    """the screen's mean brightness (0-255) in a (2r)^2 box around world point pt, and around the lens itself"""
    if not pt or not cam: return None
    sc, cx, cy = cam; x, y = W / 2 + (pt[0] - cx) * sc, H / 2 + (pt[1] - cy) * sc
    im = Image.open(path).convert('L'); b = (int(x - r), int(y - r), int(x + r), int(y + r))
    if b[2] <= 0 or b[3] <= 0 or b[0] >= W or b[1] >= H: return None
    return round(ImageStat.Stat(im.crop((max(0, b[0]), max(0, b[1]), min(W, b[2]), min(H, b[3])))).mean[0], 2)


async def measure(P, name, who, lens, R):
    await P.evaluate(NOCARD)
    probe = ahead(lens); st = await P.evaluate(STATE, probe)
    fn = os.path.join(A_.out, f'{TAG}_{name}_{who}.png'); await P.screenshot(path=fn)
    st['file'] = os.path.basename(fn); st['at'] = round(time.time() - R['t0wall'], 3); st['probe'] = probe; st['lens'] = lens
    st['lum'] = lum(fn, probe, st.get('cam')); st['lumLens'] = lum(fn, lens[:2] if lens else None, st.get('cam'), 10)
    return st


async def lens_of(P, prefer):
    v = await P.evaluate(LENS)
    for k in prefer:
        if v.get(k): return v[k]
    return None


def anchor_of(dbg, de):
    if not dbg: return None
    for k, v in dbg['anchors']:
        if str(k) == str(de): return {'anchor': v, 'epoch': dbg['epoch'], 'anchorEpoch': round(dbg['epoch'] + v, 4)}
    return None


async def main():
    port = L.free_port(); srv = L.start_server(A_.game, port, os.path.join(A_.out, f'{TAG}_server.log')); errs = []
    obsFile = os.path.join(A_.out, f'{TAG}_observer.json')                  # the reference clock: a quiet WebSocket observer in the same room
    obs = subprocess.Popen(['node', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ws_observer.js'), '--port', str(port), '--room', 'hq1lt', '--out', obsFile], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    R = {'tool': 'dev/stage-3d-hq1/light_timeline.py', 'game': A_.game, 'commit': git_head(A_.game), 'variant': A_.variant, 'kind': A_.kind, 'lightOnAtDeath': bool(A_.lo),
         'labPause': bool(A_.labpause), 'query': A_.query, 'renderer': 'SwiftShader (Chromium software GL), 960x640', 'when': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'realtime': {}, 'frozen': {}, 'checks': []}
    def check(name, ok, info): R['checks'].append({'name': name, 'ok': bool(ok), 'info': info}); print(('PASS ' if ok else 'FAIL ') + name + '  ' + json.dumps(info)[:400], flush=True)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS)
            ca, cb, cc = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(3)]
            await ca.add_init_script(f"try{{localStorage.setItem('wanderer-light', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wanderer-light')||'{{}}'),{{kind:'{A_.kind}'}})))}}catch(e){{}}")
            Q = ('&' + A_.query) if A_.query else ''
            A = await L.join(ca, port, 'hq1lt', 'Alice', errs, Q); await L.admin_open(A)
            B = await L.join(cb, port, 'hq1lt', 'Bob', errs, Q)
            C = await L.prejoin(cc, port, 'hq1lt', 'Carol', errs, Q)
            bid = await B.evaluate("()=>__api.H.id"); await L.admin_cmd(A, {'c': 'god', 'id': bid}); await A.wait_for_timeout(300)
            await L.admin_cmd(A, {'c': 'blackout', 'mode': 'on'}); await A.wait_for_timeout(1500)
            await L.clear_monsters(A); await L.ensure_alive(A); await L.auto_revive(A, True)
            for P in (A, B): await P.evaluate(HOOK)
            R['equipment'] = await A.evaluate("()=>__api.H.equipment.kind")
            R['lighting'] = await A.evaluate("()=>window.__brRole?{on:window.__brRole.on(), quality:window.__brRole.quality(), legacy:window.__brRole.stats().legacy}:null")
            spot = await A.evaluate(L.lib3d.SPOTS, 'open'); R['spot'] = spot
            await L.place(A, spot[0], spot[1], spot[2], W, H)
            wb = await B.evaluate(L.lib3d.WATCH_FROM, spot); await L.place(B, wb[0], wb[1], wb[2], W, H); R['viewer'] = wb
            if await B.evaluate("()=>__api.lightOn()"): await B.keyboard.press('KeyF')
            if bool(await A.evaluate("()=>__api.lightOn()")) != bool(A_.lo): await A.keyboard.press('KeyF')
            await A.wait_for_timeout(2500)
            R['lightOnBefore'] = {'victim': await A.evaluate("()=>__api.lightOn()"), 'spectator': await B.evaluate("()=>__api.lightOn()")}
            for P in (A, B): await P.evaluate(SAMPLER)
            await L.clear_monsters(A); await L.ensure_alive(A)
            if A_.labpause:
                for P in (A, B): await L.lab(P, True, True)                       # the Death Lab paused on both screens before the death: their pictures are
            ok = await L.preview(A, KIND, VAR); R['previewOk'] = ok               # stepped to the same physical moment; the light's clock never stops
            if not ok: raise SystemExit('preview refused: ' + L.lib3d.last_preview(os.path.join(A_.out, f'{TAG}_server.log')))
            T0 = time.time(); R['t0wall'] = T0
            for _ in range(200):                                                  # the spectator's replay has begun (a busy page may take a while)
                if await B.evaluate(L.SPEC): break
                await B.wait_for_timeout(100)
            # ---- 1: real time, both screens held at the death's first frame by the paused lab: lit now, dark after the light's end
            lensA0 = await lens_of(A, ['own']); lensB0 = await lens_of(B, ['replay', 'peer'])
            R['realtime']['lit'] = {'victim': await measure(A, 'rt_lit', 'victim', lensA0, R), 'spectator': await measure(B, 'rt_lit', 'spectator', lensB0, R)}
            dbg0 = await A.evaluate(DEBUG); de0 = dbg0['own']['de'] if dbg0 and dbg0.get('own') else None; lf0 = dbg0['own']['lf'] if dbg0 and dbg0.get('own') else None
            an0 = anchor_of(dbg0, de0); h0, f0 = (lf0[0], lf0[1]) if lf0 else (5.0, 1.5)
            endEpoch = (an0['anchorEpoch'] if an0 else T0 + 1.7) + h0 + f0
            while time.time() < endEpoch + 1.0: await A.wait_for_timeout(50)
            R['realtime']['dark'] = {'victim': await measure(A, 'rt_dark', 'victim', lensA0, R), 'spectator': await measure(B, 'rt_dark', 'spectator', lensB0, R)}
            rel, t = None, 0.0
            while t < 2.4:                                                        # step the victim's death until its physics lets the light go, then 0.3 s more
                if A_.labpause: t = round(t + .15, 2); await L.step_to(A, L.DSTATE, t)
                else: await A.wait_for_timeout(100)
                r = await A.evaluate(REL)
                if r and r['rel'] is not None: rel = r; break
            T = round((rel['rel'] if rel else 0) + .3, 2)
            if A_.labpause: await L.step_to(A, L.DSTATE, T); await L.step_to(B, L.SPEC, T); await A.wait_for_timeout(600)
            R['release'] = rel; R['steppedTo'] = T if A_.labpause else None
            dbgA = await A.evaluate(DEBUG); de = dbgA['own']['de'] if dbgA and dbgA.get('own') else None; R['de'] = de
            lf = dbgA['own']['lf'] if dbgA and dbgA.get('own') else None; R['lf'] = lf
            lensA = await lens_of(A, ['own']); lensB = await lens_of(B, ['replay', 'peer'])
            R['lens'] = {'victim': lensA, 'spectator': lensB}
            hold, fade = (lf[0], lf[1]) if lf else (5.0, 1.5)
            R['anchorsDeath'] = {'victim': anchor_of(await A.evaluate(DEBUG), de), 'spectator': anchor_of(await B.evaluate(DEBUG), de)}
            # ---- 2: frozen clock, still in the death (victim: her dying beam; spectator: the replay)
            ks = sorted(set([.5, 1.5, 3.0, 7.0, round(hold - .05, 3), round(hold + .02, 3), round(hold + fade * .25, 3), round(hold + fade * .5, 3), round(hold + fade * .75, 3), round(hold + fade - .03, 3), round(hold + fade, 3), round(hold + fade + 30, 3)]))
            R['ks'] = ks
            async def frozen(pages, phase, lenses):
                an = {who: anchor_of(await P.evaluate(DEBUG), de) for who, P in pages}; rows = []
                for k in ks:
                    for who, P in pages:                                          # (the end and after: 0.1 ms on, the anchor being read to 0.1 ms)
                        if an[who]: await P.evaluate(FREEZE, an[who]['anchor'] + k + (1e-4 if k >= hold + fade - 1e-9 else 0))
                    await pages[0][1].wait_for_timeout(450); row = {'k': k}
                    for who, P in pages: row[who] = await measure(P, f'{phase}_k{k:06.2f}', who, lenses[who], R)
                    rows.append(row); print(json.dumps({'phase': phase, 'k': k, **{w: (row[w]['own'], [d['pw'] for d in row[w]['dead']], row[w].get('buffer'), row[w].get('lum')) for w, _ in pages}}), flush=True)
                for who, P in pages: await P.evaluate(FREEZE, None)
                return {'anchors': an, 'rows': rows}
            if A_.labpause and de is not None:
                R['frozen']['death'] = await frozen([('victim', A), ('spectator', B)], 'death', {'victim': lensA, 'spectator': lensB})
            # ---- 3: the death ends; Alice stands up; Carol joins
            if A_.labpause:
                for P in (A, B): await L.lab(P, False, False)
            t1 = time.time(); revived = None
            while time.time() - t1 < 25:
                if await A.evaluate("()=>!__api.G.caught && __api.fall()<0") and await B.evaluate(L.BODIES): break
                if revived is None and time.time() - t1 > 4 and await A.evaluate("()=>__api.G.caught && __api.death().finished"):
                    # the lab's AUTO-REVIVE gives up 60 s after the preview (the paused lab outlasts it): the same revive, from the admin panel
                    await L.admin_cmd(A, {'c': 'revive', 'id': await A.evaluate("()=>__api.H.id")}); revived = round(time.time() - T0, 1)
                await A.wait_for_timeout(200)
            R['victimRevived'] = {'byAdminCommandAt': revived, 'up': await A.evaluate("()=>!__api.G.caught && __api.fall()<0"), 'deathActive': await A.evaluate("()=>__api.death().active")}
            await L.admin_cmd(A, {'c': 'god', 'id': await A.evaluate("()=>__api.H.id")}); await L.clear_monsters(A)          # (harness: nothing kills her again)
            R['victimBack'] = await L.place(A, spot[0] - math.cos(spot[2]) * 80, spot[1] - math.sin(spot[2]) * 80, spot[2], W, H)   # back where she died, a step behind it
            if await A.evaluate("()=>__api.lightOn()"): await A.keyboard.press('KeyF')
            wait = A_.late - (time.time() - T0)
            if wait > 0: await A.wait_for_timeout(int(wait * 1000))
            R['lateJoinAt'] = round(time.time() - T0, 1)
            await L.enter(C); await C.evaluate(HOOK); await C.evaluate(SAMPLER); await C.wait_for_timeout(1500)
            await L.admin_cmd(A, {'c': 'god', 'id': await C.evaluate("()=>__api.H.id")})
            R['lateJoinPlaced'] = await L.place(C, wb[0], wb[1], wb[2], W, H)
            if await C.evaluate("()=>__api.lightOn()"): await C.keyboard.press('KeyF')
            await C.wait_for_timeout(2500)
            R['bodies'] = {'victim': await A.evaluate(L.BODIES), 'spectator': await B.evaluate(L.BODIES), 'late': await C.evaluate(L.BODIES)}
            dbg = {'victim': await A.evaluate(DEBUG), 'spectator': await B.evaluate(DEBUG), 'late': await C.evaluate(DEBUG)}
            R['anchors'] = {w: anchor_of(dbg[w], de) for w in dbg}
            R['clockAtCorpse'] = {w: {'off': (dbg[w] or {}).get('off'), 'srv': [q for q in ((dbg[w] or {}).get('srv') or []) if str(q[0]) == str(de)], 'epoch': (dbg[w] or {}).get('epoch')} for w in dbg}
            # the server's own: the corpse record's age and release (Bob's copy, as received)
            srvB = await B.evaluate("(de)=>{ const b=(__api.bodyList()||[]).find(b=>b.remote&&b.de===de); return b?{born:b.born, lf:b.lf||null, epoch:Date.now()/1000-performance.now()/1000}:null }", de)
            R['serverCorpse'] = srvB
            lensC = await lens_of(C, ['body']); lensBb = await lens_of(B, ['body']); lensAb = await lens_of(A, ['body'])
            # real time, the corpse 30 s and more after the death: the spectator's and the late joiner's screens (D7: still lit; HQ1: off for good)
            R['realtime']['corpse'] = {'spectator': await measure(B, 'rt_corpse', 'spectator', lensBb, R), 'late': await measure(C, 'rt_corpse', 'late', lensC, R)}
            # ---- 4: frozen clock on the corpse (all three), and a 0.1 s flicker strip on Bob's screen
            if de is not None:
                R['frozen']['corpse'] = await frozen([('victim', A), ('spectator', B), ('late', C)], 'corpse', {'victim': lensAb, 'spectator': lensBb, 'late': lensC})
                if A_.strip and lf:
                    anB = anchor_of(await B.evaluate(DEBUG), de); strip = []
                    k = round(hold - .2, 2)
                    while k <= hold + fade + .2001:
                        await B.evaluate(FREEZE, anB['anchor'] + k); await B.wait_for_timeout(260)
                        st = await measure(B, f'strip_k{k:06.2f}', 'spectator', lensBb, R); st['k'] = k; strip.append(st); k = round(k + .1, 2)
                    await B.evaluate(FREEZE, None); R['strip'] = strip
            # ---- 5: a survivor's light
            await B.keyboard.press('KeyF'); await B.wait_for_timeout(2500)
            bl = await B.evaluate("()=>[__api.H.x+Math.cos(__api.H.angle)*70, __api.H.y+Math.sin(__api.H.angle)*70, __api.H.angle]")
            R['survivor'] = {'bobLightOn': await B.evaluate("()=>__api.lightOn()"), 'victim': await measure(A, 'survivor', 'victim', [bl[0] - math.cos(bl[2]) * 40, bl[1] - math.sin(bl[2]) * 40, bl[2]], R),
                             'late': await measure(C, 'survivor', 'late', [bl[0] - math.cos(bl[2]) * 40, bl[1] - math.sin(bl[2]) * 40, bl[2]], R)}
            await B.keyboard.press('KeyF')
            R['samples'] = {'victim': await A.evaluate(ROWS), 'spectator': await B.evaluate(ROWS), 'late': await C.evaluate(ROWS)}
            await b.close()
    finally:
        try: obs.terminate(); obs.wait(10)
        except Exception: pass
        L.stop_server(srv)
    R['errors'] = errs[:20]
    try: R['observer'] = json.load(open(obsFile))
    except Exception as e: R['observer'] = {'error': str(e)}
    analyse(R)
    L.dump(os.path.join(A_.out, f'{TAG}.json'), R)
    sheets(R)
    print(('LIGHT TIMELINE OK ' if R['ok'] else 'LIGHT TIMELINE NOT OK ') + TAG); sys.exit(0 if R['ok'] else 1)


def analyse(R):
    """the checks (gates L4, L5 and the lab-pause part of L6) from what the run recorded"""
    def check(name, ok, info): R['checks'].append({'name': name, 'ok': bool(ok), 'info': info}); print(('PASS ' if ok else 'FAIL ') + name + '  ' + json.dumps(info)[:500], flush=True)
    lit = bool(A_.lo) and A_.kind != 'camcorder'; lf = R.get('lf')
    S = R.get('samples') or {}
    S = {w: [r for r in (rows or []) if not (len(r) > 5 and r[5])] for w, rows in S.items()}      # frames drawn with the test's frozen light clock are not real time
    deadPw = {w: [(r[0], max([d[0] for d in r[2]] or [0])) for r in (S.get(w) or [])] for w in ('victim', 'spectator', 'late')}
    ownPw = [(r[0], r[1]) for r in (S.get('victim') or []) if r[1] is not None]
    vicPw = [(r[0], r[1] if r[1] is not None else max([d[0] for d in r[2]] or [0])) for r in (S.get('victim') or [])]   # her dying light, then her corpse's
    if not lit:
        anyDead = {w: sum(1 for t, v in deadPw[w] if v > 0) for w in deadPw}; anyOwn = sum(1 for t, v in ownPw if v > 0)
        rt = R['realtime']
        fzs = [(ph, w, row['k'], st) for ph, F in (R.get('frozen') or {}).items() for row in F['rows'] for w, st in row.items() if w != 'k']
        drawn = [[ph, w, k, st.get('brCarried'), st.get('buffer')] for ph, w, k, st in fzs if st['dead'] or (st.get('brCarried') or 0) > 0]
        check('L6 no light (' + ('a camcorder' if A_.kind == 'camcorder' else 'off at death') + '): no profile, no dead light on any screen in any frame, nothing drawn for it',
              lf is None and not any(anyDead.values()) and not anyOwn and not drawn,
              {'lf': lf, 'deadLightFrames': anyDead, 'ownDyingLightPowerFrames': anyOwn, 'drawnInFrozenPictures': drawn[:6], 'kind': A_.kind, 'lo': A_.lo,
               'lum': {k: {w: (v.get(w) or {}).get('lum') for w in ('victim', 'spectator')} for k, v in R['realtime'].items()}, 'ir': {k: {w: (v.get(w) or {}).get('ir') for w in ('victim', 'spectator')} for k, v in R['realtime'].items()}})
        R['ok'] = all(c['ok'] for c in R['checks']); return
    if not lf:                                                                     # a build without the profile (D7: the hold comparison's baseline)
        check('a lit light\'s death carries the server\'s failure profile', False, {'lf': lf, 'debug': 'window.__deathLight absent (a build before HQ1)' if not any((R.get('anchors') or {}).values()) else 'present'})
        R['ok'] = False; return
    hold, fade = lf[0], lf[1]
    an = R.get('anchors') or {}; ad = R.get('anchorsDeath') or {}
    offs = {w: round(an[w]['anchorEpoch'] + hold + fade, 4) for w in an if an.get(w)}
    # the server's own moment, on the server's clock (its snapshot clock st): the corpse record's release (st of its pass - its age + its
    # release relative to its making) and the kill (st of the pass that sent the kill record / replay) + the physics' release; each page's
    # anchor put on the server's clock with that page's snapshot offset (net-interp NET.off)
    # the reference: the observer (a WebSocket client doing nothing else, same machine clock): the replay's arrival - el + the physics'
    # release, and the corpse record's arrival - its age + its release relative to its making; the earlier of the two
    O = R.get('observer') or {}; relP = (R.get('release') or {}).get('rel'); de = R.get('de')
    fx = [f for f in O.get('fx') or [] if f.get('de') == de]; bd = [(m['at'], b) for m in O.get('bodies') or [] for b in m['b'] if b.get('de') == de and b.get('lf') and b.get('ag') is not None]
    refK = round(fx[0]['at'] - (fx[0]['el'] or 0) + relP, 4) if fx and relP is not None else None
    refC = round(min(at - b['ag'] + b['lf'][3] for at, b in bd), 4) if bd else None
    ref = min([v for v in (refK, refC) if v is not None] or [None]) if (refK or refC) else None
    vsRef = {w: round((an[w]['anchorEpoch'] - ref) * 1000, 1) for w in an if an.get(w)} if ref else {}
    ck = R.get('clockAtCorpse') or {}
    rs = [q[2] for w in ck for q in ck[w]['srv'] if q[2] is not None]; ks = [q[1] for w in ck for q in ck[w]['srv'] if q[1] is not None]
    srvRel = {'fromCorpse': round(min(rs), 4) if rs else None, 'fromKill': round(min(ks) + relP, 4) if ks and relP is not None else None}
    onSrv = {w: round(an[w]['anchor'] + ck[w]['off'], 4) for w in an if an.get(w) and ck.get(w) and ck[w].get('off') is not None}
    allOff = list(offs.values())
    R['offMoments'] = {'pages': offs, 'spreadMs': round((max(allOff) - min(allOff)) * 1000, 1) if len(allOff) > 1 else None,
                       'reference': {'fromReplay': refK, 'fromCorpse': refC, 'used': ref, 'end': round(ref + hold + fade, 4) if ref else None}, 'pageMinusReferenceMs': vsRef,
                       'serverClock': {'release': srvRel, 'pagesOnIt': onSrv, 'note': 'the snapshot clock runs a little slow when the server is starved; informative only'}}
    check('L4 parity: victim, spectator and late joiner put the light\'s end within 150 ms of each other and of the reference (a quiet observer of the server\'s messages)',
          len(offs) == 3 and R['offMoments']['spreadMs'] is not None and R['offMoments']['spreadMs'] <= 150 and len(vsRef) == 3 and all(abs(v) <= 150 for v in vsRef.values()), R['offMoments'])
    same = all(ad.get(w) and an.get(w) and -.0015 <= ad[w]['anchorEpoch'] - an[w]['anchorEpoch'] <= .15 for w in ('victim', 'spectator'))
    check('L6 one timeline per death: the corpse keeps the death\'s timeline (its anchor never later; earlier only by better server timing, under 150 ms)', same,
          {'death': ad, 'corpse': {w: an.get(w) for w in ('victim', 'spectator')}, 'movedMs': {w: round((ad[w]['anchorEpoch'] - an[w]['anchorEpoch']) * 1000, 1) for w in ('victim', 'spectator') if ad.get(w) and an.get(w)}})
    # what the frames show (real time; the lab paused on the victim's and spectator's screens when --labpause): lit up to the end, then 0 for good
    obs = {}
    for w, rows in (('victim', vicPw), ('spectator', deadPw['spectator']), ('late', deadPw['late'])):
        off = offs.get(w)
        if not off or not rows: obs[w] = None; continue
        litTs = [t for t, v in rows if v > 0]; lastOn = max(litTs) if litTs else None
        after = [v for t, v in rows if t > off + .05]
        shown = [t for t, v in rows if v > 0]; first = min(shown) if shown else None          # (before its death is on this page, nothing of it is shown yet)
        fullBeforeHold = [v for t, v in rows if t < off - fade - .05 and t > off - fade - hold + .3 and first is not None and t >= first]
        obs[w] = {'off': off, 'lastLitFrame': lastOn, 'lastLitBeforeOffMs': None if lastOn is None else round((off - lastOn) * 1000, 1), 'framesAfterOff': len(after), 'litFramesAfterOff': sum(1 for v in after if v > 0),
                  'firstShown': first, 'holdFrames': len(fullBeforeHold), 'holdFramesNotFull': sum(1 for v in fullBeforeHold if v != 1)}
    R['observed'] = obs
    okObs = all(obs.get(w) is None or (obs[w]['litFramesAfterOff'] == 0 and (obs[w]['lastLitFrame'] is None or obs[w]['lastLitFrame'] <= obs[w]['off'] + .001) and obs[w]['holdFramesNotFull'] == 0) for w in obs) and obs.get('victim') and obs.get('spectator')
    check('L5/L6 every frame: full through the hold, never lit after the end' + (' (the Death Lab paused on the victim\'s and spectator\'s screens throughout)' if A_.labpause else ''), okObs, obs)
    # frozen-clock checks: power from the renderers' inputs, and what they drew
    import importlib
    fz = R.get('frozen') or {}; bad = []; R['ambientLum'] = {}
    for phase, F in fz.items():
        amb = {w: min([row[w]['lum'] for row in F['rows'] if w in row and row[w].get('lum') is not None] or [None]) for w in ('victim', 'spectator', 'late')}
        R['ambientLum'][phase] = amb
        for row in F['rows']:
            k = row['k']
            for w, st in row.items():
                if w == 'k': continue
                pw = st['own'] if (phase == 'death' and w == 'victim') else (max([d['pw'] for d in st['dead']]) if st['dead'] else 0)
                if k >= hold + fade - 1e-9:
                    if pw != 0: bad.append([phase, w, k, 'power', pw])
                    if st['dead']: bad.append([phase, w, k, 'peer entry after the end', st['dead']])
                    if st.get('buffer') not in (None, 0, 0.0) and st['buffer'] > .02: bad.append([phase, w, k, 'BR-RoLE buffer', st['buffer']])
                    if st.get('lightjs') and (st['lightjs']['peers'] > 0 or (phase == 'death' and w == 'victim' and st['lightjs']['torch'] > 0)): bad.append([phase, w, k, 'light.js', st['lightjs']])
                    if st.get('lum') is not None and amb.get(w) is not None and st['lum'] > amb[w] + 3: bad.append([phase, w, k, 'screen brightness over the darkest picture', st['lum'], amb[w]])
                elif k < hold - 1e-9:
                    if pw != 1: bad.append([phase, w, k, 'power in the hold', pw])
                    if st.get('lum') is not None and amb.get(w) is not None and (st['lum'] < amb[w] + 5 or st['lum'] < amb[w] * 2): bad.append([phase, w, k, 'not visibly lit in the hold', st['lum'], amb[w]])
    R['frozenBad'] = bad
    check('L5 frozen clock: full in the hold; at and after the end no power, no peer entry, nothing in BR-RoLE\'s buffer, light.js 0, the screen dark (death and corpse, every screen)', not bad and bool(fz), {'bad': bad[:12], 'phases': list(fz)})
    sv = R.get('survivor') or {}
    okS = all(sv.get(w) and sv[w]['living'] and (sv[w].get('buffer') is None or sv[w]['buffer'] > .05) and (sv[w].get('lightjs') is None or sv[w]['lightjs']['peers'] > 0) for w in ('victim', 'late'))
    check('L5 a survivor\'s light (Bob\'s, switched on afterwards): on the other screens as a living light, lighting the floor', okS and sv.get('bobLightOn'),
          {w: {k: (sv.get(w) or {}).get(k) for k in ('living', 'buffer', 'lightjs', 'lum')} for w in ('victim', 'late')})
    R['ok'] = all(c['ok'] for c in R['checks'])


def sheets(R):
    def label(g, x, y, s): g.rectangle((x, y, x + 7 * len(s) + 8, y + 16), fill=(0, 0, 0)); g.text((x + 4, y + 2), s, fill=(255, 255, 255))
    fz = R.get('frozen') or {}
    for phase, F in fz.items():
        whos = [w for w in ('victim', 'spectator', 'late') if w in F['rows'][0]]
        sheet = Image.new('RGB', (240 * len(F['rows']), 160 * len(whos) + 30), (16, 16, 16)); g = ImageDraw.Draw(sheet)
        g.text((8, 8), f"{TAG} {R['commit'][:7]} - frozen light clock, {phase}: release + k s; hold {R['lf'][0] if R.get('lf') else '?'} s, failure {R['lf'][1] if R.get('lf') else '?'} s", fill=(230, 230, 230))
        for c, row in enumerate(F['rows']):
            for r, w in enumerate(whos):
                st = row[w]; fn = os.path.join(A_.out, st['file'])
                im = Image.open(fn).convert('RGB'); pt = st.get('probe') or (st.get('lens') or [0, 0])[:2]; cam = st.get('cam')
                if cam and pt: sc, cx, cy = cam; x, y = W / 2 + (pt[0] - cx) * sc, H / 2 + (pt[1] - cy) * sc; im = im.crop((int(x - 240), int(y - 160), int(x + 240), int(y + 160)))
                sheet.paste(im.resize((240, 160)), (c * 240, 30 + r * 160))
                pw = st['own'] if (phase == 'death' and w == 'victim') else (max([d['pw'] for d in st['dead']]) if st['dead'] else 0)
                label(g, c * 240 + 2, 32 + r * 160, f"{w} +{row['k']:.2f}s pw {pw:.2f}")
        sheet.save(os.path.join(A_.out, f'{TAG}_sequence_{phase}.jpg'), quality=88)
    if R.get('strip'):
        st0 = R['strip']; n = len(st0); cols = 8; rows = (n + cols - 1) // cols
        sheet = Image.new('RGB', (180 * cols, 120 * rows + 30), (16, 16, 16)); g = ImageDraw.Draw(sheet)
        g.text((8, 8), f"{TAG} - the failure in 0.1 s steps (spectator, frozen light clock): release + k s; end at {R['lf'][0] + R['lf'][1]:.1f}", fill=(230, 230, 230))
        for i, st in enumerate(st0):
            im = Image.open(os.path.join(A_.out, st['file'])).convert('RGB'); pt = (st.get('lens') or [0, 0])[:2]; cam = st.get('cam')
            if cam: sc, cx, cy = cam; x, y = W / 2 + (pt[0] - cx) * sc, H / 2 + (pt[1] - cy) * sc; im = im.crop((int(x - 180), int(y - 120), int(x + 180), int(y + 120)))
            sheet.paste(im.resize((180, 120)), ((i % cols) * 180, 30 + (i // cols) * 120))
            pw = max([d['pw'] for d in st['dead']]) if st['dead'] else 0
            label(g, (i % cols) * 180 + 2, 32 + (i // cols) * 120, f"+{st['k']:.1f}s pw {pw:.2f}")
        sheet.save(os.path.join(A_.out, f'{TAG}_strip.jpg'), quality=88)
    rt = R.get('realtime') or {}
    if rt:
        cols = [(k, v) for k, v in rt.items()]; sheet = Image.new('RGB', (480 * len(cols), 320 * 3 + 30), (16, 16, 16)); g = ImageDraw.Draw(sheet)
        g.text((8, 8), f"{TAG} - real time (no test clock): lit, then dark after the light's end" + (' (the Death Lab holding both screens at the death\'s first frame)' if A_.labpause else '') + '; the corpse once the late joiner is in', fill=(230, 230, 230))
        for c, (k, v) in enumerate(cols):
            for r, w in enumerate(('victim', 'spectator', 'late')):
                st = v.get(w)
                if not st: continue
                sheet.paste(Image.open(os.path.join(A_.out, st['file'])).convert('RGB').resize((480, 320)), (c * 480, 30 + r * 320))
                pw = st['own'] if st.get('own') is not None else (max([d['pw'] for d in st['dead']]) if st.get('dead') else 0)
                label(g, c * 480 + 4, 34 + r * 320, f"{w}: {k}, {st['at']} s after the preview, " + (f"power {pw:.2f}" if R.get('de') is not None else 'no failing light in this build'))
        sheet.save(os.path.join(A_.out, f'{TAG}_realtime.jpg'), quality=88)


if A_.reanalyse:
    R = json.load(open(A_.reanalyse)); TAG = os.path.basename(A_.reanalyse)[:-5]; A_.out = os.path.dirname(os.path.abspath(A_.reanalyse))
    A_.kind, A_.lo, A_.labpause = R['kind'], int(R['lightOnAtDeath']), int(R['labPause'])
    if R.get('observer') is None or 'error' in (R.get('observer') or {}):
        try: R['observer'] = json.load(open(os.path.join(A_.out, f'{TAG}_observer.json')))
        except Exception: pass
    R['checks'] = []; analyse(R); L.dump(A_.reanalyse, R); sheets(R)
    print(('LIGHT TIMELINE OK ' if R['ok'] else 'LIGHT TIMELINE NOT OK ') + TAG); sys.exit(0 if R['ok'] else 1)
asyncio.run(main())
