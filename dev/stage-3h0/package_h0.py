#!/usr/bin/env python3
"""Stage 3H0 human-QA package: a ZIP of the final commit (git archive), its SHA-256, and a receipt (development only; adapted from
dev/stage-3c-qa2/package_qa2.py).

  python3 -I dev/stage-3h0/package_h0.py REPO COMMIT OUTDIR REMOTE_JSON NAME

  REMOTE_JSON  dev/stage-3h0/verify_remote_h0.py LABEL --out FILE, run after the final push (LABEL: the final checkpoint)

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id); nothing missing or extra; every CRC OK;
  - the commit, its tree, every checkpoint after the accepted QA2 commit edd2af9 (tree 108d89f) in a straight line; QA1
    5f30e28, the first 3C candidate 76bcc4a and the accepted Stage 3B 6e6fa46 are ancestors; what GitHub reports for stage-3h0 after
    the push; main, stage-3c-qa2, stage-3c-qa1, stage-3c and every other branch untouched;
  - scope (dev/stage-3h0/scope_check.py's rules, applied to the commit): every changed file is an approved extraction file, the one
    adapted test, the stage's tooling and evidence, or a stage document; every line removed from mp.js / server.js reappears verbatim
    in the new files, except the five lines changed by design; index.html gains exactly the two script lines;
  - the protected files and folders are byte-identical to the parent;
  - the final regression (dev/stage-3h0/evidence/h0-5/summary.json) passed;
  - the shipped multiplayer files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, receipt.json and STAGE_3H0_PACKAGE_RECEIPT.txt."""
import hashlib, json, subprocess, sys, tempfile, time, zipfile, difflib
from pathlib import Path
REPO, COMMIT, OUT, REMOTE_JSON, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5]
PARENT = 'edd2af954627caf7721c7614df5ff1c7f20d3f3b'; PARENT_TREE = '108d89fa07634ef4816428939fc7dda1e03ec971'
ANC = {'Stage 3C QA1 5f30e28': '5f30e28532200bca52b57a112c6691498a263e92', 'first Stage 3C candidate 76bcc4a': '76bcc4acaa14814f84c2b9ae66acc5ffdfe2cace',
       'accepted Stage 3B 6e6fa46': '6e6fa46ecab537f716942b94f873776b09049a40'}
PRODUCTION = {'mp.js': 'H0-2, H0-3', 'index.html': 'H0-2, H0-3', 'assets/net-wire.js': 'H0-2', 'assets/net-interp.js': 'H0-3',
              'server.js': 'H0-4a, H0-4b, H0-4c', 'server/ws.js': 'H0-4a', 'server/fields.js': 'H0-4b', 'server/static.js': 'H0-4c'}
TESTS = {'dev/tests/interp_test.js'}
PROTECTED = ['sim.js', 'ai.js', 'world.js', 'death_srv.js', 'dphys.js', 'move.js', 'ents.js', 'light.js', 'glitch.js', 'gore.js', 'camcorder.js', 'sfx.js',
             'hud.js', 'inventory.js', 'camera_policy.js', 'timing_policy.js', 'redirect.js', 'package.json', 'run_linux.sh', 'run_windows.bat',
             'assets/index-DKbV5Nv9.js', 'assets/index-D7hdwmUU.css', 'assets/ui.js', 'assets/ui.css', 'assets/br-role.js', 'assets/l0-remaster.js',
             'assets/level0_visuals.js', 'assets/shadows-2d.js', 'assets/credits_data.js', 'assets/manifest.webmanifest', 'assets/MAIN_MENU_LOGO_USER_SUPPLIED.png',
             'assets/MainTheme_MenuIntro.wav', 'assets/MainTheme_MenuLoop.wav', 'assets/carpet.png', '.github/workflows/deploy-bloom.yml']
PROTECTED_PREFIX = ('dev/', 'sounds/', 'audio_source/', '.github/', 'STAGE_3C', 'STAGE_3B', 'BR_ROLE', 'PART_2', '2D_SHADOWS', 'STAGE_2')
SHIPPED = ['index.html', 'mp.js', 'assets/net-wire.js', 'assets/net-interp.js', 'server.js', 'server/ws.js', 'server/fields.js', 'server/static.js']
BY_DESIGN = ["lk: [A.look.hat, A.look.texture, A.look.hands, A.look.main, A.look.backpack].join('|')",
             "lk: [t.appearance.hat, t.appearance.texture, t.appearance.hands, t.appearance.main, t.appearance.backpack].join('|')",
             "lk: window.__api ? [window.__api.look.hat, window.__api.look.texture, window.__api.look.hands, window.__api.look.main, window.__api.look.backpack].join('|') : undefined",
             "const srv = http.createServer((req, res) => {", "sock.on('data', d => {"]
def git(*a): return subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True, text=True).stdout
def show(rev, f):
    r = subprocess.run(['git', '-C', str(REPO), 'show', f'{rev}:{f}'], capture_output=True); return r.stdout.decode('utf-8') if r.returncode == 0 else None
isanc = lambda a, b: subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', a, b]).returncode == 0
REMOTE = json.loads(REMOTE_JSON.read_text())
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
    shipped = {f: {'sha256': hashlib.sha256((root / f).read_bytes()).hexdigest(), 'bytes': (root / f).stat().st_size, 'lines': (root / f).read_text(encoding='utf-8').count('\n')} for f in SHIPPED}
    ztext = {f: (root / f).read_text(encoding='utf-8') for f in ['mp.js', 'server.js', 'index.html', 'assets/net-wire.js', 'assets/net-interp.js', 'server/ws.js', 'server/fields.js', 'server/static.js']}
    summary_path = root / 'dev' / 'stage-3h0' / 'evidence' / 'h0-5' / 'summary.json'
    SUMMARY = json.loads(summary_path.read_text()) if summary_path.exists() else {'ok': False, 'why': 'evidence/h0-5/summary.json missing'}
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip()
since = [l for l in git('diff', '--name-status', PARENT, commit).splitlines() if l]
since_names = [l.split('\t')[-1] for l in since]
def cls(p):
    if p in PRODUCTION: return 'production'
    if p in TESTS: return 'test'
    if p.startswith('dev/stage-3h0/'): return 'tooling'
    if '/' not in p and (p.startswith('3H0_') or p.startswith('STAGE_3H0_')): return 'docs'
    return 'OUT OF SCOPE'
classes = {p: cls(p) for p in since_names}
outside = [p for p, c in classes.items() if c == 'OUT OF SCOPE']
protected = {f: ('unchanged' if f not in since_names else 'CHANGED') for f in PROTECTED}
protected_dirs = [f for f in since_names if f.startswith(PROTECTED_PREFIX) and not f.startswith('dev/stage-3h0/') and f not in TESTS]
moves = {}
for host, cut in (('mp.js', ['assets/net-wire.js', 'assets/net-interp.js']), ('server.js', ['server/ws.js', 'server/fields.js', 'server/static.js'])):
    old, new = show(PARENT, host).split('\n'), ztext[host].split('\n'); pool = set(l.strip() for f in cut for l in ztext[f].split('\n'))
    rem = [d[2:] for d in difflib.ndiff(old, new) if d.startswith('- ')]; add = [d[2:] for d in difflib.ndiff(old, new) if d.startswith('+ ')]
    nm = [l for l in rem if l.strip() and l.strip() not in pool]; unexpl = [l for l in nm if not any(b in l for b in BY_DESIGN)]
    moves[host] = {'removed': len(rem), 'verbatim': len(rem) - len(nm), 'byDesign': len(nm) - len(unexpl), 'unexplained': unexpl, 'added': add}
idx = [d for d in difflib.ndiff(show(PARENT, 'index.html').split('\n'), ztext['index.html'].split('\n')) if d[:2] in ('- ', '+ ')]
index_ok = idx == ['+ <script src="./assets/net-wire.js"></script>', '+ <script src="./assets/net-interp.js"></script>']
chain = [l for l in git('log', '--format=%H %T %s', '--reverse', f'{PARENT}..{commit}').splitlines()]
merges = [l for l in git('rev-list', '--merges', f'{PARENT}..{commit}').splitlines() if l]
first_parent = git('rev-parse', chain[0].split()[0] + '^').strip() if chain else None
anc = {k: isanc(v, commit) for k, v in ANC.items()}; anc['accepted QA2 edd2af9'] = isanc(PARENT, commit)
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
U = REMOTE['untouched']; untouched_ok = all(v['ok'] for v in U.values()) and all(U.get(b, {}).get('ok') for b in ('stage-3c-qa2', 'stage-3c-qa1', 'stage-3c', 'main'))
scope_ok = (parent_tree == PARENT_TREE and first_parent == PARENT and all(anc.values()) and not merges and not outside and all(v == 'unchanged' for v in protected.values())
            and not protected_dirs and all(not m['unexplained'] for m in moves.values()) and index_ok)
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'commit': commit, 'tree': tree, 'parentCommit': parent,
     'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'acceptedParent': PARENT, 'acceptedParentTree': parent_tree, 'firstCheckpointsParent': first_parent, 'ancestors': anc, 'checkpoints': chain, 'merges': merges, 'remote': REMOTE,
     'changedSinceParent': since, 'classes': {c: sum(v == c for v in classes.values()) for c in set(classes.values())}, 'outsideScope': outside, 'protected': protected,
     'protectedDirsChanged': protected_dirs, 'moves': moves, 'indexHtml': {'difference': idx, 'onlyTheTwoScriptLines': index_ok}, 'finalRegression': SUMMARY, 'shipped': shipped,
     'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and untouched_ok and scope_ok and SUMMARY.get('ok') is True)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
T = ['THE FAR BACKROOMS - Stage 3H0 (safe architecture: mp.js / server.js extraction) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3h0/package_h0.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}',
     f'zip CRCs   {"all OK (" + str(entries) + " entries tested)" if bad_zip is None else "BAD: " + bad_zip}', f'files      {len(files)} (the commit has {len(listing)})', '',
     '== Source revision (branch stage-3h0, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}',
     f'accepted QA2 parent  {PARENT}  (tree {parent_tree}; as accepted: {yn(parent_tree == PARENT_TREE)}; the first 3H0 commit\'s parent: {yn(first_parent == PARENT)})',
     *[f'ancestor: {k:<34} {yn(v)}' for k, v in anc.items()], '',
     '== Checkpoints (every commit after edd2af9, oldest first: commit  tree  subject) ==', *[f'  {c}' for c in chain], f'  merges: {len(merges)} (a straight line)', '',
     '== GitHub (checked after the final push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}',
     f'REST API commit   {REMOTE["githubApi"]["commit"]}', f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== Branches (remote) ==', f'touched:   stage-3h0  {REMOTE["lsRemote"]}  (new from edd2af9; normal pushes only, never forced)',
     *[f'untouched: {b:<22} {v["remote"]}  {yn(v["ok"])}' for b, v in sorted(U.items(), key=lambda x: (x[0] not in ('main', 'stage-3c-qa2', 'stage-3c-qa1', 'stage-3c'), x[0]))],
     f'new remote branches: {", ".join(REMOTE.get("newRemoteBranches") or []) or "none"}', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     f'== Scope (git diff --name-status {PARENT[:7]}..commit) ==',
     f'files changed since the accepted parent: {len(since)}: ' + ', '.join(f'{c} {n}' for c, n in sorted(R['classes'].items())),
     f'outside scope: {len(outside)}' + (' -> ' + ', '.join(outside) if outside else ''),
     'production files (approved extractions):', *[f'  {l}' for l in since if l.split('\t')[-1] in PRODUCTION], 'the one adapted test:', *[f'  {l}' for l in since if l.split('\t')[-1] in TESTS],
     'stage documents:', *[f'  {l}' for l in since if classes[l.split("\t")[-1]] == 'docs'],
     f'tooling and evidence under dev/stage-3h0/: {sum(c == "tooling" for c in classes.values())} files', '',
     'the moves (every removed line found verbatim in the new files, unless changed by design):',
     *[f'  {h}: {m["removed"]} lines removed, {m["verbatim"]} verbatim in the new files, {m["byDesign"]} changed by design, {len(m["unexplained"])} unexplained; {len(m["added"])} lines added' for h, m in moves.items()],
     *[f'    + {l.strip()[:150]}' for m in moves.values() for l in m['added']],
     f'index.html: the parent\'s file plus exactly the two <script> lines for assets/net-wire.js and assets/net-interp.js: {yn(index_ok)}', '',
     'protected files, byte-identical to the parent (no gameplay, AI, movement, collision, camera, lighting, UI, menu, theme or deployment change):',
     *[f'  {f:<40} {v}' for f, v in protected.items()],
     f'  every other dev/ folder, sounds/, audio_source/, .github/ and earlier stage documents: {"unchanged" if not protected_dirs else "CHANGED: " + ", ".join(protected_dirs)}', '',
     '== Final regression on the final source tree (dev/stage-3h0/evidence/h0-5/summary.json) ==', *[f'  {l}' for l in SUMMARY.get('lines', [])],
     f'  all as required: {yn(SUMMARY.get("ok") is True)}', '',
     '== Shipped multiplayer files (SHA-256, from the ZIP) ==', *[f'  {f:<24} {v["sha256"]}  {v["bytes"]} bytes  {v["lines"]} lines' for f, v in shipped.items()], '',
     f'RESULT: {"OK" if R["ok"] else "PROBLEMS - see receipt.json"}']
(OUT / 'STAGE_3H0_PACKAGE_RECEIPT.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
