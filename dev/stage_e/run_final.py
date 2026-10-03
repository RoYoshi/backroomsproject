#!/usr/bin/env python3
"""Run E5 verification serially without replacing any historical evidence."""
import argparse, json, os, subprocess, time
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--group', choices=['spatial', 'browser'], required=True)
p.add_argument('--parent', type=Path)
a = p.parse_args()
root = Path(__file__).resolve().parents[2]
out = root / 'dev/stage_e/evidence' / ('final-' + a.group)
out.mkdir(parents=True, exist_ok=True)
runtime = subprocess.check_output(['node', '--version'], text=True).strip()
if runtime != 'v25.9.0':
    raise SystemExit('E5 authority requires Node v25.9.0; found ' + runtime)
if a.group == 'spatial':
    commands = [
        ('stage-e-gates', ['node','dev/tests/run.js','s_nav25d.js','s_perception25d.js']),
        ('stage-c-core', ['node','dev/stage_c/test_spatial.js']),
        ('stage-c-adversarial', ['node','dev/stage_c/test_adversarial.js']),
        ('stage-c-schedules', ['node','dev/stage_c/test_schedules.js']),
        ('camera-spatial', ['node','dev/stage_c/test_camera.js']),
        ('stage-d-view', ['node','dev/stage_d/test_view.js',str(out/'view.json')]),
        ('stage-d-independence', ['node','dev/stage_d/test_independence.js',str(out/'independence.json')]),
        ('smiler', ['node','dev/tests/run.js','s_smiler.js']),
        ('historical-strict-parity', ['node','dev/stage_c/verify_parity.js',str(out/'historical-strict-parity.json')]),
        ('frozen-record-parity', ['node','dev/stage_e/verify_parity.js',str(out/'parity')]),
        ('spatial-performance', ['node','dev/stage_e/perf_spatial.js',str(out/'spatial-performance.json')]),
        ('connected-performance', ['node','dev/stage_e/perf_connected_fixture.js',str(out/'connected-performance.json')]),
        ('served-package', ['node','dev/stage_c/served_package.js',str(root),str(out/'http.json')]),
    ]
else:
    if not a.parent:
        raise SystemExit('--parent must identify the clean accepted Stage D extraction')
    commands = [
        ('browser-core', ['node','dev/stage_d/browser_core.js',str(root),str(out)]),
        ('browser-extended', ['node','dev/stage_d/browser_extended.js',str(root),str(out)]),
        ('browser-flat', ['node','dev/stage_d/browser_flat.js',str(root),str(a.parent.resolve()),str(out)]),
        ('browser-network', ['node','dev/stage_e/browser_network.js',str(root),str(out/'network.json')]),
    ]
rows = []
for name, cmd in commands:
    print('START ' + name, flush=True)
    start = time.monotonic()
    r = subprocess.run(cmd, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=600)
    (out/(name+'.log')).write_bytes(r.stdout)
    row = {'name':name,'command':cmd,'runtime':runtime,'exitCode':r.returncode,'seconds':round(time.monotonic()-start,3),'log':name+'.log'}
    rows.append(row)
    (out/'results.json').write_text(json.dumps(rows,indent=2)+'\n')
    print(json.dumps(row), flush=True)
    if r.returncode:
        print(r.stdout.decode(errors='replace')[-1800:], flush=True)
        if name not in ['smiler','historical-strict-parity']:
            raise SystemExit(r.returncode)
