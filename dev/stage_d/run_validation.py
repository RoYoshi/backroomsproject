#!/usr/bin/env python3
"""Stage D focused validation. Existing suites are invoked unchanged.
Run after the saved working checkpoint. No tests run concurrently with benchmarks.
"""
import argparse,json,subprocess,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--group',choices=['browser','spatial'],required=True);p.add_argument('--parent',type=Path);a=p.parse_args();root=Path(__file__).resolve().parents[2];out=root/'dev/stage_d/evidence';out.mkdir(exist_ok=True)
if a.group=='browser':
 commands=[('browser-core',['node','dev/stage_d/browser_core.js']),('browser-extended',['node','dev/stage_d/browser_extended.js']),('browser-performance',['node','dev/stage_d/browser_performance.js'])]
 if a.parent:commands.append(('browser-flat',['node','dev/stage_d/browser_flat.js',str(root),str(a.parent.resolve()),str(out)]))
else:commands=[('view',['node','dev/stage_d/test_view.js',str(out/'view.json')]),('independence',['node','dev/stage_d/test_independence.js',str(out/'independence.json')]),('spatial-core',['node','dev/stage_c/test_spatial.js']),('spatial-adversarial',['node','dev/stage_c/test_adversarial.js']),('spatial-schedules',['node','dev/stage_c/test_schedules.js']),('camera-spatial',['node','dev/stage_c/test_camera.js']),('flat-parity',['node','dev/stage_c/verify_parity.js',str(out/'flat-parity.json')]),('http',['node','dev/stage_c/served_package.js',str(root),str(out/'http.json')])]
rows=[]
for name,cmd in commands:
 print('START '+name,flush=True);t=time.monotonic();r=subprocess.run(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=480);(out/(name+'.log')).write_bytes(r.stdout);row={'name':name,'exitCode':r.returncode,'seconds':round(time.monotonic()-t,3),'log':name+'.log'};rows.append(row);(out/(a.group+'-validation.json')).write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
 if r.returncode:print(r.stdout.decode(errors='replace')[-4000:],flush=True);raise SystemExit(r.returncode)
