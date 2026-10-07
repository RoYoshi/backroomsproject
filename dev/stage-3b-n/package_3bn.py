#!/usr/bin/env python3
"""Stage 3B-N package (adapted from dev/stage-3b/package_3b.py): ZIP of a commit (git archive), its SHA-256, and a receipt.

  package_3bn.py REPO COMMIT OUTDIR REMOTE_VERIFY_JSON NAME      (REMOTE_VERIFY_JSON from dev/stage-3b-n/verify_remote_3bn.py --out)

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id), nothing missing or extra;
  - the commit, tree and parent; what GitHub reports for the branch after the push (commit, tree, parents);
  - main, br-role and stage-3b-remaster untouched; the accepted Stage 3B parent an ancestor; no Stage 3B-W / 3C branch;
  - scope: every file changed since the Stage 3B parent is on the Stage 3B-N list (STAGE_3B_N_CHANGED_FILES.txt), and
    the files Stage 3B-N must not touch (the remaster, the HUD / UI / gore / death files, the policies themselves) are
    byte-identical to the parent;
  - the shipped client files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, receipt.json and STAGE_3B_N_PACKAGE_RECEIPT.txt.
"""
import hashlib, json, subprocess, sys, tempfile, time, zipfile
from pathlib import Path
REPO, COMMIT, OUT, RV, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5]
PARENT = '69602e7c9e755fcc65402b1563d4d060f5a10066'; PARENT_TREE = '8a011aa80cba0dd08be9902f3180499ecae3b531'
MAIN = '7781e1ac34aa09970df57fae3fc107a873fa2731'
ALLOWED = {'server.js', 'assets/br-role.js', 'mp.js', 'ents.js', 'world.js', 'assets/index-DKbV5Nv9.js', 'sim.js', 'move.js', 'ai.js',
           'dev/ents_src/40_debug.js', 'dev/sim_head.js', 'dev/sim_geo.js', 'dev/ai_src/20_senses.js', 'dev/ai_src/22_intelligence.js', 'dev/ai_src/50_hound.js',
           'dev/tests/s_hound2e.js', 'dev/tests/s_system.js'}
ALLOWED_PREFIX = ('dev/stage-3b-n/', 'STAGE_3B_N_')
UNTOUCHED = ['assets/l0-remaster.js', 'assets/level0_visuals.js', 'camera_policy.js', 'timing_policy.js', 'index.html', 'light.js', 'hud.js', 'inventory.js',
             'gore.js', 'death_srv.js', 'assets/shadows-2d.js', 'dev/ai_src/60_smiler.js', 'dev/sim_glue.js']
SHIPPED = ['server.js', 'index.html', 'camera_policy.js', 'timing_policy.js', 'assets/index-DKbV5Nv9.js', 'assets/br-role.js', 'assets/l0-remaster.js', 'world.js',
           'move.js', 'mp.js', 'ents.js', 'sim.js', 'ai.js']
REMOTE = json.loads(RV.read_text())
def git(*a): return subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True, text=True).stdout
OUT.mkdir(parents=True, exist_ok=True); zpath = OUT / f'{name}.zip'
subprocess.run(['git', '-C', str(REPO), 'archive', '--format=zip', f'--prefix={name}/', '-o', str(zpath), COMMIT], check=True)
sha = hashlib.sha256(zpath.read_bytes()).hexdigest(); (OUT / f'{name}.zip.sha256').write_text(f'{sha}  {zpath.name}\n')
commit = git('rev-parse', COMMIT).strip(); tree = git('rev-parse', f'{COMMIT}^{{tree}}').strip(); parent = git('rev-parse', f'{COMMIT}^').strip()
listing = {l.split('\t', 1)[1]: l.split('\t', 1)[0].split()[2] for l in git('ls-tree', '-r', COMMIT).splitlines()}
with tempfile.TemporaryDirectory() as td:
    with zipfile.ZipFile(zpath) as z: bad_zip = z.testzip(); z.extractall(td); entries = len(z.namelist())
    root = Path(td) / name
    files = sorted(str(p.relative_to(root)) for p in root.rglob('*') if p.is_file())
    missing = sorted(set(listing) - set(files)); extra = sorted(set(files) - set(listing))
    mism = [f for f in files if f in listing and subprocess.run(['git', 'hash-object', str(root / f)], check=True, capture_output=True, text=True).stdout.strip() != listing[f]]
    shipped = {f: {'sha256': hashlib.sha256((root / f).read_bytes()).hexdigest(), 'bytes': (root / f).stat().st_size} for f in SHIPPED}
anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', PARENT, commit]).returncode == 0
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip()
since = [l for l in git('diff', '--name-only', PARENT, commit).splitlines() if l]
outside = [f for f in since if f not in ALLOWED and not f.startswith(ALLOWED_PREFIX)]
untouched = {f: ('unchanged' if f not in since else 'CHANGED') for f in UNTOUCHED}
chain = [l for l in git('log', '--format=%h %s', f'{PARENT}..{commit}').splitlines()]
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
scope_ok = anc and not outside and all(v == 'unchanged' for v in untouched.values()) and parent_tree == PARENT_TREE
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'commit': commit, 'tree': tree,
     'parentCommit': parent, 'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'shipped': shipped, 'remote': REMOTE, 'acceptedParent': PARENT, 'acceptedParentTree': parent_tree, 'acceptedParentIsAncestor': anc, 'checkpoints': chain,
     'changedSinceParent': since, 'outsideScope': outside, 'mustBeUntouched': untouched, 'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and scope_ok)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
code = [f for f in since if not f.startswith('dev/stage-3b-n/evidence/')]
T = ['THE FAR BACKROOMS - Stage 3B-N (Behavior / Visibility / Camera QOL Corrections) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3b-n/package_3bn.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}', f'zip CRCs   {"all OK" if bad_zip is None else "BAD: " + bad_zip}', '',
     '== Source revision (branch stage-3b-n, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}  ({git("log", "-1", "--format=%s", parent).strip()})',
     f'accepted Stage 3B parent  {PARENT}  (tree {parent_tree}; an ancestor: {yn(anc)}; tree as accepted: {yn(parent_tree == PARENT_TREE)})', '',
     '== Stage 3B-N checkpoints (parent..commit) ==', *[f'  {c}' for c in reversed(chain)], '',
     '== GitHub (checked after the push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}', f'REST API commit   {REMOTE["githubApi"]["commit"]}',
     f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'main (untouched)               {REMOTE["mainUntouched"]}  {yn(REMOTE["mainUntouched"] == MAIN)}',
     f'stage-3b-remaster (untouched)  {REMOTE["stage3bRemasterUntouched"]}  {yn(REMOTE["stage3bRemasterUntouched"] == PARENT)}',
     f'br-role (untouched)            {REMOTE["brRoleUntouched"]}', f'Stage 3B-W / 3C branches       {REMOTE["stage3bWor3cBranches"] or "none"}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     '== Scope (git diff --name-only 69602e7..commit) ==', f'files changed since the accepted Stage 3B parent: {len(since)} ({len(code)} outside dev/stage-3b-n/evidence/)',
     f'outside the Stage 3B-N list (STAGE_3B_N_CHANGED_FILES.txt): {len(outside)}' + (' -> ' + ', '.join(outside) if outside else ''),
     *[f'  {f}' for f in code], '', 'must be untouched (byte-identical to the parent):', *[f'  {f:<30} {v}' for f, v in untouched.items()],
     f'Stage 3B-W not begun (no topology / pits / DAMP flooring / procedural change; no stage-3b-w branch): {yn(not REMOTE["stage3bWor3cBranches"] and untouched["assets/level0_visuals.js"] == "unchanged")}',
     f'Stage 3C not begun (hud.js, inventory.js, gore.js, death_srv.js untouched; no stage-3c branch): {yn(not REMOTE["stage3bWor3cBranches"] and all(untouched[f] == "unchanged" for f in ["hud.js", "inventory.js", "gore.js", "death_srv.js"]))}',
     f'Stage 3B remaster untouched (assets/l0-remaster.js, assets/level0_visuals.js): {yn(untouched["assets/l0-remaster.js"] == untouched["assets/level0_visuals.js"] == "unchanged")}', '',
     '== Shipped client / server files ==', *[f'{f:<26} sha256 {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], '',
     f'RESULT: {"OK" if R["ok"] else "FAILED"}', '']
(OUT / 'STAGE_3B_N_PACKAGE_RECEIPT.txt').write_text('\n'.join(T))
print(json.dumps({k: R[k] for k in ['package', 'sha256', 'bytes', 'commit', 'tree', 'filesInZip', 'filesInCommit', 'zipIntegrity', 'acceptedParentIsAncestor', 'outsideScope', 'ok']}, indent=1))
