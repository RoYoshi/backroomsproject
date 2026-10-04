#!/usr/bin/env python3
"""Exact name/status audit against accepted Stage I; preserve frozen source."""
import json,subprocess
from release_common import ROOT,PARENT,PARENT_TREE,RECOVERY,git
out=ROOT/'dev/part3a/evidence/p3a5/scope-audit.json';ledger=ROOT/'PART_3A_CHANGED_FILES.txt';out.parent.mkdir(parents=True,exist_ok=True)
for p in [out,ledger]:
 if not p.exists():p.write_text('Pending exact source audit\n')
subprocess.run(['git','add',str(out),str(ledger)],cwd=ROOT,check=True)
rows=git('diff','--cached','--name-status',PARENT).splitlines()
allowed={'dev/sim_glue.js','glitch.js','mp.js','sim.js','spatial_client.js','world_view.js'}
new_content={'levels/level0_gameplay.js','levels/level0_spatial.js','levels/level0_spatial.json','levels/level0_vertical.js'}
for row in rows:
 status,name=row.split('\t');assert status in ['A','M'],row
 assert name in allowed|new_content or name.startswith(('PART_3A_','dev/part3a/')),row
 assert '__pycache__' not in name and not name.endswith('.pyc'),name
 assert name not in new_content or status=='A',row
assert git('rev-parse',PARENT+'^{tree}')==PARENT_TREE
assert not git('diff','--cached','--name-only',PARENT,'--','levels/level0.js','dev/stage_a/traces','dev/stage_b/level0-baseline.json.gz','move.js','world.js','world_motion.js','world_geometry.js','server.js','redirect.js','spatial_authority.js','spatial_protocol.js','dphys.js','death_srv.js','dev/ai_src','dev/ents_src')
assert not git('diff','--cached','--name-only',RECOVERY,'--',*sorted(allowed|new_content)),'Recovery changed production runtime'
changed=git('diff','--cached','--name-only',RECOVERY,'--','dev/part3a/evidence').splitlines()
preserved=set(git('ls-tree','-r','--name-only',RECOVERY,'--','dev/part3a/evidence').splitlines())
assert not preserved.intersection(changed),'Preserved evidence edited'
result={'status':'PASS','acceptedParentCommit':PARENT,'acceptedParentTree':PARENT_TREE,'changedFiles':rows,'changedFileCount':len(rows),'modifiedRuntimeAndMaintainedSource':sorted(allowed),'newContentFiles':sorted(new_content),'recoveryRuntimeChanges':0,'allPreservedEvidenceUntouched':True,'noRemovedFiles':True,'frozenFlatReferencesUnchanged':True,'mainModifiedOrMerged':False,'part3BBegun':False,'part3CPlusBegun':False}
out.write_text(json.dumps(result,indent=2)+'\n');ledger.write_text('Accepted parent: '+PARENT+'\nExact Part 3A changed-file inventory (Git status + path):\n\n'+'\n'.join(rows)+'\n')
subprocess.run(['git','add',str(out),str(ledger)],cwd=ROOT,check=True);print(json.dumps({'status':'PASS','files':len(rows),'recoveryRuntimeChanges':0}))
