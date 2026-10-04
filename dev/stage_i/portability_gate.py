#!/usr/bin/env python3
"""Real named Z32 kernel; runs without Git or the originating package path."""
import pathlib,tempfile,zipfile,hashlib,subprocess,sys,os,json,time,shutil
root=pathlib.Path(__file__).resolve().parents[2]
out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
dest=pathlib.Path(tempfile.mkdtemp(prefix='Stage I Fresh Extraction '));clean=dest/'package with spaces'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
rows=[]
try:
 archive=dest/'candidate.zip';files=[]
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for p in sorted(root.rglob('*')):
   n=p.relative_to(root)
   if not p.is_file() or any(x in n.parts for x in ['.git','node_modules','__pycache__']) or 'evidence' in n.parts:continue
   z.write(p,str(n));files.append(str(n))
 with zipfile.ZipFile(archive) as z:
  assert z.testzip() is None;z.extractall(clean)
 for n in files:assert (clean/n).read_bytes()==(root/n).read_bytes(),n
 hashes={n:sha(clean/n) for n in ['ai.js','sim.js','ents.js']}
 commands=[(f'build-{i}-{n}',['bash',f'dev/build_{n}.sh']) for i in [1,2] for n in ['ai','sim','ents']]
 commands += [('world',['node','dev/tests/s_world25d.js']),('nav',['node','dev/tests/s_nav25d.js']),('perception',['node','dev/tests/s_perception25d.js']),('fps',['npm','run','test:fps']),('camera',['npm','run','test:camera']),('http',['node','dev/stage_h/served_package.js',str(out/'http.json')]),('redirect',['node','dev/stage_i/test_redirect.js'])]
 for name,cmd in commands:
  start=time.monotonic()
  with (out/(name+'.log')).open('x') as f:p=subprocess.run(cmd,cwd=clean,stdout=f,stderr=subprocess.STDOUT,env={**os.environ,'TFB_EVIDENCE_DIR':str(out/(name+'-raw'))},timeout=600)
  rows.append({'name':name,'command':cmd,'exitCode':p.returncode,'seconds':time.monotonic()-start});(out/'progress.json').write_text(json.dumps(rows,indent=2))
  assert p.returncode==0,name
  assert hashes=={n:sha(clean/n) for n in hashes},'nonreproducible generated outputs'
 result={'status':'PASS','pathContainsSpaces':True,'cleanPath':str(clean),'filesCompared':len(files),'crc':'PASS','buildsRepeated':2,'buildHashes':hashes,'checks':rows,'scope':'Package-relative source/build/HTTP gate. Full exact-source all-seven-suite clean extraction and browser certification is separately required at I4/I5.'}
 (out/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
except BaseException as e:
 (out/'failure.json').write_text(json.dumps({'status':'FAIL','error':repr(e),'cleanPath':str(clean),'checks':rows},indent=2));raise
finally:
 if (out/'result.json').exists():shutil.rmtree(dest)
