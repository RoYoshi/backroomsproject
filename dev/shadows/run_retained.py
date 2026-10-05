#!/usr/bin/env python3
"""2D Lighting & Shadows - retained v23.3.6 gameplay regression runner.

  python3 dev/shadows/run_retained.py run --game PATH --out DIR [--only id,id] [--skip id,id] [--timeout-scale N]
  python3 dev/shadows/run_retained.py compare --base BASE/retained.json --cand CAND/retained.json [--out compare.md]

Runs the unmodified v23.3.6 suites serially (one server / browser at a time; fixed ports inside the suites),
one log per suite, and a machine-readable summary.  No suite, threshold or assertion is changed by this tool.
`compare` reports, suite by suite, whether the candidate reproduces the baseline exactly: same verdict,
same counts and the same set of failing assertion names.  Wall-clock durations are runner metadata only.
The per-suite timeouts are this runner's own safety deadlines (a hung suite is reported BLOCKED), not part of any
suite; `--timeout-scale` multiplies them on a slower machine and is recorded in the run's metadata.
"""
import argparse, json, os, platform, re, signal, subprocess, sys, time, urllib.request
from pathlib import Path

PY = sys.executable
# id, command, timeout (s), what it covers (the SH-05 list in SHADOWS_ACCEPTANCE_MATRIX.md)
SUITES = [
    ('npm-test', ['node', 'dev/tests/run.js'], 900, 'default scenario suites: percept, hound, smiler, capture, system, admin, commit, nav, chase, audit, evidence, ir, hound2e, shared2f'),
    ('humanqa', ['node', 'dev/tests/run.js', 's_humanqa_hotfix.js'], 600, 'human-QA hotfix suite'),
    ('entity-look', ['node', 'dev/tests/run.js', 's_entity_look.js'], 600, 'entity look'),
    ('camera', ['node', 'dev/tests/s_camera_fairness.js'], 300, 'camera fairness'),
    ('fps', ['node', 'dev/tests/s_fps_equality.js'], 300, 'FPS-independent gameplay'),
    ('physics', ['node', 'dev/tests/phys_test.js'], 300, 'death physics (dphys.js)'),
    ('interpolation', ['node', 'dev/tests/interp_test.js'], 300, 'network snapshot interpolation (mp.js, extracted verbatim)'),
    ('live', ['node', 'dev/tests/live.js'], 300, 'server boot + real WebSocket protocol, kill flow, admin gating'),
    ('audit-net', ['node', 'dev/tests/audit_net.js'], 300, 'networking audit remediation'),
    ('audit-net2', ['node', 'dev/tests/audit_net2.js'], 600, 'networking exploit sequences'),
    ('ir-net', ['node', 'dev/tests/ir_net.js'], 300, 'IR on the wire'),
    ('browser-move', [PY, 'dev/tests/move_test.py'], 300, 'movement in the real client (move.js through the shipped page)'),
    ('browser-play', [PY, 'dev/tests/play_mp.py', '{art}'], 300, 'ordinary player moves; server never corrects'),
    ('browser-light', [PY, 'dev/tests/light_test.py', '{art}'], 300, 'entity visibility vs lighting in the real client'),
    ('browser-ir', [PY, 'dev/tests/ir_test.py', '{art}'], 400, 'IR / darkness layer measured on the #light canvas'),
    ('browser-admin', [PY, 'dev/tests/admin_test.py'], 400, 'admin panel / death preview / pause'),
    ('browser-lifecycle', [PY, 'dev/tests/lifecycle_mp.py', '{art}'], 400, 'lifecycle buttons for an ordinary player'),
    ('browser-smiler2d', [PY, 'dev/tests/smiler2d_view.py', '{art}'], 400, 'Smiler 2D presentation + debug feed'),
    ('browser-chase', [PY, 'dev/tests/chase_mp.py', '{art}'], 400, 'search/crawl debug layers, a hunt (descriptive)'),
    ('browser-nav', [PY, 'dev/tests/nav_mp.py', '{art}'], 400, 'navigation overlay, remote hound drawing (descriptive)'),
]
DESCRIPTIVE = {'browser-chase', 'browser-nav'}          # print JSON without a verdict: judged by exit status + page errors
SERVE_PROBE = ['/', '/index.html', '/assets/index-DKbV5Nv9.js', '/light.js', '/world.js', '/camera_policy.js', '/timing_policy.js', '/assets/shadows-2d.js', '/sim.js', '/ai.js', '/server.js']


def boot_check(game, port, log):
    """server boot: the shipped `node server.js` starts and serves the client; records which client files it serves"""
    t0 = time.monotonic(); codes = {}; line = ''
    with open(log, 'w') as f:
        p = subprocess.Popen(['node', 'server.js', str(port)], cwd=game, stdout=f, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            for _ in range(80):
                try:
                    if urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=1).status == 200: break
                except Exception: time.sleep(.1)
            for u in SERVE_PROBE:
                try: codes[u] = urllib.request.urlopen(f'http://127.0.0.1:{port}{u}', timeout=3).status
                except urllib.error.HTTPError as e: codes[u] = e.code
                except Exception as e: codes[u] = str(e)[:60]
        finally:
            os.killpg(p.pid, signal.SIGTERM)
            try: p.wait(timeout=3)
            except subprocess.TimeoutExpired: os.killpg(p.pid, signal.SIGKILL); p.wait()
    txt = Path(log).read_text(); line = next((l for l in txt.splitlines() if 'Far Backrooms' in l or 'localhost' in l), txt.strip()[:120])
    ok = codes.get('/') == 200 and codes.get('/assets/index-DKbV5Nv9.js') == 200 and all(codes.get(u) == 404 for u in ('/sim.js', '/ai.js', '/server.js'))
    with open(log, 'a') as f: f.write('\nSERVED ' + json.dumps(codes) + '\n' + ('PASS' if ok else 'FAIL') + ' server boot\n')
    return {'id': 'server-boot', 'command': f'node server.js {port} (+ HTTP probe)', 'result': 'PASS' if ok else 'FAIL', 'exitCode': 0 if ok else 1,
            'durationSeconds': round(time.monotonic() - t0, 3), 'counts': {'passed': int(ok), 'total': 1, 'source': 'boot probe'}, 'failures': [] if ok else ['server boot'],
            'served': codes, 'startupLine': line, 'log': Path(log).name, 'covers': 'server boot; which client files the shipped server serves'}


def parse(txt, sid, code):
    # a failing assertion's NAME (its note / measured values after a 3-space gap or the timing tag are not part of the name)
    fails = [re.split(r'\s{2,}-\s|\s{3,}', re.sub(r'\s+\[\d+ms\]\s*$', '', l[5:]).strip())[0] for l in txt.splitlines() if l.startswith('FAIL ')]
    passes = [l for l in txt.splitlines() if l.startswith('PASS ')]
    m = re.findall(r'^(\d+)/(\d+) passed', txt, re.M) or re.findall(r'(\d+)/(\d+) checks passed', txt) or re.findall(r'(\d+)/(\d+) PASS\b', txt)
    if m: counts = {'passed': int(m[-1][0]), 'total': int(m[-1][1]), 'source': 'suite summary line'}
    else:
        js = None
        for l in reversed(txt.splitlines()):
            l = l.strip()
            if l.startswith('{') and l.endswith('}'):
                try: js = json.loads(l); break
                except ValueError: pass
        if js is not None and isinstance(js.get('ok'), bool):
            counts = {'passed': int(js['ok']), 'total': 1, 'source': 'suite JSON verdict'}
            if not js['ok'] and not fails: fails = [k for k, v in js.items() if v is False] or ['ok=false']
        elif passes or fails: counts = {'passed': len(passes), 'total': len(passes) + len(fails), 'source': 'PASS/FAIL lines'}
        else: counts = {'passed': None, 'total': None, 'source': 'no verdict printed; exit status only'}
        if js is not None and sid in DESCRIPTIVE:
            errs = js.get('errors') or []
            counts = {'passed': int(code == 0 and not errs), 'total': 1, 'source': 'descriptive suite: exit status + page errors', 'pageErrors': len(errs)}
            if errs: fails = ['page errors: ' + '; '.join(sorted({re.sub(r'\d+', '#', str(e))[:120] for e in errs}))]      # distinct messages, not how many times
    return counts, fails


ERR_RX = re.compile(r"Failed to load resource:[^'\"\\\]\n]{0,100}|\b[A-Z][A-Za-z]*Error\b:[^'\"\\\]\n]{0,100}|Uncaught[^'\"\\\]\n]{0,100}|\[shadows-2d\][^'\"\\\]\n]{0,100}")


def error_signature(txt):
    """distinct page/console error messages a suite printed (digits normalised): a 'no errors' check that fails for the same
    pre-existing reason must not hide a NEW error, so the candidate's set must equal the baseline's"""
    return sorted({re.sub(r'\d+', '#', m.strip()) for m in ERR_RX.findall(txt)})


def cmd_run(a):
    game = Path(a.game).resolve(); out = Path(a.out).resolve(); out.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
    meta = {'game': str(game), 'node': subprocess.check_output(['node', '--version'], text=True).strip(), 'python': platform.python_version(),
            'os': platform.platform(), 'machine': platform.machine(), 'cpus': os.cpu_count(), 'label': a.label, 'started': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    try: meta['playwright'] = subprocess.check_output([PY, '-c', 'import importlib.metadata as m; print(m.version("playwright"))'], text=True).strip()
    except Exception: meta['playwright'] = None
    try: meta['gitHead'] = subprocess.check_output(['git', '-C', str(game), 'rev-parse', 'HEAD'], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception: meta['gitHead'] = None
    only = set(filter(None, a.only.split(','))); skip = set(filter(None, a.skip.split(',')))
    rows = []
    if (not only or 'server-boot' in only) and 'server-boot' not in skip:
        r = boot_check(game, 8791, out / 'server-boot.log'); rows.append(r); print(json.dumps({k: r[k] for k in ('id', 'result', 'counts')}), flush=True)
    meta['timeoutScale'] = a.timeout_scale
    for sid, cmd, timeout, covers in SUITES:
        if (only and sid not in only) or sid in skip: continue
        timeout = int(round(timeout * a.timeout_scale))
        art = out / (sid + '-artifacts')
        if any('{art}' in c for c in cmd): art.mkdir(exist_ok=True)
        cmd = [c.replace('{art}', str(art)) for c in cmd]
        log = out / (sid + '.log'); t0 = time.monotonic(); code = None; blocked = None
        print('START ' + sid, flush=True)
        with log.open('w') as f:
            p = subprocess.Popen(cmd, cwd=game, stdout=f, stderr=subprocess.STDOUT, start_new_session=True, env=env)
            try: code = p.wait(timeout=timeout)
            except subprocess.TimeoutExpired: blocked = f'runner safety deadline {timeout}s reached'
            finally:
                try: os.killpg(p.pid, signal.SIGTERM)
                except ProcessLookupError: pass
                try: p.wait(timeout=3)
                except subprocess.TimeoutExpired: os.killpg(p.pid, signal.SIGKILL); p.wait()
        txt = log.read_text(errors='replace'); counts, fails = parse(txt, sid, code)
        res = 'BLOCKED' if blocked else ('PASS' if code == 0 and not fails else 'FAIL')
        if sid in DESCRIPTIVE and not blocked: res = 'PASS' if counts.get('passed') == 1 else 'FAIL'
        row = {'id': sid, 'command': ' '.join(cmd).replace(str(out) + '/', '<out>/'), 'covers': covers, 'result': res, 'exitCode': code, 'durationSeconds': round(time.monotonic() - t0, 3),
               'counts': counts, 'failures': fails, 'errorSignature': error_signature(txt), 'limitation': blocked, 'log': log.name}
        rows.append(row)
        (out / 'retained.json').write_text(json.dumps({'meta': meta, 'suites': rows}, indent=1) + '\n')
        print(json.dumps({k: row[k] for k in ('id', 'result', 'durationSeconds', 'counts')}) + (' FAILS ' + '; '.join(fails)[:300] if fails else ''), flush=True)
    meta['finished'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    (out / 'retained.json').write_text(json.dumps({'meta': meta, 'suites': rows}, indent=1) + '\n')
    return 0


def cmd_reparse(a):
    """recompute counts / failure names from the saved logs (parser improvements never require re-running suites)"""
    f = Path(a.out) / 'retained.json'; R = json.loads(f.read_text())
    for row in R['suites']:
        if row['id'] == 'server-boot': continue
        txt = (Path(a.out) / row['log']).read_text(errors='replace'); counts, fails = parse(txt, row['id'], row['exitCode'])
        row['counts'], row['failures'], row['errorSignature'] = counts, fails, error_signature(txt)
        if not row.get('limitation'): row['result'] = ('PASS' if counts.get('passed') == 1 else 'FAIL') if row['id'] in DESCRIPTIVE else ('PASS' if row['exitCode'] == 0 and not fails else 'FAIL')
    f.write_text(json.dumps(R, indent=1) + '\n'); print('reparsed', f); return 0


def cmd_compare(a):
    B = json.loads(Path(a.base).read_text()); C = json.loads(Path(a.cand).read_text())
    bs = {r['id']: r for r in B['suites']}; cs = {r['id']: r for r in C['suites']}
    lines = ['| suite | baseline | candidate | same verdict | same counts | same failing set | same error messages |', '|---|---|---|---|---|---|---|']; diffs = []
    for sid in [r['id'] for r in B['suites']] + [i for i in cs if i not in bs]:
        b, c = bs.get(sid), cs.get(sid)
        if not b or not c: lines.append(f'| {sid} | {b and b["result"]} | {c and c["result"]} | - | - | - |'); diffs.append(sid + ' missing'); continue
        fmt = lambda r: f"{r['result']} {r['counts'].get('passed')}/{r['counts'].get('total')}"
        sv = b['result'] == c['result']; sc = (b['counts'].get('passed'), b['counts'].get('total')) == (c['counts'].get('passed'), c['counts'].get('total')); sf = set(b['failures']) == set(c['failures'])
        se = set(b.get('errorSignature') or []) == set(c.get('errorSignature') or [])
        lines.append(f"| {sid} | {fmt(b)} | {fmt(c)} | {'yes' if sv else '**NO**'} | {'yes' if sc else '**NO**'} | {'yes' if sf else '**NO**'} | {'yes' if se else '**NO**'} |")
        if not (sv and sc and sf and se): diffs.append(f"{sid}: baseline {fmt(b)} {sorted(b['failures'])} {b.get('errorSignature')} vs candidate {fmt(c)} {sorted(c['failures'])} {c.get('errorSignature')}")
    md = '\n'.join(lines) + '\n\n' + ('**All suites reproduce the baseline exactly.**' if not diffs else '**Differences:**\n' + '\n'.join('- ' + d for d in diffs)) + '\n'
    if a.out: Path(a.out).write_text(md)
    print(md); return 0 if not diffs else 1


def main():
    P = argparse.ArgumentParser(); S = P.add_subparsers(dest='cmd', required=True)
    r = S.add_parser('run'); r.add_argument('--game', default=str(Path(__file__).resolve().parents[2])); r.add_argument('--out', required=True)
    r.add_argument('--only', default=''); r.add_argument('--skip', default=''); r.add_argument('--label', default='')
    r.add_argument('--timeout-scale', type=float, default=1.0, help='multiply the runner safety deadlines (slower machine); recorded in meta')
    c = S.add_parser('compare'); c.add_argument('--base', required=True); c.add_argument('--cand', required=True); c.add_argument('--out')
    rp = S.add_parser('reparse'); rp.add_argument('--out', required=True)
    a = P.parse_args(); sys.exit({'run': cmd_run, 'compare': cmd_compare, 'reparse': cmd_reparse}[a.cmd](a))


if __name__ == '__main__':
    main()
