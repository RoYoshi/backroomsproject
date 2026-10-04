#!/usr/bin/env python3
"""Run the seven unchanged named Stage I gates; preserve each original output."""
import pathlib,subprocess,sys,os,time,json
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False);rows=[]
for name in ['s_world25d','s_nav25d','s_perception25d','network25d','physics25d','view25d','perf_world25d']:
 print('START',name,flush=True);begin=time.monotonic();cmd=['node','dev/tests/'+name+'.js']
 with (out/(name+'.log')).open('xb') as f:
  try:code=subprocess.run(cmd,cwd=root,env={**os.environ,'TFB_EVIDENCE_DIR':str(out/(name+'-raw'))},stdout=f,stderr=subprocess.STDOUT,timeout=1800).returncode
  except subprocess.TimeoutExpired:code=124;f.write(b'\nPart 3A runner deadline exceeded. Raw output preserved.\n')
 rows.append({'name':name,'command':cmd,'exitCode':code,'seconds':time.monotonic()-begin});(out/'progress.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows[-1]),flush=True)
result={'status':'PASS' if all(r['exitCode']==0 for r in rows) else 'FAIL','checks':rows};(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');sys.exit(0 if result['status']=='PASS' else 1)
