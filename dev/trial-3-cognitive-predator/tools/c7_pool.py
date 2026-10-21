#!/usr/bin/env python3
# dev/trial-3-cognitive-predator/tools/c7_pool.py - C7 (the review's F5): the real-page outcomes of every pass of tools/c6_browser.js,
# pooled per scene and build, with n and every try left out and why (development only).
#   python3 -I -B dev/trial-3-cognitive-predator/tools/c7_pool.py BUILD:PASS:RUN.json [BUILD:PASS:RUN.json ...]
# A try is left out when: the creature never saw a page (a setup miss); the pass's tool steered that scene's page into walls (v1: the
# escape, A's way to the pillar and the pillar's ring; v2: the pillar's ring - the tool was fixed after each); or, from the final tool on
# (which logs it), the decoy's A was held up by a wall on its way to hide (2 or more 'skip's). Everything else counts, kill or not.
import json, sys, math
from collections import OrderedDict
SCENES = ['lookaway', 'fork', 'decoy', 'pillar', 'escape']
FAULTY = {'v1': {'escape', 'decoy', 'pillar'}, 'v2': {'pillar'}}
rows, out = OrderedDict(), []
for arg in sys.argv[1:]:
    build, ps, path = arg.split(':', 2)
    for r in json.load(open(path))['runs']:
        sc, tr = r['scene'], r['try']; key = (build, sc)
        rows.setdefault(key, {'n': 0, 'kills': 0, 'out': []})
        skips = sum(1 for i in r.get('inputs', []) if i[1] == 'skip')
        why = None
        if r.get('error'): why = 'error'
        elif r.get('setupMiss'): why = 'setup miss'
        elif sc in FAULTY.get(ps, set()): why = 'faulty tool (%s)' % ps
        elif sc == 'decoy' and skips >= 2: why = "A held up (%d skips)" % skips
        if why: rows[key]['out'].append('%s #%d: %s' % (ps, tr, why)); continue
        rows[key]['n'] += 1
        if r.get('watcherDied') is not None: rows[key]['kills'] += 1
builds = []
for (b, _) in rows:
    if b not in builds: builds.append(b)
print('scene      ' + ''.join('%-24s' % b for b in builds))
for sc in SCENES:
    line = '%-10s ' % sc
    for b in builds:
        q = rows.get((b, sc), {'n': 0, 'kills': 0})
        line += '%-24s' % ('%d kills / %d valid' % (q['kills'], q['n']))
    print(line)
tot = '%-10s ' % 'all'
for b in builds:
    n = sum(rows.get((b, s), {'n': 0})['n'] for s in SCENES); k = sum(rows.get((b, s), {'kills': 0})['kills'] for s in SCENES)
    tot += '%-24s' % ('%d kills / %d valid' % (k, n))
print(tot)
print('\nleft out:')
for (b, sc), q in rows.items():
    if q['out']: print('  %s %s: %s' % (b, sc, '; '.join(q['out'])))
