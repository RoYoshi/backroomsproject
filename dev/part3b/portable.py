#!/usr/bin/env python3
"""Extract the exact staged source in a path with spaces; run final gates there."""
import pathlib,subprocess,zipfile,json,os,sys,time
from release_common import ROOT,git,sha,blob,entries,validated,tree_hash
out=pathlib.Path(sys.argv[1]).resolve();dest=pathlib.Path(sys.argv[2]).resolve();parent=pathlib.Path(sys.argv[3]).resolve()
out.mkdir(parents=True,exist_ok=False);dest.mkdir(parents=True,exist_ok=False);assert ' ' in str(dest)
tree=git('write-tree');source=entries(tree);assert tree_hash(source)==tree
archive=dest/'part-3b-portable-candidate.zip';prefix='thefarbackrooms-level0/'
subprocess.run(['git','archive','--format=zip','--prefix='+prefix,'-o',str(archive),tree],cwd=ROOT,check=True)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None;assert set(z.namelist())=={prefix+n for _,_,n in source}|{n for n in z.namelist() if n.endswith('/')};z.extractall(dest)
 for mode,digest,n in source:
  data=z.read(prefix+n);assert blob(data)==digest,n;assert (ROOT/n).read_bytes()==data,n
  assert (z.getinfo(prefix+n).external_attr>>16)&0o777==int(mode,8)&0o777,n
  p=dest/prefix/n;assert p.read_bytes()==data;p.chmod(int(mode,8)&0o777)
clean=dest/prefix
try:
 with (out/'validation.log').open('xb') as f:
  code=subprocess.run(['python','dev/part3b/validate.py',str(out/'gates'),'final',str(parent)],cwd=clean,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'},stdout=f,stderr=subprocess.STDOUT).returncode
 assert code==0,'Final clean-extraction gates failed'
 for _,digest,n in source:assert blob((clean/n).read_bytes())==digest,'Source mutated during validation: '+n
 result={'status':'PASS','sourceTreeAtExtraction':tree,'sourceFiles':len(source),'everyBlobAndModeMatches':True,'pathContainsSpaces':True,'cleanPath':str(clean),'candidateArchiveSha256':sha(archive),'crc':'PASS','buildsRepeated':2,'validatedFiles':{n:sha(clean/n) for _,_,n in source if validated(n)},'gates':json.loads((out/'gates/result.json').read_text()),'scope':'Exact source extraction with package-relative final tests, builds, HTTP serving and redirect. Finalizer independently audits final remote tree and ZIP.'}
 (out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print('PASS exact Part 3B portable validation')
except BaseException as e:
 (out/'failure.json').write_text(json.dumps({'status':'FAIL','error':repr(e),'sourceTree':tree,'cleanPath':str(clean)},indent=2)+'\n');raise
