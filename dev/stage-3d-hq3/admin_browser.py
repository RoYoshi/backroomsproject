#!/usr/bin/env python3
"""Stage 3D HQ3 - UNLIMITED NEW RUN in the real admin panel, with screenshots (development only; SwiftShader)

  python3 -I dev/stage-3d-hq3/admin_browser.py --game DIR --out FILE.json [--shots DIR]

Alice unlocks the admin panel with the synthetic passcode, typed into the panel (the same path a person takes); Bob is an ordinary player.
  - Alice's DEATHS tab: YOUR NEW RUN · INSTANT GIB, the toggle OFF as the server says (screenshot);
  - she clicks it: the label turns ON once the server has answered (the toggle's text and the panel's status line; screenshot);
  - NEW RUN (the pause dialog's button), SPAWN, NEW RUN again a few seconds later: both approved, two blasts (no 30 s wait);
  - Bob opens the panel: the passcode prompt, no toggle (screenshot);
  - Alice clicks it OFF (the server answers), SPAWN, NEW RUN: refused, the dialog's button says NEW RUN · WAIT n S (screenshot).
Checks (exit 1 if any fails): the toggle's label follows the server (OFF, then ON only with nf/nrf from the server, then OFF); the two
NEW RUNs in a row approved with ON; refused with the wait after OFF; Bob's page has no panel beyond the passcode prompt."""
import os, sys, asyncio, argparse, json, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'stage-3d-hq2'))
import hq2lib as Q
L = Q.L
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--game', default=Q.REPO); ap.add_argument('--out', required=True); ap.add_argument('--shots', default=None)
A_ = ap.parse_args(); A_.game = os.path.abspath(A_.game)
W, H = 960, 600
ROOM = 'h3admin'
PRESS = "()=>{ const b=document.getElementById('reset'); if(!b) return false; b.click(); return true }"
SPAWN = "()=>{ const b=document.getElementById('runSpawn'); if(!b) return false; const v=!document.getElementById('runMenu').hidden; b.click(); return v }"
TOGGLE = "()=>{ const b=document.querySelector('#adminPanel [data-c=nrfree]'); return b?{text:b.textContent, on:b.classList.contains('on')}:null }"
SUB = "()=>{ const s=[...document.querySelectorAll('#admBody .adm-sub')].map(e=>e.textContent).find(t=>/SERVER SAYS/.test(t)); return s||null }"
STATUS = "()=>document.getElementById('admStatus')?document.getElementById('admStatus').textContent:null"
LAST = "()=>{ const d=window.__nrDebug(); return d&&d.last?{q:d.last.q, ok:d.last.ok, why:d.last.why, wait:d.last.wait, de:d.last.de}:null }"


async def main():
    port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(A_.game, port, A_.out + '.server.log'); errs = []
    R = {'tool': 'dev/stage-3d-hq3/admin_browser.py', 'game': A_.game, 'steps': []}
    step = lambda **k: R['steps'].append(dict(k, t=round(time.time(), 3)))
    shots = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=Q.ARGS)
            ca, cb = [await b.new_context(viewport={'width': W, 'height': H}) for _ in range(2)]
            A = await Q.join(ca, port, ROOM, 'Alice', errs)                          # an ordinary page: no test passcode
            B = await Q.join(cb, port, ROOM, 'Bob', errs)
            await L.admin_open(A)                                                  # the passcode typed into the panel, then the DEATHS tab
            await A.wait_for_timeout(1500)
            async def shot(label, P, nm):
                if not A_.shots: return
                os.makedirs(A_.shots, exist_ok=True); f = os.path.join(A_.shots, f'{label}_{nm}.png'); await P.screenshot(path=f); shots[label] = os.path.basename(f)
            for P in (A, B): await L.admin_cmd(A, {'c': 'god', 'id': await P.evaluate("()=>__api.H.id")})   # (no monster interferes; NEW RUN does not look at god mode)
            step(what='panel unlocked', toggle=await A.evaluate(TOGGLE), sub=await A.evaluate(SUB))
            await shot('1_toggle_off', A, 'alice')
            # ON
            await L.click(A, '#adminPanel [data-c=nrfree]'); t0 = time.time(); seen = None
            while time.time() - t0 < 6:
                tg = await A.evaluate(TOGGLE)
                if tg and tg['on']: seen = round(time.time() - t0, 2); break
                await A.wait_for_timeout(50)
            await A.wait_for_timeout(600)
            step(what='clicked ON', toggleOnAfterS=seen, toggle=await A.evaluate(TOGGLE), sub=await A.evaluate(SUB), status=await A.evaluate(STATUS))
            await shot('2_toggle_on', A, 'alice')
            await L.click(A, '#adminPanel [data-a=close]'); await A.wait_for_timeout(300)   # the panel's own close button (a person's path; the panel stops rendering)
            # two NEW RUNs in a row
            for k in range(2):
                await A.keyboard.press('Escape'); await A.wait_for_timeout(500)
                await A.evaluate(PRESS); t0 = time.time(); last = None
                while time.time() - t0 < 6:
                    last = await A.evaluate(LAST)
                    if last and last['q'] == k + 1: break
                    await A.wait_for_timeout(50)
                step(what=f'NEW RUN {k + 1}', answer=last)
                await A.wait_for_timeout(2500); await shot(f'3_newrun{k + 1}_menu', A, 'alice')
                step(what=f'SPAWN after NEW RUN {k + 1}', pressed=await A.evaluate(SPAWN)); await A.wait_for_timeout(2500)
            # Bob: the panel is a passcode prompt only
            await B.keyboard.press('Backquote'); await B.wait_for_timeout(600)
            step(what='Bob opens the panel', login=await B.evaluate("()=>!document.getElementById('admLogin').hidden"), main=await B.evaluate("()=>!document.getElementById('admMain').hidden"), toggle=await B.evaluate(TOGGLE))
            await shot('4_bob_panel', B, 'bob')
            # OFF
            if await A.evaluate("()=>document.getElementById('adminPanel').hidden"):
                await A.evaluate("()=>document.activeElement && document.activeElement.blur && document.activeElement.blur()"); await A.keyboard.press('Backquote'); await A.wait_for_timeout(400)
            panel_open = await A.evaluate("()=>!document.getElementById('adminPanel').hidden")
            await L.click(A, '[data-a=tab][data-t=deaths]'); await A.wait_for_timeout(300)
            await L.click(A, '#adminPanel [data-c=nrfree]'); t0 = time.time(); seen = None
            while time.time() - t0 < 6:
                tg = await A.evaluate(TOGGLE)
                if tg and not tg['on']: seen = round(time.time() - t0, 2); break
                await A.wait_for_timeout(50)
            await A.wait_for_timeout(600)
            step(what='clicked OFF', panelOpen=panel_open, toggleOffAfterS=seen, toggle=await A.evaluate(TOGGLE), sub=await A.evaluate(SUB), status=await A.evaluate(STATUS))
            await shot('5_toggle_off_again', A, 'alice')
            await L.click(A, '#adminPanel [data-a=close]'); await A.wait_for_timeout(300)   # the panel's own close button (a person's path; the panel stops rendering)
            await A.keyboard.press('Escape'); await A.wait_for_timeout(500)
            await A.evaluate(PRESS); t0 = time.time(); last = None
            while time.time() - t0 < 6:
                last = await A.evaluate(LAST)
                if last and last['q'] == 3: break
                await A.wait_for_timeout(50)
            await A.wait_for_timeout(300)
            step(what='NEW RUN 3 (OFF)', answer=last, button=await A.evaluate("()=>document.getElementById('reset').textContent"))
            await shot('6_refused_wait', A, 'alice')
            R['pageErrors'] = errs[:20]
            await b.close()
    finally:
        Q.lib3d.stop_server(srv)
    R['shots'] = shots
    S = {s['what']: s for s in R['steps']}
    C = []
    def check(name, ok, info): C.append({'name': name, 'ok': bool(ok), 'info': info})
    u, on, off = S.get('panel unlocked', {}), S.get('clicked ON', {}), S.get('clicked OFF', {})
    check('the panel shows UNLIMITED NEW RUN OFF when unlocked (the server\'s state), ON after the click once the server answered (status line), OFF again after the second click',
          u.get('toggle') and not u['toggle']['on'] and 'SERVER SAYS: OFF' in (u.get('sub') or '') and on.get('toggleOnAfterS') is not None and on['toggle']['on'] and 'SERVER SAYS: ON' in (on.get('sub') or '')
          and 'UNLIMITED NEW RUN ON' in (on.get('status') or '') and off.get('panelOpen') and off.get('toggleOffAfterS') is not None and not off['toggle']['on'] and 'UNLIMITED NEW RUN OFF' in (off.get('status') or ''),
          {'unlocked': u.get('toggle'), 'on': {k: on.get(k) for k in ('toggleOnAfterS', 'sub', 'status')}, 'off': {k: off.get(k) for k in ('panelOpen', 'toggleOffAfterS', 'sub', 'status')}})
    n1, n2, n3 = S.get('NEW RUN 1', {}).get('answer'), S.get('NEW RUN 2', {}).get('answer'), S.get('NEW RUN 3 (OFF)', {})
    check('ON: two NEW RUNs a few seconds apart (each after SPAWN) both approved, two different events',
          n1 and n1['ok'] == 1 and n2 and n2['ok'] == 1 and n1['de'] != n2['de'], {'first': n1, 'second': n2})
    check('OFF: the next NEW RUN is refused with the wait, and the button says so',
          n3.get('answer') and n3['answer']['ok'] == 0 and n3['answer']['why'] == 'cooldown' and 'WAIT' in (n3.get('button') or ''), n3)
    bp = S.get('Bob opens the panel', {})
    check('an ordinary player\'s panel is only the passcode prompt: no toggle', bp.get('login') and not bp.get('main') and not bp.get('toggle'), bp)
    R['checks'] = C; R['passed'] = sum(c['ok'] for c in C); R['total'] = len(C); R['ok'] = R['passed'] == R['total']
    with open(A_.out, 'w') as f: json.dump(R, f, indent=1); f.write('\n')
    for c in C: print(('PASS ' if c['ok'] else 'FAIL ') + c['name'] + '  ' + json.dumps(c['info'])[:500])
    print(f"{R['passed']}/{R['total']} checks passed")
    sys.exit(0 if R['ok'] else 1)


asyncio.run(main())
