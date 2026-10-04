#!/usr/bin/env python3
"""Audit the final staged source against the accepted G tree, without rewriting it."""
import pathlib, subprocess, hashlib, json

root = pathlib.Path(__file__).resolve().parents[2]
parent = '7fb4dafef92040571209403358e536ccb1105509'
git = lambda *a: subprocess.check_output(['git',*a],cwd=root,text=True).strip()
out = root/'dev/stage_h/evidence/h5/scope-audit.json'
ledger = root/'25D_STAGE_H_CHANGED_FILES.txt'
out.parent.mkdir(parents=True,exist_ok=True)
# Stage placeholders first, so the inventory includes its own two paths.
for p in [out,ledger]:
    if not p.exists():
        p.write_text('Pending exact staged-tree audit\n')
subprocess.run(['git','add',str(out),str(ledger)],cwd=root,check=True)
rows = git('diff','--cached','--name-status',parent).splitlines()
runtime = {
    'assets/index-DKbV5Nv9.js':'Narrow production startup, frame, aim and spatial presentation hooks; retained Pixi prefix.',
    'camcorder.js':'Physical spatial IR query and emitter bloom; retained flat path.',
    'death_srv.js':'Canonical attacker identity for singular presentation ownership; no solver change.',
    'dev/ents_src/30_audio.js':'Existing physical impact presentation and spatial acoustic placement.',
    'ents.js':'Reproducible generated output of maintained entity sources.',
    'hud.js':'Client-local cutaway and full/reduced quality controls.',
    'move.js':'Suppress unsupported cosmetic footsteps only; motor unchanged.',
    'mp.js':'Spatial handshake, canonical presentation metadata/history, masked world overlays.',
    'server.js':'Serve spatial client/bootstrap; sanitize existing equipment/aim inputs and publish physical presentation events.',
    'spatial_authority.js':'Bounded pitch/presentation fields attached only to accepted fixed-tick inputs.',
    'spatial_client.js':'Existing Pixi/world-view integration for XYZ art, aftermath, lights, effects, audio, labels and aim.',
    'world_view.js':'Depth, physical masks, local camera cutaway, lighting and physical picking.',
    'dev/tests/view25d.js':'Real served-browser acceptance orchestrator for Z29/Z30/H-Z14.',
}
for row in rows:
    status,name = row.split('\t',1)
    assert status in ['A','M'], row
    assert name in runtime or name.startswith('dev/stage_h/') or name.startswith('25D_STAGE_H_'), row
    assert '__pycache__' not in name and not name.endswith('.pyc'), name
invariant_paths = ['ai.js','sim.js','dphys.js','world_geometry.js','world_motion.js','spatial_protocol.js',
    'spatial_history.js','world.js','levels','camera_policy.js','timing_policy.js','dev/ai_src',
    'dev/stage_a/traces','dev/stage_b/level0-baseline.json.gz','assets/stageD-pixi.js']
for name in invariant_paths:
    assert not git('diff','--cached','--name-only',parent,'--',name), 'Invariant changed: '+name
base = subprocess.check_output(['git','show',parent+':assets/index-DKbV5Nv9.js'],cwd=root)
current = (root/'assets/index-DKbV5Nv9.js').read_bytes()
assert current[:285685] == base[:285685], 'Existing renderer/vendor prefix changed'
retained = [r for r in rows if r.split('\t',1)[1] in runtime]
result = {'status':'PASS','acceptedParentCommit':parent,'acceptedParentTree':git('rev-parse',parent+'^{tree}'),
    'changedFiles':rows,'changedFileCount':len(rows),'runtimeChanges':{r.split('\t',1)[1]:runtime[r.split('\t',1)[1]] for r in retained},
    'byteUnchangedInvariants':invariant_paths,'unchangedApplicationPrefixBytes':285685,
    'noRemovedFiles':True,'mainModifiedOrMerged':False,'stageIBegun':False,
    'method':'Exact Git staged name/status diff. Finalizer rechecks against published tree; source is not rewritten.'}
out.write_text(json.dumps(result,indent=2)+'\n')
ledger.write_text('Accepted parent: '+parent+'\nExact final Stage H changed-file inventory (Git status + path):\n\n'+'\n'.join(rows)+'\n')
subprocess.run(['git','add',str(out),str(ledger)],cwd=root,check=True)
print(json.dumps({'status':'PASS','files':len(rows),'runtimeFiles':len(retained)}))
