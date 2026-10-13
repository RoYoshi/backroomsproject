#!/usr/bin/env python3
"""Stage 3D HQ2 - NEW RUN pressed in a real browser, watched by a second one and by the server (development only; SwiftShader)

  python3 -I dev/stage-3d-hq2/nr_browser.py --game DIR --out FILE.json [--shots DIR] [--plan red]

Alice presses NEW RUN (the pause dialog's #reset button, the game's own handler) and, after her run menu, SPAWN (#runSpawn).  Bob watches
from ~150 px.  A quiet WebSocket observer (ws_watch.js) records the server's own player list.  Both pages are sampled 10 times a second:
  Alice: started / hidden self / run menu shown / caught, where she is, local and server light records (cause Vanish), replays;
  Bob:   the replays he plays (vanish ghosts, deaths), light records (cause Vanish), the living lights he draws (where Alice stands for him).
Plan `red` (H2-0, the accepted HQ1 parent): NR1 at T; SPAWN at T+3.5 s; NR2 at T+6 s (inside the 30 s cooldown); SPAWN at T+9.5 s;
(Alice is put back in front of Bob after each SPAWN; the test page holds the test passcode for that, which changes nothing in the
NEW RUN lifecycle) then NR3 at T+40 s (the cooldown over) and a second press 1.0 s later, during NR3's own sequence; SPAWN 3.5 s after NR3.
Screenshots of both pages at NR2+1.2 s, NR2+3 s and 1 s after the SPAWN that follows NR2.  The `red` plan only measures.
Plan `e02` (H2-1 GREEN, checked; exit 1 if a check fails): NR1 approved and its run menu within 1.5 s; presses during its beat and in its
run menu start nothing; after SPAWN, presses 10 s and 29.9 s after the approval are refused with the remaining wait and change nothing
on either screen or on the server for 3 s; the press at 30.8 s is approved."""
import os, sys, asyncio, argparse, json, time, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq1'))
import hq1lib as L
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=L.REPO); ap.add_argument('--out', required=True)
ap.add_argument('--shots', default=None); ap.add_argument('--plan', default='red')
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 720, 480
SAMPLER = r"""(who)=>{ if(window.__h2n) return 'already'; const S=window.__h2n={rows:[]};
  const vis=id=>{ const e=document.getElementById(id); if(!e||e.hidden) return false; const c=getComputedStyle(e); return c.display!=='none'&&c.visibility!=='hidden' };
  const one=()=>{ try{ const A=window.__api, bl=A.bodyList?A.bodyList():[];
      const r={ t:+(Date.now()/1000).toFixed(3), st:A.started?(A.started()?1:0):null, hs:window.__hideSelf?1:0, rm:vis('runMenu')?1:0, dg:vis('dialog')?1:0, c:A.G.caught?1:0,
        x:Math.round(A.H.x), y:Math.round(A.H.y), id:A.H.id,
        vl:bl.filter(b=>b.cause==='Vanish'&&!b.remote).length, vr:bl.filter(b=>b.cause==='Vanish'&&b.remote).map(b=>[String(b.ownerId),Math.round(b.x),Math.round(b.y)]),
        fx:(window.__fxs||[]).map(f=>[f.k,f.id,f.de==null?null:f.de]),
        pl:(window.__peerLights||[]).filter(l=>l&&!l.dead&&l.pw==null&&l.on).map(l=>[Math.round(l.x),Math.round(l.y)]),
        nr: window.__nrDebug?window.__nrDebug():null, rt:(document.getElementById('reset')||{}).textContent||'' };
      S.rows.push(r); if(S.rows.length>6000) S.rows.splice(0,2000) }catch(e){ S.err=String(e) } };
  S.iv=setInterval(one,100); return 'ok' }"""
ROWS = "(since)=>window.__h2n?window.__h2n.rows.filter(r=>r.t>=since):null"
PRESS = "()=>{ const b=document.getElementById('reset'); if(!b) return false; b.click(); return true }"
SPAWN = "()=>{ const b=document.getElementById('runSpawn'); if(!b) return false; const v=!document.getElementById('runMenu').hidden; b.click(); return v }"


async def main():
    port = L.free_port(); srv = L.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    R = {'tool': 'dev/stage-3d-hq2/nr_browser.py', 'plan': A_.plan, 'game': A_.game, 'events': []}
    watch = A_.out + '.watch.json'
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=L.ARGS)
            ca, cb = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(2)]
            A = await L.join(ca, port, 'h2nr', 'Alice', errs); await L.admin_open(A); await A.evaluate("()=>{document.getElementById('adminPanel').hidden=true}")
            B = await L.join(cb, port, 'h2nr', 'Bob', errs)
            aid, bid = await A.evaluate("()=>__api.H.id"), await B.evaluate("()=>__api.H.id")
            R['ids'] = {'alice': aid, 'bob': bid}
            await L.admin_cmd(A, {'c': 'god', 'id': bid}); await L.admin_cmd(A, {'c': 'blackout', 'mode': 'off'}); await A.wait_for_timeout(800)
            await L.clear_monsters(A); await L.ensure_alive(A)
            spot = await A.evaluate(L.lib3d.SPOTS, 'open'); R['spot'] = spot
            await L.place(A, spot[0], spot[1], spot[2], W, H)
            wb = await B.evaluate(L.lib3d.WATCH_FROM, spot); await L.place(B, wb[0], wb[1], wb[2], W, H)
            if not await A.evaluate("()=>__api.lightOn()"): await A.keyboard.press('KeyF')
            if await B.evaluate("()=>__api.lightOn()"): await B.keyboard.press('KeyF')
            wp = subprocess.Popen(['node', os.path.join(HERE, 'ws_watch.js'), '--port', str(port), '--room', 'h2nr', '--pass', L.PASS, '--secs', '75', '--out', watch],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for P in (A, B): await P.evaluate(SAMPLER)
            await A.wait_for_timeout(1500)
            since = await A.evaluate("()=>Date.now()/1000")
            T = time.time()
            shots = {}

            async def at(dt):
                while time.time() < T + dt: await A.wait_for_timeout(25)

            async def ev(label, js):
                r = await A.evaluate(js); R['events'].append({'label': label, 't': round(time.time(), 3), 'ok': r}); return r

            async def shot(label):
                if not A_.shots: return
                os.makedirs(A_.shots, exist_ok=True)
                for nm, P in (('alice', A), ('bob', B)):
                    f = os.path.join(A_.shots, f'{label}_{nm}.png'); await P.screenshot(path=f); shots.setdefault(label, {})[nm] = os.path.basename(f)

            async def guard():                                     # (harness) no real monster in the middle of it
                await L.clear_monsters(A)
            if A_.plan == 'e02':
                await e02(A, B, spot, at, ev, shot, guard, T, R)
            else:
                await red(A, B, spot, at, ev, shot, guard)
            R['shots'] = shots
            R['rows'] = {'alice': await A.evaluate(ROWS, since), 'bob': await B.evaluate(ROWS, since)}
            R['pageErrors'] = errs[:20]
            try: wp.send_signal(15); wp.wait(10)
            except Exception: wp.kill()
            await b.close()
    finally:
        L.stop_server(srv)
    R['watch'] = json.load(open(watch)) if os.path.exists(watch) else None
    R['measured'] = measure_e02(R) if A_.plan == 'e02' else measure(R)
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    print(json.dumps(R['measured'], indent=1))
    if A_.plan == 'e02': sys.exit(0 if R['measured']['ok'] else 1)


async def red(A, B, spot, at, ev, shot, guard):
            await ev('NR1', PRESS)
            await at(3.5); await ev('NR1 spawn', SPAWN)
            await at(4.6); await L.place(A, spot[0], spot[1], spot[2], W, H); await guard()          # (harness) back in front of Bob after the new run's spawn
            await at(6.0); await ev('NR2', PRESS)
            await at(7.2); await shot('nr2+1.2s')
            await at(9.0); await shot('nr2+3s')
            await at(9.5); await ev('NR2 spawn', SPAWN)
            await at(10.5); await shot('nr2_spawn+1s')
            await at(12.5); await L.place(A, spot[0], spot[1], spot[2], W, H)
            await at(20); await guard(); await at(32); await guard()
            await at(40.0); await ev('NR3', PRESS)
            await at(41.0); await ev('NR3 second press during its sequence', PRESS)
            await at(43.5); await ev('NR3 spawn', SPAWN)
            await at(48.0)


ACK = "()=>{ const d=window.__nrDebug&&window.__nrDebug(); return d&&d.last?d.last:null }"


async def e02(A, B, spot, at, ev, shot, guard, T, R):
    """H2-1 GREEN: NR1 approved; presses during its beat and its run menu do nothing; after SPAWN, presses 10 s and 29.9 s after the
    approval are refused with the wait and change nothing anywhere; the press after 30 s is approved."""
    W_, H_ = 720, 480
    await ev('NR1', PRESS)
    ack = None; t0 = time.time()
    while time.time() - t0 < 5 and not ack:
        ack = await A.evaluate(ACK); await A.wait_for_timeout(30)
    R['ack1'] = ack
    if not ack or not ack.get('ok'): return
    ta = ack['at']                                               # (the page's Date.now()/1000 when the approval arrived: the same clock as time.time())
    async def till(dt):
        while time.time() < ta + dt: await A.wait_for_timeout(25)
    await till(.45); await ev('press during the beat', PRESS)
    await till(1.3); await shot('nr1_menu'); await ev('press in the run menu', PRESS)
    await till(2.6); await ev('NR1 spawn', SPAWN)
    await till(4.0); await L.place(A, spot[0], spot[1], spot[2], W_, H_); await guard()
    await till(10.0); await ev('press at 10 s', PRESS)
    await till(11.0); await shot('press10+1s')
    await till(14.0); await guard()
    await till(29.9); await ev('press at 29.9 s', PRESS)
    await till(30.8); await ev('press at 30.8 s', PRESS)
    await till(33.0); await shot('boundary+2s')
    await till(34.0)


def measure_e02(R):
    aid = R['ids']['alice']; ev = {e['label']: e['t'] for e in R['events']}
    A, B = R['rows']['alice'] or [], R['rows']['bob'] or []
    W_ = R['watch'] or {'pl': [], 'fx': [], 'bodies': []}
    ack = R.get('ack1') or {}; ta = ack.get('at')
    win = lambda rows, t0, t1: [r for r in rows if t0 <= r['t'] < t1]
    srv = lambda t0, t1: [q for t, pl in W_['pl'] if t0 <= t < t1 for q in pl if q[0] == aid]
    C = []
    def check(name, ok, info): C.append({'name': name, 'ok': bool(ok), 'info': info})
    check('E01 the first press is approved by the server', ack.get('ok') == 1, ack)
    if not ta: return {'ok': False, 'checks': C}
    menu = [r['t'] - ta for r in win(A, ta, ta + 3) if r['rm']]
    check('E01 the approved press reaches the run menu promptly (within 1.5 s of the approval)', menu and menu[0] <= 1.5, {'firstMenuRow': menu[0] if menu else None})
    gone = [r['t'] - ta for r in win(B, ta, ta + 3) if not r['pl']]
    check('E01 the spectator stops drawing Alice\'s living light within 1 s of the approval', gone and gone[0] <= 1.0, {'firstRowWithout': gone[0] if gone else None})
    b1, b2 = ev.get('press during the beat'), ev.get('press in the run menu')
    a12 = win(A, b1, ev.get('NR1 spawn', b1 + 2))
    check('E02 presses during the beat and in the run menu start nothing: no new run, the run menu stays, no second approval',
          a12 and not any(r['st'] for r in a12 if r['t'] > b1 + .3) and any(r['rm'] for r in a12) and sum(1 for r in A if r.get('nr') and r['nr'].get('last') and r['nr']['last'].get('ok') == 1 and r['nr']['last'].get('q') != ack.get('q')) == 0,
          {'rows': len(a12)})
    for lab, want, nxt in (('press at 10 s', 20.0, None), ('press at 29.9 s', .1, 'press at 30.8 s')):
        t = ev.get(lab)
        if not t: check(f'E02 {lab}', False, 'not pressed'); continue
        L_ = min(3.0, ev[nxt] - t - .05) if nxt and ev.get(nxt) else 3.0                 # (until the next press)
        a, b_, s = win(A, t, t + L_), win(B, t, t + L_), srv(t, t + L_)
        ans = next((r['nr']['last'] for r in a if r.get('nr') and r['nr'].get('last') and r['nr']['last'].get('at', 0) >= t - .05), None)
        x0 = next((r for r in reversed(A) if r['t'] < t), None)
        still = all(r['st'] == 1 and not r['rm'] and not r['hs'] and r['vl'] == 0 and x0 and abs(r['x'] - x0['x']) <= 3 and abs(r['y'] - x0['y']) <= 3 for r in a)
        told = any(('S' in r['rt'] and any(ch.isdigit() for ch in r['rt'])) or 'NOT NOW' in r['rt'] for r in a) if want > 1 else True
        check(f'E02 {lab} after the approval: refused (cooldown, ~{want} s left), and nothing changes on her screen, on Bob\'s or on the server until the next press (at most 3 s)',
              ans and ans.get('ok') == 0 and ans.get('why') == 'cooldown' and abs(ans.get('wait', 0) - want) < .7 and still and told
              and b_ and all(r['pl'] for r in b_) and s and all(q[1] == 1 for q in s)
              and not [f for f in W_['fx'] if f.get('id') == aid and t <= f['at'] < t + L_] and not [x for x in W_['bodies'] if t <= x['at'] < t + L_],
              {'window': round(L_, 2), 'answer': ans, 'aliceStill': still, 'buttonTold': told, 'bobRows': len(b_), 'bobAlwaysSawHer': bool(b_) and all(r['pl'] for r in b_), 'serverActive': sorted({q[1] for q in s})})
    t = ev.get('press at 30.8 s')
    a = win(A, t, t + 3) if t else []
    ans = next((r['nr']['last'] for r in a if r.get('nr') and r['nr'].get('last') and r['nr']['last'].get('at', 0) >= (t or 0) - .05), None)
    check('E02 the press after the 30 s cooldown is approved (run menu)', ans and ans.get('ok') == 1 and any(r['rm'] for r in a), {'answer': ans})
    return {'ok': all(c['ok'] for c in C), 'passed': sum(c['ok'] for c in C), 'total': len(C), 'checks': C}


def measure(R):
    aid = R['ids']['alice']; ev = {e['label']: e['t'] for e in R['events']}
    A, B = R['rows']['alice'] or [], R['rows']['bob'] or []
    W_ = R['watch'] or {'pl': [], 'fx': [], 'bodies': []}
    def win(rows, t0, t1): return [r for r in rows if t0 <= r['t'] < t1]
    def srv(t0, t1):
        out = []
        for t, pl in W_['pl']:
            if t0 <= t < t1:
                for q in pl:
                    if q[0] == aid: out.append({'t': t, 'active': q[1], 'x': q[3], 'y': q[4]})
        return out
    M = {}
    for lab, nxt in (('NR1', 'NR1 spawn'), ('NR2', 'NR2 spawn'), ('NR3', 'NR3 spawn')):
        t0 = ev.get(lab); t1 = ev.get(nxt)
        if not t0 or not t1: continue
        a, b_, s = win(A, t0, t1), win(B, t0, t1), srv(t0, t1)
        after = win(A, t1, t1 + 2.5); safter = srv(t1 + 1.0, t1 + 2.5)
        M[lab] = {
            'alice_localVanishBody': max([r['vl'] for r in a] or [0]),
            'alice_runMenuShown': any(r['rm'] for r in a), 'alice_hiddenSelf': any(r['hs'] for r in a),
            'bob_vanishGhostPlayed': any(any(f[0] == 'vanish' and f[1] == aid for f in r['fx']) for r in b_),
            'bob_vanishLightRecordAt': sorted({tuple(v[1:]) for r in b_ for v in r['vr'] if v[0] == str(aid)}),
            'server_activeDuringAliceMenu': sorted({q['active'] for q in s if any(r['rm'] for r in a if abs(r['t'] - q['t']) < .15)}),
            'server_alicePositions': sorted({(q['x'], q['y']) for q in s})[:6],
            'bob_drawsAliceLightDuringHerMenu': any(r['pl'] for r in b_ if any(x['rm'] and abs(x['t'] - r['t']) < .15 for x in a)),
            'afterSpawn_alicePositions': [(r['x'], r['y']) for r in after][::5],
            'afterSpawn_serverAlice': [(q['x'], q['y'], q['active']) for q in safter][:3],
            'fxForAlice': [{'at': f['at'], 'k': f['k']} for f in W_['fx'] if f.get('id') == aid and t0 <= f['at'] < t1],
            'bodiesVersionsInWindow': [{'at': x['at'], 'vanish': [(r['x'], r['y']) for r in x['b'] if r['c'] == 'Vanish' and r['k'] == aid]} for x in W_['bodies'] if t0 <= x['at'] < t1],
        }
    t3b = ev.get('NR3 second press during its sequence')
    if t3b:
        a = win(A, t3b, t3b + 2.4)
        M['NR3 second press'] = {'alice_runMenuHiddenAndStartedAgain': [(r['t'] - t3b, r['st'], r['rm'], r['hs'], r['x'], r['y']) for r in a][::4],
                                 'server': [(q['t'] - t3b, q['active'], q['x'], q['y']) for q in srv(t3b, t3b + 2.4)][::3]}
    return M


asyncio.run(main())
