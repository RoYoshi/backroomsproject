"""Shared exact-source rules for Part 3A release tooling."""
import hashlib,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
PARENT='106c87015ae8702f452979e0277cbacb5435fa6a'
PARENT_TREE='82be2ca8d031f2d46c70a17b5c14c83689dbf8c8'
PARENT_ZIP='e5ebb8cd7b9c511ce83ea56443e7382de13e1cfbf2a0b2e2764808136e924bff'
RECOVERY='4bcafa871e40f592ef5480572b55a4f764674558'
STATUS='PART 3A — PRODUCTION 2.5D LEVEL 0 ENGINEERING COMPLETE — HUMAN QA PENDING'
NAMED=['s_world25d','s_nav25d','s_perception25d','network25d','physics25d','view25d','perf_world25d']
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def entries(tree):
 out=[]
 for raw in subprocess.check_output(['git','ls-tree','-rz',tree],cwd=ROOT).split(b'\0'):
  if raw:
   meta,n=raw.split(b'\t',1);mode,kind,blob=meta.decode().split();assert kind=='blob';out.append((mode,blob,n.decode()))
 return out
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def validated(n):
 if '/evidence/' in n or '/results/' in n or n.startswith('PART_3A_'):return False
 return n.startswith(('assets/','levels/')) or pathlib.Path(n).suffix in ['.js','.py','.sh','.html','.css','.json']
