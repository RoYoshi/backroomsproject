#!/usr/bin/env python3
"""Stage 3H0 - how long dev/tests/live.js's L5 waits for its kill, per version (development only).

  python3 -I dev/stage-3h0/golden/live_kill_times.py --out REPORT.json DIR [DIR ...]

Reads every live.js log in the given folders (named ARM_N.log, e.g. old_3.log, A_7.log) and takes the time L5b printed ("dead after X s";
-1 means no kill within the test's 70 s).  Per arm: the times, the median, the share over 20 s, and who killed.  For each pair of arms, a
two-sided Mann-Whitney U test (normal approximation with a tie correction): a small p would mean the arms' times differ more than chance
would explain.  The kill comes from an AI acting in a freshly random world, in real time, so a wide spread is expected on every version."""
import os, re, sys, json, math, itertools
args = sys.argv[1:]; out = args[args.index('--out') + 1]; dirs = [a for i, a in enumerate(args) if a != '--out' and (i == 0 or args[i - 1] != '--out')]
arms = {}
for d in dirs:
    for n in sorted(os.listdir(d)):
        m = re.match(r'([A-Za-z]+)_(\d+)\.log$', n)
        if not m: continue
        t = open(os.path.join(d, n), encoding='utf8', errors='replace').read()
        k = re.search(r'dead after (-?[0-9.]+) s; me=([A-Za-z]*)', t)
        if not k: continue
        sec = float(k.group(1)); arm = os.path.basename(os.path.normpath(d)) + ':' + m.group(1)
        arms.setdefault(arm, []).append({'run': int(m.group(2)), 'seconds': 70.0 if sec < 0 else sec, 'timedOut': sec < 0, 'killer': k.group(2) or None,
                                         'passed': bool(re.search(r'^17/17 passed', t, re.M))})
def mwu(a, b):
    allv = sorted([(v, 0) for v in a] + [(v, 1) for v in b]); n = len(allv); ranks = [0.0] * n; i = 0
    while i < n:
        j = i
        while j + 1 < n and allv[j + 1][0] == allv[i][0]: j += 1
        for k in range(i, j + 1): ranks[k] = (i + j) / 2 + 1
        i = j + 1
    ra = sum(r for r, (v, g) in zip(ranks, allv) if g == 0); n1, n2 = len(a), len(b)
    u = ra - n1 * (n1 + 1) / 2; mu = n1 * n2 / 2
    ties = {}; [ties.__setitem__(v, ties.get(v, 0) + 1) for v, _ in allv]
    sd = math.sqrt(n1 * n2 / 12 * ((n + 1) - sum(t ** 3 - t for t in ties.values()) / (n * (n - 1))))
    z = (u - mu) / sd if sd else 0.0
    p = math.erfc(abs(z) / math.sqrt(2))
    return {'U': u, 'z': round(z, 3), 'p': round(p, 4)}
med = lambda v: sorted(v)[len(v) // 2] if len(v) % 2 else (sorted(v)[len(v) // 2 - 1] + sorted(v)[len(v) // 2]) / 2
rep = {'tool': 'dev/stage-3h0/golden/live_kill_times.py', 'arms': {}, 'pairs': {}}
for a, rs in sorted(arms.items()):
    v = [r['seconds'] for r in rs]
    rep['arms'][a] = {'runs': len(rs), 'median': med(v), 'min': min(v), 'max': max(v), 'over20s': sum(x > 20 for x in v), 'timedOut': sum(r['timedOut'] for r in rs),
                      'killers': {k: sum(r['killer'] == k for r in rs) for k in set(r['killer'] for r in rs)}, 'allPassed': all(r['passed'] for r in rs), 'times': v}
for a, b in itertools.combinations(sorted(arms), 2):
    rep['pairs'][a + ' vs ' + b] = mwu([r['seconds'] for r in arms[a]], [r['seconds'] for r in arms[b]])
json.dump(rep, open(out, 'w'), indent=1)
for a, s in rep['arms'].items(): print(a, {k: s[k] for k in ('runs', 'median', 'min', 'max', 'over20s', 'timedOut', 'killers', 'allPassed')})
for k, v in rep['pairs'].items(): print(k, v)
