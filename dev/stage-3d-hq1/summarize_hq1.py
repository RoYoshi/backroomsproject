#!/usr/bin/env python3
"""Stage 3D HQ1 - the final regression (HQ1-3) in one summary, each result next to what it is compared with (development only).

  python3 -I dev/stage-3d-hq1/summarize_hq1.py        (in the repository; reads dev/stage-3d-hq1/evidence/hq1-3/, writes summary.json there)

D6's summary (dev/stage-3d/summarize_d6.py) re-based on HQ1: the parent is D7 (ffe2b53, its export run side by side in the same session),
and the gates are STAGE_3D_HQ1_AUDIT.md's R1-R5.  "ok"/"FAIL" lines are gated; "OVER" lines are over a performance line and are reported,
not passed and not hidden; "note" lines are context.  The five older network-suite checks that assert the pre-D4 death protocol (the
victim reports its replay and corpse) are superseded by death_net, as at D6: the run passes only when exactly those five fail."""
import json, re, statistics
from pathlib import Path
E = Path('dev/stage-3d-hq1/evidence/hq1-3'); L = []; OK = True; WATCH = []
def gate(ok, text):
    global OK
    OK = OK and bool(ok); L.append(('ok   ' if ok else 'FAIL ') + text)
def watch(ok, text):
    L.append(('ok   ' if ok else 'OVER ') + text)
    if not ok: WATCH.append(text)
def note(text): L.append('note ' + text)
def j(p): return json.loads((E / p).read_text())
def log(p): return (E / p).read_text(errors='replace') if (E / p).exists() else ''
steps = {}
for l in log('steps.txt').splitlines():
    m = re.match(r'(\S+) exit=(\d+)', l)
    if m: steps[m.group(1)] = int(m.group(2))
passed = lambda f: re.search(r'(\d+)/(\d+) passed', log(f))
fails = lambda f: sorted(set(re.sub(r'\s+\[\d+ms\]$', '', l[5:].split('   EXCEPTION')[0]).strip() for l in log(f).splitlines() if l.startswith('FAIL ')))

# ---- R2: non-death output identical; every difference a death-domain one
for f, lab in (('golden3d.json', 'against 3H0 (06949a8)'), ('golden3d_vs_d7.json', 'against D7 (ffe2b53)')):
    g = j(f); fo = {k: v['followOnAfterHandback'] for k, v in g['scenarios'].items() if v.get('followOnAfterHandback')}
    gate(g['ok'] and set(fo) <= {'deaths'} and all(v.get('pass') or v.get('identical') for v in g['scenarios'].values()),
         f"golden3d (server, whole tree) {lab}: every difference starts in the death domain; non-death output identical" + (f"; the bounded follow-on after a killer hand-back in: {', '.join(fo)}" if fo else ''))
ga = j('golden3d_aa_d7.json'); gate(all(v['identical'] for v in ga['scenarios'].values()), f"golden3d A/A (D7 against D7): {sum(v['identical'] for v in ga['scenarios'].values())}/{len(ga['scenarios'])} identical")
for f, lab in (('cli_golden3d.json', 'against 3H0'), ('cli_golden3d_vs_d7.json', 'against D7')):
    c = j(f); gate(c['ok'], f"client golden (mp.js scenes) {lab}: {sum(s['identical'] for s in c['scenes'])} identical, {sum((not s['identical']) and s.get('nonDeathIdentical', False) for s in c['scenes'])} with only death-domain differences, of {len(c['scenes'])}")
k = j('contract3d.json'); gate(k['ok'], f"protocol contract with the 3D death fields (HQ1: lf on the replay): {k['violations']} violations")
k0 = j('contract_3h0.json')
gate(all(v.get('why') == 'field not in the contract' and v.get('t') == 'fx' and v.get('k') in ('de', 'lo', 'el', 'lf') for v in k0.get('firstViolations', [])),
     f"3H0's contract file, unchanged: {k0['violations']} differences, all the optional replay fields {sorted(set(v.get('k') for v in k0.get('firstViolations', [])))}")
s = j('static_check.json'); gate(s['ok'], 'static serving against D7: every path answers as before; server-only files and dev/ still 404')
# ---- R1: D7's regression, every correctness line
gate(steps.get('phys_test') == 0, 'phys_test passes')
pm = j('phys_matrix.json')['byVariant']
gate(all(v['samplingSame'] and v['finite'] and v['neverSlept'] == 0 and v['moveAfterSleep'] == 0 and v['asleepByEnd'] == v['runs'] and max(v['maxBodyPen'], v['maxHandPen'], v['maxGearPen'], v['maxAttPen']) < .5 and v['crossed'] == 0 for v in pm.values()),
     f"phys_matrix ({sum(v['runs'] for v in pm.values())} runs): every death asleep by its end, nothing moves after, same at 30-240 Hz, overlap < 0.5 px, no tunnelling")
gg = j('gore_geo.json'); gate(gg['ok'], f"gore_geo: {gg['live']['onSolid']} of {gg['live']['points']} live and {gg['corpse']['onSolid']} of {gg['corpse']['points']} corpse points on anything solid ({gg['deaths']} deaths)")
lp = j('light_power.json'); gate(lp['ok'], f"light_power (L1, L2): {sum(c['ok'] for c in lp['checks'])}/{len(lp['checks'])}")
ln = j('light_net.json'); gate(ln['ok'], f"light_net (L3, L7): {sum(c['ok'] for c in ln['checks'])}/{len(ln['checks'])}")
dn = j('death_net.json'); gate(dn['ok'], f"death_net: {sum(x['ok'] for x in dn['checks'])}/{len(dn['checks'])}")
ps, pp = j('perf_death_srv.json'), j('perf_death_srv_parent.json')
ms = lambda d: sum(v['medianMs'] for v in d['bodyFor'].values())
watch(ms(ps) <= ms(pp) * 1.07, f"server: the corpse simulation, sum of the eight medians {ms(ps):.1f} ms (D7 {ms(pp):.1f}, line +7 %)")
gate(ps['bodiesMsg']['bytesPerCorpse'] <= 395, f"server: 'bodies' {ps['bodiesMsg']['bytesPerCorpse']} B per corpse (D7 {pp['bodiesMsg']['bytesPerCorpse']}; D0's line 395; these records come without a light profile - a lit corpse's is in light_net H6)")
inc = ps.get('incremental') or {}
gate(len(inc) == 8 and max(v['largestTickMaxMs'] for v in inc.values()) < 25, f"server: the death as the server runs it, largest single tick {max(v['largestTickMedianMs'] for v in inc.values()):.2f} ms median, {max(v['largestTickMaxMs'] for v in inc.values()):.2f} ms worst")
SUPERSEDED = {'existing/live.log': {'L5d the replay reaches Bob, and the corpse (with her light left behind) is stored once for everybody', 'L5e one body per player: sending another replaces it', 'L5f a living player still cannot leave a corpse or trigger a death replay'},
              'existing/audit_net.log': {'D3 a normal death: the victim\'s own replay and corpse are used - one replay, one corpse, nothing added by the server'},
              'existing/audit_net2.log': {'DD2 a connected victim: its own replay and corpse, exactly one of each, nothing added by the server even after the fallback deadline'}}
for f, want in SUPERSEDED.items():
    p = passed(f); got = set(fails(f))
    gate(p and got == want, f"{f[9:-4]}: {p.group(0) if p else '?'}; the failing checks are exactly the {len(want)} superseded by death_net ({', '.join(sorted(x.split(' ')[0] for x in want))})")
gate(steps.get('existing/ir_net') == 0, 'ir_net passes')
gate(steps.get('existing/interp_test') == 0 and steps.get('existing/test_3bn') == 0, 'interp_test and test_3bn pass')
nt, ntp = fails('existing/npm_test.log'), fails('existing/npm_test_parent.log')
gate(nt == ntp and passed('existing/npm_test.log') and passed('existing/npm_test_parent.log') and passed('existing/npm_test.log').group(0) == passed('existing/npm_test_parent.log').group(0),
     f"npm test: {passed('existing/npm_test.log').group(0) if passed('existing/npm_test.log') else '?'}, the same {len(nt)} historical failures as D7, by name")
norm = lambda xs: sorted(x.split(' ')[0] for x in xs)
gate(norm(fails('existing/test_shadows.log')) == norm(fails('existing/test_shadows_parent.log')), f"test_shadows: {passed('existing/test_shadows.log').group(0) if passed('existing/test_shadows.log') else '?'}, the same failures as D7 ({', '.join(norm(fails('existing/test_shadows.log')))})")
gate('12/12 PASS' in log('qa2/camera_fairness.log'), 'camera fairness 12/12')
gate('32/32 passed' in log('qa2/br_role.log'), 'BR-RoLE 32/32')
gate(steps.get('qa2/theme_assets') == 0, 'theme files unchanged')
gate('stage-3c-qa2 evidence untouched: yes' in log('steps.txt'), "QA2 probes wrote their pictures under evidence/hq1-3/qa2/; stage-3c-qa2's own evidence untouched (git status)")
for b in ('probe_b1', 'probe_b2', 'probe_b3'):
    t = log(f'qa2/{b}.log'); gate(steps.get(f'qa2/{b}') == 0 and 'FAIL' not in t, f"QA2 {b}: {t.count(chr(10) + 'PASS') + t.startswith('PASS')} PASS, 0 FAIL")
# ---- R5: all eight variants as at D7
pa = j('parity.json')['compare3d']
mx = lambda key: max(max(c['victimVsServer'][key], c['spectatorVsServer'][key]) for c in pa)
gate(len(pa) == 8 and mx('body') < 1 and mx('light') < 1 and mx('hands') < 1 and mx('hat') < 1 and all(c['victimVsServer']['blood']['seedsSame'] and c['spectatorVsServer']['blood']['seedsSame'] for c in pa) and all(not c['clientSent'] for c in pa),
     f"parity, all eight at normal speed: victim and spectator against the server's corpse: body <= {mx('body')} px, light <= {mx('light')} px, hands <= {mx('hands')}, hat <= {mx('hat')}; the client sends nothing")
sd = j('sound.json')['runs']
v_ok = all(r['victim'] and r['victim'][0]['what'] == 'death' and r['victim'][0]['hits'] for r in sd.values())
s_ok = all(any(x['what'] == 'death' for x in sd[t]['spectator']) for t in ('houndC', 'smilerA', 'houndA_reducedMotion')) and not any(x['what'] == 'death' for x in sd['houndA_bobSoundOff']['spectator'])
f_ok = all(not any(x['what'] == 'death' for x in r['far']) for r in sd.values())
gate(v_ok and s_ok and f_ok, "sound: the victim's death sound has the physics' blows; the spectator hears it (not with sound OFF); out of earshot nothing")
cc = j('corpse_houndC/corpse_check.json')
gate(all(not x['visible'] and not x['cached'] for x in cc['farAway']) and all(x['visible'] and x['cached'] for x in cc['back']) and all(b['born'] and b['age'] >= 20 for b in cc['lateJoiner']['bodies']),
     'corpses: culled and their texture released off screen, cached again on screen; a late joiner gets the corpse with its age')
fs = j('film/film_summary.json')['variants']
gate(len(fs) == 8 and all(v.get('settle') == 'SLEEPING' and v.get('specSeen') for v in fs.values()), 'film: all eight end asleep, and the spectator saw each one')
# ---- 8 players
t8, t7 = j('traffic8/traffic8_hq1.json'), j('traffic8/traffic8_d7.json')
gate(t8['ok'] and t7['T1']['ok'] and t7['T2']['ok'], f"8 players, 6 deaths over the network: every client got every replay once and every corpse, the lit lights' profile the same everywhere, no errors, nobody dropped (D7 the same deliveries)")
b8, b7 = t8['summary']['bytesPerSecPerClient']['mean'], t7['summary']['bytesPerSecPerClient']['mean']
note(f"8 players: {b8} B/s per client (D7 {b7}, {(b8 - b7) / b7 * 100:+.1f} %); snapshot mean {t8['summary']['snapshotMeanBytes']} B (D7 {t7['summary']['snapshotMeanBytes']}); replay sizes {t8['summary']['fxBytes']} (D7 {t7['summary']['fxBytes']}); server tick {t8['summary']['serverTickMs']} ms (D7 {t7['summary']['serverTickMs']}), CPU {t8['summary']['serverCpuSec']} s (D7 {t7['summary']['serverCpuSec']}) - the players move on their own loops, so the snapshots differ run to run")
# ---- R3: interleaved A/B against D7, the whole death
AB = lambda side: [r for i in range(1, 5) if (E / f'perf_ab/{side}_{i}.json').exists() for r in j(f'perf_ab/{side}_{i}.json')['rounds']]
p_, n_ = AB('parent'), AB('new'); rows = []
for w in ('idle', 'houndA', 'houndC'):
    key = 'idle' if w == 'idle' else 'whole_' + w
    for i, who in enumerate(('victim', 'spectator')):
        a = [r[key][i]['frameMedianMs'] for r in p_ if key in r]; b = [r[key][i]['frameMedianMs'] for r in n_ if key in r]
        if a and b: rows.append((w, who, statistics.median(a), statistics.median(b), len(b)))
over = [f'{w} {who}' for w, who, a, b, k in rows if b > a * 1.07]
watch(len(rows) == 6 and not over, "browser A/B, interleaved with D7 (R3: within +7 %), the whole death on both pages, 4 pairs, median of the rounds' frame-time medians: " + '; '.join(f'{w} {who} {a:.0f} -> {b:.0f} ms ({(b - a) / a * 100:+.1f} %)' for w, who, a, b, k in rows) + (f'; over: {", ".join(over)}' if over else ''))
# ---- R4: 20 corpses, memory
pd, p7 = j('perf_death.json'), j('perf_death_parent.json')
worst = lambda d, w: max(x['frameMedianMs'] for r in d['rounds'] if w in r for x in r[w])
for w, lim in (('corpses20_onscreen', 1.10), ('corpses20_offscreen', 1.10), ('idle', 1.07)):
    watch(worst(pd, w) <= worst(p7, w) * lim, f"browser, {w}: worst round's frame-time median {worst(pd, w):.0f} ms (D7 {worst(p7, w):.0f}, line +{round((lim - 1) * 100)} %)")
p0 = json.loads(Path('dev/stage-3d/evidence/d0/perf_death_parent.json').read_text())
d0w = lambda w: max(x['frameMedianMs'] for r in p0['rounds'] for x in r[w])
checks = [(w, worst(pd, w), d0w(w) * 1.10) for w in ('idle', 'death_houndA', 'death_houndC', 'death_smilerA', 'corpses20_onscreen')] + [('corpses20_offscreen', worst(pd, 'corpses20_offscreen'), worst(pd, 'idle') * 1.05)]
gate(all(v <= lim for w, v, lim in checks), "browser, D0's thresholds (as at D6): " + '; '.join(f'{w} {v:.0f} (limit {lim:.0f})' for w, v, lim in checks))
hp = max(x['heapMB'] for r in pd['rounds'] for w in r if isinstance(r[w], list) for x in r[w] if 'heapMB' in x); hp7 = max(x['heapMB'] for r in p7['rounds'] for w in r if isinstance(r[w], list) for x in r[w] if 'heapMB' in x)
note(f'browser: the largest JS heap sample {hp:.0f} MB (D7 in the same session {hp7:.0f} MB)')
hph = [j('perf_high/new_high.json'), j('perf_high/parent_high.json')]
note('browser at HIGH lighting, worst round: ' + '; '.join(f"{w} {worst(hph[0], w):.0f} ms (D7 {worst(hph[1], w):.0f})" for w in ('idle', 'death_houndA', 'death_houndC') if w in hph[0]['rounds'][0]))
sk, skp = j('soak.json'), j('soak_parent.json')
gate(all(abs(v) < .5 for v in sk['slopeMBPerDeath'].values()) and sk['maxReplaysLeft'] == 0 and all(abs(v) < 5 for v in sk['slopeDisplayObjectsPerDeath'].values()),
     f"browser soak, {sk['deaths']} deaths: JS heap after GC {sk['slopeMBPerDeath']} MB per death (D7 {skp['slopeMBPerDeath']}), display objects {sk['slopeDisplayObjectsPerDeath']} per death, replays left {sk['maxReplaysLeft']}")
gate(all(sk['slopeMBPerDeath'][k] <= skp['slopeMBPerDeath'][k] + .1 for k in sk['slopeMBPerDeath'] if k in skp['slopeMBPerDeath']), f"browser heap slope within D7's + 0.1 MB per death (R4)")
g6, gp = j('soak_gc/soak_gc.json'), j('soak_gc/soak_gc_parent.json'); r6 = [r['serverRssMB'] for r in g6['rows']]; rp = [r['serverRssMB'] for r in gp['rows']]
gate(g6['serverHeapAfterFullGC']['last'] <= gp['serverHeapAfterFullGC']['last'] + 1 and max(r6[-8:]) - min(r6[-8:]) < 2,
     f"browser soak, {len(r6)} deaths, the server's GC traced: its heap after full collections {g6['serverHeapAfterFullGC']['first']} -> {g6['serverHeapAfterFullGC']['last']} MB (D7 {gp['serverHeapAfterFullGC']['first']} -> {gp['serverHeapAfterFullGC']['last']}; R4: within D7 + 1 MB); RSS over the last 8 deaths {min(r6[-8:])}-{max(r6[-8:])} MB (D7 {min(rp[-8:])}-{max(rp[-8:])})")
ss, ssp = j('server_soak.json'), j('server_soak_parent.json')
gate(ss['died'] == ss['deaths'] and abs(ss['heapSlopeMBPerDeath']) < .05 and abs(ss['rssSlopeMBPerDeath']) < .5 and not ss['serverErrors'],
     f"server soak, {ss['deaths']} deaths, forced GC: heap {ss['heapFirstLast'][0]} -> {ss['heapFirstLast'][1]} MB ({ss['heapSlopeMBPerDeath']} MB per death; D7 {ssp['heapSlopeMBPerDeath']}), RSS slope {ss['rssSlopeMBPerDeath']} MB per death (D7 {ssp['rssSlopeMBPerDeath']})")
sn, snp = j('server_soak_nogc.json'), j('server_soak_nogc_parent.json'); q = [r['rssMB'] for r in sn['rows']]; qp = [r['rssMB'] for r in snp['rows']]
gate(sn['died'] == sn['deaths'] and not sn['serverErrors'] and max(q[-16:]) <= max(q[:-16]),
     f"server soak, {sn['deaths']} deaths, no forced GC: RSS {q[0]} -> peak {max(q)} -> {q[-1]} MB, no new peak in the last 16 deaths (D7 {qp[0]} -> peak {max(qp)} -> {qp[-1]})")
R = {'tool': 'dev/stage-3d-hq1/summarize_hq1.py', 'ok': OK, 'over': WATCH, 'lines': L,
     'how': "ok: every gated line holds. 'over' lists the lines over a performance line (R3, R4); they are reported in STAGE_3D_HQ1_PERFORMANCE.md and the report, not passed"}
(E / 'summary.json').write_text(json.dumps(R, indent=1, ensure_ascii=False) + '\n'); print('\n'.join(L)); print(('OK' if OK else 'NOT OK') + (f'; OVER a performance line: {len(WATCH)}' if WATCH else ''))
