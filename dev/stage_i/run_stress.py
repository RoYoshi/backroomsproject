#!/usr/bin/env python3
"""Serial bounded I2 workloads. Every attempt keeps its raw evidence."""
import pathlib,subprocess,sys,os,json,time
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
commands=[('geometry',['node','dev/stage_i/stress_geometry.js',str(out/'geometry.json')]),('four-surfaces',['node','dev/stage_e/perf_spatial.js',str(out/'four-surfaces.json')]),('connected-nav',['node','dev/stage_e/perf_connected_fixture.js',str(out/'connected-nav.json')]),('network25d',['node','dev/tests/network25d.js']),('aftermath',['node','dev/stage_g/performance.js']),('server-soak',['node','dev/stage_i/stress_server.js',str(out/'server-soak.json')]),('browser-matrix',['node','dev/stage_h/browser_h4.js',str(out/'browser-matrix')])]
if len(sys.argv)>2:commands=commands[next(i for i,(n,_) in enumerate(commands) if n==sys.argv[2]):]
rows=[]
for name,cmd in commands:
 print('START',name,flush=True);start=time.monotonic()
 with (out/(name+'.log')).open('xb') as f:
  try:code=subprocess.run(cmd,cwd=root,stdout=f,stderr=subprocess.STDOUT,env={**os.environ,'TFB_EVIDENCE_DIR':str(out/(name+'-raw'))},timeout=1800).returncode
  except subprocess.TimeoutExpired:code=124;f.write(b'\nBounded orchestration deadline exceeded.\n')
 row={'name':name,'command':cmd,'exitCode':code,'seconds':time.monotonic()-start};rows.append(row);(out/'progress.json').write_text(json.dumps(rows,indent=2));print(row,flush=True)
 if code:raise SystemExit(code)
(out/'result.json').write_text(json.dumps({'status':'PASS','checks':rows},indent=2))
