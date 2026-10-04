#!/usr/bin/env python3
"""Exact staged-tree archive, fresh space-containing path, seven real named gates."""
import pathlib,subprocess,zipfile,hashlib,json,os,time,sys
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(sys.argv[1]).resolve();dest=pathlib.Path(sys.argv[2]).resolve()
out.mkdir(parents=True,exist_ok=False);dest.mkdir(parents=True,exist_ok=False);assert ' ' in str(dest)
git=lambda *a:subprocess.check_output(['git',*a],cwd=root,text=True).strip()
tree=git('write-tree');archive=dest/'stage-i-portable-candidate.zip';prefix='thefarbackrooms-level0/'
subprocess.run(['git','archive','--format=zip','--prefix='+prefix,'-o',str(archive),tree],cwd=root,check=True)
entries=[]
for raw in subprocess.check_output(['git','ls-tree','-rz',tree],cwd=root).split(b'\0'):
 if raw:
  meta,n=raw.split(b'\t',1);mode,kind,blob=meta.decode().split();assert kind=='blob';entries.append((n.decode(),mode,blob))
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None;z.extractall(dest)
 for n,mode,blob in entries:
  data=z.read(prefix+n);assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==blob,n
  assert (dest/prefix/n).read_bytes()==data;assert (root/n).read_bytes()==data,'Working bytes differ from staged snapshot: '+n
  (dest/prefix/n).chmod(int(mode,8)&0o777)
clean=dest/prefix;sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before={n:sha(clean/n) for n in ['ai.js','sim.js','ents.js']};rows=[]
commands=[(f'build-{i}-{n}',['bash',f'dev/build_{n}.sh']) for i in [1,2] for n in ['ai','sim','ents']]
commands += [(n,['node','dev/tests/'+n+'.js']) for n in ['s_world25d','s_nav25d','s_perception25d','network25d','physics25d','view25d','perf_world25d']]
commands += [('served-package',['node','dev/stage_h/served_package.js',str(out/'served.json')]),('redirect',['node','dev/stage_i/test_redirect.js']),('fps',['npm','run','test:fps']),('camera',['npm','run','test:camera'])]
for name,cmd in commands:
 print('START',name,flush=True);start=time.monotonic()
 with (out/(name+'.log')).open('xb') as f:
  try:code=subprocess.run(cmd,cwd=clean,stdout=f,stderr=subprocess.STDOUT,env={**os.environ,'TFB_EVIDENCE_DIR':str(out/(name+'-raw'))},timeout=2700).returncode
  except subprocess.TimeoutExpired:code=124;f.write(b'\nPortable gate deadline exceeded; failure retained.\n')
 row={'name':name,'command':cmd,'exitCode':code,'seconds':time.monotonic()-start};rows.append(row);(out/'progress.json').write_text(json.dumps(rows,indent=2)+'\n');print(row,flush=True)
 if code:raise SystemExit(code)
 assert before=={n:sha(clean/n) for n in before},'Generated runtime differs'
validated={n:sha(clean/n) for n,_,_ in entries if n.startswith(('assets/','levels/')) or (pathlib.Path(n).suffix in ['.js','.py','.sh','.html','.css','.json'] and '/evidence/' not in n and '/results/' not in n)}
result={'status':'PASS','sourceTreeAtExtraction':tree,'sourceFiles':len(entries),'everyBlobMatches':True,'pathContainsSpaces':True,'cleanPath':str(clean),'archiveSha256':sha(archive),'crc':'PASS','buildsRepeated':2,'buildHashes':before,'checks':rows,'validatedFiles':validated,'runtime':subprocess.check_output(['node','-v'],text=True).strip(),'scope':'Complete staged-source extraction; seven named gates actually executed. Final publication checks exact final Git tree and modes.'}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print('PASS complete portable certification',flush=True)
