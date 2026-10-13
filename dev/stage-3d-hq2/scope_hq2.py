#!/usr/bin/env python3
"""Stage 3D HQ2 - the file allowlist frozen at H2-0, checked against what changed since the accepted HQ1 parent (development only).

  python3 -I dev/stage-3d-hq2/scope_hq2.py [--ref HEAD] [--worktree] [--out FILE.json] [--manifest FILE.json]

Every path changed between the parent (ebb3bd6) and --ref (default HEAD; --worktree: the working tree, staged or not, untracked
included) is put in one of:
  production-allowed   the production files H2-0 allows HQ2 to change (the two features and their lifecycle repairs only)
  production-new       new production files H2-0 allows (server/peers.js)
  dev / docs           development tools, evidence and the stage documents
  FORBIDDEN            anything else (another production file, an older stage's tools, tests or evidence: an older assertion HQ2 changes on
                       purpose stays as it is and is reported as a protocol-delta failure next to the HQ2 test that replaces it)
--manifest writes the parent's production files with their blob ids (the H2-0 baseline fingerprint).
Exit 0 only when nothing is FORBIDDEN."""
import json, subprocess, sys, fnmatch
PARENT = 'ebb3bd603e8a2bb4ef00cc40aa6b415bccab9763'
PROD_ALLOWED = {
    'server.js': 'NEW RUN intent/decision, the explosion aftermath, peer blockers in movement/spawn/admin placement, world epoch messages; the old fx:vanish / b:Vanish seams removed',
    'sim.js': 'built from dev/sim_head.js + dev/sim_glue.js: the NEW RUN lifecycle (vanish allowances removed), collision membership, free spawn spots',
    'death_srv.js': 'the explosion as a server death event (fxFor / begin / step / corpse for cause Boom)',
    'dphys.js': 'a separate Boom kind (no attacker, a seeded impulse) beside the untouched Hound/Smiler variants; HQ1 wall marks and light profile reused',
    'mp.js': 'NEW RUN intent/ACK client flow, the explosion replay, world-epoch cleanup, the living peers handed to move.js, soft corrections',
    'move.js': 'living peers as blockers in local prediction (contact projection), vault landing clear of peers',
    'assets/index-DKbV5Nv9.js': 'exact-text edits only, made by dev/stage-3d/apply_bundle.py: the NEW RUN button hook, the short post-ACK beat, ending a local death on a world reset',
    'assets/net-wire.js': 'the corpse codec, only if a Boom record needs a field the codec drops',
    'gore.js': 'the explosion blood burst / corpse look, only through the existing HQ1 wall-stain and floor-blood paths',
    'ents.js': 'one positioned explosion sound on the existing audio bus (built from dev/ents_src by dev/build_ents.sh)',
    'index.html': 'only the run menu copy if the NEW RUN text must stop saying "fade"',
}
PROD_NEW = {'server/peers.js': 'pure peer-collision geometry (swept circle, free spot): server-side only, never served'}
DEV = ['dev/stage-3d-hq2/*', 'dev/stage-3d/apply_bundle.py', 'dev/sim_glue.js', 'dev/sim_head.js', 'dev/build_sim.sh', 'dev/ents_src/*', 'dev/build_ents.sh']
DOCS = ['STAGE_3D_HQ2_*']
PROTECTED_DEV = ['dev/stage-3d-hq1/*', 'dev/stage-3d/evidence/*', 'dev/stage-3h0/*', 'dev/stage-3c*/*', 'dev/stage-3b*/*', 'dev/tests/*', 'STAGE_3D_HQ1_*', 'STAGE_3D_[A-Z]*']   # (older stages' tools, tests and evidence stay as they are: an older assertion HQ2 changes on purpose is reported as a protocol-delta failure, with its HQ2 replacement)
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout


def changed(ref, worktree):
    if worktree:
        names = set(run('git', 'diff', '--name-only', PARENT).split()) | set(run('git', 'ls-files', '--others', '--exclude-standard').split())
    else:
        names = set(run('git', 'diff', '--name-only', PARENT, ref).split())
    return sorted(names)


def classify(p):
    if '__pycache__/' in p: return 'cache (never committed)'
    if p in PROD_ALLOWED: return 'production-allowed'
    if p in PROD_NEW: return 'production-new'
    if any(fnmatch.fnmatch(p, g) for g in DOCS): return 'docs'
    if any(fnmatch.fnmatch(p, g) for g in PROTECTED_DEV) and not p.startswith('STAGE_3D_HQ2_'): return 'FORBIDDEN'
    if any(fnmatch.fnmatch(p, g) for g in DEV): return 'dev'
    return 'FORBIDDEN'


def main():
    a = sys.argv
    ref = a[a.index('--ref') + 1] if '--ref' in a else 'HEAD'
    files = changed(ref, '--worktree' in a)
    R = {'parent': PARENT, 'ref': 'working tree' if '--worktree' in a else run('git', 'rev-parse', ref).strip(), 'allowlist': {'production': PROD_ALLOWED, 'productionNew': PROD_NEW, 'dev': DEV, 'docs': DOCS, 'protected': PROTECTED_DEV},
         'files': {p: classify(p) for p in files}}
    R['forbidden'] = [p for p, c in R['files'].items() if c == 'FORBIDDEN']; R['ok'] = not R['forbidden']
    if '--manifest' in a:
        rows = [l.split(None, 3) for l in run('git', 'ls-tree', '-r', PARENT).splitlines()]
        prod = {r[3]: r[2] for r in rows if not r[3].startswith('dev/') and not r[3].endswith(('.md', '.txt'))}
        with open(a[a.index('--manifest') + 1], 'w') as f: json.dump({'parent': PARENT, 'productionBlobs': prod}, f, indent=1); f.write('\n')
    s = json.dumps(R, indent=1)
    if '--out' in a:
        with open(a[a.index('--out') + 1], 'w') as f: f.write(s + '\n')
    print(json.dumps({'ref': R['ref'], 'counts': {c: sum(1 for v in R['files'].values() if v == c) for c in set(R['files'].values())}, 'forbidden': R['forbidden'], 'ok': R['ok']}))
    return 0 if R['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
