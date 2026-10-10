#!/usr/bin/env python3
"""Stage 3C QA2 human-QA package: ZIP of a commit (git archive), its SHA-256, and a receipt.  (Adapted from
dev/stage-3c-qa1/package_qa1.py.)

  python3 -I dev/stage-3c-qa2/package_qa2.py REPO COMMIT OUTDIR EVIDENCE_DIR NAME

  EVIDENCE_DIR  the final run's outputs (on the final tree):
                remote.json                  dev/stage-3c-qa2/verify_remote_qa2.py QA2-4 --out (after the final push)
                probe_b1.json .. probe_b3.json   the QA2 browser probes (--out)
                regression.json              dev/stage-3c-qa2/regress/run.js: QA1's five probes and lifecycle.js, the first candidate's
                                             five probes, and the retained lifecycle suite (dev/tests/lifecycle_mp.py), re-run on QA2;
                                             each check PASS, or FAIL with the QA2 (or, for the first candidate, QA1) decision that
                                             deliberately changed what it checked
                camera_3bn.log               node dev/stage-3b-n/test_3bn.js
                camera_fairness.log          node dev/tests/s_camera_fairness.js
                br_role.log                  node dev/br-role/test_br_role.js
                theme_assets.json            dev/stage-3c-qa1/theme_assets_check.py --out

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id); nothing missing or extra; CRCs OK;
  - the commit, its tree, the QA2-0..QA2-4 checkpoints back to the QA1 final commit 5f30e28 (tree 374911e) in a straight line; the
    first Stage 3C candidate 76bcc4a and the accepted Stage 3B commit 6e6fa46 ancestors; what GitHub reports for stage-3c-qa2 after
    the push; stage-3c-qa1, stage-3c, main and every other branch untouched (their tips as found at QA2-0);
  - scope: every file changed since QA1 is one of the two QA2 UI files (assets/ui.js, assets/ui.css), the accounted index.html edit,
    the user's logo, a QA2 document or dev/stage-3c-qa2/; the game bundle, mp.js, server.js, hud.js, inventory.js, the credits
    data, the manifest, the theme audio and every gameplay, AI, movement, collision, network, camera, lighting (BR-RoLE),
    night-vision, remaster and older development file are byte-identical to QA1;
  - index.html, exactly: QA1's file plus the boot block in the head (the black-first rules and window.__boot), the boot layer as the
    body's first element, the root element's boot classes, and the title's lettering replaced by the user's logo - nothing else;
    every QA1 element id kept;
  - the logo is the user's file (SHA-256 as supplied); the theme audio is the user's (SHA-256 as locked) and its seams check out;
  - the QA2 probes, the regression of the older probes, the camera checks, BR-RoLE unit checks and the retained lifecycle suite
    pass on the final tree;
  - the shipped client files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, receipt.json and STAGE_3C_QA2_PACKAGE_RECEIPT.txt.
"""
import hashlib, json, subprocess, sys, tempfile, time, zipfile
from html.parser import HTMLParser
from pathlib import Path
REPO, COMMIT, OUT, EV, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5]
PARENT = '5f30e28532200bca52b57a112c6691498a263e92'; PARENT_TREE = '374911e01e2a66706a3938fcd2f7495ee4133a49'
FIRST3C = '76bcc4acaa14814f84c2b9ae66acc5ffdfe2cace'; FIRST3C_TREE = 'd8f0949500168294e3856d64ff24df111dc76bd2'
R1 = '06d7ae7a4ba08d0abb9b4b2b616647c2e4ad4a3b'                                   # the QA2 probes' source tree (probe_b1..b3 ran on it; R1/R2)
STAGE3B = '6e6fa46ecab537f716942b94f873776b09049a40'; STAGE3B_TREE = '33ed11b672d3a2a45767accccbb9f04fdd7949c3'
QA2_UI = {'assets/ui.js', 'assets/ui.css'}
LOGO = {'assets/MAIN_MENU_LOGO_USER_SUPPLIED.png': '906e19a8f4423bc7b2a7bf924a05201b3b2ba2c13753df3eec6eb6abc9cb9cb9'}
AUDIO = {'assets/MainTheme_MenuIntro.wav': '64b2124ba6970b36284802e9fdf53b3ba373b665dc6bccce95bd3895a5b6fbd0',
         'assets/MainTheme_MenuLoop.wav': '848db3af81c7bd023b3e32e68f39fd83ed835232ecf8fc44278b2c232ca158b9',
         'audio_source/MainTheme.wav': 'ba087949275af24c7ceb4c927c5b2ba64ede448a850dd6ecd1be968763af4fa8'}
ACCOUNTED = {'index.html'}
ALLOWED_PREFIX = ('dev/stage-3c-qa2/', 'STAGE_3C_QA2_')
PROTECTED = ['assets/index-DKbV5Nv9.js', 'assets/index-D7hdwmUU.css', 'mp.js', 'camera_policy.js', 'timing_policy.js', 'server.js', 'sim.js', 'ai.js', 'light.js',
             'move.js', 'ents.js', 'death_srv.js', 'dphys.js', 'gore.js', 'glitch.js', 'sfx.js', 'world.js', 'camcorder.js', 'redirect.js', 'assets/br-role.js',
             'assets/l0-remaster.js', 'assets/level0_visuals.js', 'assets/shadows-2d.js', 'package.json', 'hud.js', 'inventory.js', 'assets/credits_data.js',
             'assets/manifest.webmanifest', *AUDIO]
PROTECTED_PREFIX = ('dev/ai_src/', 'dev/ents_src/', 'dev/tests/', 'dev/br-role/', 'dev/stage-3b', 'dev/shadows/', 'dev/stage-3c/', 'dev/stage-3c-qa1/', 'sounds/', 'audio_source/')
SHIPPED = ['index.html', 'assets/ui.js', 'assets/ui.css', 'assets/MAIN_MENU_LOGO_USER_SUPPLIED.png', 'assets/credits_data.js', 'assets/manifest.webmanifest',
           'assets/MainTheme_MenuIntro.wav', 'assets/MainTheme_MenuLoop.wav', 'hud.js', 'inventory.js', 'mp.js', 'assets/index-DKbV5Nv9.js', 'server.js', 'camcorder.js',
           'assets/br-role.js', 'assets/l0-remaster.js']
QA2_IDS = {'boot', 'bootErr', 'bootErrMsg', 'bootGo', 'bootMsg', 'bootNote', 'bootRetry', 'mmLogo', 'tfbBootCss'}
J = lambda f: json.loads((EV / f).read_text())
REMOTE = J('remote.json'); PROBES = {f'probe_b{i}': J(f'probe_b{i}.json') for i in range(1, 4)}; REG = J('regression.json'); THEME = J('theme_assets.json')
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
def qa2_index_back_to_qa1(h):
    """QA2's index.html with QA2's four edits taken out again; None if an edit is not where (and as) it should be."""
    try:
        a = h.index('  <!-- Stage 3C QA2: the boot gate.'); b = h.index('})();</script>\n', a) + len('})();</script>\n')
        block = h[a:b]
        if not ('<style id="tfbBootCss">' in block and 'window.__boot=' in block and block.count('<script>') == 1): return None
        h = h[:a] + h[b:]
        old1 = '<!doctype html><html lang="en" class="tfb-boot tfb-black" data-boot="black"><head>'
        if h.count(old1) != 1: return None
        h = h.replace(old1, '<!doctype html><html lang="en"><head>')
        c = h.index('<div id="boot" role="status" aria-live="polite">'); d = h.index('</div></div>\n', c) + len('</div></div>\n')
        h = h[:c] + h[d:]
        e = h.index('    <!-- QA2: the user\'s own logo'); f = h.index('</h1>\n', e) + len('</h1>\n')
        title = h[e:f]
        if 'src="./assets/MAIN_MENU_LOGO_USER_SUPPLIED.png"' not in title or 'alt="The Far Backrooms"' not in title or 'id="mmLogo"' not in title: return None
        return h[:e] + '    <h1 class="mm-title" id="mmTitle"><span class="a">The Far</span><span class="b">Backrooms</span></h1>\n' + h[f:]
    except ValueError:
        return None
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
    audio = {f: hashlib.sha256((root / f).read_bytes()).hexdigest() for f in AUDIO}
    logo = {f: hashlib.sha256((root / f).read_bytes()).hexdigest() for f in LOGO}
    zindex = (root / 'index.html').read_text(encoding='utf-8')
anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', PARENT, commit]).returncode == 0
anc1 = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', FIRST3C, commit]).returncode == 0
anc3b = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', STAGE3B, commit]).returncode == 0
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip(); first_tree = git('rev-parse', f'{FIRST3C}^{{tree}}').strip(); s3b_tree = git('rev-parse', f'{STAGE3B}^{{tree}}').strip()
since = [l for l in git('diff', '--name-only', PARENT, commit).splitlines() if l]
outside = [f for f in since if f not in QA2_UI and f not in ACCOUNTED and f not in LOGO and not f.startswith(ALLOWED_PREFIX)]
protected = {f: ('unchanged' if f not in since else 'CHANGED') for f in PROTECTED}
protected_dirs = [f for f in since if f.startswith(PROTECTED_PREFIX)]
qa1_index = blob(PARENT, 'index.html')
index_exact = qa2_index_back_to_qa1(zindex) == qa1_index
pids, nids = ids(qa1_index), ids(zindex)
ids_kept = not (set(pids) - set(nids)); ids_added = sorted(set(nids) - set(pids)); ids_added_ok = set(ids_added) == QA2_IDS
logo_ok = all(logo[f] == h for f, h in LOGO.items())
audio_ok = all(audio[f] == h for f, h in AUDIO.items()) and THEME.get('ok') is True
chain = [l for l in git('log', '--format=%H %T %s', '--reverse', f'{PARENT}..{commit}').splitlines()]
merges = [l for l in git('rev-list', '--merges', f'{PARENT}..{commit}').splitlines() if l]
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
U = REMOTE['untouched']; untouched_ok = all(v['ok'] for v in U.values()) and all(U.get(b, {}).get('ok') for b in ('stage-3c-qa1', 'stage-3c', 'main'))
cam_lines = [l for l in CAM.splitlines() if l.startswith(('PASS', 'FAIL'))]
camera_ok = bool(cam_lines) and all(l.startswith('PASS') for l in cam_lines) and 'CAMERA FAIRNESS: 12/12 PASS' in FAIR and protected['camera_policy.js'] == 'unchanged' == protected['timing_policy.js']
br_lines = [l for l in BRL.splitlines() if l.startswith(('PASS', 'FAIL'))]
br_ok = bool(br_lines) and all(l.startswith('PASS') for l in br_lines)
probes_ok = {k: bool(v.get('ok')) and all(c['ok'] for c in v['checks']) for k, v in PROBES.items()}
probe_counts = {k: f"{sum(c['ok'] for c in v['checks'])}/{len(v['checks'])}" for k, v in PROBES.items()}
reg_rows = REG['probes']
reg_ok = REG.get('ok') is True and all(all(c['ok'] or ((c.get('supersededBy') or c.get('artifact')) and c.get('why')) for c in p['checks']) and not p.get('crashed') and p['checks'] for p in reg_rows.values())
def reg_line(p):
    sup = [c for c in p['checks'] if not c['ok'] and c.get('supersededBy')]; art = [c for c in p['checks'] if not c['ok'] and c.get('artifact')]
    return (f"{sum(c['ok'] for c in p['checks'])}/{len(p['checks'])} pass" + (f", {len(sup)} superseded" + (f" ({sum(c.get('by') == 'QA1' for c in sup)} of them by QA1)" if any(c.get('by') == 'QA1' for c in sup) else '') if sup else '')
            + (f", {len(art)} timing-sensitive (fails on QA1 too under software rendering; evidence listed)" if art else ''))
reg_counts = {k: reg_line(p) for k, p in reg_rows.items()}
life = reg_rows.get('lifecycle_mp', {}); life_ok = bool(life.get('checks')) and all(c['ok'] for c in life['checks'])
src_since_r1 = [l for l in git('diff', '--name-only', R1, commit).splitlines() if l and not l.startswith(('dev/', 'STAGE_3C_QA2_'))]
r1_anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', R1, commit]).returncode == 0
scope_ok = (r1_anc and not src_since_r1 and anc and anc1 and anc3b and parent_tree == PARENT_TREE and first_tree == FIRST3C_TREE and s3b_tree == STAGE3B_TREE and not merges and not outside
            and all(v == 'unchanged' for v in protected.values()) and not protected_dirs)
accounted_ok = index_exact and ids_kept and ids_added_ok
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'commit': commit, 'tree': tree,
     'parentCommit': parent, 'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'qa1Parent': PARENT, 'qa1ParentTree': parent_tree, 'qa1ParentIsAncestor': anc, 'first3c': FIRST3C, 'first3cTree': first_tree, 'first3cIsAncestor': anc1,
     'stage3b': STAGE3B, 'stage3bTree': s3b_tree, 'stage3bIsAncestor': anc3b, 'checkpoints': chain, 'merges': merges, 'remote': REMOTE,
     'changedSinceQa1': since, 'outsideScope': outside, 'protected': protected, 'protectedDirsChanged': protected_dirs,
     'accounted': {'indexHtmlIsQa1PlusTheFourQa2Edits': index_exact, 'indexHtmlKeepsEveryQa1Id': ids_kept, 'indexHtmlIdsAdded': ids_added, 'indexHtmlIdsAddedAsExpected': ids_added_ok},
     'logo': {'sha256': logo, 'asSupplied': logo_ok}, 'themeAudio': {'sha256': audio, 'asLocked': audio_ok, 'check': THEME.get('seams')},
     'cameraTests': cam_lines, 'cameraFairness': [l for l in FAIR.splitlines() if 'CAMERA FAIRNESS' in l], 'brRole': {'pass': sum(l.startswith('PASS') for l in br_lines), 'total': len(br_lines)},
     'probesSourceTree': {'r1': R1, 'r1IsAncestor': r1_anc, 'shippedFilesChangedSinceR1': src_since_r1}, 'probes': probe_counts, 'regression': reg_counts, 'lifecycle': life.get('checks'), 'shipped': shipped, 'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and untouched_ok and scope_ok and accounted_ok and logo_ok and audio_ok and camera_ok
               and br_ok and life_ok and all(probes_ok.values()) and reg_ok)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
T = ['THE FAR BACKROOMS - Stage 3C QA2 (main menu branding / black background / boot asset gate) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3c-qa2/package_qa2.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}',
     f'zip CRCs   {"all OK (" + str(entries) + " entries tested)" if bad_zip is None else "BAD: " + bad_zip}', f'files      {len(files)} (the commit has {len(listing)})', '',
     '== Source revision (branch stage-3c-qa2, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}',
     f'QA1 parent (Stage 3C QA1 final)          {PARENT}  (tree {parent_tree}; as given: {yn(parent_tree == PARENT_TREE)}; an ancestor: {yn(anc)})',
     f'first Stage 3C candidate                 {FIRST3C}  (tree {first_tree}; as given: {yn(first_tree == FIRST3C_TREE)}; an ancestor: {yn(anc1)})',
     f'accepted Stage 3B                        {STAGE3B}  (tree {s3b_tree}; as given: {yn(s3b_tree == STAGE3B_TREE)}; an ancestor: {yn(anc3b)})', '',
     '== Checkpoints QA2-0..QA2-4 (after QA1 5f30e28, oldest first: commit  tree  subject) ==', *[f'  {c}' for c in chain], f'  merges: {len(merges)} (a straight line)', '',
     '== GitHub (checked after the final push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}',
     f'REST API commit   {REMOTE["githubApi"]["commit"]}', f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== Branches (remote) ==', f'touched:   stage-3c-qa2  {REMOTE["lsRemote"]}  (new from 5f30e28; never force-pushed)',
     *[f'untouched: {b:<22} {v["remote"]}  {yn(v["ok"])}' for b, v in sorted(U.items(), key=lambda x: (x[0] not in ('stage-3c-qa1', 'stage-3c', 'main'), x[0]))],
     f'other remote branches: {", ".join(REMOTE["otherRemoteBranches"]) or "none"}',
     f'stage-3c-qa1 untouched: {yn(U.get("stage-3c-qa1", {}).get("ok"))}', f'stage-3c untouched: {yn(U.get("stage-3c", {}).get("ok"))}', f'main untouched: {yn(U.get("main", {}).get("ok"))}', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     f'== Scope (git diff --name-only {PARENT[:7]}..commit) ==',
     f'files changed since QA1: {len(since)} ({len([f for f in since if "/evidence/" not in f])} outside evidence folders)',
     f'outside QA2 (assets/ui.js, assets/ui.css, the accounted index.html edit, the user\'s logo, STAGE_3C_QA2_* documents, dev/stage-3c-qa2/): {len(outside)}' + (' -> ' + ', '.join(outside) if outside else ''),
     *[f'  {f}' for f in since if '/evidence/' not in f], '',
     'the user\'s logo (byte-identical to visual_reference/MAIN_MENU_LOGO_USER_SUPPLIED.png):', *[f'  {f:<44} {logo[f]}  {yn(logo[f] == h)}' for f, h in LOGO.items()],
     'the user\'s theme audio (unchanged since QA1; byte-identical to MAIN_MENU_THEME_LOCK.md):', *[f'  {f:<32} {audio[f]}  {yn(audio[f] == h)}' for f, h in AUDIO.items()],
     f'  Intro -> Loop and Loop seam checks (dev/stage-3c-qa1/theme_assets_check.py): {yn(THEME.get("ok"))}', '',
     'index.html, the one existing file QA2 edits besides its UI files, checked exactly:',
     f'  QA1\'s file plus exactly: the boot block in the head (black-first rules, window.__boot), the root element\'s boot classes, the boot layer as the body\'s first element, the title lettering replaced by the logo: {yn(index_exact)}',
     f'  every QA1 element id kept: {yn(ids_kept)}; ids added: {", ".join(ids_added)} (as expected: {yn(ids_added_ok)})', '',
     'protected files, byte-identical to QA1 (the game bundle, mp.js, server.js and the settings model too: no AI, movement, collision, network, camera, lighting, NV, remaster or server change):',
     *[f'  {f:<32} {v}' for f, v in protected.items()],
     f'  {"dev/ai_src/, dev/ents_src/, dev/tests/, dev/br-role/, dev/stage-3b*, dev/shadows/, dev/stage-3c/, dev/stage-3c-qa1/, sounds/, audio_source/":<32} {"unchanged" if not protected_dirs else "CHANGED: " + ", ".join(protected_dirs)}', '',
     '== Checks on the final tree ==',
     f'probe_b1..b3 ran on R1 {R1[:7]} (an ancestor: {yn(r1_anc)}); shipped files changed between R1 and this commit: {len(src_since_r1)}' + (' -> ' + ', '.join(src_since_r1) if src_since_r1 else ' (the same source)'),
     *[f'{k} (dev/stage-3c-qa2/{k}.js): {probe_counts[k]} {"PASS" if probes_ok[k] else "FAIL"}' for k in PROBES],
     'the older probes re-run on QA2 (dev/stage-3c-qa2/regress/run.js; originals unchanged):',
     *[f'  {k} ({reg_rows[k]["source"]}): {reg_counts[k]}' for k in reg_rows],
     f'  every check not passing is a deliberate QA2 (or, for the first candidate, QA1) decision with the check that covers the new behaviour, or a timing-sensitive check shown to fail on QA1 too (regression.json): {yn(reg_ok)}',
     f'retained lifecycle suite (dev/tests/lifecycle_mp.py: NEW RUN, start from the title, death -> RETRY), through the boot gate: {"PASS" if life_ok else "FAIL"}',
     f'camera (dev/stage-3b-n/test_3bn.js): {sum(l.startswith("PASS") for l in cam_lines)}/{len(cam_lines)} PASS', *[f'  {l}' for l in R['cameraFairness']],
     f'BR-RoLE unit checks (dev/br-role/test_br_role.js): {R["brRole"]["pass"]}/{R["brRole"]["total"]} PASS', '',
     '== Shipped client files (SHA-256, from the ZIP) ==', *[f'  {f:<40} {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], '',
     f'RESULT: {"OK" if R["ok"] else "PROBLEMS - see receipt.json"}']
(OUT / 'STAGE_3C_QA2_PACKAGE_RECEIPT.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
