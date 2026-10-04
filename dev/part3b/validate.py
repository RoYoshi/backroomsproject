#!/usr/bin/env python3
"""Serial Part 3B whole/final validation, preserving every raw attempt."""
import pathlib,subprocess,sys,os,time,json,re,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
out=pathlib.Path(sys.argv[1]).resolve();phase=sys.argv[2];parent=pathlib.Path(sys.argv[3]).resolve()
assert phase in ['whole','final'];out.mkdir(parents=True,exist_ok=False);rows=[]
env={k:v for k,v in os.environ.items() if k not in ['ONLY','TFB_WORLD']};env['PYTHONDONTWRITEBYTECODE']='1'
generated=['ai.js','sim.js','ents.js','levels/level0_spatial.json'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before={n:sha(ROOT/n) for n in generated}
def run(name,cmd,timeout=2400):
 print('START',name,flush=True);start=time.monotonic()
 with (out/(name+'.log')).open('xb') as f:
  try:code=subprocess.run(cmd,cwd=ROOT,env={**env,'TFB_EVIDENCE_DIR':str(out/(name+'-raw'))},stdout=f,stderr=subprocess.STDOUT,timeout=timeout).returncode
  except subprocess.TimeoutExpired:code=124;f.write(b'\nValidation deadline exceeded; raw evidence preserved.\n')
 row={'name':name,'command':cmd,'exitCode':code,'seconds':time.monotonic()-start};rows.append(row);(out/'progress.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
 assert code==0,name
 assert before=={n:sha(ROOT/n) for n in generated},'Generated runtime/content differs'
try:
 if phase=='final':
  for i in [1,2]:
   for n in ['ai','sim','ents']:run(f'build-{i}-{n}',['bash',f'dev/build_{n}.sh'])
   run(f'build-{i}-level0',['node','dev/part3a/build_level0_spatial.js'])
 run('invariants',['python','dev/part3b/verify_invariants.py',str(out/'invariants.json')])
 for n in ['foundation','motion','cutaway']:run('presentation-'+n,['node','dev/part3b/test_'+n+'.js',str(out/('presentation-'+n+'.json'))])
 for n in ['base','vertical','navigation','gameplay','perception','picking','render_coverage','aftermath']:run('production-'+n,['node','dev/part3a/test_'+n+'.js',str(out/('production-'+n+'.json'))])
 if phase=='final':
  for n in ['s_world25d','s_nav25d','s_perception25d','network25d','physics25d','view25d','perf_world25d']:run(n,['node','dev/tests/'+n+'.js'])
 run('full-retained',['python','dev/stage_a/run_baseline.py','--game','.', '--out',str(out/'full-retained')],3600)
 current=json.loads((out/'full-retained/baseline-tests.json').read_text());accepted=json.loads((ROOT/'dev/stage_i/evidence/i4/baseline-comparison.json').read_text())['rows'];assert len(current)==len(accepted)==18
 comparison=[]
 for got,want in zip(current,accepted):
  assert got['id']==want['suite'];names=[re.sub(r'\s+\[\d+ms\]$','',s[5:]) for s in got['failureLines']]
  assert names==want['failureNames'],(got['id'],names,want['failureNames'])
  assert got['counts']['passed']==want['counts']['passed'] and got['counts']['total']==want['counts']['total'],got['id']
  assert got['exitCode']==(1 if want['disposition']=='INHERITED FAILURE' else 0),got['id']
  comparison.append({'suite':got['id'],'disposition':want['disposition'],'counts':got['counts'],'failureNames':names,'evidence':'full-retained/'+got['log']})
 (out/'baseline-comparison.json').write_text(json.dumps({'status':'PASS_BASELINE_EQUIVALENCE','exactFailureNamesMatch':True,'rows':comparison},indent=2)+'\n')
 run('frozen-parity',['python','dev/stage_h/run_parity.py',str(out/'parity')])
 run('flat-browser-parity',['node','dev/stage_h/browser_flat.js','.',str(parent),str(out/'flat-browser')])
 for name,script in [('foundation','dev/part3b/browser_foundation.js'),('matrix','dev/part3b/browser_matrix.js'),('resets','dev/part3b/browser_resets.js'),('cutaway','dev/part3b/browser_cutaway.js')]:run('browser-'+name,['node',script,str(out/('browser-'+name))])
 if phase=='whole':
  for name in ['readability','aftermath','gameplay']:run('browser-production-'+name,['node','dev/part3a/browser_'+name+'.js',str(out/('browser-production-'+name))])
  run('performance-production',['node','dev/part3a/performance.js',str(out/'performance-production.json')])
 run('served-flat-fixture',['node','dev/stage_h/served_package.js',str(out/'served-flat-fixture.json')])
 run('served-production',['node','dev/part3a/served_production.js',str(out/'served-production.json')])
 run('redirect',['node','dev/stage_i/test_redirect.js'])
 result={'status':'PASS','phase':phase,'checks':rows,'buildHashes':before,'baselineComparison':'PASS_BASELINE_EQUIVALENCE','contentHash':json.loads((ROOT/'levels/level0_spatial.json').read_text())['contentHash']}
 (out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print('PASS Part 3B '+phase+' validation',flush=True)
except BaseException as e:
 (out/'failure.json').write_text(json.dumps({'status':'FAIL','error':repr(e),'checks':rows},indent=2)+'\n');raise
