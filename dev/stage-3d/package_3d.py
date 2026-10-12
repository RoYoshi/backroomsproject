#!/usr/bin/env python3
"""Stage 3D human-QA package: a ZIP of the final commit (git archive), its SHA-256, and a receipt (development only; adapted from
dev/stage-3h0/package_h0.py).

  python3 -I dev/stage-3d/package_3d.py REPO COMMIT OUTDIR REMOTE_JSON NAME

  REMOTE_JSON  dev/stage-3d/verify_remote_3d.py LABEL --out FILE, run after the final push (LABEL: the final checkpoint)

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id); nothing missing or extra; every CRC OK;
  - the commit, its tree, every checkpoint after the accepted parent 06949a8 (stage-3h0, tree 5adf3f3) in a straight line; the accepted
    QA2 commit edd2af9 is an ancestor; what GitHub reports for stage-3d after the push; main and every other branch untouched;
  - scope: every changed file is one of 3D's death files, the stage's tooling and evidence, or a stage document; the files 3D must not
    touch are byte-identical to the parent (index.html among them: no new script, no load-order change);
  - the built files are their sources: ents.js == dev/ents_src concatenated, sim.js == dev/sim_head.js + dev/sim_glue.js, the bundle ==
    the parent's bundle with exactly the edits listed in dev/stage-3d/apply_bundle.py (each parent text found once);
  - the final regression (dev/stage-3d/evidence/d6/summary.json) passed;
  - the shipped death files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, receipt.json and STAGE_3D_PACKAGE_RECEIPT.txt."""
import hashlib, json, subprocess, sys, tempfile, time, zipfile, ast
from pathlib import Path
REPO, COMMIT, OUT, REMOTE_JSON, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5]
PARENT = '06949a8a4204a1ce8144b87b2192251b259b21ec'; PARENT_TREE = '5adf3f3cde5c1a52775f561c36facda646f3cca8'
ANC = {'accepted QA2 edd2af9': 'edd2af954627caf7721c7614df5ff1c7f20d3f3b'}
PRODUCTION = {'dphys.js': 'D1 D2 D3 D4 D5', 'death_srv.js': 'D1 D2', 'gore.js': 'D2 D3', 'ents.js': 'D2 D5 (built)', 'dev/ents_src/25_death.js': 'D2', 'dev/ents_src/30_audio.js': 'D5',
              'server.js': 'D2 D3 D4', 'sim.js': 'D4 (built)', 'dev/sim_glue.js': 'D4', 'mp.js': 'D3 D4 D5', 'assets/net-wire.js': 'D3 D6', 'sfx.js': 'D5',
              'assets/index-DKbV5Nv9.js': 'D3 D4 D5 (exact-text hooks)'}
PROTECTED = ['index.html', 'ai.js', 'world.js', 'move.js', 'light.js', 'glitch.js', 'camcorder.js', 'hud.js', 'inventory.js', 'camera_policy.js', 'timing_policy.js', 'redirect.js',
             'package.json', 'run_linux.sh', 'run_windows.bat', 'server/ws.js', 'server/fields.js', 'server/static.js', 'assets/net-interp.js', 'assets/index-D7hdwmUU.css',
             'assets/ui.js', 'assets/ui.css', 'assets/br-role.js', 'assets/l0-remaster.js', 'assets/level0_visuals.js', 'assets/shadows-2d.js', 'assets/credits_data.js',
             'assets/manifest.webmanifest', 'assets/MAIN_MENU_LOGO_USER_SUPPLIED.png', 'assets/MainTheme_MenuIntro.wav', 'assets/MainTheme_MenuLoop.wav', 'assets/carpet.png',
             'dev/sim_head.js', 'dev/ai_src', 'dev/tests', '.github/workflows/deploy-bloom.yml']
PROTECTED_PREFIX = ('dev/', 'sounds/', 'audio_source/', '.github/', 'STAGE_3C', 'STAGE_3B', 'STAGE_3H0', '3H0_', 'BR_ROLE', 'PART_2', '2D_SHADOWS', 'STAGE_2')
SHIPPED = ['dphys.js', 'gore.js', 'ents.js', 'mp.js', 'sfx.js', 'assets/net-wire.js', 'assets/index-DKbV5Nv9.js', 'server.js', 'sim.js', 'death_srv.js']
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
    shipped = {f: {'sha256': hashlib.sha256((root / f).read_bytes()).hexdigest(), 'bytes': (root / f).stat().st_size} for f in SHIPPED}
    # the built files are their sources (checked on the ZIP's own files)
    src = lambda p: (root / p).read_text(encoding='utf-8')
    ents_ok = src('ents.js') == ''.join(src(f'dev/ents_src/{f}') for f in ['00_head.js', '10_hound.js', '20_smiler.js', '25_death.js', '30_audio.js', '40_debug.js'])
    hl = src('dev/sim_head.js').splitlines(keepends=True); cut = next(i for i, l in enumerate(hl) if l.startswith("'use strict';")); head = ''.join(hl[cut + 1:])   # build_sim.sh: sed -e "1,/^'use strict';/d"
    sim_built = ("/* sim.js - server-side Level 0 simulation.\n * The map, collision, ray-cast and light code below is the game's own (extracted from the production bundle assets/index-*.js).\n"
                 " * The hounds and smilers are driven by ai.js (v16); the 'multiplayer glue' section connects players, bodies, glitched walls and the admin tools. */\n'use strict';\n") + head + src('dev/sim_glue.js')
    sim_ok = src('sim.js') == sim_built
    abtext = (root / 'dev' / 'stage-3d' / 'apply_bundle.py').read_text(encoding='utf-8')
    EDITS = ast.literal_eval(abtext[abtext.index('EDITS = [') + len('EDITS = '):abtext.index(']\n\n\ndef build') + 1])   # the list of string tuples, read as data
    pb = show(PARENT, 'assets/index-DKbV5Nv9.js'); built = pb; bundle_edits = []
    for cp, what, old, new in EDITS:
        bundle_edits.append({'checkpoint': cp, 'what': what, 'parentTextOnce': pb.count(old) == 1}); built = built.replace(old, new)
    bundle_ok = all(e['parentTextOnce'] for e in bundle_edits) and built == src('assets/index-DKbV5Nv9.js')
    summary_path = root / 'dev' / 'stage-3d' / 'evidence' / 'd6' / 'summary.json'
    SUMMARY = json.loads(summary_path.read_text()) if summary_path.exists() else {'ok': False, 'why': 'evidence/d6/summary.json missing'}
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip()
since = [l for l in git('diff', '--name-status', PARENT, commit).splitlines() if l]
since_names = [l.split('\t')[-1] for l in since]
def cls(p):
    if p in PRODUCTION: return 'production'
    if p.startswith('dev/stage-3d/'): return 'tooling'
    if '/' not in p and p.startswith('STAGE_3D_'): return 'docs'
    return 'OUT OF SCOPE'
classes = {p: cls(p) for p in since_names}
outside = [p for p, c in classes.items() if c == 'OUT OF SCOPE']
protected = {f: ('unchanged' if not any(n == f or n.startswith(f + '/') for n in since_names) else 'CHANGED') for f in PROTECTED}
protected_dirs = [f for f in since_names if f.startswith(PROTECTED_PREFIX) and not f.startswith('dev/stage-3d/') and f not in PRODUCTION]
chain = [l for l in git('log', '--format=%H %T %s', '--reverse', f'{PARENT}..{commit}').splitlines()]
merges = [l for l in git('rev-list', '--merges', f'{PARENT}..{commit}').splitlines() if l]
first_parent = git('rev-parse', chain[0].split()[0] + '^').strip() if chain else None
anc = {k: isanc(v, commit) for k, v in ANC.items()}; anc['accepted parent stage-3h0 06949a8'] = isanc(PARENT, commit)
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
U = REMOTE['untouched']; untouched_ok = all(v['ok'] for v in U.values()) and all(U.get(b, {}).get('ok') for b in ('stage-3h0', 'main'))
scope_ok = (parent_tree == PARENT_TREE and first_parent == PARENT and all(anc.values()) and not merges and not outside and all(v == 'unchanged' for v in protected.values()) and not protected_dirs)
built_ok = ents_ok and sim_ok and bundle_ok
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'commit': commit, 'tree': tree, 'parentCommit': parent,
     'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'acceptedParent': PARENT, 'acceptedParentTree': parent_tree, 'firstCheckpointsParent': first_parent, 'ancestors': anc, 'checkpoints': chain, 'merges': merges, 'remote': REMOTE,
     'changedSinceParent': since, 'classes': {c: sum(v == c for v in classes.values()) for c in set(classes.values())}, 'outsideScope': outside, 'protected': protected,
     'protectedDirsChanged': protected_dirs, 'built': {'ents.js == dev/ents_src': ents_ok, 'sim.js == sim_head + sim_glue': sim_ok, 'bundle == parent + apply_bundle edits': bundle_ok, 'bundleEdits': bundle_edits},
     'finalRegression': SUMMARY, 'shipped': shipped, 'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and untouched_ok and scope_ok and built_ok and SUMMARY.get('ok') is True)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
T = ['THE FAR BACKROOMS - Stage 3D (Gore & Death 2.0) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3d/package_3d.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}',
     f'zip CRCs   {"all OK (" + str(entries) + " entries tested)" if bad_zip is None else "BAD: " + bad_zip}', f'files      {len(files)} (the commit has {len(listing)})', '',
     '== Source revision (branch stage-3d, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}',
     f'accepted parent  {PARENT} (stage-3h0; tree {parent_tree}; as accepted: {yn(parent_tree == PARENT_TREE)}; the first 3D commit\'s parent: {yn(first_parent == PARENT)})',
     *[f'ancestor: {k:<36} {yn(v)}' for k, v in anc.items()], '',
     '== Checkpoints (every commit after 06949a8, oldest first: commit  tree  subject) ==', *[f'  {c}' for c in chain], f'  merges: {len(merges)} (a straight line)', '',
     '== GitHub (checked after the final push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}',
     f'REST API commit   {REMOTE["githubApi"]["commit"]}', f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== Branches (remote) ==', f'touched:   stage-3d  {REMOTE["lsRemote"]}  (new from 06949a8; normal pushes only, never forced)',
     *[f'untouched: {b:<22} {v["remote"]}  {yn(v["ok"])}' for b, v in sorted(U.items(), key=lambda x: (x[0] not in ('main', 'stage-3h0'), x[0]))],
     f'new remote branches: {", ".join(REMOTE.get("newRemoteBranches") or []) or "none"}', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     f'== Scope (git diff --name-status {PARENT[:7]}..commit) ==',
     f'files changed since the accepted parent: {len(since)}: ' + ', '.join(f'{c} {n}' for c, n in sorted(R['classes'].items())),
     f'outside scope: {len(outside)}' + (' -> ' + ', '.join(outside) if outside else ''),
     'death files (production):', *[f'  {l:<40} {PRODUCTION[l.split(chr(9))[-1]]}' for l in since if l.split('\t')[-1] in PRODUCTION],
     'stage documents:', *[f'  {l}' for l in since if classes[l.split(chr(9))[-1]] == 'docs'],
     f'tooling and evidence under dev/stage-3d/: {sum(c == "tooling" for c in classes.values())} files', '',
     'files 3D must not touch, byte-identical to the parent (no load-order, AI, movement, collision, camera, lighting, UI, menu, theme or deployment change):',
     *[f'  {f:<40} {v}' for f, v in protected.items()],
     f'  every other dev/ folder, sounds/, audio_source/, .github/ and earlier stage documents: {"unchanged" if not protected_dirs else "CHANGED: " + ", ".join(protected_dirs)}', '',
     '== Built files are their sources (from the ZIP) ==', f'  ents.js == dev/ents_src/*.js concatenated:            {yn(ents_ok)}', f'  sim.js == dev/sim_head.js + dev/sim_glue.js:          {yn(sim_ok)}',
     f'  bundle == the parent\'s bundle + apply_bundle.py edits: {yn(bundle_ok)} ({len(bundle_edits)} edits, each parent text found exactly once: {yn(all(e["parentTextOnce"] for e in bundle_edits))})',
     *[f'    {e["checkpoint"]}: {e["what"]}' for e in bundle_edits], '',
     '== Final regression on the final source tree (dev/stage-3d/evidence/d6/summary.json) ==', *[f'  {l}' for l in SUMMARY.get('lines', [])],
     f'  all gated lines as required: {yn(SUMMARY.get("ok") is True)}',
     f'  over D6\'s own stricter A/B line (reported, not passed): {len(SUMMARY.get("over", []))}' + (' - see STAGE_3D_PERFORMANCE.md' if SUMMARY.get('over') else ''), '',
     '== Shipped death files (SHA-256, from the ZIP) ==', *[f'  {f:<28} {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], '',
     f'RESULT: {"OK" if R["ok"] else "PROBLEMS - see receipt.json"}']
(OUT / 'STAGE_3D_PACKAGE_RECEIPT.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
