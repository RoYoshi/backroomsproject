#!/usr/bin/env python3
"""Exact staged name/status audit; no product runtime edit is currently justified."""
import pathlib,subprocess,json
root=pathlib.Path(__file__).resolve().parents[2];parent='692eebd338cc42347d437b0c0a2dcc9d7217ac34'
git=lambda *a:subprocess.check_output(['git',*a],cwd=root,text=True).strip()
out=root/'dev/stage_i/evidence/i5/scope-audit.json';ledger=root/'25D_STAGE_I_CHANGED_FILES.txt';out.parent.mkdir(parents=True,exist_ok=True)
for p in [out,ledger]:
 if not p.exists():p.write_text('Pending exact staged audit\n')
subprocess.run(['git','add',str(out),str(ledger)],cwd=root,check=True)
rows=git('diff','--cached','--name-status',parent).splitlines()
allowed={'package.json','dev/tests/s_world25d.js','dev/tests/perf_world25d.js'}
for row in rows:
 status,name=row.split('\t',1);assert status in ['A','M'],row
 assert name in allowed or name.startswith('dev/stage_i/') or name.startswith('25D_STAGE_I_'),row
 assert '__pycache__' not in name and not name.endswith('.pyc'),name
runtime=[n for n in git('ls-tree','-r','--name-only',parent).splitlines() if not n.startswith('dev/') and not n.startswith('25D_') and n!='package.json']
assert not git('diff','--cached','--name-only',parent,'--',*runtime),'Production runtime changed'
assert not git('diff','--cached','--name-only',parent,'--','dev/ai_src','dev/ents_src','dev/sim_head.js','dev/sim_glue.js','dev/stage_a/traces','dev/stage_b/level0-baseline.json.gz'),'Maintained source or frozen reference changed'
result={'status':'PASS','acceptedParentCommit':parent,'acceptedParentTree':git('rev-parse',parent+'^{tree}'),'changedFiles':rows,'changedFileCount':len(rows),'productionRuntimeFilesUnchanged':len(runtime),'runtimeChanges':0,'allowedChangedExistingFiles':sorted(allowed),'noRemovedFiles':True,'mainModifiedOrMerged':False,'productionLevel0ConversionBegun':False,'part3Begun':False}
out.write_text(json.dumps(result,indent=2)+'\n');ledger.write_text('Accepted parent: '+parent+'\nExact final Stage I changed-file inventory (Git status + path):\n\n'+'\n'.join(rows)+'\n')
subprocess.run(['git','add',str(out),str(ledger)],cwd=root,check=True);print(json.dumps({'status':'PASS','files':len(rows),'runtimeChanges':0}))
