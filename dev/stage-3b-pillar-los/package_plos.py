#!/usr/bin/env python3
"""Stage 3B pillar LOS correction package: ZIP of a commit (git archive), its SHA-256, and a receipt.
(Adapted from dev/stage-3b-l-qa1/package_qa1.py.)

  package_plos.py REPO COMMIT OUTDIR REMOTE_VERIFY_JSON TESTS_JSON CAMERA_LOG CAMERA_FAIRNESS_LOG NAME

  REMOTE_VERIFY_JSON   from dev/stage-3b-pillar-los/verify_remote_plos.py --out (after the final push)
  TESTS_JSON           from dev/stage-3b-pillar-los/los_tests.js --out, on the final tree
  CAMERA_LOG           the output of dev/stage-3b-n/test_3bn.js on the final tree
  CAMERA_FAIRNESS_LOG  the output of dev/tests/s_camera_fairness.js on the final tree

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id), nothing missing or extra;
  - the commit, tree and parent chain back to the QA1 parent d3ec226 (tree cffbc31); what GitHub reports for
    stage-3b-pillar-los after the push; the camera checkpoint b2783b3 an ancestor and unchanged on the remote; main, br-role,
    stage-3b-l-qa1 (the parent), stage-3b-l, stage-3b-remaster and the superseded stage-3b-n untouched; no Stage 3B-W / 3C
    branch;
  - scope: every file changed since the parent is the bundle, this pass's development folder or its documents; the bundle
    differs from the parent only inside the sight-polygon builder Hl (everything before and after it byte-identical; its two
    call sites unchanged); the camera / timing policies, server.js, sim.js, the AI, light.js, collision / movement, world.js
    (fixture placement), BR-RoLE and the other gameplay files are byte-identical to the parent;
  - camera unchanged: camera_policy.js, timing_policy.js and server.js byte-identical, the bundle's camera code untouched
    (outside Hl), and the camera checks pass on the final tree;
  - the focused pillar LOS tests pass on the final tree;
  - the shipped client files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, receipt.json and STAGE_3B_PILLAR_LOS_CORRECTION_PACKAGE_RECEIPT.txt.
"""
import hashlib, json, subprocess, sys, tempfile, time, zipfile
from pathlib import Path
REPO, COMMIT, OUT, RV, TJ, CAMLOG, FAIRLOG, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), Path(sys.argv[5]), Path(sys.argv[6]), Path(sys.argv[7]), sys.argv[8]
PARENT = 'd3ec2269af873dbc381d223ad538a43ba06f5c45'; PARENT_TREE = 'cffbc3125619170d9a55344b2519042a720a798d'
MAIN = '7781e1ac34aa09970df57fae3fc107a873fa2731'; CAMERA = 'b2783b34e1185b30002350f5b482dd8c5e10b000'; STAGE3BL = 'b9f3a9b934f40e35d51596f593eae810d077f194'
REMASTER = '69602e7c9e755fcc65402b1563d4d060f5a10066'; BRROLE = 'b86966b5f59070b0f4c15b000c70a95e5f3b4e00'; SUPERSEDED = '118d45c24d99d2cbc1e7b5b76cb76e041ac40d87'
BUNDLE = 'assets/index-DKbV5Nv9.js'
ALLOWED = {BUNDLE}
ALLOWED_PREFIX = ('dev/stage-3b-pillar-los/', 'STAGE_3B_PILLAR_LOS_CORRECTION_')
UNTOUCHED = ['camera_policy.js', 'timing_policy.js', 'server.js', 'index.html', 'sim.js', 'light.js', 'ai.js', 'move.js', 'mp.js', 'ents.js', 'death_srv.js',
             'dphys.js', 'hud.js', 'inventory.js', 'gore.js', 'glitch.js', 'camcorder.js', 'sfx.js', 'world.js', 'assets/br-role.js', 'assets/l0-remaster.js',
             'assets/level0_visuals.js', 'assets/shadows-2d.js', 'dev/sim_glue.js', 'dev/sim_head.js', 'dev/sim_geo.js']
UNTOUCHED_PREFIX = ('dev/ai_src/', 'dev/ents_src/', 'dev/br-role/', 'dev/stage-3b-l-qa1/', 'dev/stage-3b-n/')
SHIPPED = ['server.js', 'index.html', 'camera_policy.js', 'timing_policy.js', BUNDLE, 'assets/br-role.js', 'assets/l0-remaster.js',
           'assets/level0_visuals.js', 'world.js', 'move.js', 'mp.js', 'ents.js', 'sim.js', 'ai.js', 'light.js']
CALLS = 'this.sightPoints=Hl(a.x,a.y,700),this.scenePoints=Hl(a.x,a.y,700,24)'
OLD_HL = ('function Hl(e,t,n=700,r=0){let i=[];for(let e=0;e<96;e++)i.push(e/96*Math.PI*2-Math.PI);for(let r of Vl){if(Math.hypot(r.x-e,r.y-t)>n+96)continue;'
          'let a=Math.atan2(r.y-t,r.x-e);i.push(a-2e-5,a,a+2e-5)}i.sort((e,t)=>e-t);let a=[];for(let o of i){let i=Uc(e,t,o,n),s=Math.min(n,i+(i<n?r:0));'
          'a.push(e+Math.cos(o)*s,t+Math.sin(o)*s)}return a}')
REMOTE = json.loads(RV.read_text()); TESTS = json.loads(TJ.read_text()); CAM = CAMLOG.read_text(); FAIR = FAIRLOG.read_text()
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
    zipped_bundle = (root / BUNDLE).read_text(encoding='utf-8')
anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', PARENT, commit]).returncode == 0
cam_anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', CAMERA, commit]).returncode == 0
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip()
since = [l for l in git('diff', '--name-only', PARENT, commit).splitlines() if l]
outside = [f for f in since if f not in ALLOWED and not f.startswith(ALLOWED_PREFIX)]
untouched = {f: ('unchanged' if f not in since else 'CHANGED') for f in UNTOUCHED}
untouched_dirs = [f for f in since if f.startswith(UNTOUCHED_PREFIX)]
# the bundle: identical to the parent before 'function Hl(' and from 'function Ul(' on; the parent's Hl is the known one; the call sites unchanged
old = blob(PARENT, BUNDLE).decode('utf-8'); cur = zipped_bundle
oi, ci = old.find('function Hl('), cur.find('function Hl('); oj, cj = old.find('function Ul(', oi), cur.find('function Ul(', ci)
hl_only = bool(oi > 0 and ci > 0 and old[:oi] == cur[:ci] and old[oj:] == cur[cj:] and old[oi:oj] == OLD_HL and old.count(CALLS) == 1 and cur.count(CALLS) == 1
               and cur.count('Hl(') == 3 and old.count('Hl(') == 3)
bundle_diff = {'before_Hl_identical': old[:oi] == cur[:ci], 'after_Hl_identical': old[oj:] == cur[cj:], 'parent_Hl_as_audited': old[oi:oj] == OLD_HL,
               'call_sites_unchanged': old.count(CALLS) == 1 == cur.count(CALLS), 'Hl_chars': [oj - oi, cj - ci], 'new_Hl': cur[ci:cj]}
chain = [l for l in git('log', '--format=%h %s', f'{PARENT}..{commit}').splitlines()]
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
camera_tests = [l for l in CAM.splitlines() if l.startswith(('PASS', 'FAIL'))]
camera_ok = (all(untouched[f] == 'unchanged' for f in ['camera_policy.js', 'timing_policy.js', 'server.js', 'index.html']) and hl_only
             and camera_tests and all(l.startswith('PASS') for l in camera_tests) and '7/7 passed' in CAM and 'CAMERA FAIRNESS: 12/12 PASS' in FAIR)
tests_ok = bool(TESTS['results']) and all(r['ok'] for r in TESTS['results'])
scope_ok = anc and cam_anc and not outside and all(v == 'unchanged' for v in untouched.values()) and not untouched_dirs and hl_only and parent_tree == PARENT_TREE
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'commit': commit, 'tree': tree,
     'parentCommit': parent, 'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'shipped': shipped, 'remote': REMOTE, 'qa1Parent': PARENT, 'qa1ParentTree': parent_tree, 'qa1ParentIsAncestor': anc, 'cameraCheckpointIsAncestor': cam_anc,
     'checkpoints': chain, 'changedSinceParent': since, 'outsideScope': outside, 'mustBeUntouched': untouched, 'untouchedDirsChanged': untouched_dirs,
     'bundleChangeOnlyInHl': hl_only, 'bundleDiff': bundle_diff, 'cameraUnchanged': camera_ok, 'cameraTests': camera_tests,
     'cameraFairness': [l for l in FAIR.splitlines() if 'CAMERA FAIRNESS' in l], 'pillarLosTests': TESTS['results'],
     'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and scope_ok and camera_ok and tests_ok)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
code = [f for f in since if '/evidence/' not in f]
T = ['THE FAR BACKROOMS - Stage 3B Pillar LOS Presentation Correction - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3b-pillar-los/package_plos.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}', f'zip CRCs   {"all OK (" + str(entries) + " entries tested)" if bad_zip is None else "BAD: " + bad_zip}', '',
     '== Source revision (branch stage-3b-pillar-los, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}  ({git("log", "-1", "--format=%s", parent).strip()})',
     f'QA1 parent {PARENT}  (stage-3b-l-qa1, the accepted-looking lighting candidate; tree {parent_tree}; as given: {yn(parent_tree == PARENT_TREE)}; an ancestor: {yn(anc)})',
     f'camera checkpoint  {CAMERA}  (stage-3b-n-camera, accepted; an ancestor: {yn(cam_anc)})', '',
     '== Checkpoints (parent..commit, oldest first) ==', *[f'  {c}' for c in reversed(chain)], '',
     '== GitHub (checked after the push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}', f'REST API commit   {REMOTE["githubApi"]["commit"]}',
     f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== Branches (remote) ==',
     f'touched:   stage-3b-pillar-los  {REMOTE["lsRemote"]}  (new; never force-pushed)',
     f'untouched: stage-3b-l-qa1 (QA1 parent)       {REMOTE["qa1Parent"]["remote"]}  {yn(REMOTE["qa1Parent"]["remote"] == PARENT)}',
     f'untouched: stage-3b-l                        {REMOTE["stage3bLUntouched"]}  {yn(REMOTE["stage3bLUntouched"] == STAGE3BL)}',
     f'untouched: stage-3b-n-camera (accepted)      {REMOTE["cameraCheckpoint"]["remote"]}  {yn(REMOTE["cameraCheckpoint"]["remote"] == CAMERA)}',
     f'untouched: main                              {REMOTE["mainUntouched"]}  {yn(REMOTE["mainUntouched"] == MAIN)}',
     f'untouched: stage-3b-remaster                 {REMOTE["stage3bRemasterUntouched"]}  {yn(REMOTE["stage3bRemasterUntouched"] == REMASTER)}',
     f'untouched: br-role                           {REMOTE["brRoleUntouched"]}  {yn(REMOTE["brRoleUntouched"] == BRROLE)}',
     f'untouched: stage-3b-n (superseded)           {REMOTE["supersededStage3bNUntouched"]}  {yn(REMOTE["supersededStage3bNUntouched"] == SUPERSEDED)}',
     f'Stage 3B-W / 3C branches: {REMOTE["stage3bWor3cBranches"] or "none"}  (Stage 3C not begun)', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     f'== Scope (git diff --name-only {PARENT[:7]}..commit) ==', f'files changed since the QA1 parent: {len(since)} ({len(code)} outside evidence folders)',
     f'outside this pass (the bundle, dev/stage-3b-pillar-los/, STAGE_3B_PILLAR_LOS_CORRECTION_*): {len(outside)}' + (' -> ' + ', '.join(outside) if outside else ''),
     *[f'  {f}' for f in code], '',
     f'the game bundle: its only change is inside the sight-polygon builder Hl: {yn(hl_only)}',
     f'  everything before Hl byte-identical {yn(bundle_diff["before_Hl_identical"])}; everything after Hl byte-identical {yn(bundle_diff["after_Hl_identical"])}; '
     f'the parent Hl the one audited {yn(bundle_diff["parent_Hl_as_audited"])}; call sites (entity mask r 0, darkness clip r 24) unchanged {yn(bundle_diff["call_sites_unchanged"])}; '
     f'Hl {bundle_diff["Hl_chars"][0]} -> {bundle_diff["Hl_chars"][1]} chars',
     'must be untouched (byte-identical to the parent):', *[f'  {f:<28} {v}' for f, v in untouched.items()],
     f'  {"dev/ai_src/, dev/ents_src/, dev/br-role/, dev/stage-3b-l-qa1/, dev/stage-3b-n/":<28} {"unchanged" if not untouched_dirs else "CHANGED: " + ", ".join(untouched_dirs)}',
     '  (sim.js / ai.js / dev/ai_src: AI; server.js / death_srv.js: server; move.js / dphys.js: collision and movement; light.js: gameplay light;',
     '   world.js: the 170-fixture placement; assets/br-role.js: BR-RoLE receivers and lighting; camera_policy.js / timing_policy.js: camera and timing)', '',
     '== Camera (accepted 1.25; not tuned) ==',
     f'camera_policy.js, timing_policy.js, server.js, index.html byte-identical; the bundle\'s camera code untouched (outside Hl); camera checks on the final tree: {yn(camera_ok)}',
     *[f'  {l[:150]}' for l in camera_tests], *[f'  {l}' for l in R['cameraFairness']], '',
     '== Focused pillar LOS tests on the final tree (dev/stage-3b-pillar-los/los_tests.js) ==',
     *[f'  {"PASS" if r["ok"] else "FAIL"} {r["name"][:150]}' for r in TESTS['results']], '',
     '== Shipped client files (SHA-256, from the ZIP) ==', *[f'  {f:<28} {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], '',
     f'RESULT: {"OK" if R["ok"] else "PROBLEMS - see receipt.json"}']
(OUT / 'STAGE_3B_PILLAR_LOS_CORRECTION_PACKAGE_RECEIPT.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
