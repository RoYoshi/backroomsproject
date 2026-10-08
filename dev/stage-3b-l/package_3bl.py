#!/usr/bin/env python3
"""Stage 3B final polish package (adapted from dev/stage-3b-n): ZIP of a commit (git archive), its SHA-256, and a receipt.

  package_3bl.py REPO COMMIT OUTDIR REMOTE_VERIFY_JSON NAME      (REMOTE_VERIFY_JSON from dev/stage-3b-l/verify_remote_3bl.py --out)

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id), nothing missing or extra;
  - the commit, tree and parent; what GitHub reports for stage-3b-l after the push; the Phase A camera checkpoint
    (stage-3b-n-camera b2783b3) on the remote and an ancestor; main, br-role, stage-3b-remaster and the superseded
    stage-3b-n untouched; the accepted Stage 3B parent an ancestor; no Stage 3B-W / 3C branch;
  - scope: every file changed since the Stage 3B parent is on the final-polish list (STAGE_3B_FINAL_POLISH_CHANGED_FILES.txt),
    the remaster's one change is its one-token camera fallback, and the files this pass must not touch (gameplay, AI, light
    truth, HUD / UI, the remaster's level visuals, the timing policy) are byte-identical to the parent;
  - the shipped client files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, receipt.json and STAGE_3B_FINAL_POLISH_PACKAGE_RECEIPT.txt.
"""
import hashlib, json, subprocess, sys, tempfile, time, zipfile
from pathlib import Path
REPO, COMMIT, OUT, RV, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5]
PARENT = '69602e7c9e755fcc65402b1563d4d060f5a10066'; PARENT_TREE = '8a011aa80cba0dd08be9902f3180499ecae3b531'
MAIN = '7781e1ac34aa09970df57fae3fc107a873fa2731'; CAMERA = 'b2783b34e1185b30002350f5b482dd8c5e10b000'
ALLOWED = {'server.js', 'camera_policy.js', 'assets/index-DKbV5Nv9.js', 'assets/l0-remaster.js', 'assets/br-role.js',
           'dev/tests/s_camera_fairness.js', 'dev/br-role/test_br_role.js', 'dev/br-role/smoke.js'}
ALLOWED_PREFIX = ('dev/stage-3b-n/', 'dev/stage-3b-l/', 'STAGE_3B_FINAL_POLISH_')
UNTOUCHED = ['timing_policy.js', 'index.html', 'light.js', 'world.js', 'move.js', 'mp.js', 'ents.js', 'sim.js', 'ai.js', 'death_srv.js', 'dphys.js',
             'hud.js', 'inventory.js', 'gore.js', 'glitch.js', 'camcorder.js', 'sfx.js', 'assets/level0_visuals.js', 'assets/shadows-2d.js']
UNTOUCHED_PREFIX = ('dev/ai_src/', 'dev/ents_src/')
SHIPPED = ['server.js', 'index.html', 'camera_policy.js', 'timing_policy.js', 'assets/index-DKbV5Nv9.js', 'assets/br-role.js', 'assets/l0-remaster.js',
           'world.js', 'move.js', 'mp.js', 'ents.js', 'sim.js', 'ai.js', 'light.js']
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
cam_anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', CAMERA, commit]).returncode == 0
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip()
since = [l for l in git('diff', '--name-only', PARENT, commit).splitlines() if l]
outside = [f for f in since if f not in ALLOWED and not f.startswith(ALLOWED_PREFIX)]
untouched = {f: ('unchanged' if f not in since else 'CHANGED') for f in UNTOUCHED}
untouched_dirs = [f for f in since if f.startswith(UNTOUCHED_PREFIX)]
remaster = [l for l in git('diff', '-U0', PARENT, commit, '--', 'assets/l0-remaster.js').splitlines() if l[:1] in '+-' and not l.startswith(('+++', '---'))]
remaster_ok = len(remaster) == 2 and 'let sc = 1.18;' in remaster[0] and 'let sc = 1.25;' in remaster[1] and remaster[0].replace('1.18', '1.25')[1:] == remaster[1][1:]
chain = [l for l in git('log', '--format=%h %s', f'{PARENT}..{commit}').splitlines()]
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
scope_ok = anc and cam_anc and not outside and all(v == 'unchanged' for v in untouched.values()) and not untouched_dirs and remaster_ok and parent_tree == PARENT_TREE
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'commit': commit, 'tree': tree,
     'parentCommit': parent, 'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'shipped': shipped, 'remote': REMOTE, 'acceptedParent': PARENT, 'acceptedParentTree': parent_tree, 'acceptedParentIsAncestor': anc, 'cameraCheckpointIsAncestor': cam_anc,
     'checkpoints': chain, 'changedSinceParent': since, 'outsideScope': outside, 'mustBeUntouched': untouched, 'untouchedDirsChanged': untouched_dirs,
     'remasterChange': remaster, 'remasterOnlyTheCameraFallback': remaster_ok, 'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and scope_ok)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
code = [f for f in since if '/evidence/' not in f]
T = ['THE FAR BACKROOMS - Stage 3B Final Polish (camera 1.25 + BR-RoLE 1.1) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3b-l/package_3bl.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}', f'zip CRCs   {"all OK" if bad_zip is None else "BAD: " + bad_zip}', '',
     '== Source revision (branch stage-3b-l, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}  ({git("log", "-1", "--format=%s", parent).strip()})',
     f'Phase A camera checkpoint  {CAMERA}  (stage-3b-n-camera; an ancestor: {yn(cam_anc)})',
     f'accepted Stage 3B parent   {PARENT}  (tree {parent_tree}; an ancestor: {yn(anc)}; tree as accepted: {yn(parent_tree == PARENT_TREE)})', '',
     '== Checkpoints (parent..commit) ==', *[f'  {c}' for c in reversed(chain)], '',
     '== GitHub (checked after the push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}', f'REST API commit   {REMOTE["githubApi"]["commit"]}',
     f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'stage-3b-n-camera (Phase A)     {REMOTE["cameraCheckpoint"]["remote"]}  {yn(REMOTE["cameraCheckpoint"]["remote"] == CAMERA)}',
     f'main (untouched)                {REMOTE["mainUntouched"]}  {yn(REMOTE["mainUntouched"] == MAIN)}',
     f'stage-3b-remaster (untouched)   {REMOTE["stage3bRemasterUntouched"]}  {yn(REMOTE["stage3bRemasterUntouched"] == PARENT)}',
     f'stage-3b-n superseded (untouched, never force-pushed)  {REMOTE["supersededStage3bNUntouched"]}',
     f'br-role (untouched)             {REMOTE["brRoleUntouched"]}', f'Stage 3B-W / 3C branches        {REMOTE["stage3bWor3cBranches"] or "none"}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     '== Scope (git diff --name-only 69602e7..commit) ==', f'files changed since the accepted Stage 3B parent: {len(since)} ({len(code)} outside evidence folders)',
     f'outside the final-polish list (STAGE_3B_FINAL_POLISH_CHANGED_FILES.txt): {len(outside)}' + (' -> ' + ', '.join(outside) if outside else ''),
     *[f'  {f}' for f in code], '',
     f'assets/l0-remaster.js: only its camera fallback 1.18 -> 1.25 (one line): {yn(remaster_ok)}',
     'must be untouched (byte-identical to the parent):', *[f'  {f:<28} {v}' for f, v in untouched.items()],
     f'  {"dev/ai_src/, dev/ents_src/":<28} {"unchanged" if not untouched_dirs else "CHANGED: " + ", ".join(untouched_dirs)}',
     f'gameplay light truth untouched (light.js, the server / AI, the bundle\'s Ul()): {yn(untouched["light.js"] == untouched["ai.js"] == untouched["sim.js"] == "unchanged")}',
     f'Stage 3C not begun (hud.js, inventory.js, gore.js, death_srv.js untouched; no stage-3c branch): {yn(not REMOTE["stage3bWor3cBranches"] and all(untouched[f] == "unchanged" for f in ["hud.js", "inventory.js", "gore.js", "death_srv.js"]))}', '',
     '== Shipped client files (SHA-256, from the ZIP) ==', *[f'  {f:<28} {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], '',
     f'RESULT: {"OK" if R["ok"] else "PROBLEMS - see receipt.json"}']
(OUT / 'STAGE_3B_FINAL_POLISH_PACKAGE_RECEIPT.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
