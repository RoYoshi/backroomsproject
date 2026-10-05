#!/usr/bin/env python3
"""Run the seven named Stage I suites serially, preserving every raw attempt.

Usage: python dev/part3b/run_named.py <out-dir>
Same conventions as validate.py: one log per suite, raw browser evidence under
<out>/<suite>-raw (TFB_EVIDENCE_DIR), progress.json after every suite, and a
result.json that never relabels a failure. Generated runtime/content bytes are
checked unchanged after each suite.
"""
import pathlib,subprocess,sys,os,time,json,hashlib
from release_common import ROOT,NAMED
out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False);rows=[]
env={k:v for k,v in os.environ.items() if k not in ['ONLY','TFB_WORLD']};env['PYTHONDONTWRITEBYTECODE']='1'
generated=['ai.js','sim.js','ents.js','levels/level0_spatial.json'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before={n:sha(ROOT/n) for n in generated}
for name in NAMED:
 print('START',name,flush=True);start=time.monotonic()
 with (out/(name+'.log')).open('xb') as f:
  try:code=subprocess.run(['node','dev/tests/'+name+'.js'],cwd=ROOT,env={**env,'TFB_EVIDENCE_DIR':str(out/(name+'-raw'))},stdout=f,stderr=subprocess.STDOUT,timeout=2400).returncode
  except subprocess.TimeoutExpired:code=124;f.write(b'\nValidation deadline exceeded; raw evidence preserved.\n')
 rows.append({'name':name,'command':['node','dev/tests/'+name+'.js'],'exitCode':code,'seconds':time.monotonic()-start});(out/'progress.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows[-1]),flush=True)
 assert before=={n:sha(ROOT/n) for n in generated},'Generated runtime/content differs'
status='PASS' if all(r['exitCode']==0 for r in rows) else 'FAIL'
(out/'result.json').write_text(json.dumps({'status':status,'checks':rows,'buildHashes':before},indent=2)+'\n');print(status,'named Stage I suites',flush=True)
sys.exit(0 if status=='PASS' else 1)
