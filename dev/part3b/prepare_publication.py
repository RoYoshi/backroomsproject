#!/usr/bin/env python3
"""Describe the staged exact tree for authenticated GitHub Git-data publication.

The caller uploads only unknown blobs, creates this exact tree/commit, moves only
part-3b with a fast-forward, then independently reads the remote ref and commit.
"""
import json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2]
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
assert git('branch','--show-current')=='part-3b'
parent=git('rev-parse','HEAD')
known={line.split()[0] for line in git('rev-list','--objects',parent).splitlines()}
entries=[]
for line in git('diff','--cached','--raw','--no-abbrev').splitlines():
    meta,name=line.split('\t');oldmode,mode,oldsha,sha,status=meta[1:].split()
    assert status in ['A','M','D'],status
    entries.append({'path':name,'mode':mode if status!='D' else oldmode,'type':'blob',
                    'sha':None if status=='D' else sha,'known':sha in known,
                    'bytes':0 if status=='D' else int(git('cat-file','-s',sha))})
print(json.dumps({'parent':parent,'tree':git('write-tree'),'baseTree':git('rev-parse','HEAD^{tree}'),'entries':entries}))
