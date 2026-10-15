#!/usr/bin/env python3
# C5d diagnosis (scratch only, never committed): a copy of dev/stage-3e-0/two_browser.py that also saves, for every frame in which
# Bob's drawn avatar of Alice is not mp.js's drawn pose for her, the frame's time, the gap since the previous recorded frame, both
# positions and the previous frame's, so the failing frames can be described.  Usage: make_diag.py <tree>  (writes
# <tree>/dev/stage-3e-0/two_browser_diag.py next to the original, so its imports resolve the same way)
import sys, pathlib
T = pathlib.Path(sys.argv[1])
src = (T / 'dev' / 'stage-3e-0' / 'two_browser.py').read_text()
anchor = "            R['frames'] = len(rec)\n"
assert src.count(anchor) == 1, 'anchor'
diag = anchor + r"""            R['diag'] = []; prev = None; R['frameGaps'] = []
            for i, r in enumerate(rec):
                if 'err' in r: prev = None; continue
                if prev is not None: R['frameGaps'].append(round(r['t'] - prev['t'], 1))
                if r['avs'] and r['pn']:
                    av = r['avs'][0]; pe = next((q for q in r['pn'] if q['id'] == aid), None)
                    if pe and math.hypot(av['x'] - pe['x'], av['y'] - pe['y']) >= .01:
                        pv = prev['avs'][0] if prev is not None and prev.get('avs') else None
                        pp = next((q for q in (prev.get('pn') or []) if q['id'] == aid), None) if prev is not None else None
                        R['diag'].append({'i': i, 't': round(r['t'], 1), 'gap': round(r['t'] - prev['t'], 1) if prev is not None else None,
                                          'phase': next((p['name'] for p in R['phases'] if p['t0'] <= r['t'] <= p['t1']), None),
                                          'avatar': [round(av['x'], 2), round(av['y'], 2)], 'drawnPose': [round(pe['x'], 2), round(pe['y'], 2)],
                                          'target': [pe.get('tx'), pe.get('ty')], 'prevAvatar': [round(pv['x'], 2), round(pv['y'], 2)] if pv else None,
                                          'prevDrawnPose': [round(pp['x'], 2), round(pp['y'], 2)] if pp else None, 'me': r['me']})
                prev = r
"""
(T / 'dev' / 'stage-3e-0' / 'two_browser_diag.py').write_text(src.replace(anchor, diag))
print('written', T / 'dev' / 'stage-3e-0' / 'two_browser_diag.py')
