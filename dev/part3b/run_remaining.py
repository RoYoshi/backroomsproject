#!/usr/bin/env python3
"""Continue a stopped validate.py 'whole' attempt from a named check onward.

Usage: python dev/part3b/run_remaining.py <out> <parent-3A-dir> <first-check | only:check,check>
Commands, order, timeouts and per-check conventions are exactly validate.py's
'whole' phase; nothing is retained or relabeled. Used in HQ2 after whole-02
stopped at the zero-tolerance frozen parity (host Node v22 vs recorded v24),
whose cross-engine evidence is recorded separately. The HQ1 focused suites
are appended. Every check runs even if an earlier one fails; failures are
preserved and the overall status is FAIL if any check failed.
"""
import pathlib,subprocess,sys,os,time,json,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
out=pathlib.Path(sys.argv[1]).resolve();parent=pathlib.Path(sys.argv[2]).resolve();first=sys.argv[3];out.mkdir(parents=True,exist_ok=False);rows=[]
env={k:v for k,v in os.environ.items() if k not in ['ONLY','TFB_WORLD']};env['PYTHONDONTWRITEBYTECODE']='1'
generated=['ai.js','sim.js','ents.js','levels/level0_spatial.json'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before={n:sha(ROOT/n) for n in generated}
flat=os.environ.get('TFB_FLAT_HARNESS','dev/stage_h/browser_flat.js')
checks=[('flat-browser-parity',['node',flat,'.',str(parent),str(out/'flat-browser')],2400)]
for name,script in [('foundation','dev/part3b/browser_foundation.js'),('matrix','dev/part3b/browser_matrix.js'),('resets','dev/part3b/browser_resets.js'),('cutaway','dev/part3b/browser_cutaway.js')]:checks.append(('browser-'+name,['node',script,str(out/('browser-'+name))],2400))
for name in ['readability','aftermath','gameplay']:checks.append(('browser-production-'+name,['node','dev/part3a/browser_'+name+'.js',str(out/('browser-production-'+name))],2400))
checks+=[('performance-production',['node','dev/part3a/performance.js',str(out/'performance-production.json')],2400),
 ('served-flat-fixture',['node','dev/stage_h/served_package.js',str(out/'served-flat-fixture.json')],2400),
 ('served-production',['node','dev/part3a/served_production.js',str(out/'served-production.json')],2400),
 ('redirect',['node','dev/stage_i/test_redirect.js'],2400),
 ('hq1-focused',['node','dev/part3b/test_hq1.js',str(out/'hq1-focused.json')],2400),
 ('hq1-browser',['node','dev/part3b/browser_hq1.js',str(out/'hq1-browser')],2400)]
names=[c[0] for c in checks]
selected=[c for c in checks if c[0] in first[5:].split(',')] if first.startswith('only:') else checks[names.index(first):]
assert selected and (not first.startswith('only:') or len(selected)==len(first[5:].split(','))),first
for name,cmd,timeout in selected:
 print('START',name,flush=True);start=time.monotonic()
 with (out/(name+'.log')).open('xb') as f:
  try:code=subprocess.run(cmd,cwd=ROOT,env={**env,'TFB_EVIDENCE_DIR':str(out/(name+'-raw'))},stdout=f,stderr=subprocess.STDOUT,timeout=timeout).returncode
  except subprocess.TimeoutExpired:code=124;f.write(b'\nValidation deadline exceeded; raw evidence preserved.\n')
 rows.append({'name':name,'command':cmd,'exitCode':code,'seconds':time.monotonic()-start});(out/'progress.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows[-1]),flush=True)
 assert before=={n:sha(ROOT/n) for n in generated},'Generated runtime/content differs'
status='PASS' if all(r['exitCode']==0 for r in rows) else 'FAIL'
(out/'result.json').write_text(json.dumps({'status':status,'phase':'whole-continuation','firstCheck':first,'checks':rows,'buildHashes':before},indent=2)+'\n');print(status,flush=True)
sys.exit(0 if status=='PASS' else 1)
