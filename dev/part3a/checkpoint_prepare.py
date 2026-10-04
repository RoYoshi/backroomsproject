#!/usr/bin/env python3
"""Describe staged changes for the authenticated GitHub Git-data publisher."""
import subprocess,json,pathlib
root=pathlib.Path(__file__).resolve().parents[2]
run=lambda *a:subprocess.check_output(['git',*a],cwd=root,text=True).strip()
entries=[]
for raw in subprocess.check_output(['git','diff','--cached','--raw','--no-abbrev','-z'],cwd=root).split(b'\0'):
 if not raw:continue
 if raw.startswith(b':'):
  oldmode,mode,oldsha,sha,status=raw.decode()[1:].split();meta=(mode,sha,status)
 else:
  mode,sha,status=meta;p=root/raw.decode();entries.append({'path':raw.decode(),'mode':mode,'sha':sha,'status':status,'bytes':p.stat().st_size if p.exists() else 0})
print(json.dumps({'parent':run('rev-parse','HEAD'),'baseTree':run('rev-parse','HEAD^{tree}'),'tree':run('write-tree'),'entries':entries}))
