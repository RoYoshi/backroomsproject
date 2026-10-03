#!/usr/bin/env python3
"""Audit staged inventory against Stage D. Stage the two output paths first.
Outputs contain no self-referential hashes. Historical evidence stays unchanged.
"""
import hashlib,json,pathlib,re,subprocess
root=pathlib.Path(__file__).resolve().parents[2]
def git(*args):return subprocess.check_output(['git','-C',str(root),*args])
assert git('branch','--show-current').decode().strip()=='stage-e'
parent=json.loads((root/'dev/stage_e/evidence/e0/parent-manifest.json').read_text())
paths=sorted(p.decode() for p in git('ls-files','-z').split(b'\0') if p)
digest=lambda p:hashlib.sha256((root/p).read_bytes()).hexdigest()
reasons={
 'ai.js':'Generated maintained AI output; Stage E adapters and E5 flat coarseMove repair.',
 'dev/ai_src/00_head.js':'Import the canonical Stage C movement kernel for spatial actors.',
 'dev/ai_src/10_geo.js':'Surface-local cells/links in retained A*, physical edge proof, spatial snapping and counters.',
 'dev/ai_src/20_senses.js':'Physical XYZ observations; preserve flat sensing.',
 'dev/ai_src/22_intelligence.js':'Legitimate spatial evidence and uncertainty in existing memory/prediction.',
 'dev/ai_src/25_light.js':'Height-aware visible receiver queries and explicit IR exclusion.',
 'dev/ai_src/30_entity.js':'Spatial pose/route/motion dispatch; restore original flat coarse distance.',
 'dev/ai_src/40_capture.js':'Physical guards reject cross-floor contact before lifecycle/RNG changes.',
 'dev/ai_src/50_hound.js':'Existing Hound consumes spatial evidence, physical goals and feasible pack boundaries.',
 'dev/ai_src/60_smiler.js':'Existing Smiler consumes spatial adapters without new species powers.',
 'dev/ai_src/90_engine.js':'Spatial spawn, observer-bound adapters, sound and fixed-tick LOD integration.',
 'dev/build_ai.sh':'Include maintained spatial query and motion sections in generated AI.',
 'dev/tests/s_nav25d.js':'Activate Z10-Z13 navigation placeholders using implemented real-system suites.',
 'dev/tests/s_perception25d.js':'Activate Z14-Z17 Stage E portions using actual sensor/entity suites.',
 'server.js':'Authorized presentation-only BOOTING/ONLINE banner with safe runtime/revision metadata.',
 'world_geometry.js':'Support continuity, physical receiver queries and bounded acoustic routing for Stage E.',
 'world_motion.js':'Legitimate top-tread/landing seam continuity through existing fixed-tick support kernel.',
}
changed=[{'path':p,'parentSHA256':h,'finalSHA256':digest(p),'reason':reasons.get(p)} for p,h in sorted(parent.items()) if (root/p).exists() and digest(p)!=h]
deleted=[p for p in parent if not (root/p).exists()]
new=[p for p in paths if p not in parent]
assert not deleted,deleted
assert all(p['reason'] for p in changed),'Every changed original requires a reason'
protected=['levels/level0.js','move.js','camera_policy.js','timing_policy.js','world_view.js','mp.js','dphys.js','death_srv.js','sim.js','dev/sim_glue.js','index.html','assets/index-DKbV5Nv9.js','assets/stageD-prototype.js','assets/stageD-world.json','redirect.js','dev/stage_a/future_matrix.json']
checks={p:{'sha256':digest(p),'unchanged':digest(p)==parent[p]} for p in protected}
assert all(r['unchanged'] for r in checks.values())
wire={}
for species,file in [('HOUND','dev/ai_src/50_hound.js'),('SMILER','dev/ai_src/60_smiler.js')]:
 old=git('show','478ada6cf534d40810e28709755e88f0b53b6ee5:'+file).decode()
 now=(root/file).read_text();pattern=r'^'+species+r'\.snap = .*;$'
 wire[species]=re.search(pattern,old,re.M).group()==re.search(pattern,now,re.M).group()
assert all(wire.values())
result={'status':'PASS','reference':'Immutable accepted Stage D ZIP manifest','parentZIP_SHA256':'b52a40ca1d10216d113f5105c4f1e537dce2270b786f9b293e9d59467629c5de','originalFiles':len(parent),'originalChanged':changed,'originalDeleted':deleted,'originalIdentical':len(parent)-len(changed),'newFiles':new,'totalFiles':len(paths),'protected':checks,'wireSnapshotsUnchanged':wire,'stageFStarted':False}
(root/'dev/stage_e/evidence/final/scope.json').write_text(json.dumps(result,indent=2)+'\n')
lines=['Stage E exact file record','Reference: accepted Stage D ZIP; 585-file immutable manifest.','Final commit/tree/file hashes: external PACKAGE_VERIFICATION.json.','',f'Originals: {len(changed)} changed; {len(deleted)} deleted; {result["originalIdentical"]} byte-identical.',f'New relative to the ZIP: {len(new)}; final total: {len(paths)}.','','MODIFIED ORIGINALS']
for r in changed:lines.extend([r['path'],'  parent SHA-256: '+r['parentSHA256'],'  final SHA-256:  '+r['finalSHA256'],'  reason: '+r['reason']])
lines+=['','DELETED ORIGINALS','None.','','NEW RELATIVE TO STAGE D ZIP',*new,'','E5 CONTINUATION DELTA FROM VERIFIED bca4bb1 CANDIDATE (STAGED FINAL TREE)',git('diff','--cached','--name-status','bca4bb1ca183e7c2cb83a676d4f3c3e3167f954f').decode().rstrip(),'','Three pre-existing repository-only files (.github/workflows/deploy-bloom.yml, sounds/sting.mp3, sounds/sting copy.mp3) are preserved. Historical evidence records former machine paths; executable harnesses resolve package-relative roots and the package is tested in a gitless path containing spaces.']
(root/'25D_STAGE_E_CHANGED_FILES.txt').write_text('\n'.join(lines)+'\n')
print(json.dumps({k:v for k,v in result.items() if k in ['status','originalFiles','originalIdentical','totalFiles']}))
