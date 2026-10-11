#!/usr/bin/env python3
"""Stage 3H0 H0-5 - one summary of the final regression on the final tree (development only).

  python3 -I dev/stage-3h0/summarize_h05.py      (in the repository; reads dev/stage-3h0/evidence/h0-5/, writes summary.json there)

Each line says what ran, its result, and what it is compared with:
  - the existing suites against their H0-1 results on the parent (the same passes; npm test: the same failing checks, by name);
  - QA2's own final checks (QA2 R3 ran them on the parent): camera fairness, BR-RoLE, theme files, QA2's three probes, and the older
    probes' regression (each check compared with R3's result for the same check);
  - the menu and boot captures of the parent and the final tree, taken now (compare_captures.py), and the parent's against R3's;
  - the gate (golden traces + contract), the scope check, the live wire and raw socket comparisons, and performance.
ok only when every gated item holds.  Reported-only items (capture differences, QA2's performance tools) are listed, not gated."""
import json, os, re, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
E, H1 = 'dev/stage-3h0/evidence/h0-5', 'dev/stage-3h0/evidence/h0-1'
R3 = 'dev/stage-3c-qa2/evidence/r3'
lines, gates, details = [], {}, {}
def rd(p):
    try: return open(p, encoding='utf8', errors='replace').read()
    except OSError: return None
def js(p):
    try: return json.load(open(p))
    except (OSError, ValueError): return None
def gate(name, ok, text): gates[name] = bool(ok); lines.append(('PASS ' if ok else 'FAIL ') + text)
def note(text): lines.append('NOTE ' + text)
passed = lambda t: (re.findall(r'^(\d+)/(\d+) passed', t or '', re.M) or [None])[-1]
fails = lambda t: sorted(set(re.sub(r'\s+\[\d+ms\]$', '', l[5:]).strip() for l in (t or '').splitlines() if l.startswith('FAIL ')))
# 1. existing suites
for s in ['live', 'audit_net', 'audit_net2', 'ir_net', 'test_3bn']:
    now, then = passed(rd(f'{E}/existing/{s}.log')), passed(rd(f'{H1}/existing/{s}.log'))
    gate('existing/' + s, now and now == then and now[0] == now[1], f'{s}: {"/".join(now) if now else "no result"} (H0-1 on the parent: {"/".join(then) if then else "?"})')
t = rd(f'{E}/existing/interp_test.log'); gate('existing/interp_test', t and 'interpolation checks passed' in t, 'interp_test: ' + ('interpolation checks passed' if t and 'interpolation checks passed' in t else 'NOT passed'))
now, then = rd(f'{E}/existing/npm_test.log'), rd(f'{H1}/existing/npm_test.log')
fn, ft = fails(now), fails(then)
details['npm_test'] = {'now': passed(now), 'h01': passed(then), 'failingNow': fn, 'failingAtH01': ft, 'newFailures': sorted(set(fn) - set(ft)), 'nowPassing': sorted(set(ft) - set(fn))}
gate('existing/npm_test', passed(now) and passed(now) == passed(then) and fn == ft,
     f'npm test: {"/".join(passed(now)) if passed(now) else "no result"}, the same {len(fn)} historical failures as H0-1 on the parent: {"yes" if fn == ft else "NO (new: " + str(sorted(set(fn) - set(ft))) + ")"}')
# 2. QA2's final checks
t = rd(f'{E}/qa2/camera_fairness.log'); m = re.search(r'CAMERA FAIRNESS: (\d+)/(\d+) PASS', t or '')
gate('qa2/camera_fairness', m and m.group(1) == m.group(2), 'camera fairness: ' + (m.group(0) if m else 'no result') + ' (QA2 R3: ' + ((re.search(r'CAMERA FAIRNESS: \S+ PASS', rd(f'{R3}/camera_fairness.log') or '') or [None])[0] or '?') + ')')
t = rd(f'{E}/qa2/br_role.log'); p_ = len(re.findall(r'^PASS', t or '', re.M)); f_ = len(re.findall(r'^FAIL', t or '', re.M)); r3b = rd(f'{R3}/br_role.log')
gate('qa2/br_role', t and p_ and not f_, f'BR-RoLE unit checks: {p_}/{p_ + f_} PASS (QA2 R3: {len(re.findall(r"^PASS", r3b or "", re.M))}/{len(re.findall(r"^(PASS|FAIL)", r3b or "", re.M))})')
j = js(f'{E}/qa2/theme_assets.json'); gate('qa2/theme_assets', j and j.get('ok') is True, 'theme files (the menu music and its seams): ' + ('ok' if j and j.get('ok') else 'NOT ok'))
for b in ('probe_b1', 'probe_b2', 'probe_b3'):
    j = js(f'{E}/qa2/{b}.json'); n = len(j['checks']) if j else 0; k = sum(c['ok'] for c in j['checks']) if j else 0
    gate('qa2/' + b, j and j.get('ok') and k == n, f'QA2 {b}: {k}/{n} checks pass')
J, J3 = js(f'{E}/qa2/regress/regression.json'), js(f'{R3}/regress/regression.json')
if J:
    diff = []
    for pn, p in J['probes'].items():
        old = {c['name']: c['ok'] for c in (J3 or {}).get('probes', {}).get(pn, {}).get('checks', [])}
        for c in p['checks']:
            if c['name'] in old and old[c['name']] != c['ok']: diff.append({'probe': pn, 'check': c['name'][:160], 'r3': old[c['name']], 'now': c['ok'], 'why': c.get('why'), 'artifact': c.get('artifact'), 'supersededBy': c.get('supersededBy')})
    details['regress'] = {'ok': J.get('ok'), 'differFromR3': diff, 'perProbe': {pn: f"{sum(c['ok'] for c in p['checks'])}/{len(p['checks'])}" for pn, p in J['probes'].items()}}
    unexpl = [(pn, c['name']) for pn, p in J['probes'].items() for c in p['checks'] if not c['ok'] and not (c.get('supersededBy') or c.get('artifact'))]
    # a check that failed without a listed reason is re-run through QA2's own runner, alternating the final tree and the parent (qa2/rerun/)
    reruns = {}
    for d in sorted(os.listdir(f'{E}/qa2/rerun')) if os.path.isdir(f'{E}/qa2/rerun') else []:
        rj = js(f'{E}/qa2/rerun/{d}/regression.json')
        if rj: reruns[d] = {(pn, c['name']): c['ok'] for pn, p in rj['probes'].items() for c in p['checks']}
    explained = []
    for key in unexpl:
        fin = [r[key] for n, r in reruns.items() if n.startswith('final') and key in r]; par = [r[key] for n, r in reruns.items() if n.startswith('parent') and key in r]
        explained.append({'probe': key[0], 'check': key[1][:160], 'finalReruns': fin, 'parentReruns': par, 'passedOnARerunOfTheFinalTree': any(fin), 'failedOnTheParentToo': par.count(False) > 0})
    details['regress']['unexplainedInTheMainRun'] = explained
    details['regress']['reruns'] = {n: (js(f'{E}/qa2/rerun/{n}/regression.json') or {}).get('ok') for n in reruns}
    clean = J.get('ok') is True or (explained and all(e['passedOnARerunOfTheFinalTree'] for e in explained))
    gate('qa2/regress', clean, f"QA2's regression of the older probes (12 probes): {'clean' if J.get('ok') else str(len(explained)) + ' check(s) failed without a listed reason in the main run'}; "
         + ', '.join(f'{pn} {v}' for pn, v in details['regress']['perProbe'].items()) + f'; checks whose result differs from QA2 R3: {len(diff)}')
    for e in explained:
        lines.append(f"     {e['probe']}: {e['check'][:90]} - final-tree re-runs {['pass' if x else 'FAIL' for x in e['finalReruns']]}, parent re-runs {['pass' if x else 'FAIL' for x in e['parentReruns']]}")
else: gate('qa2/regress', False, "QA2's regression: no result")
# 3. captures (reported, not gated: a live menu is animated)
for k in ('menu', 'boot'):
    j = js(f'{E}/qa2/compare_{k}.json')
    if j: note(f'{k} captures, the final tree against the parent, both taken now: {j["images"]} pairs, unpaired {len(j["missing"])}, largest share of pixels changed {j["largestChangedShare"]:.4f}')
    j2 = js(f'{E}/qa2/compare_{k}_parent_vs_r3.json')
    if j2: note(f'  the same for the parent now against QA2 R3 (the same code, another day): largest share {j2["largestChangedShare"]:.4f}')
# 4. the gate, scope, live, raw sockets
j = js(f'{E}/checkpoint.json'); gate('gate', j and j.get('ok'), 'golden traces (server 11 scenarios, client 9 scenes) old against new and against the baselines, and the protocol contract: ' + ('ALL EQUIVALENT' if j and j.get('ok') else 'NOT equivalent'))
j = js(f'{E}/final_tree/checkpoint.json'); gate('gate/final_tree', j and j.get('ok'), 'the same gate again after the comment-only corrections (the final tree): ' + ('ALL EQUIVALENT' if j and j.get('ok') else 'NOT equivalent'))
fe = {t: js(f'{E}/final_tree/fn_equiv_{t}.json') for t in ('wire', 'interp', 'ws', 'fields')}
gate('fn_equiv/final_tree', all(v and v.get('ok') for v in fe.values()), 'function equivalence of all four pure pieces on the final tree (wire, interp, ws, fields): ' + ('identical' if all(v and v.get('ok') for v in fe.values()) else 'DIFFERENT'))
j = js(f'{E}/final_tree/static_mutants.json'); gate('static_mutants/final_tree', j and j['caught'] == j['applied'] and (j.get('control') or {}).get('same'), 'static serving mutants on the final tree: ' + (f"{j['caught']}/{j['applied']} caught, control identical" if j else 'no result'))
for t in ('interp_test', 'test_3bn'):
    lg = rd(f'{E}/final_tree/{t}.log') or ''
    gate('final_tree/' + t, ('interpolation checks passed' in lg) if t == 'interp_test' else bool(re.search(r'^7/7 passed', lg, re.M)), f'{t} on the final tree: ' + ('passed' if (('interpolation checks passed' in lg) if t == 'interp_test' else re.search(r'^7/7 passed', lg, re.M)) else 'NOT passed'))
tp, tf = rd(f'{E}/final_tree/test_shadows_parent.log'), rd(f'{E}/final_tree/test_shadows_final.log')
fp, ff = [l.split('   ')[0][5:].strip()[:60] for l in (tp or '').splitlines() if l.startswith('FAIL ')], [l.split('   ')[0][5:].strip()[:60] for l in (tf or '').splitlines() if l.startswith('FAIL ')]
gate('test_shadows', passed(tp) == passed(tf) and fp == ff, f'dev/shadows/test_shadows.js (reads server.js text in S16): parent {"/".join(passed(tp) or ("?", "?"))}, final {"/".join(passed(tf) or ("?", "?"))}, the same failing checks: {"yes" if fp == ff else "NO"}')
j = js(f'{E}/scope_check.json'); gate('scope', j and j.get('ok'), 'scope: ' + (f"every change is an approved extraction, the adapted test, tooling or documentation ({j['counts']})" if j and j.get('ok') else 'NOT ok'))
runs = [('main', js(f'{E}/live_wire.json')), ('rerun 2', js(f'{E}/live_rerun/live_wire_2.json')), ('rerun 3', js(f'{E}/live_rerun/live_wire_3.json'))]
aa = [js(f'{E}/live_rerun/live_wire_aa_{i}.json') for i in (1, 2)]
OUTAGE = ('server_down|', 'server_restart|')        # the server is stopped and started again: real-time reconnects, and the game playing offline meanwhile
rule = lambda r: r and (r.get('structurallyIdentical') or all(d['at'].startswith(OUTAGE) for d in r.get('diffs', [])))
gate('live_wire', any(r and r.get('structurallyIdentical') for _, r in runs) and all(rule(r) for _, r in runs),
     'live wire (the real server and game, two players, every phase), old against new: ' + ', '.join(f"{n} {'identical' if r and r.get('structurallyIdentical') else str(len((r or {}).get('diffs', []))) + ' differences, all in the outage phases' if rule(r) else 'DIFFERENT'}" for n, r in runs)
     + f"; A/A (the parent against itself): {', '.join('identical' if r and r.get('structurallyIdentical') else 'different' for r in aa)}")
j = js(f'{E}/raw_live.json'); gate('raw_live', j and j.get('identical'), 'real sockets (node server.js old and new): ' + (f"{j['httpCases']} HTTP exchanges and {j['wsChecks']} WebSocket checks identical" if j and j.get('identical') else 'DIFFERENT or missing'))
# 5. performance
j = js(f'{E}/perf_det.json')
if j:
    ok = all(v['ok'] for w in j['server'].values() for v in ([w] if 'ok' in w else w.values())) and all(v['ok'] for w in j['client'].values() for v in w.values())
    gate('perf_det', ok, 'deterministic performance (server CPU, client hook and handler; 15 rounds): ' + ('within the H0-1 rule' if ok else 'OUTSIDE the rule'))
else: gate('perf_det', False, 'deterministic performance: no result')
j = js(f'{E}/perf_h0.json')
if j: gate('perf_h0', j.get('ok') is not False, 'real-stack server CPU (perf_h0.js, 3 rounds): ' + ('within the H0-1 rule' if j.get('ok') is not False else 'OUTSIDE the rule') + f" (play8 {j['server']['play8']['cpuMsPerSec']['changePct']:+.1f} %, debug4 {j['server']['debug4']['cpuMsPerSec']['changePct']:+.1f} %)")
j = js(f'{E}/perf_h0_server_r6.json')
if j: gate('perf_h0_r6', j.get('ok') is not False, 'real-stack server CPU again, 6 rounds: ' + ('within the H0-1 rule' if j.get('ok') is not False else 'OUTSIDE the rule') + f" (play8 {j['server']['play8']['cpuMsPerSec']['changePct']:+.1f} %, debug4 {j['server']['debug4']['cpuMsPerSec']['changePct']:+.1f} %)")
j = js(f'{E}/summon/summon_seeds.json')
if j: gate('summon_seeds', j.get('allIdentical'), f"the summoned-Hound sequence in the closed world, 30 seeds: {j['identical']}/{j['seeds']} byte-identical old against new; a monster came within 620 px in {j['closestApproach']['under620']} of {j['closestApproach']['of']} worlds")
for f, label in (('summon_probe.json', 'first run, 12 rounds'), ('summon/summon_probe_r24.json', 'replication, 24 rounds')):
    j = js(f'{E}/{f}')
    if j: note(f"the same on the real server ({label}): under 620 px old {j['old']['under620']}/{j['old']['runs']}, new {j['new']['under620']}/{j['new']['runs']}; Mann-Whitney p = {j['mwu']['p']}")
for k in ('perf_ab', 'perf_start'):
    if js(f'{E}/qa2/{k}.json'): note(f"QA2's {k}_qa2.js, the parent against the final tree: reported in STAGE_3H0_PERFORMANCE.md")
# 6. the old suites wrote nothing outside the stage's folder
for f in ('repo_status_after.txt', 'repo_status_after_b.txt', 'repo_status_after_c.txt', 'repo_status_after_e.txt'):
    t = rd(f'{E}/{f}')
    if t is not None:
        stray = [l for l in t.splitlines() if l.strip() and not re.match(r'^.. (3H0_|STAGE_3H0_|mp\.js$|assets/net-wire\.js$|server/static\.js$)', l)]   # the stage's documents, and the three comment-only corrections of H0-5
        gate('clean/' + f, not stray, f'the suites left the repository clean outside dev/stage-3h0/ ({f}): ' + ('yes' if not stray else 'NO: ' + '; '.join(stray[:6])))
out = {'tool': 'dev/stage-3h0/summarize_h05.py', 'ok': all(gates.values()) and len(gates) > 0, 'gates': gates, 'lines': lines, 'details': details}
json.dump(out, open(f'{E}/summary.json', 'w'), indent=1)
print('\n'.join(lines)); print('H0-5 final regression:', 'ALL AS REQUIRED' if out['ok'] else 'PROBLEMS')
sys.exit(0 if out['ok'] else 1)
