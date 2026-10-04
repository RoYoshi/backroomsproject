#!/usr/bin/env python3
"""Retained spatial/parity/browser integration outside the all-seven portable run."""
import pathlib,subprocess,sys,os,json,time
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(sys.argv[1]).resolve();parent=pathlib.Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=False)
commands=[
 ('parent-baseline',['python','dev/stage_a/run_baseline.py','--game',str(parent),'--out',str(out/'parent-baseline'),'--only','npm-test,shared']),
 ('stage-c-camera',['node','dev/stage_c/test_camera.js']),
 ('stage-d-view',['node','dev/stage_d/test_view.js',str(out/'view.json')]),
 ('stage-d-independence',['node','dev/stage_d/test_independence.js',str(out/'independence.json')]),
 ('stage-f-protocol',['node','dev/stage_f/test_f1.js']),
 ('stage-f-authority',['node','dev/stage_f/test_f2.js']),
 ('stage-h-lighting',['node','dev/stage_h/test_lighting.js']),
 ('stage-h-picking',['node','dev/stage_h/test_picking.js']),
 ('frozen-parity',['python','dev/stage_h/run_parity.py',str(out/'parity')]),
 ('stage-d-browser-core',['node','dev/stage_d/browser_core.js',str(root),str(out/'browser-d-core')]),
 ('stage-d-browser-extended',['node','dev/stage_d/browser_extended.js',str(root),str(out/'browser-d-extended')]),
 ('stage-h-traversal',['node','dev/stage_h/browser_h1.js',str(out/'browser-h-traversal')]),
 ('flat-browser-parity',['node','dev/stage_h/browser_flat.js',str(root),str(parent),str(out/'browser-flat')]),
 ('served-package',['node','dev/stage_h/served_package.js',str(out/'served.json')]),
 ('redirect',['node','dev/stage_i/test_redirect.js'])]
if len(sys.argv)>3:commands=commands[next(i for i,(n,_) in enumerate(commands) if n==sys.argv[3]):]
rows=[]
for name,cmd in commands:
 print('START',name,flush=True);start=time.monotonic()
 with (out/(name+'.log')).open('xb') as f:
  try:code=subprocess.run(cmd,cwd=root,stdout=f,stderr=subprocess.STDOUT,env={**os.environ,'TFB_EVIDENCE_DIR':str(out/(name+'-raw'))},timeout=2400).returncode
  except subprocess.TimeoutExpired:code=124;f.write(b'\nCertification deadline exceeded; original evidence retained.\n')
 row={'name':name,'command':cmd,'exitCode':code,'seconds':time.monotonic()-start};rows.append(row);(out/'progress.json').write_text(json.dumps(rows,indent=2));print(row,flush=True)
 if code:raise SystemExit(code)
(out/'result.json').write_text(json.dumps({'status':'PASS','checks':rows},indent=2)+'\n')
