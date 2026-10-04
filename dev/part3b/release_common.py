"""Exact-source audit and packaging helpers for Part 3B."""
import hashlib,pathlib,subprocess,json
ROOT=pathlib.Path(__file__).resolve().parents[2]
PARENT='4d1f17a600a10599b848b6db9d02fa16b4f479f0'
PARENT_TREE='c1e0fc5fd84e5fbea412cf3fca7c309243e8de6e'
PARENT_ZIP='6a498a2e498328ebe8064f1a67b406e5d600e614137438df67a79409bf64bdcf'
STATUS='PART 3B — MOVEMENT, CAMERA & DEPTH PRESENTATION ENGINEERING COMPLETE — HUMAN QA PENDING'
NAMED=['s_world25d','s_nav25d','s_perception25d','network25d','physics25d','view25d','perf_world25d']
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def entries(tree):
 result=[]
 for raw in subprocess.check_output(['git','ls-tree','-rz',tree],cwd=ROOT).split(b'\0'):
  if raw:
   meta,n=raw.split(b'\t',1);mode,kind,digest=meta.decode().split();assert kind=='blob';result.append((mode,digest,n.decode()))
 return result
def tree_hash(files):
 dirs={'':{}}
 for mode,digest,name in files:
  node=dirs[''];parts=name.split('/')
  for part in parts[:-1]:node=node.setdefault(part,{})
  node[parts[-1]]=(mode,digest)
 def visit(node):
  raw=b''
  for name,value in sorted(node.items(),key=lambda kv:kv[0]+('/' if isinstance(kv[1],dict) else '')):
   mode,digest=('40000',visit(value)) if isinstance(value,dict) else value
   raw+=(mode+' '+name).encode()+b'\0'+bytes.fromhex(digest)
  return hashlib.sha1(b'tree '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
 return visit(dirs[''])
def validated(n):
 if '/evidence/' in n or '/results/' in n or n.startswith('PART_3B_'):return False
 return n.startswith(('assets/','levels/')) or pathlib.Path(n).suffix in ['.js','.py','.sh','.html','.css','.json']
def changed_files(source):
 parent=json.loads((ROOT/'dev/part3b/evidence/p3b0/parent-source-manifest.json').read_text())
 old={r['path']:(r['mode'],r['blob']) for r in parent};assert tree_hash([(mode,digest,n) for n,(mode,digest) in old.items()])==PARENT_TREE
 new={n:(mode,digest) for mode,digest,n in source};rows=[]
 for n in sorted(set(old)|set(new)):
  if old.get(n)==new.get(n):continue
  rows.append(('A' if n not in old else 'D' if n not in new else 'M')+'\t'+n)
 return rows
def audit(source):
 changes=changed_files(source)
 for row in changes:
  status,n=row.split('\t');assert status!='D',row
  assert n in ['world_view.js','spatial_client.js','dev/stage_h/browser_h2.js'] or n.startswith(('dev/part3b/','PART_3B_')),row
 for mode,digest,n in source:
  assert blob((ROOT/n).read_bytes())==digest,n
  assert bool((ROOT/n).stat().st_mode&0o111)==(mode=='100755'),n
 return {'status':'PASS','acceptedParentCommit':PARENT,'acceptedParentTree':PARENT_TREE,'acceptedParentZipSha256':PARENT_ZIP,'parentManifestTreeVerified':True,'changedFiles':changes,'runtimeChanges':['spatial_client.js','world_view.js'],'allOtherRuntimeContentPhysicsAiNetworkingDeathAndCameraPolicyBytesUnchanged':True,'allSourceBlobsAndModesMatch':True,'sourceFiles':len(source),'sourceTree':tree_hash(source)}
