#!/usr/bin/env python3
"""Stage 3D - the final regression (D6) in one summary, each result next to what it is compared with (development only).

  python3 -I dev/stage-3d/summarize_d6.py        (in the repository; reads dev/stage-3d/evidence/d6/, writes summary.json there)

Every line is one result next to its comparison.  "ok"/"FAIL" lines are gated: ok is true only when all hold (D0's thresholds and
every correctness check).  "OVER" marks D6's own stricter A/B line (+10 % against the parent in the same session) where it is exceeded:
listed under 'over', reported in the documents, not passed and not hidden.  "note" lines are context.  Five checks of the older network suites assert the parent's death
protocol (the victim reports its replay and corpse) and fail by design; they are named here, and the run passes only when exactly those
fail.  npm test and test_shadows must fail exactly as the parent does, by name."""
import json, re, statistics, os
from pathlib import Path
E = Path('dev/stage-3d/evidence/d6'); L = []; OK = True
def gate(ok, text):
    global OK
    OK = OK and bool(ok); L.append(('ok   ' if ok else 'FAIL ') + text)
def j(p): return json.loads((E / p).read_text())
def log(p): return (E / p).read_text(errors='replace') if (E / p).exists() else ''
steps = {}
for l in log('steps.txt').splitlines():
    m = re.match(r'(\S+) exit=(\d+)', l)
    if m: steps[m.group(1)] = int(m.group(2))          # the last run of a step counts (the re-runs after the corrections come last)
passed = lambda f: re.search(r'(\d+)/(\d+) passed', log(f))
fails = lambda f: sorted(set(re.sub(r'\s+\[\d+ms\]$', '', l[5:].split('   EXCEPTION')[0]).strip() for l in log(f).splitlines() if l.startswith('FAIL ')))

g = j('golden3d_d6.json'); fo = {k: v['followOnAfterHandback'] for k, v in g['scenarios'].items() if v.get('followOnAfterHandback')}
gate(g['ok'] and set(fo) <= {'deaths'} and all(v.get('pass') or v.get('identical') for v in g['scenarios'].values()),
    f"golden3d (server, whole tree): every difference starts in the death domain; non-death output identical, except the one bounded follow-on: " + ('; '.join(f"{k} identical up to the first killer hand-back at {v['handbackAt']} ms, diverging from {v['divergesAt']} ms" for k, v in fo.items()) or 'none'))
ga = j('golden3d_aa.json'); gate(all(v['identical'] for v in ga['scenarios'].values()), f"golden3d A/A (parent against parent): {sum(v['identical'] for v in ga['scenarios'].values())}/{len(ga['scenarios'])} identical")
c = j('cli_golden3d.json'); gate(c['ok'], f"client golden (mp.js scenes): {sum(s['identical'] for s in c['scenes'])} identical, {sum((not s['identical']) and s.get('nonDeathIdentical', False) for s in c['scenes'])} with only death-domain differences, of {len(c['scenes'])}")
k = j('contract3d.json'); gate(k['ok'], f"protocol contract with the 3D death fields: {k['violations']} violations")
k0 = j('contract_3h0.json'); extra = {(v.get('t'), v.get('k')) for v in k0.get('firstViolations', [])}
gate(all(v.get('why') == 'field not in the contract' and v.get('t') == 'fx' and v.get('k') in ('de', 'lo', 'el') for v in k0.get('firstViolations', [])),
     f"3H0's contract file, unchanged: {k0['violations']} differences, all the new optional replay fields {sorted(set(v.get('k') for v in k0.get('firstViolations', [])))}")
s = j('static_check.json'); gate(s['ok'], 'static serving: every path answers as at the parent; server-only files and dev/ still 404')
gate(steps.get('phys_test') == 0, 'phys_test passes')
pm = j('phys_matrix_d6.json')['byVariant']
gate(all(v['samplingSame'] and v['finite'] and v['neverSlept'] == 0 and v['moveAfterSleep'] == 0 and v['asleepByEnd'] == v['runs'] and max(v['maxBodyPen'], v['maxHandPen'], v['maxGearPen'], v['maxAttPen']) < .5 and v['crossed'] == 0 and v.get('marksBad', 0) == 0 and v.get('blowsOff', 0) == 0 for v in pm.values()),
     f"phys_matrix ({sum(v['runs'] for v in pm.values())} runs): every death asleep by its end, nothing moves after, same at 30-240 Hz, overlap < 0.5 px, no tunnelling, wall marks on wall faces, blood on floor")
gg = j('gore_geo_d6.json'); gate(gg['ok'], f"gore_geo: {gg['live']['onSolid']} of {gg['live']['points']} live and {gg['corpse']['onSolid']} of {gg['corpse']['points']} corpse points on anything solid ({gg['deaths']} deaths)")
dn = j('death_net_d6.json'); gate(dn['ok'], f"death_net: {sum(x['ok'] for x in dn['checks'])}/{len(dn['checks'])}")
ps, pp = j('perf_death_srv_d6.json'), j('perf_death_srv_parent30.json')
ms = lambda d: sum(v['medianMs'] for v in d['bodyFor'].values())
gate(ms(ps) <= ms(pp) and ps['bodiesMsg']['bytesPerCorpse'] <= 395, f"server: the corpse simulation, sum of the eight medians {ms(ps):.1f} ms (parent {ms(pp):.1f}); 'bodies' {ps['bodiesMsg']['bytesPerCorpse']} B per corpse (D0 359, limit 395)")
inc = ps.get('incremental') or {}
gate(len(inc) == 8 and max(v['largestTickMaxMs'] for v in inc.values()) < 25, f"server: the death as the server runs it, spread over its ticks: largest single tick {max(v['largestTickMedianMs'] for v in inc.values()):.2f} ms median, {max(v['largestTickMaxMs'] for v in inc.values()):.1f} ms worst (the 25 ms wake); the parent's fallback ran whole in one tick" if inc else 'server: no incremental measurement')
SUPERSEDED = {'existing/live.log': {'L5d the replay reaches Bob, and the corpse (with her light left behind) is stored once for everybody', 'L5e one body per player: sending another replaces it', 'L5f a living player still cannot leave a corpse or trigger a death replay'},
              'existing/audit_net.log': {'D3 a normal death: the victim\'s own replay and corpse are used - one replay, one corpse, nothing added by the server'},
              'existing/audit_net2.log': {'DD2 a connected victim: its own replay and corpse, exactly one of each, nothing added by the server even after the fallback deadline'}}
for f, want in SUPERSEDED.items():
    p = passed(f); got = set(fails(f))
    gate(p and got == want, f"{f[9:-4]}: {p.group(0) if p else '?'}; the failing checks are exactly the {len(want)} superseded by death_net ({', '.join(sorted(x.split(' ')[0] for x in want))})")
gate(steps.get('existing/ir_net') == 0, 'ir_net passes')
gate(steps.get('existing/interp_test') == 0 and steps.get('existing/test_3bn') == 0, 'interp_test and test_3bn pass')
nt, ntp = fails('existing/npm_test.log'), fails('existing/npm_test_parent.log')
gate(nt == ntp and passed('existing/npm_test.log').group(0) == passed('existing/npm_test_parent.log').group(0), f"npm test: {passed('existing/npm_test.log').group(0)}, the same {len(nt)} historical failures as the parent, by name")
norm = lambda xs: sorted(x.split(' ')[0] for x in xs)
gate(norm(fails('existing/test_shadows.log')) == norm(fails('existing/test_shadows_parent.log')), f"test_shadows: {passed('existing/test_shadows.log').group(0)}, the same failures as the parent ({', '.join(norm(fails('existing/test_shadows.log')))})")
gate('12/12 PASS' in log('qa2/camera_fairness.log'), 'camera fairness 12/12')
gate('32/32 passed' in log('qa2/br_role.log'), 'BR-RoLE 32/32')
gate(steps.get('qa2/theme_assets') == 0, 'theme files unchanged')
gate('stage-3c-qa2 evidence untouched: yes' in log('steps.txt').split("the review's corrections")[-1], "QA2 probes wrote their pictures under evidence/d6/qa2/; stage-3c-qa2's own evidence untouched (git status)")
for b in ('probe_b1', 'probe_b2', 'probe_b3'):
    t = log(f'qa2/{b}.log'); gate(steps.get(f'qa2/{b}') == 0 and 'FAIL' not in t, f"QA2 {b}: {t.count(chr(10) + 'PASS') + t.startswith('PASS')} PASS, 0 FAIL")
pa = j('parity_d6.json')['compare3d']
mx = lambda key: max(max(c['victimVsServer'][key], c['spectatorVsServer'][key]) for c in pa)
gate(len(pa) == 8 and mx('body') < 1 and mx('light') < 1 and mx('hands') < 1 and mx('hat') < 1 and all(c['victimVsServer']['blood']['seedsSame'] and c['spectatorVsServer']['blood']['seedsSame'] for c in pa) and all(not c['clientSent'] for c in pa),
     f"parity, all eight at normal speed: victim and spectator against the server's corpse: body ≤ {mx('body')} px, light ≤ {mx('light')} px, hands ≤ {mx('hands')}, hat ≤ {mx('hat')}; the client sends nothing")
sd = j('sound_d6.json')['runs']
v_ok = all(r['victim'] and r['victim'][0]['what'] == 'death' and r['victim'][0]['hits'] for r in sd.values())
s_ok = all(any(x['what'] == 'death' for x in sd[t]['spectator']) for t in ('houndC', 'smilerA', 'houndA_reducedMotion')) and not any(x['what'] == 'death' for x in sd['houndA_bobSoundOff']['spectator'])
f_ok = all(not any(x['what'] == 'death' for x in r['far']) for r in sd.values())
gate(v_ok and s_ok and f_ok, 'sound: the victim\'s death sound has the physics\' blows; the spectator hears it (not with sound OFF); out of earshot nothing')
cc = j('corpse_houndC/corpse_check.json')
gate(all(not x['visible'] and not x['cached'] for x in cc['farAway']) and all(x['visible'] and x['cached'] for x in cc['back']) and all(b['born'] and b['age'] >= 20 for b in cc['lateJoiner']['bodies']),
     'corpses: culled and their texture released off screen, cached again on screen; a late joiner gets the corpse with its age')
def note(text): L.append('note ' + text)          # reported, not gated (see the text)
AB = lambda side, ids: [r for i in ids if (E / f'perf_ab/{side}_{i}.json').exists() for r in j(f'perf_ab/{side}_{i}.json')['rounds']]
def ab_rows(ids, pre):
    p, n = AB('parent', ids), AB('new', ids); out = []
    for w in ('idle', 'houndA', 'houndC'):
        key = 'idle' if w == 'idle' else pre + w
        for i, who in enumerate(('victim', 'spectator')):
            a = [r[key][i]['frameMedianMs'] for r in p if key in r]; b = [r[key][i]['frameMedianMs'] for r in n if key in r]
            if a and b: out.append((w, who, statistics.median(a), statistics.median(b), len(b)))
    return out
fmt = lambda rows: '; '.join(f'{w} {who} {a:.0f} -> {b:.0f} ms ({(b - a) / a * 100:+.1f} %)' for w, who, a, b, k in rows)
wh = ab_rows(range(7, 11), 'whole_')
WATCH = []
def watch(ok, text):                               # D6's own stricter line, beyond D0's thresholds: reported and listed, not hidden
    L.append(('ok   ' if ok else 'OVER ') + text)
    if not ok: WATCH.append(text)
over = [f'{w} {who}' for w, who, a, b, k in wh if b > a * 1.10]
watch(len(wh) == 6 and not over, f'browser, interleaved with the parent (D6\'s own line: +10 % on the same machine and session), the whole death on both pages (perf_ab pairs 7-10, {wh[0][4] if wh else 0} rounds each), median of the rounds\' frame-time medians: ' + fmt(wh) + (f'; OVER +10 %: {", ".join(over)}' if over else ''))
for ids, lab in ((range(1, 4), 'pairs 1-3'), (range(4, 7), 'pairs 4-6'), (range(1, 11), 'pairs 1-10')):
    cl = ab_rows(ids, 'death_'); over = [f'{w} {who}' for w, who, a, b, k in cl if b > a * 1.10]
    note(f'browser A/B, the polling windows (4-5 frames each; 3D\'s Hound A windows shorter, 2.5 against 3.0 s), {lab}: ' + fmt(cl) + (f'; over +10 %: {", ".join(over)}' if over else ''))
pd, p0 = j('perf_death_d6.json'), j('../d0/perf_death_parent.json')
d0w = lambda w: max(x['frameMedianMs'] for r in p0['rounds'] for x in r[w]); d6w = lambda w: max(x['frameMedianMs'] for r in pd['rounds'] if w in r for x in r[w])
idle0 = max(x['frameMedianMs'] for r in p0['rounds'] for x in r['idle'])
checks = [(w, d6w(w), d0w(w) * 1.10) for w in ('idle', 'death_houndA', 'death_houndC', 'death_smilerA', 'corpses20_onscreen')] + [('corpses20_offscreen', d6w('corpses20_offscreen'), d6w('idle') * 1.05)]
gate(all(v <= lim for w, v, lim in checks), "browser, D0's thresholds (the worst round of 3, frame-time median; deaths, idle and 20 corpses on screen within D0's worst + 10 %, off screen within idle + 5 %): " + '; '.join(f'{w} {v:.0f} (limit {lim:.0f})' for w, v, lim in checks))
hp = max(x['heapMB'] for r in pd['rounds'] for w in r if isinstance(r[w], list) for x in r[w] if 'heapMB' in x); hp0 = max(x['heapMB'] for r in p0['rounds'] for w in r for x in r[w])
gate(hp <= hp0, f'browser: the largest JS heap sample {hp:.0f} MB (D0 {hp0:.0f} MB)')
sk, skp = j('soak_d6.json'), j('soak_parent.json')
rss = [r['serverRssMB'] for r in sk['rows']]
gate(all(abs(v) < .5 for v in sk['slopeMBPerDeath'].values()) and sk['maxReplaysLeft'] == 0 and all(abs(v) < 5 for v in sk['slopeDisplayObjectsPerDeath'].values()),
     f"browser soak, {sk['deaths']} deaths: JS heap after GC {sk['slopeMBPerDeath']} MB per death (parent {skp['slopeMBPerDeath']}), display objects {sk['slopeDisplayObjectsPerDeath']} per death, replays left {sk['maxReplaysLeft']}, corpse views at most {sk['maxViews']}")
note(f"browser soak: the server's RSS {rss[0]} -> {rss[-1]} MB over {len(rss)} deaths (parent {skp['rows'][0]['serverRssMB']} -> {skp['rows'][-1]['serverRssMB']}); see the 32-death run with the server's GC traced (next line)")
g6, gp = j('soak_gc/soak_gc_d6.json'), j('soak_gc/soak_gc_parent.json'); r6 = [r['serverRssMB'] for r in g6['rows']]; rp = [r['serverRssMB'] for r in gp['rows']]
gate(g6['serverHeapAfterFullGC']['last'] - g6['serverHeapAfterFullGC']['first'] < 5 and max(r6[-8:]) - min(r6[-8:]) < 2,
     f"browser soak, {len(r6)} deaths, the server's GC traced (it collects when V8 decides): its heap after each full collection {g6['serverHeapAfterFullGC']['first']} -> {g6['serverHeapAfterFullGC']['last']} MB (parent {gp['serverHeapAfterFullGC']['first']} -> {gp['serverHeapAfterFullGC']['last']}); its RSS {r6[0]} -> {r6[-1]} MB, level over the last 8 deaths ({min(r6[-8:])}-{max(r6[-8:])}) (parent {rp[0]} -> {rp[-1]})")
ss, ssp = j('server_soak_d6.json'), j('server_soak_parent.json')
gate(ss['died'] == ss['deaths'] and abs(ss['heapSlopeMBPerDeath']) < .05 and abs(ss['rssSlopeMBPerDeath']) < .5 and not ss['serverErrors'],
     f"server soak, {ss['deaths']} deaths over WebSockets, forced GC: heap {ss['heapFirstLast'][0]} -> {ss['heapFirstLast'][1]} MB ({ss['heapSlopeMBPerDeath']} MB per death; parent {ssp['heapSlopeMBPerDeath']}), RSS {ss['rssFirstLast'][0]} -> {ss['rssFirstLast'][1]} MB (parent {ssp['rssFirstLast'][0]} -> {ssp['rssFirstLast'][1]})")
sn, snp = j('server_soak_nogc_d6.json'), j('server_soak_nogc_parent.json'); q = [r['rssMB'] for r in sn['rows']]; qp = [r['rssMB'] for r in snp['rows']]
gate(sn['died'] == sn['deaths'] and not sn['serverErrors'] and max(q[-16:]) <= max(q[:-16]),
     f"server soak, {sn['deaths']} deaths, no forced GC: RSS {q[0]} -> peak {max(q)} -> {q[-1]} MB, no new peak in the last 16 deaths ({min(q[-16:])}-{max(q[-16:])}) (parent {qp[0]} -> peak {max(qp)} -> {qp[-1]}); heap used at most {max(r['heapMB'] for r in sn['rows'])} MB")
fs = j('film/film_summary.json')['variants']
gate(len(fs) == 8 and all(v.get('settle') == 'SLEEPING' and v.get('specSeen') for v in fs.values()), 'film: all eight end asleep, and the spectator saw each one')
R = {'tool': 'dev/stage-3d/summarize_d6.py', 'ok': OK, 'over': WATCH, 'lines': L,
     'how': "ok: every gated line holds (D0's thresholds and every correctness check). 'over' lists the lines over D6's own stricter A/B line; they are reported in STAGE_3D_PERFORMANCE.md and the report, not passed"}
(E / 'summary.json').write_text(json.dumps(R, indent=1, ensure_ascii=False) + '\n'); print('\n'.join(L)); print(('OK' if OK else 'NOT OK') + (f'; OVER D6\'s A/B line: {len(WATCH)}' if WATCH else ''))
