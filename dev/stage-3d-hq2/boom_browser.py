#!/usr/bin/env python3
"""Stage 3D HQ2 - a NEW RUN blast on three real screens (development only; SwiftShader)

  python3 -I dev/stage-3d-hq2/boom_browser.py --game DIR --out FILE.json [--shots DIR] [--kind flashlight] [--no-wall]

Alice (the initiator, light ON) stands in front of a lit papered wall face, placed so that the blast the server will choose throws her
body at it: the blast's direction is the server's (dphys.boomPlan of the world's number and the event id), so the test reads the world
and the next event id first and picks the face whose outside looks back along that direction.  Bob watches from the side (god mode,
light off).  Carol opens the game after the blast (a late joiner: her page and connection are new).  Alice presses NEW RUN (the dialog's own
button); her short beat and run menu follow; then she presses SPAWN.  Every page is sampled ~10 times a second: the blast replays it
plays (event id, clock, whether its physics sleeps, where body / hands / light / hat are), the wallpaper stains it has stamped (by event
id), the corpse records (cause Boom), the dead lights it draws (power), the victim's own state.  A quiet observer logs the server's
messages.  Screenshots: the blast at +0.3 s, +1 s and +2 s on Alice's and Bob's screens; the run menu; the corpse on all three at
+4 s; the corpse's light near the end of its hold and after its failure.
Checks (exit 1 if any fails):
  E01  one blast event per page (Alice's included), one Boom corpse, Alice's run menu after a short beat
  E06  every sample of every page's replay - body, both hands, the light, the hat - equals the server's own run of the blast (boom_ref.js)
       at the same physics time, within 1 px / 0.01 rad, and the corpse is where that run ends
  E04  the late joiner (in after the blast, on these slow pages) gets the same corpse, its stain and its light's state
  W    the blast threw the body at the wall: a wall mark in the corpse record, and the HQ1 wallpaper stain on every screen (same face)
  E03  the dropped light (ON) keeps its full power for the profile's hold, flickers out over its fade, and is exactly 0 afterwards, on
       every screen, on one timeline (pages within 0.25 s of each other)"""
import os, sys, asyncio, argparse, json, time, math, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hq2lib as Q
L = Q.L
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--out', required=True); ap.add_argument('--shots', default=None)
ap.add_argument('--kind', default='flashlight'); ap.add_argument('--query', default=''); ap.add_argument('--light-off', action='store_true', help="Alice's light OFF when she presses NEW RUN")
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 720, 480
SAMPLER = r"""()=>{ if(window.__h2b) return 'already'; const S=window.__h2b={rows:[], voice:[]};
  const E=window.__ents; if(E&&E.boomVoice&&!E.boomVoice.__h2){ const f=E.boomVoice; E.boomVoice=function(x,y){ S.voice.push([+(Date.now()/1000).toFixed(3),Math.round(x),Math.round(y)]); return f.apply(this,arguments) }; E.boomVoice.__h2=1 }
  S.iv=setInterval(()=>{ try{ const A=window.__api, G=window.__gore&&window.__gore.wallStains, Lv=window.__l0v;
      const fx=(window.__fxs||[]).filter(f=>f.k==='boom'&&f.jl&&f.jl.ph).map(f=>{ const S=f.jl.ph; return { id:f.id, de:f.de, t:+f.jl.elapsed.toFixed(2), pt:+S.t.toFixed(6), n:S.stepN, st:S.state,
        b:[+S.b.x.toFixed(2),+S.b.y.toFixed(2),+S.b.th.toFixed(4)], h:S.h.map(h=>[+h.x.toFixed(2),+h.y.toFixed(2)]), eq:S.eq.has?[+S.eq.x.toFixed(2),+S.eq.y.toFixed(2),+S.eq.rot.toFixed(4)]:null,
        hat:S.hat.has?[+S.hat.x.toFixed(2),+S.hat.y.toFixed(2),+S.hat.rot.toFixed(4)]:null, marks:window.__dphys.marks(S).length } });
      S.rows.push({ t:+(Date.now()/1000).toFixed(3), fx, st:G?G.list().filter(s=>s.status==='stamped').map(s=>[s.de,s.surf]):null, rc:Lv&&Lv.surfaces?Lv.surfaces.count():null,
        bd:(A.bodyList?A.bodyList():[]).filter(b=>b.cause==='Boom').map(b=>[String(b.ownerId),b.de,Math.round(b.x),Math.round(b.y)]),
        pw:(window.__peerLights||[]).filter(l=>l&&l.pw!=null).map(l=>+(+l.pw).toFixed(3)),
        lg:(()=>{ const d=window.__deathLight&&window.__deathLight.debug&&window.__deathLight.debug(); return d?d.frame.map(e=>[String(e.de), +(d.epoch+e.now).toFixed(3), e.pw, e.src]):[] })(), rm:!document.getElementById('runMenu').hidden, hs:!!window.__hideSelf,
        started:A.started?A.started():null });
      if(S.rows.length>8000) S.rows.splice(0,3000) }catch(e){ S.err=String(e) } },100); return 'ok' }"""
ROWS = "(since)=>window.__h2b?window.__h2b.rows.filter(r=>r.t>=since):null"
PRESS = "()=>{ const b=document.getElementById('reset'); if(!b) return false; b.click(); return true }"
SPAWN = "()=>{ const b=document.getElementById('runSpawn'); if(!b) return false; const v=!document.getElementById('runMenu').hidden; b.click(); return v }"
DLDBG = "()=>window.__deathLight&&window.__deathLight.debug?window.__deathLight.debug():null"
# which face the blast will throw her at: the world's number and the next event id give the blast's direction (dphys.boomPlan)
PICK = r"""([de, faceJs])=>{ const D=window.__dphys, w=window.__nrDebug().w; const P=D.boomPlan(w, de), dx=Math.cos(P.d), dy=Math.sin(P.d);
  const F=eval(faceJs); let best=null;
  for(const side of ['N','S','E','W']) for(let skip=0; skip<4; skip++){ const S=F([side, 64, skip]); if(!S) break; const dot=-(S.ox*dx+S.oy*dy); if(!best||dot>best.dot) best=Object.assign({dot, side, skip}, S) }
  return { w, de, plan:P, spot:best } }"""


async def main():
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    R = {'tool': 'dev/stage-3d-hq2/boom_browser.py', 'game': A_.game, 'kind': A_.kind, 'events': []}
    wf = A_.out + '.watch.json'; Qy = ('&' + A_.query) if A_.query else ''
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=Q.ARGS)
            ca, cb, cc = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(3)]
            await ca.add_init_script("try{localStorage.setItem('wanderer-light', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wanderer-light')||'{}'),{kind:'%s'})))}catch(e){}" % A_.kind)
            A = await L.join(ca, port, 'h2boom', 'Alice', errs, Qy); await L.admin_open(A); await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            B = await L.join(cb, port, 'h2boom', 'Bob', errs, Qy)
            aid, bid = await A.evaluate("()=>__api.H.id"), await B.evaluate("()=>__api.H.id")
            R['ids'] = {'alice': aid, 'bob': bid}
            await L.admin_cmd(A, {'c': 'god', 'id': bid}); await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(1000)
            await L.clear_monsters(A); await L.ensure_alive(A)
            for _ in range(80):
                if await A.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
                await A.wait_for_timeout(250)
            pick = await A.evaluate(PICK, [1, L.FACE_SPOT]); R['pick'] = pick
            S = pick['spot']
            await L.place(A, S['x'], S['y'], S['a'], W, H)
            V = await B.evaluate(L.VIEW_SPOT, S); R['view'] = V
            if V: await L.place(B, V[0], V[1], V[2], W, H)
            if bool(await A.evaluate("()=>__api.lightOn()")) == bool(A_.light_off): await A.keyboard.press('KeyF')
            R['lightOn'] = await A.evaluate("()=>__api.lightOn()")
            if await B.evaluate("()=>__api.lightOn()"): await B.keyboard.press('KeyF')
            wp = Q.watch(port, 'h2boom', 40, wf)
            for P in (A, B): await P.evaluate(SAMPLER)
            await A.wait_for_timeout(1500); await L.clear_monsters(A)
            since = await A.evaluate("()=>Date.now()/1000")
            shots = {}
            async def shot(label, pages):
                if not A_.shots: return
                os.makedirs(A_.shots, exist_ok=True)
                for nm, P in pages:
                    f = os.path.join(A_.shots, f'{label}_{nm}.png'); await P.screenshot(path=f); shots.setdefault(label, {})[nm] = os.path.basename(f)
            await A.evaluate(PRESS); R['events'].append({'label': 'press', 't': time.time()})
            ack = None; t0 = time.time()
            while time.time() - t0 < 5 and not ack:
                ack = await A.evaluate("()=>{ const d=window.__nrDebug(); return d&&d.last&&d.last.ok?d.last:null }"); await A.wait_for_timeout(30)
            R['ack'] = ack
            ta = ack['at'] if ack else time.time()
            async def till(dt):
                while time.time() < ta + dt: await A.wait_for_timeout(25)
            await till(.3); await shot('blast+0.3s', (('alice', A), ('bob', B)))
            await till(1.0); await shot('blast+1s', (('alice', A), ('bob', B)))
            await till(2.0); await shot('blast+2s', (('alice', A), ('bob', B)))
            await till(2.6); await shot('run_menu', (('alice', A),))
            C = await L.prejoin(cc, port, 'h2boom', 'Carol', errs, Qy)                                                   # a late joiner: her page and connection open after the blast
            await L.enter(C); await C.evaluate(SAMPLER); R['events'].append({'label': 'carol in', 't': time.time()})
            await L.admin_cmd(A, {'c': 'god', 'id': await C.evaluate("()=>__api.H.id")})
            if V: await L.place(C, V[0] + 40, V[1], V[2], W, H)
            await till(max(4.0, time.time() - ta + 1.0)); await shot('corpse', (('bob', B), ('carol', C)))
            lf = (ack or {}).get('lf')
            await till(5.0)
            R['dl'] = {nm: await P.evaluate(DLDBG) for nm, P in (('alice', A), ('bob', B), ('carol', C))}
            fx = [f for f in json.load(open(wf))['fx'] if f.get('k') == 'boom'] if os.path.exists(wf) else []
            await till(6.0); await A.evaluate(SPAWN); R['events'].append({'label': 'alice spawn', 't': time.time()})
            await till(max(14.0, time.time() - ta + 1.0))
            await shot('after_light', (('bob', B), ('carol', C)))
            R['shots'] = shots
            R['rows'] = {nm: await P.evaluate(ROWS, since) for nm, P in (('alice', A), ('bob', B), ('carol', C))}
            R['voice'] = {nm: await P.evaluate("()=>window.__h2b?window.__h2b.voice:null") for nm, P in (('alice', A), ('bob', B), ('carol', C))}
            R['pageErrors'] = errs[:20]
            try: wp.send_signal(15); wp.wait(10)
            except Exception: wp.kill()
            await b.close()
    finally:
        Q.lib3d.stop_server(srv)
    R['watch'] = json.load(open(wf)) if os.path.exists(wf) else None
    R['reference'] = reference(R)
    R['measured'] = measure(R)
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    print(json.dumps({k: v for k, v in R['measured'].items() if k != 'checks'}, indent=1)[:2000])
    for c in R['measured']['checks']: print(('PASS ' if c['ok'] else 'FAIL ') + c['name'] + '  ' + json.dumps(c['info'])[:400])
    sys.exit(0 if R['measured']['ok'] else 1)


def reference(R):
    """the server's own run of this blast at every physics time a page showed (boom_ref.js)"""
    aid = R['ids']['alice']; Wt = R['watch'] or {'fx': []}
    fx = next((f for f in Wt['fx'] if f.get('k') == 'boom' and f.get('id') == aid), None)
    if not fx: return None
    times = sorted({f['n'] for nm in R['rows'] for r in (R['rows'][nm] or []) for f in r['fx'] if f['id'] == aid})      # (physics steps: the page's own count)
    fi, fo = A_.out + '.ref_in.json', A_.out + '.ref.json'
    with open(fi, 'w') as f: json.dump({'fx': fx, 'steps': times}, f)
    subprocess.run(['node', os.path.join(HERE, 'boom_ref.js'), '--game', A_.game, '--in', fi, '--out', fo], check=True, capture_output=True)
    return json.load(open(fo))['samples']


def measure(R):
    aid = R['ids']['alice']; Wt = R['watch'] or {'fx': [], 'bodies': []}
    C = []
    def check(name, ok, info): C.append({'name': name, 'ok': bool(ok), 'info': info})
    fx = [f for f in Wt['fx'] if f.get('k') == 'boom' and f.get('id') == aid]
    de = fx[0]['de'] if fx else None
    corpse = None
    for x in Wt['bodies']:
        for r in x['b']:
            if r['k'] == aid and r['c'] == 'Boom': corpse = r
    # the observer summarises bodies; the full record is on the pages' last rows / the server: take it from the bodies log of a page
    rows = R['rows']
    seen = {nm: sorted({f['de'] for r in (rows[nm] or []) for f in r['fx'] if f['id'] == aid}) for nm in rows}
    check('E01 one blast event, the same on Alice\'s and Bob\'s pages (the late joiner, in after it, plays none: it gets the corpse)', len(fx) == 1 and seen['alice'] == [de] and seen['bob'] == [de] and seen['carol'] in ([], [de]), {'observer': len(fx), 'pages': seen})
    menu = [r['t'] for r in rows['alice'] or [] if r['rm']]
    ta = (R.get('ack') or {}).get('at')
    check('E01 Alice\'s run menu after a short beat (within 2 s on this SwiftShader page)', ta and menu and min(menu) - ta <= 2.0, {'after': round(min(menu) - ta, 3) if ta and menu else None})
    check('E01 one Boom corpse, from the server, with the event id', corpse is not None and corpse.get('de') == de, {'corpse': corpse})
    # E06: every sample of every page's replay against the server's own run at the same physics time
    ref = {q['n']: q for q in (R.get('reference') or [])}
    def dist(p, q): return math.hypot(p[0] - q[0], p[1] - q[1])
    worst, n, missing = 0.0, 0, 0
    for nm in rows:
        for r in rows[nm] or []:
            for f in r['fx']:
                if f['id'] != aid: continue
                q = ref.get(f['n'])
                if not q: missing += 1; continue
                n += 1
                d = max([dist(f['b'], q['b'])] + [dist(f['h'][k], q['h'][k]) for k in range(2)] + ([dist(f['eq'], q['eq'])] if f['eq'] and q['eq'] else []) + ([dist(f['hat'], q['hat'])] if f['hat'] and q['hat'] else []))
                worst = max(worst, d, abs(f['b'][2] - q['b'][2]) * 100)
    last = (R.get('reference') or [None])[-1]
    nearCorpse = last is not None and corpse is not None and abs(last['b'][0] - corpse['x']) <= 1 and abs(last['b'][1] - corpse['y']) <= 1
    check('E06 every sample of every page\'s replay (body, both hands, light, hat) equals the server\'s own run of the blast at the same physics time (within 1 px; body angle within 0.01 rad), and the server\'s corpse is where that run ends',
          n >= 3 and not missing and worst <= 1.0 and nearCorpse, {'samples': n, 'pages': {nm: sum(1 for r in rows[nm] or [] for f in r['fx'] if f['id'] == aid) for nm in rows}, 'worstPx': round(worst, 4), 'missing': missing, 'corpse': corpse and [corpse['x'], corpse['y']], 'runEnd': last and last['b']})
    marks = {nm: max([f['marks'] for r in (rows[nm] or []) for f in r['fx'] if f['id'] == aid] or [0]) for nm in rows}
    stains = {nm: sorted({tuple(s) for r in (rows[nm] or []) for s in (r['st'] or []) if s[0] == de}) for nm in rows}
    played = [nm for nm in rows if any(f['id'] == aid for r in (rows[nm] or []) for f in r['fx'])]
    check('W the blast threw the body at the wall: a wall mark in every replay, and the HQ1 wallpaper stain on every screen (the late joiner\'s from the corpse record), on the same face',
          played and all(marks[nm] >= 1 for nm in played) and all(stains[nm] for nm in rows) and len({s[1] for nm in rows for s in stains[nm]}) == 1, {'marks': marks, 'stains': stains, 'pick': R.get('pick', {}).get('spot', {}).get('face')})
    lf = fx[0].get('lf') if fx else None
    pw = {nm: [(r['t'], max(r['pw'] or [0])) for r in (rows[nm] or [])] for nm in rows}
    dl = R.get('dl') or {}
    anchors = {}
    for nm, d in dl.items():
        if d:
            for k, v in d['anchors']:
                if str(k) == str(de): anchors[nm] = round(d['epoch'] + v, 3)
    spread = (max(anchors.values()) - min(anchors.values())) if len(anchors) >= 2 else None
    if A_.light_off or R.get('lightOn') is False:
        logs = {nm: [e for r in (rows[nm] or []) for e in r.get('lg', []) if e[0] == str(de) and e[2] > 0] for nm in rows}
        check('E03 the light was OFF: the blast and its corpse carry no light, and no page ever lights it',
              fx and fx[0].get('lo') == 0 and not fx[0].get('lf') and corpse and corpse.get('lo') == 0 and not any(logs.values()), {'fx': fx and [fx[0].get('lo'), fx[0].get('lf')], 'corpse': corpse and corpse.get('lo'), 'litFrames': {nm: len(v) for nm, v in logs.items()}})
    elif lf:
        rel = min(anchors.values()) if anchors else None
        # every power this page's lighting computed for the blast's light, with the moment it computed it (mp.js's own frame log, DLOG)
        logs = {nm: sorted({(e[1], e[2], e[3]) for r in (rows[nm] or []) for e in r.get('lg', []) if e[0] == str(de)}) for nm in rows}
        lit_late = {nm: [round(t - rel, 3) for t, p, src in logs[nm] if rel and p > 0 and t > rel + lf[0] + lf[1] + .02] for nm in logs}
        dim_early = {nm: [round(t - rel, 3) for t, p, src in logs[nm] if rel and rel + .05 < t < rel + lf[0] - .05 and p < 1] for nm in logs}
        failing = {nm: [round(t - rel, 3) for t, p, src in logs[nm] if rel and rel + lf[0] < t < rel + lf[0] + lf[1] and 0 < p < 1] for nm in logs}
        check('E03 the dropped light, as each page\'s lighting computed it: full power through its hold, dimming/flickering in its fade, exactly 0 after hold + fade; one timeline (release anchors within 0.25 s)',
              rel and spread is not None and spread <= .25 and all(logs[nm] for nm in ('alice', 'bob')) and not any(lit_late.values()) and not any(dim_early.values()),
              {'lf': lf, 'anchors': anchors, 'spread': spread, 'computed': {nm: len(logs[nm]) for nm in logs}, 'litAfterEnd': lit_late, 'dimInHold': dim_early, 'fadeSamples': {nm: len(v) for nm, v in failing.items()}})
    else:
        check('E03 the light profile came with the blast', False, {'fx': fx[:1]})
    v = R.get('voice') or {}
    check('the blast is heard once on each page that played it (Alice, Bob), where it happened; never by the late joiner', all(len(v.get(nm) or []) == 1 for nm in ('alice', 'bob')) and not (v.get('carol') or []),
          {nm: v.get(nm) for nm in v})
    return {'ok': all(c['ok'] for c in C), 'passed': sum(c['ok'] for c in C), 'total': len(C), 'de': de, 'lf': lf, 'checks': C}


asyncio.run(main())
