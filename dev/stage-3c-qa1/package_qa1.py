#!/usr/bin/env python3
"""Stage 3C QA1 human-QA package: ZIP of a commit (git archive), its SHA-256, and a receipt.  (Adapted from
dev/stage-3c/package_c3.py.)

  python3 -I dev/stage-3c-qa1/package_qa1.py REPO COMMIT OUTDIR EVIDENCE_DIR NAME

  EVIDENCE_DIR  the final run's outputs (on the final tree):
                remote.json                   dev/stage-3c-qa1/verify_remote_qa1.py Q5 --out (after the final push)
                probe_q1..probe_q5.json       the QA1 browser probes (--out)
                first_candidate_probes.json   the first candidate's five probes (dev/stage-3c/probe_c1..c5.js) re-run on QA1, each check
                                              PASS, or FAIL with the QA1 decision that intentionally changed what it checked
                lifecycle_mp.json             {"result": <dev/tests/lifecycle_mp.py's JSON>}
                camera_3bn.log                node dev/stage-3b-n/test_3bn.js
                camera_fairness.log           node dev/tests/s_camera_fairness.js
                br_role.log                   node dev/br-role/test_br_role.js
                theme_assets.json             dev/stage-3c-qa1/theme_assets_check.py --out

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id); nothing missing or extra; CRCs OK;
  - the commit, its tree, the Q0..Q5 checkpoints back to the first Stage 3C candidate 76bcc4a (tree d8f0949) in a straight line,
    the accepted Stage 3B commit 6e6fa46 an ancestor; what GitHub reports for stage-3c-qa1 after the push; stage-3c, main and every
    other branch untouched (their tips as found at Q0);
  - scope: every file changed since the first candidate is a QA1 UI file, an accounted UI-facing edit, the user's theme audio, a
    QA1 document or dev/stage-3c-qa1/; the game bundle, mp.js and every gameplay, AI, movement, collision, network, camera,
    lighting (BR-RoLE), night-vision, remaster and server file are byte-identical to the first candidate;
  - the accounted edits, each exactly: inventory.js (key-label hooks only), hud.js (the settings model: same fields, v2), credits
    data (one version field), index.html (every element id of the first candidate still there, except the first candidate's own
    menu ids that QA1's rebuilt menu retired - each listed with its reason, and referenced by no shipped script; the manifest link and
    app metadata);
  - the theme audio is the user's (SHA-256 as locked), and the source is preserved;
  - the camera checks, BR-RoLE unit checks, the retained lifecycle suite, the five QA1 probes and the first candidate's probes pass
    on the final tree (a first-candidate check that QA1 deliberately superseded is listed with the QA1 check that covers it);
  - the shipped client files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, receipt.json and STAGE_3C_QA1_PACKAGE_RECEIPT.txt.
"""
import hashlib, json, subprocess, sys, tempfile, time, zipfile
from html.parser import HTMLParser
from pathlib import Path
REPO, COMMIT, OUT, EV, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5]
PARENT = '76bcc4acaa14814f84c2b9ae66acc5ffdfe2cace'; PARENT_TREE = 'd8f0949500168294e3856d64ff24df111dc76bd2'
STAGE3B = '6e6fa46ecab537f716942b94f873776b09049a40'; STAGE3B_TREE = '33ed11b672d3a2a45767accccbb9f04fdd7949c3'
NEW_UI = {'assets/ui.js', 'assets/ui.css', 'assets/manifest.webmanifest'}
AUDIO = {'assets/MainTheme_MenuIntro.wav': '64b2124ba6970b36284802e9fdf53b3ba373b665dc6bccce95bd3895a5b6fbd0',
         'assets/MainTheme_MenuLoop.wav': '848db3af81c7bd023b3e32e68f39fd83ed835232ecf8fc44278b2c232ca158b9',
         'audio_source/MainTheme.wav': 'ba087949275af24c7ceb4c927c5b2ba64ede448a850dd6ecd1be968763af4fa8'}
ACCOUNTED = {'index.html', 'hud.js', 'inventory.js', 'assets/credits_data.js'}
ALLOWED_PREFIX = ('dev/stage-3c-qa1/', 'STAGE_3C_QA1_')
PROTECTED = ['assets/index-DKbV5Nv9.js', 'assets/index-D7hdwmUU.css', 'mp.js', 'camera_policy.js', 'timing_policy.js', 'server.js', 'sim.js', 'ai.js', 'light.js',
             'move.js', 'ents.js', 'death_srv.js', 'dphys.js', 'gore.js', 'glitch.js', 'sfx.js', 'world.js', 'camcorder.js', 'redirect.js', 'assets/br-role.js',
             'assets/l0-remaster.js', 'assets/level0_visuals.js', 'assets/shadows-2d.js', 'package.json']
PROTECTED_PREFIX = ('dev/ai_src/', 'dev/ents_src/', 'dev/tests/', 'dev/br-role/', 'dev/stage-3b', 'dev/shadows/', 'dev/stage-3c/', 'sounds/')
SHIPPED = ['index.html', 'assets/ui.js', 'assets/ui.css', 'assets/credits_data.js', 'assets/manifest.webmanifest', 'assets/MainTheme_MenuIntro.wav',
           'assets/MainTheme_MenuLoop.wav', 'hud.js', 'inventory.js', 'mp.js', 'assets/index-DKbV5Nv9.js', 'server.js', 'camcorder.js', 'assets/br-role.js', 'assets/l0-remaster.js']
# inventory.js: key-label hooks, exactly
INV = [("  const KIND_KEYS = { camcorder: 'F raise / lower · N night vision · WHEEL zoom' };",
        "  // Stage 3C QA1: the keys named here are the player's own (assets/ui.js's window.__keys; the defaults when it is absent)\n"
        "  const K = (a, d) => { try { return ((window.__keys && window.__keys.label(a)) || d).toUpperCase(); } catch (e) { return d; } };\n"
        "  const KIND_KEYS = { get camcorder() { return `${K('light', 'F')} raise / lower · ${K('nv', 'N')} night vision · WHEEL zoom`; } };"),
       ("toast('FOUND · ' + ITEMS[id].name, 'Press TAB to see what you are carrying. M opens it.');",
        "toast('FOUND · ' + ITEMS[id].name, `Press ${K('inventory', 'TAB')} to see what you are carrying. ${K('map', 'M')} opens it.`);"),
       ("    $('invToggle').innerHTML = (k === 'camcorder' ? (on ? 'RAISED' : 'LOWERED') : on ? 'LIGHT ON' : 'LIGHT OFF') + ' <kbd>F</kbd>';",
        "    $('invToggle').innerHTML = (k === 'camcorder' ? (on ? 'RAISED' : 'LOWERED') : on ? 'LIGHT ON' : 'LIGHT OFF') + ` <kbd>${K('light', 'F')}</kbd>`;\n"
        "    const hk = root.querySelector('.inv-head kbd'); if (hk) hk.textContent = K('inventory', 'TAB');"),
       ("<button type=\"button\" id=\"invUse\">${showing ? 'PUT AWAY' : 'OPEN'} <kbd>${it.use}</kbd></button>`;",
        "<button type=\"button\" id=\"invUse\">${showing ? 'PUT AWAY' : 'OPEN'} <kbd>${K('map', it.use)}</kbd></button>`;")]
CREDITS = [("window.TFB_CREDITS = {\n  sections: [", "window.TFB_CREDITS = {\n  version: '23.3.6',\n  sections: ["),
           (" * - Only list real people and real software. Nothing here is generated.\n */",
            " * - Only list real people and real software. Nothing here is generated.\n * - version is the build number the main menu shows in its bottom-right corner (package.json's version).\n */")]
J = lambda f: json.loads((EV / f).read_text())
REMOTE = J('remote.json'); PROBES = {f'probe_q{i}': J(f'probe_q{i}.json') for i in range(1, 6)}; LIFE = J('lifecycle_mp.json'); FIRSTP = J('first_candidate_probes.json')
THEME = J('theme_assets.json')
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
def applied(old, pairs):
    out = old
    for a, b in pairs:
        if out is None or out.count(a) != 1: return None
        out = out.replace(a, b)
    return out
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
    zf = {f: (root / f).read_text(encoding='utf-8') for f in ['inventory.js', 'index.html', 'hud.js', 'assets/credits_data.js']}
anc = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', PARENT, commit]).returncode == 0
anc3b = subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', STAGE3B, commit]).returncode == 0
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip(); s3b_tree = git('rev-parse', f'{STAGE3B}^{{tree}}').strip()
since = [l for l in git('diff', '--name-only', PARENT, commit).splitlines() if l]
outside = [f for f in since if f not in NEW_UI and f not in ACCOUNTED and f not in AUDIO and not f.startswith(ALLOWED_PREFIX)]
protected = {f: ('unchanged' if f not in since else 'CHANGED') for f in PROTECTED}
protected_dirs = [f for f in since if f.startswith(PROTECTED_PREFIX)]
inv_ok = applied(blob(PARENT, 'inventory.js'), INV) == zf['inventory.js']
cred_ok = applied(blob(PARENT, 'assets/credits_data.js'), CREDITS) == zf['assets/credits_data.js']
pids, nids = ids(blob(PARENT, 'index.html')), ids(zf['index.html'])
# first-candidate element ids QA1's rebuilt menu retired on purpose (none is bound by the game or any shipped script; checked below)
RETIRED_IDS = {'mmPlayT': "the first candidate's PLAY panel heading (\"You have been here before.\"); QA1's PLAY is a button and its entry has its own heading, #mmEntryT"}
gone = sorted(set(pids) - set(nids))
SCRIPTS = [f for f in listing if f.endswith('.js') and not f.startswith('dev/')]
gone_refs = {g: [f for f in SCRIPTS if g in (blob(commit, f) or '')] for g in gone}
ids_kept = all(g in RETIRED_IDS for g in gone) and not any(gone_refs.values())
html_meta = all(k in zf['index.html'] for k in ['rel="manifest" href="./assets/manifest.webmanifest"', 'viewport-fit=cover', 'apple-mobile-web-app-capable'])
hud_keeps = all(k in zf['hud.js'] for k in ["const KEY = 'fb_settings_v1'", "c: '', s: 1, o: 1, keys: true, coords: false, title: true, auto: true, vol: 1, rm: 'auto', v: 2"])
audio_ok = all(audio[f] == h for f, h in AUDIO.items()) and THEME.get('ok') is True
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
first_rows = FIRSTP['probes']
first_ok = all(all(c['ok'] or (c.get('supersededBy') and c.get('why')) for c in p['checks']) and not p.get('crashed') for p in first_rows.values())
first_counts = {k: f"{sum(c['ok'] for c in p['checks'])}/{len(p['checks'])} pass, {sum((not c['ok']) for c in p['checks'])} superseded" for k, p in first_rows.items()}
scope_ok = anc and anc3b and parent_tree == PARENT_TREE and s3b_tree == STAGE3B_TREE and not merges and not outside and all(v == 'unchanged' for v in protected.values()) and not protected_dirs
accounted_ok = inv_ok and cred_ok and ids_kept and html_meta and hud_keeps
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'commit': commit, 'tree': tree,
     'parentCommit': parent, 'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'qa1Parent': PARENT, 'qa1ParentTree': parent_tree, 'qa1ParentIsAncestor': anc, 'stage3b': STAGE3B, 'stage3bTree': s3b_tree, 'stage3bIsAncestor': anc3b,
     'checkpoints': chain, 'merges': merges, 'remote': REMOTE, 'changedSinceQa1Parent': since, 'outsideScope': outside, 'protected': protected, 'protectedDirsChanged': protected_dirs,
     'accounted': {'inventoryKeyLabelHooksOnly': inv_ok, 'creditsVersionFieldOnly': cred_ok, 'indexHtmlKeepsEveryParentId': ids_kept, 'indexHtmlIdsMissing': gone, 'indexHtmlIdsRetired': {g: RETIRED_IDS.get(g) for g in gone}, 'retiredIdsReferencedBy': gone_refs,
                   'indexHtmlIdsAdded': sorted(set(nids) - set(pids)), 'indexHtmlAppMetadata': html_meta, 'hudJsSettingsModelV2': hud_keeps},
     'themeAudio': {'sha256': audio, 'asLocked': audio_ok, 'check': THEME.get('seams')},
     'cameraTests': cam_lines, 'cameraFairness': [l for l in FAIR.splitlines() if 'CAMERA FAIRNESS' in l], 'brRole': {'pass': sum(l.startswith('PASS') for l in br_lines), 'total': len(br_lines)},
     'lifecycle': life, 'probes': probe_counts, 'firstCandidateProbes': first_counts, 'shipped': shipped, 'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and untouched_ok and scope_ok and accounted_ok and audio_ok and camera_ok and br_ok
               and life_ok and all(probes_ok.values()) and first_ok)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
T = ['THE FAR BACKROOMS - Stage 3C QA1 (main menu / HUD / mobile UX human-QA correction) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3c-qa1/package_qa1.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}',
     f'zip CRCs   {"all OK (" + str(entries) + " entries tested)" if bad_zip is None else "BAD: " + bad_zip}', f'files      {len(files)} (the commit has {len(listing)})', '',
     '== Source revision (branch stage-3c-qa1, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}',
     f'QA1 parent (first Stage 3C candidate)  {PARENT}  (tree {parent_tree}; as given: {yn(parent_tree == PARENT_TREE)}; an ancestor: {yn(anc)})',
     f'accepted Stage 3B                      {STAGE3B}  (tree {s3b_tree}; as given: {yn(s3b_tree == STAGE3B_TREE)}; an ancestor: {yn(anc3b)})', '',
     '== Checkpoints Q0..Q5 (first candidate .. final, oldest first: commit  tree  subject) ==', *[f'  {c}' for c in chain], f'  merges: {len(merges)} (a straight line)', '',
     '== GitHub (checked after the final push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}',
     f'REST API commit   {REMOTE["githubApi"]["commit"]}', f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== Branches (remote) ==', f'touched:   stage-3c-qa1  {REMOTE["lsRemote"]}  (new from 76bcc4a; never force-pushed)',
     *[f'untouched: {b:<22} {v["remote"]}  {yn(v["ok"])}' for b, v in sorted(U.items(), key=lambda x: (x[0] not in ('stage-3c', 'main'), x[0]))],
     f'other remote branches: {", ".join(REMOTE["otherRemoteBranches"]) or "none"}', f'stage-3c untouched: {yn(U.get("stage-3c", {}).get("ok"))}', f'main untouched: {yn(U.get("main", {}).get("ok"))}', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     f'== Scope (git diff --name-only {PARENT[:7]}..commit) ==',
     f'files changed since the first candidate: {len(since)} ({len([f for f in since if "/evidence/" not in f])} outside evidence folders)',
     f'outside QA1 (new UI files, the accounted edits, the theme audio, STAGE_3C_QA1_* documents, dev/stage-3c-qa1/): {len(outside)}' + (' -> ' + ', '.join(outside) if outside else ''),
     *[f'  {f}' for f in since if '/evidence/' not in f], '',
     'new QA1 files: ' + ', '.join(sorted(NEW_UI - {'assets/ui.js', 'assets/ui.css'})) + ' (assets/ui.js and assets/ui.css are the first candidate\'s UI files, extended)',
     'the user\'s theme audio (byte-identical to MAIN_MENU_THEME_LOCK.md):', *[f'  {f:<32} {audio[f]}  {yn(audio[f] == h)}' for f, h in AUDIO.items()],
     f'  Intro -> Loop and Loop seam checks (theme_assets_check.py): {yn(THEME.get("ok"))}', '',
     'UI-facing edits to existing files, each checked exactly:',
     f'  inventory.js: key-label hooks only (the keys it names follow Settings > Controls): {yn(inv_ok)}',
     f'  assets/credits_data.js: one version field for the menu corner, and its comment: {yn(cred_ok)}',
     f'  hud.js: the settings model (fb_settings_v1, same fields, v: 2, coordinates off by default), contextual stamina, the dormant health hook: {yn(hud_keeps)}',
     f'  index.html: the menu, HUD, pause and touch markup, the manifest link and app metadata: {yn(html_meta)}; every element id of the first candidate kept, except the retired ones below, which no shipped script references: {yn(ids_kept)}',
     *[f'    retired: #{g} - {RETIRED_IDS.get(g, "NOT ACCOUNTED")}; referenced by: {", ".join(gone_refs[g]) or "nothing"}' for g in gone],
     f'    (added: {", ".join(R["accounted"]["indexHtmlIdsAdded"])})', '',
     'protected files, byte-identical to the first candidate (the game bundle and mp.js too: no AI, movement, collision, network, camera, lighting, NV, remaster or server change):',
     *[f'  {f:<28} {v}' for f, v in protected.items()],
     f'  {"dev/ai_src/, dev/ents_src/, dev/tests/, dev/br-role/, dev/stage-3b*, dev/shadows/, dev/stage-3c/, sounds/":<28} {"unchanged" if not protected_dirs else "CHANGED: " + ", ".join(protected_dirs)}', '',
     '== Checks on the final tree ==',
     f'camera (dev/stage-3b-n/test_3bn.js): {sum(l.startswith("PASS") for l in cam_lines)}/{len(cam_lines)} PASS', *[f'  {l}' for l in R['cameraFairness']],
     f'BR-RoLE unit checks (dev/br-role/test_br_role.js): {R["brRole"]["pass"]}/{R["brRole"]["total"]} PASS',
     f'retained lifecycle suite (dev/tests/lifecycle_mp.py: NEW RUN, start from the title, death -> RETRY): {"PASS" if life_ok else "FAIL"}',
     *[f'{k} (dev/stage-3c-qa1/{k}.js): {probe_counts[k]} {"PASS" if probes_ok[k] else "FAIL"}' for k in PROBES],
     *[f'first candidate {k} (dev/stage-3c/{k}.js, run through dev/stage-3c-qa1/first_candidate/) on QA1: {first_counts[k]}' for k in first_rows],
     f'  every superseded check is a QA1 decision, each with the QA1 check that covers it (first_candidate_probes.json): {yn(first_ok)}', '',
     '== Shipped client files (SHA-256, from the ZIP) ==', *[f'  {f:<30} {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], '',
     f'RESULT: {"OK" if R["ok"] else "PROBLEMS - see receipt.json"}']
(OUT / 'STAGE_3C_QA1_PACKAGE_RECEIPT.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
