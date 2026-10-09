#!/usr/bin/env python3
"""Stage 3B-L QA2 (final visual polish) package: ZIP of a commit (git archive), its SHA-256, and a receipt.
(Adapted from dev/stage-3b-l-qa1/package_qa1.py and the pillar LOS pass's package_plos.py.)

  package_qa2.py REPO COMMIT OUTDIR EVIDENCE_DIR NAME

  EVIDENCE_DIR  the final run's outputs (on the final tree):
                remote.json        dev/stage-3b-l-qa2/verify_remote_qa2.py --out (after the final push)
                los_tests.json     dev/stage-3b-l-qa2/los_qa2_tests.js --out
                receivers.json     dev/stage-3b-l-qa2/receivers_qa2.js --out
                nv.json            dev/stage-3b-l-qa2/nv_qa2.js --out
                nv_profile.json    dev/stage-3b-l-qa2/nv_profile_qa2.js --out
                camera_3bn.log     dev/stage-3b-n/test_3bn.js        camera_fairness.log   dev/tests/s_camera_fairness.js
                s_ir.log           dev/tests/run.js s_ir.js          ir_net.log            dev/tests/ir_net.js
                ir_test.json       dev/tests/ir_test.py (its JSON)
                occlusion.json     dev/stage-3b-l-qa2/occlusion_qa2.js --out

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id), nothing missing or extra;
  - the commit, tree and the QA2 checkpoints back to the QA1 parent d3ec226 (tree cffbc31); what GitHub reports for
    stage-3b-l-qa2 after the push; the camera checkpoint b2783b3 an ancestor and unchanged on the remote; main, br-role,
    stage-3b-l-qa1, stage-3b-l, stage-3b-remaster, the superseded stage-3b-n and stage-3b-pillar-los untouched; no Stage 3C;
  - scope: every file changed since the parent is the bundle (only inside the sight-polygon builder Hl), assets/br-role.js,
    camcorder.js, the BR-RoLE unit test's U02 (one allowance), this pass's development folder or its documents; the camera
    and timing policies, server.js, sim.js, the AI, light.js, collision / movement, world.js and the other gameplay files are
    byte-identical to the parent;
  - camera unchanged, with the camera checks passing on the final tree;
  - NIGHT VISION IS PRESENTATION ONLY: the exact proof (the server keeps the infrared on the connection; ai.js / sim.js never
    name it; toggling it changes no AI decision; server.js, sim.js, ai.js, light.js byte-identical; the IR path in BR-RoLE only
    reads window.__cam and only writes BR-RoLE's own light buffer);
  - the focused QA2 tests pass on the final tree; the shipped client files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, receipt.json and STAGE_3B_FINAL_VISUAL_POLISH_PACKAGE_RECEIPT.txt.
"""
import hashlib, json, re, subprocess, sys, tempfile, time, zipfile
from pathlib import Path
REPO, COMMIT, OUT, EV, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5]
PARENT = 'd3ec2269af873dbc381d223ad538a43ba06f5c45'; PARENT_TREE = 'cffbc3125619170d9a55344b2519042a720a798d'
CAMERA = 'b2783b34e1185b30002350f5b482dd8c5e10b000'; CAMERA_TREE = 'bdef2606b50dc485eac648a70300e33bf7a32723'
BUNDLE = 'assets/index-DKbV5Nv9.js'
ALLOWED = {BUNDLE, 'assets/br-role.js', 'camcorder.js', 'dev/br-role/test_br_role.js'}
ALLOWED_PREFIX = ('dev/stage-3b-l-qa2/', 'STAGE_3B_FINAL_VISUAL_POLISH_')
UNTOUCHED = ['camera_policy.js', 'timing_policy.js', 'server.js', 'index.html', 'sim.js', 'light.js', 'ai.js', 'move.js', 'mp.js', 'ents.js', 'death_srv.js',
             'dphys.js', 'hud.js', 'inventory.js', 'gore.js', 'glitch.js', 'sfx.js', 'world.js', 'assets/l0-remaster.js', 'assets/level0_visuals.js',
             'assets/shadows-2d.js', 'dev/sim_glue.js', 'dev/sim_head.js', 'dev/sim_geo.js', 'dev/tests/s_ir.js', 'dev/tests/ir_net.js', 'dev/tests/ir_test.py']
UNTOUCHED_PREFIX = ('dev/ai_src/', 'dev/ents_src/', 'dev/stage-3b-l-qa1/', 'dev/stage-3b-n/', 'dev/tests/')
SHIPPED = ['server.js', 'index.html', 'camera_policy.js', 'timing_policy.js', BUNDLE, 'assets/br-role.js', 'camcorder.js', 'assets/l0-remaster.js',
           'assets/level0_visuals.js', 'world.js', 'move.js', 'mp.js', 'ents.js', 'sim.js', 'ai.js', 'light.js']
CALLS = 'this.sightPoints=Hl(a.x,a.y,700),this.scenePoints=Hl(a.x,a.y,700,24)'
OLD_HL = ('function Hl(e,t,n=700,r=0){let i=[];for(let e=0;e<96;e++)i.push(e/96*Math.PI*2-Math.PI);for(let r of Vl){if(Math.hypot(r.x-e,r.y-t)>n+96)continue;'
          'let a=Math.atan2(r.y-t,r.x-e);i.push(a-2e-5,a,a+2e-5)}i.sort((e,t)=>e-t);let a=[];for(let o of i){let i=Uc(e,t,o,n),s=Math.min(n,i+(i<n?r:0));'
          'a.push(e+Math.cos(o)*s,t+Math.sin(o)*s)}return a}')
J = lambda f: json.loads((EV / f).read_text())
REMOTE = J('remote.json'); LOS = J('los_tests.json'); RCV = J('receivers.json'); NV = J('nv.json'); NVP = J('nv_profile.json'); IRT = J('ir_test.json'); OCC = J('occlusion.json')
CAM = (EV / 'camera_3bn.log').read_text(); FAIR = (EV / 'camera_fairness.log').read_text(); SIR = (EV / 's_ir.log').read_text(); IRN = (EV / 'ir_net.log').read_text()
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
    zb = (root / BUNDLE).read_text(encoding='utf-8'); zbr = (root / 'assets/br-role.js').read_text(encoding='utf-8'); zcam = (root / 'camcorder.js').read_text(encoding='utf-8')
    hlsrc = (root / 'dev/stage-3b-l-qa2/hl_qa2.js').read_text(encoding='utf-8')
anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', PARENT, commit]).returncode == 0
cam_anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', CAMERA, commit]).returncode == 0
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip()
since = [l for l in git('diff', '--name-only', PARENT, commit).splitlines() if l]
outside = [f for f in since if f not in ALLOWED and not f.startswith(ALLOWED_PREFIX)]
untouched = {f: ('unchanged' if f not in since else 'CHANGED') for f in UNTOUCHED}
untouched_dirs = [f for f in since if f.startswith(UNTOUCHED_PREFIX)]
# the bundle: the parent's text with its Hl replaced by hl_qa2.js's block, nothing else
old = blob(PARENT, BUNDLE).decode('utf-8')
oi, oj = old.find('function Hl('), old.find('function Ul(', old.find('function Hl('))
ci = zb.find('var HlqD='); cj = zb.find('function Ul(', ci)
a = hlsrc.index('// ---- begin (bundle text) ----\n') + 32; b = hlsrc.index('// ---- end (bundle text) ----'); block = hlsrc[a:b].replace('\n', '')
hl_only = bool(oi > 0 and ci > 0 and old[:oi] == zb[:ci] and old[oj:] == zb[cj:] and old[oi:oj] == OLD_HL and zb[ci:cj] == block and old.count(CALLS) == 1 == zb.count(CALLS))
bundle_diff = {'before_Hl_identical': old[:oi] == zb[:ci], 'after_Hl_identical': old[oj:] == zb[cj:], 'parent_Hl_as_audited': old[oi:oj] == OLD_HL,
               'new_Hl_is_hl_qa2_js': zb[ci:cj] == block, 'call_sites_unchanged': old.count(CALLS) == 1 == zb.count(CALLS), 'Hl_chars': [oj - oi, cj - ci]}
# the U02 allowance: the BR-RoLE unit test changed only in U02's clip check
ut = git('diff', '-U0', PARENT, commit, '--', 'dev/br-role/test_br_role.js')
def u02_span(text):   # the U02 test's lines (1-based, inclusive): from its run('U02 to the line before run('U03
    L = text.splitlines(); a = next(i for i, l in enumerate(L) if l.startswith("run('U02")); b = next(i for i, l in enumerate(L) if l.startswith("run('U03")); return a + 1, b
ua, ub = u02_span(blob(PARENT, 'dev/br-role/test_br_role.js').decode('utf-8')), u02_span(blob(commit, 'dev/br-role/test_br_role.js').decode('utf-8'))
hunks = [tuple(int(x or 1) for x in m) for m in re.findall(r'^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@', ut, re.M)]
inside = lambda start, n, span: n == 0 and span[0] - 1 <= start <= span[1] or n > 0 and span[0] <= start and start + n - 1 <= span[1]
ut_ok = bool(hunks) and all(inside(h[0], h[1], ua) and inside(h[2], h[3], ub) for h in hunks)   # every hunk inside U02, in the parent and in the commit
chain = [l for l in git('log', '--format=%H %s', f'{PARENT}..{commit}').splitlines()]
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
camera_tests = [l for l in CAM.splitlines() if l.startswith(('PASS', 'FAIL'))]
camera_ok = (all(untouched[f] == 'unchanged' for f in ['camera_policy.js', 'timing_policy.js', 'server.js', 'index.html']) and hl_only
             and camera_tests and all(l.startswith('PASS') for l in camera_tests) and '7/7 passed' in CAM and 'CAMERA FAIRNESS: 12/12 PASS' in FAIR)
# NIGHT VISION: presentation only - the proof
srv = blob(commit, 'server.js').decode('utf-8'); code = lambda s: re.sub(r'(^|[^:\'"`])//[^\n]*', r'\1', re.sub(r'/\*[\s\S]*?\*/', '', s))
ai_code, sim_code = code(blob(commit, 'ai.js').decode('utf-8')), code(blob(commit, 'sim.js').decode('utf-8'))
IRW = re.compile(r'\.ir\b|\birNet\b|\binfra|\bnvOn\b|__cam\b|\birLevel\b')
ir_line = next((l.strip() for l in srv.splitlines() if 'me.ir =' in l), '')
br_ir = zbr[zbr.find('function irLight('):zbr.find('/* ---------- the static wall grounding')]
br_ir_writes = sorted(set(re.findall(r'\b(S\.[a-zA-Z]+|window\.[a-zA-Z_]+|__api\.[a-zA-Z]+)\s*=(?!=)', br_ir)))
nv_proof = {
    'serverKeepsIrOnTheConnection': ir_line[:220], 'serverWritesIrOnThePlayer': bool(re.search(r'(player|\bp)\.ir\s*=', srv)),
    'irNamesInAiJs': len(IRW.findall(ai_code)), 'irNamesInSimJs': len(IRW.findall(sim_code)),
    'gameplayFilesByteIdentical': {f: untouched[f] for f in ['server.js', 'sim.js', 'ai.js', 'light.js', 'move.js', 'death_srv.js']},
    'sIr': [l for l in SIR.splitlines() if l.startswith(('PASS', 'FAIL'))], 'irNet': [l for l in IRN.splitlines() if l.startswith(('PASS', 'FAIL'))],
    'brRoleIrPathWrites': br_ir_writes, 'brRoleIrReadsCam': 'window.__cam.irLights' in zbr and 'CAM.irLights(' in zbr,
    'camcorderIrSentToServerUnchanged': 'irNet' in zcam and blob(PARENT, 'mp.js') == blob(commit, 'mp.js')}
nv_ok = (not nv_proof['serverWritesIrOnThePlayer'] and 'connection' in nv_proof['serverKeepsIrOnTheConnection'].lower() or 'me.ir' in nv_proof['serverKeepsIrOnTheConnection']) and \
        nv_proof['irNamesInAiJs'] == 0 and nv_proof['irNamesInSimJs'] == 0 and all(v == 'unchanged' for v in nv_proof['gameplayFilesByteIdentical'].values()) and \
        nv_proof['sIr'] and all(l.startswith('PASS') for l in nv_proof['sIr']) and nv_proof['irNet'] and all(l.startswith('PASS') for l in nv_proof['irNet']) and \
        not [w for w in br_ir_writes if not w.startswith('S.')] and nv_proof['camcorderIrSentToServerUnchanged']
suites = {'los_qa2_tests.js': LOS['results'], 'receivers_qa2.js': RCV['results'], 'nv_qa2.js': NV['results'], 'nv_profile_qa2.js': NVP['results'], 'occlusion_qa2.js': OCC['results']}
ir_test = IRT if isinstance(IRT, dict) else {}
ir_test_ok = bool(ir_test) and all(v.get('pass', v.get('ok', False)) if isinstance(v, dict) else bool(v) for k, v in ir_test.items() if re.match(r'^R\d', k))
tests_ok = all(rs and all(r['ok'] for r in rs) for rs in suites.values()) and ir_test_ok
scope_ok = anc and cam_anc and not outside and all(v == 'unchanged' for v in untouched.values()) and not untouched_dirs and hl_only and parent_tree == PARENT_TREE and ut_ok
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'commit': commit, 'tree': tree,
     'parentCommit': parent, 'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'shipped': shipped, 'remote': REMOTE, 'qa1Parent': PARENT, 'qa1ParentTree': parent_tree, 'qa1ParentIsAncestor': anc, 'cameraCheckpointIsAncestor': cam_anc,
     'checkpoints': chain, 'changedSinceParent': since, 'outsideScope': outside, 'mustBeUntouched': untouched, 'untouchedDirsChanged': untouched_dirs,
     'bundleChangeOnlyInHl': hl_only, 'bundleDiff': bundle_diff, 'unitTestChangeOnlyU02': ut_ok, 'cameraUnchanged': camera_ok, 'cameraTests': camera_tests,
     'cameraFairness': [l for l in FAIR.splitlines() if 'CAMERA FAIRNESS' in l], 'nightVisionPresentationOnly': nv_ok, 'nightVisionProof': nv_proof,
     'suites': suites, 'irTest': ir_test, 'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and scope_ok and camera_ok and tests_ok and nv_ok)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
IRT_LINE = ', '.join(f'{k} {v}' for k, v in ir_test.items() if re.match(r'^R\d', k))
code_files = [f for f in since if '/evidence/' not in f]
U = REMOTE['untouched']
T = ['THE FAR BACKROOMS - Stage 3B Final Visual Polish (Stage 3B-L QA2) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3b-l-qa2/package_qa2.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}', f'zip CRCs   {"all OK (" + str(entries) + " entries tested)" if bad_zip is None else "BAD: " + bad_zip}',
     f'files      {len(files)} (the commit has {len(listing)})', '',
     '== Source revision (branch stage-3b-l-qa2, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}',
     f'QA1 parent {PARENT}  (stage-3b-l-qa1; tree {parent_tree}; as given: {yn(parent_tree == PARENT_TREE)}; an ancestor: {yn(anc)})',
     f'camera checkpoint  {CAMERA}  (stage-3b-n-camera, accepted; tree {REMOTE["cameraCheckpoint"]["tree"]}; an ancestor: {yn(cam_anc)})', '',
     '== Correction checkpoints (QA1 parent .. final, oldest first) ==', *[f'  {c}' for c in reversed(chain)], '',
     '== GitHub (checked after the final push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}', f'REST API commit   {REMOTE["githubApi"]["commit"]}',
     f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== Branches (remote) ==',
     f'touched:   stage-3b-l-qa2  {REMOTE["lsRemote"]}  (new; never force-pushed)',
     f'untouched: stage-3b-l-qa1 (QA1 parent)       {REMOTE["qa1Parent"]["remote"]}  {yn(REMOTE["qa1Parent"]["remote"] == PARENT)}',
     f'untouched: stage-3b-n-camera (accepted)      {REMOTE["cameraCheckpoint"]["remote"]}  {yn(REMOTE["cameraCheckpoint"]["remote"] == CAMERA)}',
     *[f'untouched: {b:<32}  {v["remote"]}  {yn(v["ok"])}' for b, v in U.items()],
     f'Stage 3C branches: {REMOTE["stage3cBranches"] or "none"}  (Stage 3C not begun; main not modified)', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     f'== Scope (git diff --name-only {PARENT[:7]}..commit) ==', f'files changed since the QA1 parent: {len(since)} ({len(code_files)} outside evidence folders)',
     f'outside this pass (bundle Hl, assets/br-role.js, camcorder.js, the unit test U02, dev/stage-3b-l-qa2/, STAGE_3B_FINAL_VISUAL_POLISH_*): {len(outside)}' + (' -> ' + ', '.join(outside) if outside else ''),
     *[f'  {f}' for f in code_files], '',
     f'the game bundle: its only change is the sight-polygon builder Hl (= dev/stage-3b-l-qa2/hl_qa2.js): {yn(hl_only)}',
     f'  before Hl byte-identical {yn(bundle_diff["before_Hl_identical"])}; after Hl byte-identical {yn(bundle_diff["after_Hl_identical"])}; the parent Hl the one audited {yn(bundle_diff["parent_Hl_as_audited"])}; '
     f'the new Hl is hl_qa2.js\'s block {yn(bundle_diff["new_Hl_is_hl_qa2_js"])}; call sites unchanged {yn(bundle_diff["call_sites_unchanged"])}; Hl {bundle_diff["Hl_chars"][0]} -> {bundle_diff["Hl_chars"][1]} chars',
     f'dev/br-role/test_br_role.js: only U02 (a face band\'s mitred outline is an allowed clip, like a light\'s pixel box): {yn(ut_ok)}',
     'must be untouched (byte-identical to the parent):', *[f'  {f:<28} {v}' for f, v in untouched.items()],
     f'  {"dev/ai_src/, dev/ents_src/, dev/stage-3b-l-qa1/, dev/stage-3b-n/, dev/tests/":<28} {"unchanged" if not untouched_dirs else "CHANGED: " + ", ".join(untouched_dirs)}', '',
     '== Camera (accepted 1.25; not tuned) ==',
     f'camera_policy.js, timing_policy.js, server.js, index.html byte-identical; the bundle\'s camera code untouched (outside Hl); camera checks on the final tree: {yn(camera_ok)}',
     *[f'  {l[:150]}' for l in camera_tests], *[f'  {l}' for l in R['cameraFairness']], '',
     '== Night vision / infrared: does it affect gameplay light truth? NO - presentation only (exact proof) ==',
     f'  1. server.js (byte-identical to the parent) keeps the infrared level on the CONNECTION, never on the player the simulation sees:',
     f'       {nv_proof["serverKeepsIrOnTheConnection"]}',
     f'     it writes .ir on a player object: {yn(nv_proof["serverWritesIrOnThePlayer"])}',
     f'  2. ai.js / sim.js (byte-identical) never name it (code, comments stripped): {nv_proof["irNamesInAiJs"]} / {nv_proof["irNamesInSimJs"]} occurrences',
     f'  3. server.js, sim.js, ai.js, light.js, move.js, death_srv.js byte-identical to the parent: {yn(all(v == "unchanged" for v in nv_proof["gameplayFilesByteIdentical"].values()))}; mp.js (what the client sends) byte-identical: {yn(nv_proof["camcorderIrSentToServerUnchanged"])}',
     '  4. dev/tests/s_ir.js on the final tree (toggling infrared OFF vs HIGH changes no AI decision; a raised camcorder is no light to the AI):',
     *[f'       {l[:160]}' for l in nv_proof['sIr']],
     '     dev/tests/ir_net.js (the infrared on the wire is presentation shared between players):', *[f'       {l[:160]}' for l in nv_proof['irNet']],
     f'  5. BR-RoLE\'s infrared path (irLight) reads window.__cam.irLights (this player\'s sensor) and writes only BR-RoLE\'s own state / buffers: {", ".join(br_ir_writes) or "(no assignments outside canvas calls)"}',
     '     (BR-RoLE never sends anything and never writes game state; the camcorder\'s reading of the infrared (irFrom) is used only by its own',
     '      readability (nvRead) and light.js\'s presentation sample, as before; its profile change is reported in the report: P1-P3 below)',
     f'  RESULT: presentation only: {yn(nv_ok)}', '',
     '== Focused QA2 tests on the final tree ==',
     *[f'  {s}: ' + ', '.join(f'{"PASS" if r["ok"] else "FAIL"} {r["name"].split(" ")[0]}' for r in rs) for s, rs in suites.items()],
     f'  dev/tests/ir_test.py (Part 2 2C-IR rules, unchanged): {IRT_LINE}  -> {yn(ir_test_ok)}', '',
     '== Shipped client files (SHA-256, from the ZIP) ==', *[f'  {f:<28} {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], '',
     f'RESULT: {"OK" if R["ok"] else "PROBLEMS - see receipt.json"}']
(OUT / 'STAGE_3B_FINAL_VISUAL_POLISH_PACKAGE_RECEIPT.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
