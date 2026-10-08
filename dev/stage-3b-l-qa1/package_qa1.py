#!/usr/bin/env python3
"""Stage 3B-L QA1 (lighting reality correction) package: ZIP of a commit (git archive), its SHA-256, and a receipt.
(Adapted from dev/stage-3b-l/package_3bl.py.)

  package_qa1.py REPO COMMIT OUTDIR REMOTE_VERIFY_JSON FIXTURES_JSON FIXTURES_PAGE_JSON CAMERA_LOG NAME

  REMOTE_VERIFY_JSON  from dev/stage-3b-l-qa1/verify_remote_qa1.py --out
  FIXTURES_JSON       from dev/stage-3b-l-qa1/fixtures_qa1.js --out        (node: client = server = world.js W.lamps)
  FIXTURES_PAGE_JSON  from dev/stage-3b-l-qa1/fixtures_page_qa1.js --out   (the running game, beside every fixture)
  CAMERA_LOG          the output of dev/stage-3b-n/test_3bn.js on the final tree

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id), nothing missing or extra;
  - the commit, tree and parent chain back to the QA parent b9f3a9b (tree 3a1ccbb); what GitHub reports for stage-3b-l-qa1
    after the push; the camera checkpoint b2783b3 an ancestor and unchanged on the remote; main, br-role, stage-3b-remaster,
    stage-3b-l (the parent) and the superseded stage-3b-n untouched; no Stage 3B-W / 3C branch;
  - scope: every file changed since the parent is on the QA1 list; the bundle's and sim.js's only change is their lamp list
    line (now world.js W.lamps); the camera / timing policies, server.js, the AI, light.js, movement, mp.js and the other
    gameplay files are byte-identical to the parent;
  - camera unchanged: camera_policy.js, timing_policy.js and server.js byte-identical, the bundle's camera code untouched (its
    one changed line is the lamp list), and the camera fast checks pass on the final tree;
  - lamp placement consistent: one placement (world.js), the client's and the server's lists identical, every fixture with
    its housing, its BR-RoLE light and its client / server light truth;
  - the shipped client files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, receipt.json and STAGE_3B_LIGHTING_QA_CORRECTION_PACKAGE_RECEIPT.txt.
"""
import hashlib, json, subprocess, sys, tempfile, time, zipfile
from pathlib import Path
REPO, COMMIT, OUT, RV, FX, FXP, CAMLOG, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), Path(sys.argv[5]), Path(sys.argv[6]), Path(sys.argv[7]), sys.argv[8]
PARENT = 'b9f3a9b934f40e35d51596f593eae810d077f194'; PARENT_TREE = '3a1ccbb6ca3bf869b9e4c56722a4bf755ee4e36a'
MAIN = '7781e1ac34aa09970df57fae3fc107a873fa2731'; CAMERA = 'b2783b34e1185b30002350f5b482dd8c5e10b000'
REMASTER = '69602e7c9e755fcc65402b1563d4d060f5a10066'; BRROLE = 'b86966b5f59070b0f4c15b000c70a95e5f3b4e00'; SUPERSEDED = '118d45c24d99d2cbc1e7b5b76cb76e041ac40d87'
ALLOWED = {'assets/br-role.js', 'world.js', 'assets/index-DKbV5Nv9.js', 'sim.js', 'dev/sim_head.js', 'dev/sim_geo.js', 'assets/l0-remaster.js',
           'assets/level0_visuals.js', 'dev/br-role/test_br_role.js', 'dev/br-role/smoke.js', 'dev/stage-3b/test_3b.js'}
ALLOWED_PREFIX = ('dev/stage-3b-l-qa1/', 'STAGE_3B_LIGHTING_QA_CORRECTION_')
UNTOUCHED = ['camera_policy.js', 'timing_policy.js', 'server.js', 'index.html', 'light.js', 'ai.js', 'move.js', 'mp.js', 'ents.js', 'death_srv.js', 'dphys.js',
             'hud.js', 'inventory.js', 'gore.js', 'glitch.js', 'camcorder.js', 'sfx.js', 'dev/sim_glue.js', 'assets/shadows-2d.js']
UNTOUCHED_PREFIX = ('dev/ai_src/', 'dev/ents_src/')
SHIPPED = ['server.js', 'index.html', 'camera_policy.js', 'timing_policy.js', 'assets/index-DKbV5Nv9.js', 'assets/br-role.js', 'assets/l0-remaster.js',
           'assets/level0_visuals.js', 'world.js', 'move.js', 'mp.js', 'ents.js', 'sim.js', 'ai.js', 'light.js']
LAMP_LINE = {'assets/index-DKbV5Nv9.js': 'var Fc=window.WORLD.lamps(Oc,', 'sim.js': 'var Fc=WORLD.lamps(Oc,'}
OLD_LOOP = 'var Fc=[];Oc.forEach((e,t)=>{if(t!==6)for(let n=e.x+2;n<e.x+e.w-1;n+=5)for(let r=e.y+2;r<e.y+e.h-1;r+=5)kc[r*FBW+n]&&Fc.push({x:(n+.5)*96,y:(r+.5)*96})});'
REMOTE = json.loads(RV.read_text()); FIX = json.loads(FX.read_text()); FIXP = json.loads(FXP.read_text()); CAM = CAMLOG.read_text()
def git(*a): return subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True, text=True).stdout
def blob(rev, f):
    r = subprocess.run(['git', '-C', str(REPO), 'show', f'{rev}:{f}'], capture_output=True); return r.stdout if r.returncode == 0 else None
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
    zipped_src = {f: (root / f).read_text(encoding='utf-8') for f in LAMP_LINE}
anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', PARENT, commit]).returncode == 0
cam_anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', CAMERA, commit]).returncode == 0
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip()
since = [l for l in git('diff', '--name-only', PARENT, commit).splitlines() if l]
outside = [f for f in since if f not in ALLOWED and not f.startswith(ALLOWED_PREFIX)]
untouched = {f: ('unchanged' if f not in since else 'CHANGED') for f in UNTOUCHED}
untouched_dirs = [f for f in since if f.startswith(UNTOUCHED_PREFIX)]
# the bundle's and sim.js's only change: the old lamp loop replaced by the world.js call (everything else byte-identical)
lamp_only = {}
for f, new in LAMP_LINE.items():
    old = blob(PARENT, f).decode('utf-8'); cur = zipped_src[f]
    i = cur.find(new); j = cur.find(';', cur.find(')', i)) + 1 if i >= 0 else -1
    lamp_only[f] = bool(old.count(OLD_LOOP) == 1 and i >= 0 and old.replace(OLD_LOOP, cur[i:j]) == cur)
chain = [l for l in git('log', '--format=%h %s', f'{PARENT}..{commit}').splitlines()]
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
camera_tests = [l for l in CAM.splitlines() if l.startswith(('PASS', 'FAIL'))]
camera_ok = (all(untouched[f] == 'unchanged' for f in ['camera_policy.js', 'timing_policy.js', 'server.js']) and lamp_only['assets/index-DKbV5Nv9.js']
             and camera_tests and all(l.startswith('PASS') for l in camera_tests) and '7/7 passed' in CAM)
fx_ok = all(r['ok'] for r in FIX['results']) and all(r['ok'] for r in FIXP['results'])
lamps_consistent = fx_ok and lamp_only['sim.js'] and lamp_only['assets/index-DKbV5Nv9.js']
scope_ok = anc and cam_anc and not outside and all(v == 'unchanged' for v in untouched.values()) and not untouched_dirs and all(lamp_only.values()) and parent_tree == PARENT_TREE
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'commit': commit, 'tree': tree,
     'parentCommit': parent, 'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'shipped': shipped, 'remote': REMOTE, 'qaParent': PARENT, 'qaParentTree': parent_tree, 'qaParentIsAncestor': anc, 'cameraCheckpointIsAncestor': cam_anc,
     'checkpoints': chain, 'changedSinceParent': since, 'outsideScope': outside, 'mustBeUntouched': untouched, 'untouchedDirsChanged': untouched_dirs,
     'lampLineOnly': lamp_only, 'cameraUnchanged': camera_ok, 'cameraTests': camera_tests, 'lampPlacementConsistent': lamps_consistent,
     'fixtures': {'node': FIX['results'], 'page': FIXP['results'], 'counts': FIX.get('counts'), 'coverage': FIX.get('coverage'), 'aiField': FIX.get('aiField')},
     'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and scope_ok and camera_ok and lamps_consistent)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
code = [f for f in since if '/evidence/' not in f]
cnt = FIX.get('counts', {}); bz, az = cnt.get('before', {}), cnt.get('after', {})
T = ['THE FAR BACKROOMS - Stage 3B Lighting QA Correction (BR-RoLE 1.1-qa1) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3b-l-qa1/package_qa1.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}', f'zip CRCs   {"all OK (" + str(entries) + " entries tested)" if bad_zip is None else "BAD: " + bad_zip}', '',
     '== Source revision (branch stage-3b-l-qa1, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}  ({git("log", "-1", "--format=%s", parent).strip()})',
     f'QA parent  {PARENT}  (stage-3b-l, the rejected-lighting candidate; tree {parent_tree}; as given: {yn(parent_tree == PARENT_TREE)}; an ancestor: {yn(anc)})',
     f'camera checkpoint  {CAMERA}  (stage-3b-n-camera, accepted; an ancestor: {yn(cam_anc)})', '',
     '== Checkpoints (parent..commit, oldest first) ==', *[f'  {c}' for c in reversed(chain)], '',
     '== GitHub (checked after the push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}', f'REST API commit   {REMOTE["githubApi"]["commit"]}',
     f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== Branches (remote) ==',
     f'touched:   stage-3b-l-qa1  {REMOTE["lsRemote"]}  (new; never force-pushed)',
     f'untouched: stage-3b-l (QA parent)            {REMOTE["qaParent"]["remote"]}  {yn(REMOTE["qaParent"]["remote"] == PARENT)}',
     f'untouched: stage-3b-n-camera (accepted)      {REMOTE["cameraCheckpoint"]["remote"]}  {yn(REMOTE["cameraCheckpoint"]["remote"] == CAMERA)}',
     f'untouched: main                              {REMOTE["mainUntouched"]}  {yn(REMOTE["mainUntouched"] == MAIN)}',
     f'untouched: stage-3b-remaster                 {REMOTE["stage3bRemasterUntouched"]}  {yn(REMOTE["stage3bRemasterUntouched"] == REMASTER)}',
     f'untouched: br-role                           {REMOTE["brRoleUntouched"]}  {yn(REMOTE["brRoleUntouched"] == BRROLE)}',
     f'untouched: stage-3b-n (superseded)           {REMOTE["supersededStage3bNUntouched"]}  {yn(REMOTE["supersededStage3bNUntouched"] == SUPERSEDED)}',
     f'Stage 3B-W / 3C branches: {REMOTE["stage3bWor3cBranches"] or "none"}', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     f'== Scope (git diff --name-only {PARENT[:7]}..commit) ==', f'files changed since the QA parent: {len(since)} ({len(code)} outside evidence folders)',
     f'outside the QA1 list (STAGE_3B_LIGHTING_QA_CORRECTION_CHANGED_FILES.txt): {len(outside)}' + (' -> ' + ', '.join(outside) if outside else ''),
     *[f'  {f}' for f in code], '',
     'the game bundle and sim.js: their only change is the lamp list line (the old grid loop -> world.js W.lamps):',
     *[f'  {f:<28} {yn(v)}' for f, v in lamp_only.items()],
     'must be untouched (byte-identical to the parent):', *[f'  {f:<28} {v}' for f, v in untouched.items()],
     f'  {"dev/ai_src/, dev/ents_src/":<28} {"unchanged" if not untouched_dirs else "CHANGED: " + ", ".join(untouched_dirs)}', '',
     '== Camera (accepted 1.25; not tuned) ==',
     f'camera_policy.js, timing_policy.js, server.js byte-identical; the bundle\'s camera code untouched; camera fast checks on the final tree: {yn(camera_ok)}',
     *[f'  {l[:150]}' for l in camera_tests], '',
     '== Lamp placement: gameplay / presentation consistency ==',
     f'consistent: {yn(lamps_consistent)}  (one placement, world.js W.lamps; total {cnt.get("total", {}).get("before")} -> {cnt.get("total", {}).get("after")})',
     *[f'  {"PASS" if r["ok"] else "FAIL"} {r["name"][:150]}' for r in FIX['results']],
     *[f'  {"PASS" if r["ok"] else "FAIL"} {r["name"][:150]}' for r in FIXP['results']],
     '  by zone (before -> after): ' + ', '.join(f'{z} {bz.get(z)}->{az.get(z)}' for z in az), '',
     '== Shipped client files (SHA-256, from the ZIP) ==', *[f'  {f:<28} {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], '',
     f'RESULT: {"OK" if R["ok"] else "PROBLEMS - see receipt.json"}']
(OUT / 'STAGE_3B_LIGHTING_QA_CORRECTION_PACKAGE_RECEIPT.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
