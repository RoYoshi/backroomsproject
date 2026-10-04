#!/usr/bin/env python3
"""Serial retained H5 gates. A new output directory preserves every attempt."""
import pathlib, subprocess, json, os, sys, time

root = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1]).resolve()
parent = pathlib.Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=False)
commands = [
    ('parent-baseline', ['python', 'dev/stage_a/run_baseline.py', '--game', str(parent), '--out', str(out/'parent-baseline'), '--only', 'npm-test,shared']),
    ('stage-b-geometry', ['node', 'dev/stage_b/test_geometry.js']),
    ('stage-c-motion', ['node', 'dev/stage_c/test_spatial.js']),
    ('stage-c-adversarial', ['node', 'dev/stage_c/test_adversarial.js']),
    ('stage-c-schedules', ['node', 'dev/stage_c/test_schedules.js']),
    ('stage-c-camera', ['node', 'dev/stage_c/test_camera.js']),
    ('stage-e', ['node', 'dev/tests/run.js', 's_nav25d.js', 's_perception25d.js']),
    ('stage-d-view', ['node', 'dev/stage_d/test_view.js', str(out/'view.json')]),
    ('stage-d-independence', ['node', 'dev/stage_d/test_independence.js', str(out/'independence.json')]),
    ('stage-f-protocol', ['node', 'dev/stage_f/test_f1.js']),
    ('stage-f-authority', ['node', 'dev/stage_f/test_f2.js']),
    ('network25d', ['node', 'dev/tests/network25d.js']),
    ('physics25d', ['node', 'dev/tests/physics25d.js']),
    ('frozen-parity', ['python', 'dev/stage_h/run_parity.py', str(out/'parity')]),
    ('stage-d-browser-core', ['node', 'dev/stage_d/browser_core.js', str(root), str(out/'browser-d-core')]),
    ('stage-d-browser-extended', ['node', 'dev/stage_d/browser_extended.js', str(root), str(out/'browser-d-extended')]),
    ('stage-h-browser-traversal', ['node', 'dev/stage_h/browser_h1.js', str(out/'browser-h-traversal')]),
    ('flat-browser-parity', ['node', 'dev/stage_h/browser_flat.js', str(root), str(parent), str(out/'browser-flat')]),
    ('served-package', ['node', 'dev/stage_h/served_package.js', str(out/'served.json')]),
]
if len(sys.argv) > 3:
    start = next(i for i, (name, _) in enumerate(commands) if name == sys.argv[3])
    commands = commands[start:]
rows = []
for name, cmd in commands:
    print('START', name, flush=True)
    start = time.monotonic()
    env = {**os.environ, 'TFB_EVIDENCE_DIR': str(out/(name+'-raw'))}
    with (out/(name+'.log')).open('xb') as log:
        try:
            p = subprocess.run(cmd, cwd=root, stdout=log, stderr=subprocess.STDOUT, env=env, timeout=1800)
            code = p.returncode
        except subprocess.TimeoutExpired:
            code = 124
            log.write(b'\nH5 orchestration deadline exceeded. Failure retained.\n')
    rows.append({'name': name, 'command': cmd, 'exitCode': code, 'seconds': time.monotonic()-start})
    (out/'results.json').write_text(json.dumps(rows, indent=2)+'\n')
    print(rows[-1], flush=True)
    if code:
        raise SystemExit(code)
print('PASS H5 retained spatial, parity, browser and HTTP gates', flush=True)
