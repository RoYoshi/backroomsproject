#!/usr/bin/env python3
"""Stage 3D HQ3 - the NEW RUN gibs on real pages: two screens and a late joiner (development only; SwiftShader)

  python3 -I dev/stage-3d-hq3/gib_browser.py --game DIR --out FILE.json [--shots DIR] [--kind flashlight] [--light-off]

Alice (light ON unless --light-off) stands near a lit papered wall, placed so the server's blast throws pieces at it (the same placement
as dev/stage-3d-hq2/boom_browser.py); Bob watches from the side (god mode, light off); Carol opens the game after the blast has settled (a
late joiner).  Alice presses NEW RUN (the pause dialog's own button), then SPAWN.  Every page is sampled ~10 times a second: the blast
replay (is the whole avatar shown? are the pieces drawn? where each piece and hand is, on the replay's own physics), the Boom corpse
records it holds (gs, gb, gh), the corpse views on its floor layer (is the whole avatar hidden?).  A quiet observer logs the server.
Screenshots: Bob's screen at 0.05, 0.15, 0.4 and 1.0 s of the replay (his Death Lab clock paused and stepped there: presentation only,
these pages draw about one frame a second), then let go, and the settled remains; Alice's run menu; Carol's late view.
Checks (exit 1 if any fails):
  1 one approved NEW RUN, one blast event on the wire, one Boom corpse with 5-8 pieces, a seed and both hands
  2 no whole torso on any screen: in every replay sample the avatar is hidden (from the moment the replay is made) and, once the page has
    drawn a frame of it, the pieces are drawn; every page's corpse view hides the avatar
  3 the pieces move apart at once: in Bob's first replay samples within 0.5 s of the blast the pieces already lie apart (the spread of
    the piece centres grows past the body's own radius)
  4 one settled picture everywhere: Alice's, Bob's and Carol's corpse records are the server's (the same gs / gb / gh), and the last
    replay frame on Alice's and Bob's pages put every piece and hand within 1 px of the record (Alice's at rest)
  5 the late joiner sees the remains, plays no blast and hears nothing
--reanalyse FILE recomputes the checks from a saved run (no browser)."""
import os, sys, asyncio, argparse, json, time, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq2'))
import hq2lib as Q
L = Q.L
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--out', required=True); ap.add_argument('--shots', default=None)
ap.add_argument('--kind', default='flashlight'); ap.add_argument('--light-off', action='store_true'); ap.add_argument('--query', default='')
ap.add_argument('--reanalyse', default=None, help='recompute the checks from a saved run (no browser)')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 720, 480
ROOM = 'h3gib'
SAMPLER = r"""()=>{ if(window.__h3g) return 'already'; const S=window.__h3g={rows:[], voice:[]};
  const E=window.__ents; if(E&&E.boomVoice&&!E.boomVoice.__h3){ const f=E.boomVoice; E.boomVoice=function(){ S.voice.push(+(Date.now()/1000).toFixed(3)); return f.apply(this,arguments) }; E.boomVoice.__h3=1 }
  S.iv=setInterval(()=>{ try{ const A=window.__api;
      const fx=(window.__fxs||[]).filter(f=>f.k==='boom'&&f.jl&&f.jl.ph).map(f=>{ const P=f.jl.ph; return { id:f.id, de:f.de, t:+f.jl.elapsed.toFixed(2), st:P.state,
        av:!!(f.av&&f.av.visible), gib:!!(f.gib&&!f.gib.destroyed), ran:f.gibKey!=null, drawn:!!(f.gib&&!f.gib.destroyed&&f.gib.context&&f.gib.context.instructions&&f.gib.context.instructions.length>0),
        p:(P.gib||[]).map(g=>[+g.x.toFixed(1),+g.y.toFixed(1),+g.z.toFixed(1)]), h:P.h.map(h=>[+h.x.toFixed(1),+h.y.toFixed(1)]), ox:P.b.x, oy:P.b.y } });
      const recs=(A.bodyList?A.bodyList():[]).filter(b=>b.cause==='Boom').map(b=>({ owner:String(b.ownerId), de:b.de, gs:b.gs, gb:b.gb||null, gh:b.gh||null, x:b.x, y:b.y }));
      const views=[]; const fl=A.floor&&A.floor(); if(fl) for(const v of fl.children) if(v.record&&v.record.cause==='Boom'){ const av=v.children.find(c=>c.__cause); views.push({ id:v.record.id, gb:!!v.record.gb, avatarShown:!!(av&&av.visible&&av.renderable!==false), visible:v.visible }); }
      S.rows.push({ t:+(Date.now()/1000).toFixed(3), fx, recs, views, rm:!document.getElementById('runMenu').hidden, rmText:(document.querySelector('#runMenu .eyebrow')||{}).textContent||'' });
      if(S.rows.length>8000) S.rows.splice(0,3000) }catch(e){ S.err=String(e) } },100); return 'ok' }"""
ROWS = "(since)=>window.__h3g?{rows:window.__h3g.rows.filter(r=>r.t>=since),voice:window.__h3g.voice,err:window.__h3g.err||null}:null"
PRESS = "()=>{ const b=document.getElementById('reset'); if(!b) return false; b.click(); return true }"
SPAWN = "()=>{ const b=document.getElementById('runSpawn'); if(!b) return false; const v=!document.getElementById('runMenu').hidden; b.click(); return v }"
PICK = r"""([de, faceJs])=>{ const D=window.__dphys, w=window.__nrDebug().w; const P=D.boomPlan(w, de), dx=Math.cos(P.d), dy=Math.sin(P.d);
  const F=eval(faceJs); let best=null;
  for(const side of ['N','S','E','W']) for(let skip=0; skip<4; skip++){ const S=F([side, 64, skip]); if(!S) break; const dot=-(S.ox*dx+S.oy*dy); if(!best||dot>best.dot) best=Object.assign({dot, side, skip}, S) }
  return { w, de, plan:P, spot:best } }"""


async def main():
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    R = {'tool': 'dev/stage-3d-hq3/gib_browser.py', 'game': A_.game, 'kind': A_.kind, 'lightOff': A_.light_off, 'events': []}
    wf = A_.out + '.watch.json'; Qy = ('&' + A_.query) if A_.query else ''
    shots = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=Q.ARGS)
            ca, cb, cc = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(3)]
            await ca.add_init_script("try{localStorage.setItem('wanderer-light', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wanderer-light')||'{}'),{kind:'%s'})))}catch(e){}" % A_.kind)
            A = await L.join(ca, port, ROOM, 'Alice', errs, Qy); await L.admin_open(A); await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            B = await L.join(cb, port, ROOM, 'Bob', errs, Qy)
            aid, bid = await A.evaluate("()=>__api.H.id"), await B.evaluate("()=>__api.H.id"); R['ids'] = {'alice': aid, 'bob': bid}
            await L.admin_cmd(A, {'c': 'god', 'id': bid}); await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(1000)
            await L.clear_monsters(A); await L.ensure_alive(A)
            for _ in range(80):
                if await A.evaluate("()=>window.__l0v&&window.__l0v.on()"): break
                await A.wait_for_timeout(250)
            pick = await A.evaluate(PICK, [1, L.FACE_SPOT]); R['pick'] = pick; S = pick['spot']
            await L.place(A, S['x'], S['y'], S['a'], W, H)
            V = await B.evaluate(L.VIEW_SPOT, S); R['view'] = V
            if V: await L.place(B, V[0], V[1], V[2], W, H)
            if bool(await A.evaluate("()=>__api.lightOn()")) == bool(A_.light_off): await A.keyboard.press('KeyF')
            R['lightOn'] = await A.evaluate("()=>__api.lightOn()")
            if await B.evaluate("()=>__api.lightOn()"): await B.keyboard.press('KeyF')
            wp = Q.watch(port, ROOM, 60, wf)
            for P in (A, B): await P.evaluate(SAMPLER)
            await L.lab(B, True, True, 1)                                                                            # (Bob's replay clock paused: see below)
            await A.wait_for_timeout(1500); await L.clear_monsters(A)
            since = await A.evaluate("()=>Date.now()/1000")
            async def shot(label, pages):
                if not A_.shots: return
                os.makedirs(A_.shots, exist_ok=True)
                for nm, P in pages:
                    f = os.path.join(A_.shots, f'{label}_{nm}.png'); await P.screenshot(path=f); shots.setdefault(label, {})[nm] = os.path.basename(f)
            await A.evaluate(PRESS); R['events'].append({'label': 'press', 't': time.time()})
            ack = None; t0 = time.time()
            while time.time() - t0 < 6 and not ack:
                ack = await A.evaluate("()=>{ const d=window.__nrDebug(); return d&&d.last&&d.last.ok?d.last:null }"); await A.wait_for_timeout(30)
            R['ack'] = ack
            # Bob's own moment: when his page first plays the blast
            tb = None; t0 = time.time()
            while time.time() - t0 < 6 and tb is None:
                if await B.evaluate("()=>(window.__fxs||[]).some(f=>f.k==='boom')"): tb = time.time()
                else: await B.wait_for_timeout(20)
            tb = tb or time.time(); R['bobPlaysAt'] = tb
            async def till(dt):
                while time.time() < tb + dt: await A.wait_for_timeout(20)
            # Bob's Death Lab clock is paused from before the press (presentation only: hq1lib.lab), so these slow pages can be photographed
            # at chosen moments of the replay: stepped to 0.05, 0.15, 0.4 and 1.0 s, then let go (RESET CLOCK) to finish in real time
            REPT = "()=>{ const f=(window.__fxs||[]).find(f=>f.k==='boom'&&f.jl); return f?{t:f.jl.elapsed}:null }"
            for T in (.05, .15, .4, 1.0):
                st = await L.step_to(B, REPT, T); await B.wait_for_timeout(900)
                R['events'].append({'label': f'bob stepped to {T} s', 'from': st, 't': time.time()}); await shot(f'blast_{T:.2f}s', (('bob', B),))
            await L.lab(B, False, False, 1); R['events'].append({'label': 'bob clock let go', 't': time.time()})
            await shot('alice_run_menu', (('alice', A),))
            await till(6.0); await shot('settled', (('bob', B),))
            C = await L.prejoin(cc, port, ROOM, 'Carol', errs, Qy)                                                   # a late joiner, after the remains settled
            await L.enter(C); await C.evaluate(SAMPLER); R['events'].append({'label': 'carol in', 't': time.time()})
            await L.admin_cmd(A, {'c': 'god', 'id': await C.evaluate("()=>__api.H.id")})
            if V: await L.place(C, V[0] + 40, V[1], V[2], W, H)
            if await C.evaluate("()=>__api.lightOn()"): await C.keyboard.press('KeyF')
            await C.wait_for_timeout(2500); await shot('late_joiner', (('carol', C),))
            R['spawnPressed'] = await A.evaluate(SPAWN); R['events'].append({'label': 'alice spawn', 't': time.time()})
            await A.wait_for_timeout(2500)
            R['rows'] = {nm: await P.evaluate(ROWS, since) for nm, P in (('alice', A), ('bob', B), ('carol', C))}
            R['pageErrors'] = errs[:20]
            try: wp.send_signal(15); wp.wait(10)
            except Exception: wp.kill()
            await b.close()
    finally:
        Q.lib3d.stop_server(srv)
    R['shots'] = shots
    R['watch'] = json.load(open(wf)) if os.path.exists(wf) else None
    finish(R)


def finish(R):
    C = []
    def check(name, ok, info): C.append({'name': name, 'ok': bool(ok), 'info': info})
    aid = R['ids']['alice']; Wt = R.get('watch') or {'fx': [], 'bodies': []}; ack = R.get('ack') or {}
    rows = {nm: (R['rows'][nm] or {}).get('rows') or [] for nm in R['rows']}
    voice = {nm: (R['rows'][nm] or {}).get('voice') or [] for nm in R['rows']}
    fx = [f for f in Wt['fx'] if f.get('k') == 'boom' and f.get('id') == aid]
    recs = {nm: next((r for row in reversed(rows[nm]) for r in row['recs'] if r['owner'] == 'r' + str(aid)), None) for nm in rows}
    srv = recs.get('bob')
    check('1 one approved NEW RUN, one blast on the wire, one Boom corpse with 5-8 pieces, its seed and both hands',
          ack.get('ok') and len(fx) == 1 and srv and srv['gb'] and 5 <= len(srv['gb']) <= 8 and srv['gs'] and srv['gh'] and len(srv['gh']) == 4,
          {'ack': ack, 'blasts': len(fx), 'pieces': len(srv['gb']) if srv and srv['gb'] else None, 'gs': srv and srv['gs']})
    rep = {nm: [f for row in rows[nm] for f in row['fx'] if f['id'] == aid] for nm in ('alice', 'bob')}
    shown = {nm: sum(1 for f in v if f['av']) for nm, v in rep.items()}; drawn = {nm: sum(1 for f in v if f['gib'] and f['drawn']) for nm, v in rep.items()}; ran = {nm: [f for f in v if f['ran']] for nm, v in rep.items()}
    views = {nm: [v for row in rows[nm] for v in row['views'] if v['gb']] for nm in rows}
    vshown = {nm: sum(1 for v in vs if v['avatarShown']) for nm, vs in views.items()}
    check('2 no whole torso on any screen: every replay sample hides the avatar and draws the pieces; every corpse view hides the avatar',
          all(ran[nm] for nm in rep) and not any(shown.values()) and all(drawn[nm] >= len(ran[nm]) for nm in rep) and all(views[nm] for nm in views) and not any(vshown.values()),
          {'replaySamples': {nm: len(v) for nm, v in rep.items()}, 'samplesAfterTheFirstFrame': {nm: len(v) for nm, v in ran.items()}, 'avatarShownInReplay': shown, 'piecesDrawn': drawn, 'corpseViewSamples': {nm: len(v) for nm, v in views.items()}, 'avatarShownInCorpseView': vshown})
    early = [f for f in rep['bob'] if f['t'] <= .5]
    spread = [max(math.hypot(p[0] - f['ox'], p[1] - f['oy']) for p in f['p']) for f in early]
    check('3 the pieces fly apart at once: in Bob\'s replay samples of the first 0.5 s the farthest piece is already beyond the body\'s radius (18 px) and moving out',
          early and spread[0] > 4 and max(spread) > 18, {'samples': [[f['t'], round(s, 1)] for f, s in zip(early, spread)]})
    same = all(recs[nm] and srv and recs[nm]['gs'] == srv['gs'] and recs[nm]['gb'] == srv['gb'] and recs[nm]['gh'] == srv['gh'] for nm in rows)
    last = {nm: (rep[nm][-1] if rep[nm] else None) for nm in rep}
    err = {}
    for nm, f in last.items():
        if f and srv and srv['gb']: err[nm] = round(max([math.hypot(p[0] - q[0], p[1] - q[1]) for p, q in zip(f['p'], srv['gb'])] + [math.hypot(h[0] - srv['gh'][2 * k], h[1] - srv['gh'][2 * k + 1]) for k, h in enumerate(f['h'])]), 2)
    check('4 one settled picture: Alice\'s, Bob\'s and Carol\'s corpse records are the same (gs, gb, gh), and the last replay frame on Alice\'s and Bob\'s pages is within 1 px of it, piece by piece (Alice\'s at rest; Bob\'s clock was stepped for the photographs, then let go: his replay can reach its end and hand over to the corpse between two samples)',
          same and len(err) == 2 and all(v <= 1 for v in err.values()) and last['alice'] and last['alice']['st'] == 'SLEEPING',
          {'recordsSame': same, 'lastReplayVsRecordPx': err, 'lastReplayState': {nm: f and f['st'] for nm, f in last.items()}})
    cfx = [f for row in rows['carol'] for f in row['fx'] if f['id'] == aid]
    check('5 the late joiner sees the remains (the same record, its view without a whole torso), plays no blast and hears nothing',
          recs['carol'] and views['carol'] and not cfx and not voice['carol'], {'replaySamples': len(cfx), 'blastSounds': len(voice['carol']), 'views': len(views['carol'])})
    menu = [row['rmText'] for row in rows['alice'] if row['rm']]
    R['menuText'] = menu[:1]
    R['checks'] = C; R['passed'] = sum(c['ok'] for c in C); R['total'] = len(C); R['ok'] = R['passed'] == R['total']
    if A_.reanalyse: R['reanalysedFrom'] = A_.reanalyse
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    for c in C: print(('PASS ' if c['ok'] else 'FAIL ') + c['name'] + '  ' + json.dumps(c['info'])[:500])
    print(f"{R['passed']}/{R['total']} checks passed")
    sys.exit(0 if R['ok'] else 1)


if A_.reanalyse:
    finish(json.load(open(A_.reanalyse)))
else:
    asyncio.run(main())
