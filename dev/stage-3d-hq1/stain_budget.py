#!/usr/bin/env python3
"""Stage 3D HQ1 - twenty corpses with wall marks at once: the stain and receiver budget (gate R4's stamp lines, W6 at scale; development only)

  python3 -I dev/stage-3d-hq1/stain_budget.py --game DIR --out FILE.json

One page (Alice, god mode, monsters cleared).  Twenty corpse records (D6's fixture corpses20.json, as perf_death.py lays them) are each
moved to a different papered wall face of the real map, spread over the level, and given three wall marks on that face's line (seed 512 +
the direction out of the wall, as the server writes them), each with its own death id.  They are handed to the page the way perf_death.py
does (window.__api.bodies), so gore.js sees exactly what a corpse record from the server gives it.  Then:
  1  60 stains stamped, <= 3 per corpse, each on the face it was put on; the receiver holds 60 marks; at most 36 stain images exist;
     the dearest single stamp and the total stamping time
  2  10 s idle: no new stamp, no removal (no churn); the page's frame interval with the twenty stained corpses against before them
  3  the twenty replaced by twenty others (new death ids, other faces): the old 60 removed, 60 new; receiver 60; images still <= 36
  4  all corpses gone: no stain, receiver 0
Writes FILE.json; exit status 0 only when every check holds."""
import os, sys, asyncio, argparse, json, statistics
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hq1lib as L
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=L.REPO); ap.add_argument('--out', required=True)
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'stage-3d', 'fixtures', 'corpses20.json')
STATE = "()=>{ const G=window.__gore.wallStains; return { stats:G.stats(), stains:G.list(), receiver:window.__l0v.surfaces.count(), caps:window.__l0v.surfaces.caps() } }"
FACES = """()=>window.__l0v.surfaces.list().filter(f=>f.kind==='wall'&&f.material==='material:wallpaper'&&f.length>=160).map(f=>({id:f.id,side:f.side,o:f.origin,u:f.u,up:f.up,len:f.length}))"""
PLACE = """(L)=>{ const W=window.__mpLib.wire; __api.bodies(L.map(o=>W.toRec(o))) }"""
FRAMES = """(secs)=>new Promise(res=>{ const t=[]; let last=performance.now(); const end=last+secs*1000; const f=now=>{ t.push(now-last); last=now; if(now<end) requestAnimationFrame(f); else res(t) }; requestAnimationFrame(f) })"""


def mark_seed(nx, ny):
    import math
    return 512 + ((round(math.atan2(ny, nx) / (2 * math.pi) * 32) % 32) + 32) % 32


def records(fix, faces, de0):
    out = []
    for i, (c, f) in enumerate(zip(fix, faces)):
        o = json.loads(json.dumps(c['rec'])); ox, oy = -f['up'][0], -f['up'][1]                 # out of the wall
        wx, wy = f['o'][0] + f['u'][0] * f['len'] / 2, f['o'][1] + f['u'][1] * f['len'] / 2
        dx, dy = wx + ox * 34 - o['x'], wy + oy * 34 - o['y']
        o['x'] += dx; o['y'] += dy; o['k'] = 9000 + de0 + i; o['de'] = de0 + i; o['lo'] = 0; o.pop('lf', None)
        o['bl'] = [[q[0] + dx, q[1] + dy, q[2]] for q in o['bl']] + [[round(f['o'][0] + f['u'][0] * f['len'] * t), round(f['o'][1] + f['u'][1] * f['len'] * t), mark_seed(ox, oy)] for t in (.3, .5, .7)]
        o['dr'] = [o['dr'][0] + dx, o['dr'][1] + dy, o['dr'][2]]; o['ht'] = [o['ht'][0] + dx, o['ht'][1] + dy, o['ht'][2]]; o['tr'] = [[q[0] + dx, q[1] + dy] for q in o.get('tr') or []]
        out.append(o)
    return out


async def main():
    port = L.free_port(); srv = L.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    R = {'tool': 'dev/stage-3d-hq1/stain_budget.py', 'game': A_.game, 'checks': []}
    def check(name, ok, info): R['checks'].append({'name': name, 'ok': bool(ok), 'info': info}); print(('PASS ' if ok else 'FAIL ') + name + '  ' + json.dumps(info)[:400], flush=True)
    fix = json.load(open(FIX))
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS); ca = await b.new_context(viewport={'width': 960, 'height': 640})
            A = await L.join(ca, port, 'hq1sb', 'Alice', errs); await L.admin_open(A)
            await L.admin_cmd(A, {'c': 'god', 'id': await A.evaluate("()=>__api.H.id")}); await L.clear_monsters(A)
            await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            for _ in range(80):
                if await A.evaluate("()=>window.__l0v&&window.__l0v.on()&&window.__l0v.surfaces.list().length>0"): break
                await A.wait_for_timeout(500)
            faces = await A.evaluate(FACES); R['facesAvailable'] = len(faces)
            # spread over the level: every k-th face of the list (they come room by room), two sets of 20 that share no face
            step = max(1, len(faces) // 40); pick = faces[::step][:40]; setA, setB = pick[0::2][:20], pick[1::2][:20]
            R['facesUsed'] = {'A': [f['id'] for f in setA], 'B': [f['id'] for f in setB]}
            base = await A.evaluate(STATE); R['before'] = base['stats']; f0 = await A.evaluate(FRAMES, 4)
            # 1
            recA = records(fix, setA, 100); await A.evaluate(PLACE, recA); await A.wait_for_timeout(3000)
            s1 = await A.evaluate(STATE); R['after1'] = s1['stats']
            per = {}; onface = 0
            for s in s1['stains']: per[s['de']] = per.get(s['de'], 0) + 1
            want = {o['de']: f['id'] for o, f in zip(recA, setA)}
            for s in s1['stains']: onface += s['status'] == 'stamped' and s['surf'] == want.get(s['de'])
            st1 = s1['stats']
            check('1 twenty corpses with three wall marks each: 60 stains, <= 3 per corpse, each on the face it was put on; the receiver holds 60; <= 36 stain images',
                  st1['stains'] == 60 and max(per.values()) <= 3 and onface == 60 and s1['receiver'] == 60 and st1['images'] <= 36,
                  {'stains': st1['stains'], 'perCorpseMax': max(per.values()) if per else 0, 'onTheirFace': onface, 'receiver': s1['receiver'], 'images': st1['images'],
                   'stamps': st1['stamps'] - base['stats']['stamps'], 'stampMsTotal': round(st1['ms'] - base['stats']['ms'], 2), 'stampMsMax': st1['maxMs'], 'noface': st1['noface'], 'failed': st1['failed'], 'caps': s1['caps']})
            # 2
            f1 = await A.evaluate(FRAMES, 4); await A.wait_for_timeout(6000); s2 = await A.evaluate(STATE); st2 = s2['stats']
            med = lambda t: round(statistics.median(t[2:]), 2) if len(t) > 3 else None
            R['frameIntervalMedianMs'] = {'before': med(f0), 'with60stains': med(f1), 'note': 'SwiftShader, one page: the stains are baked into the wall art, so nothing is drawn per frame for them'}
            check('2 ten seconds idle: no new stamp, no removal',
                  st2['stamps'] == st1['stamps'] and st2['removed'] == st1['removed'] and s2['receiver'] == 60,
                  {'stamps': [st1['stamps'], st2['stamps']], 'removed': [st1['removed'], st2['removed']], 'receiver': s2['receiver'], 'frameIntervalMedianMs': R['frameIntervalMedianMs']})
            # 3
            recB = records(fix, setB, 200); await A.evaluate(PLACE, recB); await A.wait_for_timeout(3000)
            s3 = await A.evaluate(STATE); st3 = s3['stats']
            wantB = {o['de']: f['id'] for o, f in zip(recB, setB)}; onB = sum(s['status'] == 'stamped' and s['surf'] == wantB.get(s['de']) for s in s3['stains'])
            check('3 the twenty replaced by twenty others: the old 60 removed, 60 new on their faces; receiver 60; images still <= 36',
                  st3['removed'] - st2['removed'] == 60 and st3['stamps'] - st2['stamps'] == 60 and st3['stains'] == 60 and onB == 60 and s3['receiver'] == 60 and st3['images'] <= 36,
                  {'removed': st3['removed'] - st2['removed'], 'newStamps': st3['stamps'] - st2['stamps'], 'stains': st3['stains'], 'onTheirFace': onB, 'receiver': s3['receiver'], 'images': st3['images'], 'stampMsMax': st3['maxMs']})
            # 4
            await A.evaluate("()=>__api.bodies([])"); await A.wait_for_timeout(2000); s4 = await A.evaluate(STATE)
            check('4 every corpse gone: no stain, the receiver empty', s4['stats']['stains'] == 0 and s4['receiver'] == 0, {'stains': s4['stats']['stains'], 'receiver': s4['receiver'], 'stats': s4['stats']})
            await b.close()
    finally:
        L.stop_server(srv)
    R['errors'] = errs[:20]; R['ok'] = all(c['ok'] for c in R['checks']) and len(R['checks']) == 4 and not errs
    L.dump(A_.out, R); print('STAIN BUDGET ' + ('OK' if R['ok'] else 'NOT OK')); sys.exit(0 if R['ok'] else 1)

asyncio.run(main())
