import pathlib,subprocess,json,time,os
root=pathlib.Path(__file__).resolve().parents[2];out=root/'dev/stage_g/evidence/g5/spatial';out.mkdir(parents=True,exist_ok=True)
commands=[('stage-e',['node','dev/tests/run.js','s_nav25d.js','s_perception25d.js']),('spatial-core',['node','dev/stage_c/test_spatial.js']),('adversarial',['node','dev/stage_c/test_adversarial.js']),('schedules',['node','dev/stage_c/test_schedules.js']),('camera',['node','dev/stage_c/test_camera.js']),('view',['node','dev/stage_d/test_view.js',str(out/'view.json')]),('independence',['node','dev/stage_d/test_independence.js',str(out/'independence.json')]),('protocol-unit',['node','dev/stage_f/test_f1.js']),('authority',['node','dev/stage_f/test_f2.js']),('network25d',['node','dev/tests/network25d.js'])];rows=[]
for name,cmd in commands:
 start=time.monotonic();log=out/(name+'.log');assert not log.exists(),log
 print('START',name,flush=True)
 with log.open('wb') as f:r=subprocess.run(cmd,cwd=root,stdout=f,stderr=subprocess.STDOUT,env={**os.environ,'TFB_EVIDENCE_DIR':str(out/'wire-raw')},timeout=400)
 rows.append(dict(name=name,command=cmd,exit=r.returncode,seconds=time.monotonic()-start));(out/'results.json').write_text(json.dumps(rows,indent=2)+'\n');print(rows[-1],flush=True)
assert all(r['exit']==0 for r in rows),rows
