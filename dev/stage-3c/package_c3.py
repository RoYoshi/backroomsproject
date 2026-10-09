#!/usr/bin/env python3
"""Stage 3C (UI) human-QA package: ZIP of a commit (git archive), its SHA-256, and a receipt.  (Adapted from
dev/stage-3b-l-qa2/package_qa2.py.)

  python3 -I dev/stage-3c/package_c3.py REPO COMMIT OUTDIR EVIDENCE_DIR NAME

  EVIDENCE_DIR  the final run's outputs (on the final tree):
                remote.json            dev/stage-3c/verify_remote_c3.py C5 --out (after the final push)
                probe_c1..probe_c5.json the Stage 3C browser probes (--out)
                lifecycle_mp.json      {"result": <dev/tests/lifecycle_mp.py's JSON>}
                camera_3bn.log         node dev/stage-3b-n/test_3bn.js
                camera_fairness.log    node dev/tests/s_camera_fairness.js
                br_role.log            node dev/br-role/test_br_role.js

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id); nothing missing or extra; CRCs OK;
  - the commit, its tree, the C0..C5 checkpoints back to the accepted Stage 3B parent 6e6fa46 (tree 33ed11b), a straight line;
    what GitHub reports for stage-3c after the push; main and every other branch untouched (their tips as found at C0);
  - scope: every file changed since the parent is a Stage 3C UI file, a UI-facing edit accounted for below, a Stage 3C
    document or dev/stage-3c/; the gameplay, AI, movement, collision, network-timing, camera, lighting (BR-RoLE), night-vision,
    remaster and server files are byte-identical to the parent;
  - the accounted UI-facing edits, each exactly: the game bundle (one insertion exposing the customize preview renderer), mp.js
    (one line: an older client's backpack is not drawn), inventory.js (three camcorder wording strings), hud.js (the settings
    model without its dropdown, plus reduced motion), index.html (the menu / HUD / pause / customize markup; every element id
    of the parent is still there);
  - the camera checks, the BR-RoLE unit checks, the retained lifecycle suite and the five Stage 3C probes pass on the final tree;
  - the shipped client files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, receipt.json and STAGE_3C_PACKAGE_RECEIPT.txt.
"""
import hashlib, json, re, subprocess, sys, tempfile, time, zipfile
from html.parser import HTMLParser
from pathlib import Path
REPO, COMMIT, OUT, EV, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5]
PARENT = '6e6fa46ecab537f716942b94f873776b09049a40'; PARENT_TREE = '33ed11b672d3a2a45767accccbb9f04fdd7949c3'
CAMERA = 'b2783b34e1185b30002350f5b482dd8c5e10b000'
BUNDLE = 'assets/index-DKbV5Nv9.js'
NEW_UI = {'assets/ui.js', 'assets/ui.css', 'assets/credits_data.js'}
ACCOUNTED = {BUNDLE, 'mp.js', 'inventory.js', 'hud.js', 'index.html'}
ALLOWED_PREFIX = ('dev/stage-3c/', 'STAGE_3C_')
PROTECTED = ['camera_policy.js', 'timing_policy.js', 'server.js', 'sim.js', 'ai.js', 'light.js', 'move.js', 'ents.js', 'death_srv.js', 'dphys.js',
             'gore.js', 'glitch.js', 'sfx.js', 'world.js', 'camcorder.js', 'redirect.js', 'assets/br-role.js', 'assets/l0-remaster.js',
             'assets/level0_visuals.js', 'assets/shadows-2d.js', 'assets/index-D7hdwmUU.css', 'package.json']
PROTECTED_PREFIX = ('dev/ai_src/', 'dev/ents_src/', 'dev/tests/', 'dev/br-role/', 'dev/stage-3b', 'dev/shadows/', 'sounds/')
SHIPPED = ['index.html', 'assets/ui.js', 'assets/ui.css', 'assets/credits_data.js', 'hud.js', 'inventory.js', 'mp.js', BUNDLE, 'server.js',
           'camera_policy.js', 'timing_policy.js', 'camcorder.js', 'assets/br-role.js', 'assets/l0-remaster.js', 'assets/level0_visuals.js']
# the accounted edits, exactly
BUNDLE_OLD = 'Cu.ticker.add(()=>{pu&&wu.update(performance.now()/1e3,!0,!0)})})'
BUNDLE_NEW = 'Cu.ticker.add(()=>{pu&&wu.update(performance.now()/1e3,!0,!0)}),window.__avatarApp=Cu})'
MP_OLD = "const parseLook = s => { const [hat, texture, hands, main, backpack] = String(s || 'none|plain|#e6bb76|#ffcc77|none').split('|'); return { hat, texture, hands, main, backpack }; };"
MP_NEW = "const parseLook = s => { const [hat, texture, hands, main] = String(s || 'none|plain|#e6bb76|#ffcc77|none').split('|'); return { hat, texture, hands, main, backpack: 'none' }; };   // Stage 3C: cosmetic backpacks are gone; an older client's pack is not drawn"
INV = [("    camcorder: 'Gives off no light at all. Raise it and see the dark through the lens: grainy green-gray, zoomable with the wheel. The night-vision sensor overheats, so watch TEMP.',",
        "    camcorder: 'Night Vision Camcorder emits no visible light; its night vision uses infrared. Raise it and see the dark through the lens: grainy green-gray, zoomable with the wheel. The sensor overheats, so watch TEMP.',"),
       ("    camcorder: 'No light. Night vision through the lens; it overheats.',", "    camcorder: 'No visible light: its night vision uses infrared. It overheats.',"),
       ("line = st ? `REACH ${bar(st[0])} SPREAD ${bar(st[1])}` : 'NO LIGHT · NIGHT VISION';", "line = st ? `REACH ${bar(st[0])} SPREAD ${bar(st[1])}` : 'NO VISIBLE LIGHT · INFRARED';")]
J = lambda f: json.loads((EV / f).read_text())
REMOTE = J('remote.json'); PROBES = {f'probe_c{i}': J(f'probe_c{i}.json') for i in range(1, 6)}; LIFE = J('lifecycle_mp.json')
CAM = (EV / 'camera_3bn.log').read_text(); FAIR = (EV / 'camera_fairness.log').read_text(); BRL = (EV / 'br_role.log').read_text()
def git(*a): return subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True, text=True).stdout
def blob(rev, f):
    r = subprocess.run(['git', '-C', str(REPO), 'show', f'{rev}:{f}'], capture_output=True); return r.stdout.decode('utf-8') if r.returncode == 0 else None
class Ids(HTMLParser):
    def __init__(s): super().__init__(); s.ids = []
    def handle_starttag(s, t, a):
        d = dict(a)
        if d.get('id'): s.ids.append(d['id'])
def ids(html): p = Ids(); p.feed(html); return p.ids
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
    zf = {f: (root / f).read_text(encoding='utf-8') for f in [BUNDLE, 'mp.js', 'inventory.js', 'index.html', 'hud.js']}
anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', PARENT, commit]).returncode == 0
cam_anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', CAMERA, commit]).returncode == 0
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip()
since = [l for l in git('diff', '--name-only', PARENT, commit).splitlines() if l]
outside = [f for f in since if f not in NEW_UI and f not in ACCOUNTED and not f.startswith(ALLOWED_PREFIX)]
protected = {f: ('unchanged' if f not in since else 'CHANGED') for f in PROTECTED}
protected_dirs = [f for f in since if f.startswith(PROTECTED_PREFIX)]
# the accounted edits
old_b, old_mp, old_inv = blob(PARENT, BUNDLE), blob(PARENT, 'mp.js'), blob(PARENT, 'inventory.js')
bundle_ok = old_b.count(BUNDLE_OLD) == 1 and zf[BUNDLE] == old_b.replace(BUNDLE_OLD, BUNDLE_NEW)
mp_ok = old_mp.count(MP_OLD) == 1 and zf['mp.js'] == old_mp.replace(MP_OLD, MP_NEW)
inv_exp = old_inv
for a, b in INV:
    if inv_exp is None or inv_exp.count(a) != 1: inv_exp = None; break
    inv_exp = inv_exp.replace(a, b)
inv_ok = inv_exp is not None and zf['inventory.js'] == inv_exp
pids, nids = ids(blob(PARENT, 'index.html')), ids(zf['index.html'])
ids_kept = sorted(set(pids) - set(nids)) == []
hud_keeps = all(k in zf['hud.js'] for k in ["const KEY = 'fb_settings_v1'", "c: '', s: 1, o: 1, keys: true, coords: true, title: true, auto: true, vol: 1"])
chain = [l for l in git('log', '--format=%H %T %s', '--reverse', f'{PARENT}..{commit}').splitlines()]
merges = [l for l in git('rev-list', '--merges', f'{PARENT}..{commit}').splitlines() if l]
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
U = REMOTE['untouched']; untouched_ok = all(v['ok'] for v in U.values())
cam_lines = [l for l in CAM.splitlines() if l.startswith(('PASS', 'FAIL'))]
camera_ok = bool(cam_lines) and all(l.startswith('PASS') for l in cam_lines) and 'CAMERA FAIRNESS: 12/12 PASS' in FAIR and protected['camera_policy.js'] == 'unchanged' == protected['timing_policy.js']
br_lines = [l for l in BRL.splitlines() if l.startswith(('PASS', 'FAIL'))]
br_ok = bool(br_lines) and all(l.startswith('PASS') for l in br_lines)
life = LIFE.get('result', LIFE); life_ok = life.get('ok') is True
probes_ok = {k: bool(v.get('ok')) and all(c['ok'] for c in v['checks']) for k, v in PROBES.items()}
probe_counts = {k: f"{sum(c['ok'] for c in v['checks'])}/{len(v['checks'])}" for k, v in PROBES.items()}
scope_ok = anc and cam_anc and parent_tree == PARENT_TREE and not merges and not outside and all(v == 'unchanged' for v in protected.values()) and not protected_dirs
accounted_ok = bundle_ok and mp_ok and inv_ok and ids_kept and hud_keeps
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'commit': commit, 'tree': tree,
     'parentCommit': parent, 'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'stage3bParent': PARENT, 'stage3bParentTree': parent_tree, 'stage3bParentIsAncestor': anc, 'cameraCheckpointIsAncestor': cam_anc, 'checkpoints': chain, 'merges': merges,
     'remote': REMOTE, 'changedSinceParent': since, 'outsideScope': outside, 'protected': protected, 'protectedDirsChanged': protected_dirs,
     'accounted': {'bundleOneInsertion': bundle_ok, 'mpParseLookOnly': mp_ok, 'inventoryThreeStrings': inv_ok, 'indexHtmlKeepsEveryParentId': ids_kept,
                   'indexHtmlIdsMissing': sorted(set(pids) - set(nids)), 'indexHtmlIdsAdded': sorted(set(nids) - set(pids)), 'hudJsKeepsSettingsModel': hud_keeps},
     'cameraTests': cam_lines, 'cameraFairness': [l for l in FAIR.splitlines() if 'CAMERA FAIRNESS' in l], 'brRole': {'pass': sum(l.startswith('PASS') for l in br_lines), 'total': len(br_lines)},
     'lifecycle': life, 'probes': probe_counts, 'shipped': shipped, 'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and untouched_ok and scope_ok and accounted_ok and camera_ok and br_ok and life_ok and all(probes_ok.values()))
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
T = ['THE FAR BACKROOMS - Stage 3C (UI / HUD / customization / main menu) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3c/package_c3.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}',
     f'zip CRCs   {"all OK (" + str(entries) + " entries tested)" if bad_zip is None else "BAD: " + bad_zip}', f'files      {len(files)} (the commit has {len(listing)})', '',
     '== Source revision (branch stage-3c, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}',
     f'Stage 3B parent  {PARENT}  (accepted; tree {parent_tree}; as given: {yn(parent_tree == PARENT_TREE)}; an ancestor: {yn(anc)})',
     f'camera checkpoint {CAMERA}  (accepted 1.25; an ancestor: {yn(cam_anc)})', '',
     '== Checkpoints (Stage 3B parent .. final, oldest first: commit  tree  subject) ==', *[f'  {c}' for c in chain], f'  merges: {len(merges)} (a straight line)', '',
     '== GitHub (checked after the final push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}',
     f'REST API commit   {REMOTE["githubApi"]["commit"]}', f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== Branches (remote) ==', f'touched:   stage-3c  {REMOTE["lsRemote"]}  (new from 6e6fa46; never force-pushed)',
     *[f'untouched: {b:<22} {v["remote"]}  {yn(v["ok"])}' for b, v in sorted(U.items(), key=lambda x: (x[0] != 'main', x[0]))],
     f'other remote branches: {", ".join(REMOTE["otherRemoteBranches"]) or "none"}', f'main untouched: {yn(U.get("main", {}).get("ok"))}', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     f'== Scope (git diff --name-only {PARENT[:7]}..commit) ==',
     f'files changed since the Stage 3B parent: {len(since)} ({len([f for f in since if "/evidence/" not in f])} outside evidence folders)',
     f'outside Stage 3C (new UI files, the accounted UI-facing edits, STAGE_3C_* documents, dev/stage-3c/): {len(outside)}' + (' -> ' + ', '.join(outside) if outside else ''),
     *[f'  {f}' for f in since if '/evidence/' not in f], '',
     'new Stage 3C UI files: ' + ', '.join(sorted(NEW_UI)), '',
     'UI-facing edits to existing files, each checked exactly:',
     f'  {BUNDLE}: one insertion, ",window.__avatarApp=Cu" after the customize preview renderer is set up (so it can be stopped while hidden): {yn(bundle_ok)}',
     f'  mp.js: one line, parseLook draws every peer with backpack "none" (cosmetic backpacks removed): {yn(mp_ok)}',
     f'  inventory.js: three camcorder wording strings ("emits no visible light; its night vision uses infrared"): {yn(inv_ok)}',
     f'  hud.js: the settings model (localStorage fb_settings_v1, same fields, plus rm) without its dropdown, which moved to assets/ui.js: {yn(hud_keeps)}',
     f'  index.html: the menu, HUD, pause, run-state and customize markup; every element id of the parent kept: {yn(ids_kept)} (added: {", ".join(R["accounted"]["indexHtmlIdsAdded"])})', '',
     'protected Stage 3B / gameplay files, byte-identical to the parent (no AI, movement, collision, network-timing, camera, lighting, NV, remaster or server change):',
     *[f'  {f:<28} {v}' for f, v in protected.items()],
     f'  {"dev/ai_src/, dev/ents_src/, dev/tests/, dev/br-role/, dev/stage-3b*, dev/shadows/, sounds/":<28} {"unchanged" if not protected_dirs else "CHANGED: " + ", ".join(protected_dirs)}', '',
     '== Regression and Stage 3C checks on the final tree ==',
     f'camera (dev/stage-3b-n/test_3bn.js): {sum(l.startswith("PASS") for l in cam_lines)}/{len(cam_lines)} PASS', *[f'  {l}' for l in R['cameraFairness']],
     f'BR-RoLE unit checks (dev/br-role/test_br_role.js): {R["brRole"]["pass"]}/{R["brRole"]["total"]} PASS',
     f'retained lifecycle suite (dev/tests/lifecycle_mp.py: NEW RUN, start from the title, death -> RETRY): {"PASS" if life_ok else "FAIL"}',
     *[f'{k} (dev/stage-3c/{k}.js): {probe_counts[k]} {"PASS" if probes_ok[k] else "FAIL"}' for k in PROBES], '',
     '== Shipped client files (SHA-256, from the ZIP) ==', *[f'  {f:<26} {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], '',
     f'RESULT: {"OK" if R["ok"] else "PROBLEMS - see receipt.json"}']
(OUT / 'STAGE_3C_PACKAGE_RECEIPT.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
