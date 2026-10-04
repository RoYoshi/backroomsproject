#!/usr/bin/env python3
"""Fresh exact-tree package, serial full retained regression and production gates."""
import pathlib,subprocess,zipfile,json,os,time,sys,re
from release_common import ROOT,git,sha,blob,entries,validated,NAMED,PARENT
out=pathlib.Path(sys.argv[1]).resolve();dest=pathlib.Path(sys.argv[2]).resolve();parent=pathlib.Path(sys.argv[3]).resolve()
out.mkdir(parents=True,exist_ok=False);dest.mkdir(parents=True,exist_ok=False);assert ' ' in str(dest)
tree=git('write-tree');source=entries(tree);prefix='thefarbackrooms-level0/'
archive=dest/'part-3a-portable-candidate.zip';subprocess.run(['git','archive','--format=zip','--prefix='+prefix,'-o',str(archive),tree],cwd=ROOT,check=True)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None;z.extractall(dest)
 for mode,digest,n in source:
  data=z.read(prefix+n);assert blob(data)==digest,n;assert (ROOT/n).read_bytes()==data,n
  p=dest/prefix/n;assert p.read_bytes()==data;p.chmod(int(mode,8)&0o777)
clean=dest/prefix;generated=['ai.js','sim.js','ents.js','levels/level0_spatial.json'];before={n:sha(clean/n) for n in generated};rows=[]
env={k:v for k,v in os.environ.items() if k not in ['ONLY','TFB_WORLD']};env['PYTHONDONTWRITEBYTECODE']='1'
def run(name,cmd,timeout=2700):
 print('START',name,flush=True);start=time.monotonic()
 with (out/(name+'.log')).open('xb') as f:
  try:code=subprocess.run(cmd,cwd=clean,env={**env,'TFB_EVIDENCE_DIR':str(out/(name+'-raw'))},stdout=f,stderr=subprocess.STDOUT,timeout=timeout).returncode
  except subprocess.TimeoutExpired:code=124;f.write(b'\nPortable orchestration deadline exceeded; raw evidence retained.\n')
 row={'name':name,'command':cmd,'exitCode':code,'seconds':time.monotonic()-start};rows.append(row);(out/'progress.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(row),flush=True)
 assert code==0,name
 assert before=={n:sha(clean/n) for n in generated},'Generated runtime/content differs'
try:
 for i in [1,2]:
  for n in ['ai','sim','ents']:run(f'build-{i}-{n}',['bash',f'dev/build_{n}.sh'])
  run(f'build-{i}-level0',['node','dev/part3a/build_level0_spatial.js'])
 for n in ['base','vertical','navigation','gameplay','perception','picking','render_coverage','aftermath']:
  run('production-'+n,['node','dev/part3a/test_'+n+'.js',str(out/('production-'+n+'.json'))])
 for n in NAMED:run(n,['node','dev/tests/'+n+'.js'])
 run('full-retained',['python','dev/stage_a/run_baseline.py','--game','.', '--out',str(out/'full-retained')],3600)
 current=json.loads((out/'full-retained/baseline-tests.json').read_text());accepted=json.loads((ROOT/'dev/stage_i/evidence/i4/baseline-comparison.json').read_text())['rows']
 assert len(current)==len(accepted)==18
 comparison=[]
 for got,want in zip(current,accepted):
  assert got['id']==want['suite'];names=[re.sub(r'\s+\[\d+ms\]$','',s[5:]) for s in got['failureLines']]
  assert names==want['failureNames'],(got['id'],names,want['failureNames'])
  assert got['counts']['passed']==want['counts']['passed'] and got['counts']['total']==want['counts']['total'],got['id']
  assert got['exitCode']==(1 if want['disposition']=='INHERITED FAILURE' else 0),got['id']
  comparison.append({'suite':got['id'],'disposition':want['disposition'],'counts':got['counts'],'failureNames':names,'evidence':str((out/'full-retained'/got['log']).relative_to(ROOT))})
 (out/'baseline-comparison.json').write_text(json.dumps({'status':'PASS_BASELINE_EQUIVALENCE','acceptedParent':PARENT,'exactFailureNamesMatch':True,'rows':comparison},indent=2)+'\n')
 run('frozen-parity',['python','dev/stage_h/run_parity.py',str(out/'parity')])
 run('flat-browser-parity',['node','dev/stage_h/browser_flat.js','.',str(parent),str(out/'flat-browser')])
 run('production-browser',['node','dev/part3a/browser_base.js',str(out/'production-browser')])
 run('served-flat-fixture',['node','dev/stage_h/served_package.js',str(out/'served-flat-fixture.json')])
 run('served-production',['node','dev/part3a/served_production.js',str(out/'served-production.json')])
 run('redirect',['node','dev/stage_i/test_redirect.js'])
 preserved={n:sha(clean/n) for _,_,n in source if validated(n)}
 for _,digest,n in source:assert blob((clean/n).read_bytes())==digest,'Source mutated during tests: '+n
 result={'status':'PASS','sourceTreeAtExtraction':tree,'sourceFiles':len(source),'everyBlobAndModeMatches':True,'pathContainsSpaces':True,'cleanPath':str(clean),'candidateArchiveSha256':sha(archive),'crc':'PASS','buildsRepeated':2,'buildHashes':before,'contentHash':json.loads((clean/'levels/level0_spatial.json').read_text())['contentHash'],'checks':rows,'validatedFiles':preserved,'runtime':subprocess.check_output(['node','-v'],text=True).strip(),'baselineComparison':'PASS_BASELINE_EQUIVALENCE','scope':'Complete exact-source extraction; package-relative build/test/server commands; finalizer additionally verifies final remote source tree and final archive.'}
 (out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print('PASS full Part 3A portable certification',flush=True)
except BaseException as e:
 (out/'failure.json').write_text(json.dumps({'status':'FAIL','error':repr(e),'sourceTree':tree,'cleanPath':str(clean),'checks':rows},indent=2)+'\n');raise
