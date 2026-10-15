#!/usr/bin/env python3
# C5d diagnosis (scratch only, never committed), on top of make_diag.py's copy: with THROTTLE=<rate> in the environment, Bob's page alone
# is slowed by Chromium's own CPU throttling (DevTools' Emulation.setCPUThrottlingRate), so his frames are long without loading the
# machine (the server and Alice's page run at full speed); and the frames' analysis is written as soon as the frames are taken
# (<out>.frames.json), before Alice's reload, so a later timeout cannot lose it.  Usage: make_diag2.py <tree>
import sys, pathlib
T = pathlib.Path(sys.argv[1]); f = T / 'dev' / 'stage-3e-0' / 'two_browser_diag.py'
src = f.read_text()
a1 = "            await B.evaluate(HOOK)\n"
a2 = "            rec = await B.evaluate(\"()=>window.__e0rec.slice()\")\n"
assert src.count(a1) == 1 and src.count(a2) == 1, 'anchors'
src = src.replace(a1, """            if os.environ.get('THROTTLE'):
                cdp = await cb.new_cdp_session(B); await cdp.send('Emulation.setCPUThrottlingRate', {'rate': float(os.environ['THROTTLE'])}); R['throttle'] = float(os.environ['THROTTLE'])
""" + a1)
src = src.replace(a2, a2 + """            early = []; prev = None; gaps = []
            for i, r in enumerate(rec):
                if 'err' in r: prev = None; continue
                if prev is not None: gaps.append(r['t'] - prev['t'])
                if r['avs'] and r['pn']:
                    av = r['avs'][0]; pe = next((q for q in r['pn'] if q['id'] == aid), None)
                    if pe:
                        e = math.hypot(av['x'] - pe['x'], av['y'] - pe['y'])
                        if e >= .01: early.append({'i': i, 'gap': round(r['t'] - prev['t'], 1) if prev is not None else None, 'off': round(e, 2), 'avatar': [round(av['x'], 2), round(av['y'], 2)],
                                                   'drawnPose': [round(pe['x'], 2), round(pe['y'], 2)], 'target': [pe.get('tx'), pe.get('ty')],
                                                   'phase': next((p['name'] for p in R['phases'] if p['t0'] <= r['t'] <= p['t1']), None)})
                prev = r
            gaps.sort()
            with open(A_.out + '.frames.json', 'w') as fh:
                json.dump({'frames': len(rec), 'withAliceMismatch': early, 'gapMedian': round(gaps[len(gaps) // 2], 1) if gaps else None,
                           'gapMax': round(gaps[-1], 1) if gaps else None, 'throttle': R.get('throttle')}, fh, indent=1)
""")
f.write_text(src)
print('patched', f)
