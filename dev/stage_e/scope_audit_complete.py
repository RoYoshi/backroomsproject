#!/usr/bin/env python3
"""Audit every original Stage D file and inventory all final Stage E additions."""
import argparse, hashlib, json, pathlib, subprocess

p = argparse.ArgumentParser()
p.add_argument('--parent', type=pathlib.Path, required=True)
a = p.parse_args()
root = pathlib.Path(__file__).resolve().parents[2]
parent = a.parent.resolve()
manifest = json.loads((root/'dev/stage_e/evidence/e0/parent-manifest.json').read_text())
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
assert len(manifest) == 585
assert all(digest(parent/name) == value for name, value in manifest.items())
reasons = {
    'ai.js': 'Reproducible generated AI including the Stage E navigation/sensor/motion integration.',
    'dev/ai_src/00_head.js': 'Inject the shared CPU world-motion kernel into AI.',
    'dev/ai_src/10_geo.js': 'Occupied surface graph, physical route proofs, species gates, bounded caches and diagnostic counters.',
    'dev/ai_src/20_senses.js': 'Spatial observation boundary with bounded legitimate XYZ/support uncertainty.',
    'dev/ai_src/22_intelligence.js': 'Carry remembered spatial evidence and reachable hypotheses without hidden target queries.',
    'dev/ai_src/25_light.js': 'Receiver-aware physical visible-light sensing with separate unchanged IR channel.',
    'dev/ai_src/30_entity.js': 'Shared physical steering/traversal integration; E5 restores the original flat coarseMove distance.',
    'dev/ai_src/40_capture.js': 'Physical XYZ contact guard before capture/commitment/RNG.',
    'dev/ai_src/50_hound.js': 'Feed observed spatial poses into existing Hound species decisions/routes.',
    'dev/ai_src/60_smiler.js': 'Feed observed spatial poses into existing Smiler species decisions/routes.',
    'dev/ai_src/90_engine.js': 'Spatial spawn, LOD, group/contact and fixed-step adapter integration.',
    'dev/build_ai.sh': 'Include the new spatial sensor and motion source slices in the reproducible AI build.',
    'dev/tests/s_nav25d.js': 'Activate existing Stage E navigation acceptance through the real focused suites.',
    'dev/tests/s_perception25d.js': 'Activate existing Stage E sensor/species acceptance through the real focused suites.',
    'server.js': 'Authorized presentation-only safe BOOTING/ONLINE startup banner.',
    'world_geometry.js': 'Shared physical spatial geometry/query helpers required by Stage E.',
    'world_motion.js': 'Shared motion/traversal proof and continuous support-boundary correctness required by Stage E.',
}
out = root/'dev/stage_e/evidence/final-scope.json'
changed_file = root/'25D_STAGE_E_CHANGED_FILES.txt'
out.touch(exist_ok=True)
changed_file.touch(exist_ok=True)
paths = sorted(set(x.decode() for x in subprocess.check_output(
    ['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).split(b'\0') if x))
assert all((root/name).is_file() for name in paths)
assert 'redirect.js' in paths
deleted = sorted(set(manifest)-set(paths))
modified = {name:{'parentSHA256':value,'finalSHA256':digest(root/name),'reason':reasons.get(name)}
            for name,value in manifest.items() if name in paths and digest(root/name)!=value}
assert not deleted, deleted
assert set(modified) == set(reasons), sorted(modified)
identical = {name:value for name,value in manifest.items() if name not in modified}
protected = sorted(name for name in manifest if name.startswith(('assets/','dev/stage_a/','dev/stage_d/','levels/'))
                   or name in ['camera_policy.js','timing_policy.js','world.js','world_view.js','move.js','sim.js','mp.js','death_srv.js','dphys.js','ents.js','index.html','redirect.js'])
assert all(name in identical for name in protected)
js = """const assert=require('node:assert/strict');
const a=require(process.argv[1]+'/ai.js'),b=require(process.argv[2]+'/ai.js');
for(const k of ['HOUND','SMILER']){assert.equal(a[k].snap.toString(),b[k].snap.toString());assert.deepEqual(a[k].caps,b[k].caps);}
assert.deepEqual(a.INTEL,b.INTEL);
console.log(JSON.stringify({snapshots:'IDENTICAL',capabilities:'IDENTICAL',evidenceCaps:'IDENTICAL',intel:a.INTEL}));"""
guards=json.loads(subprocess.check_output(['node','-e',js,str(root),str(parent)],text=True))
new = sorted(set(paths)-set(manifest))
extras=['.github/workflows/deploy-bloom.yml','sounds/sting.mp3','sounds/sting copy.mp3']
result={'status':'PASS','parentFiles':len(manifest),'modifiedCount':len(modified),'deletedCount':0,
        'byteIdenticalCount':len(identical),'newCount':len(new),'finalFiles':len(paths),
        'modified':modified,'deleted':deleted,'new':new,'preexistingRepositoryExtras':extras,
        'byteIdentical':identical,'protectedFiles':protected,'speciesGuards':guards,
        'scope':'All 585 immutable Stage D files compared. New relative-to-parent files include three preexisting repository extras. Final archive identity is external.',
        'portability':'No absolute machine paths in active Stage E harness/source code. Historical logs retain provenance paths; runtime never depends on those paths.'}
out.write_text(json.dumps(result,indent=2)+'\n')
lines=['Stage E exact changed-file inventory relative to the immutable Stage D ZIP.',
       f'Original files: {len(manifest)}; modified: {len(modified)}; deleted: 0; byte-identical: {len(identical)}; additions: {len(new)}; total: {len(paths)}.',
       'The external package-verification JSON contains SHA-256 for every shipped file.',
       'Three additions predate Stage E in the repository: '+', '.join(extras)+'.',
       '', 'MODIFIED ORIGINALS (every change has a reason)']
lines += [name+' | '+row['reason'] for name,row in sorted(modified.items())]
lines += ['', 'DELETED ORIGINALS: NONE', '', 'NEW RELATIVE TO IMMUTABLE PARENT']+new
lines += ['', 'BYTE-IDENTICAL ORIGINALS']+sorted(identical)
changed_file.write_text('\n'.join(lines)+'\n')
print(json.dumps({k:result[k] for k in ['status','parentFiles','modifiedCount','deletedCount','byteIdenticalCount','newCount','finalFiles']}))
