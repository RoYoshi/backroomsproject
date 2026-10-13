#!/usr/bin/env python3
"""Stage 3D HQ2 human-QA package: a ZIP of the final commit (git archive), its SHA-256, split parts with their own checksums, and a receipt
(development only; adapted from dev/stage-3d-hq1/package_hq1.py).

  python3 -I dev/stage-3d-hq2/package_hq2.py REPO COMMIT OUTDIR REMOTE_JSON NAME [--part-mib 28]

  REMOTE_JSON  dev/stage-3d-hq2/verify_remote_hq2.py LABEL --out FILE, run after the final push

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id); nothing missing or extra; every CRC OK;
  - the commit, its tree, every HQ2 checkpoint after the accepted HQ1 parent ebb3bd6 (tree d0aaf5c) in a straight line, the first one's
    parent being HQ1 itself (never D7 ffe2b53); D7, Stage 3H0 06949a8, QA2 edd2af9 and Stage 3B 6e6fa46 are ancestors; what GitHub reports
    after the push; every other branch untouched;
  - scope: every file changed since HQ1 is one H2-0's allowlist allows (dev/stage-3d-hq2/scope_hq2.py: nothing FORBIDDEN); the files HQ2
    must leave alone are byte-identical to HQ1 (index.html, net-wire.js, the lighting, the AI, every older stage's tools, tests and evidence);
  - the built files are their sources: sim.js == dev/build_sim.sh's sim_head.js + sim_glue.js, ents.js == dev/build_ents.sh's ents_src,
    the bundle == the 3H0 bundle with exactly the edits listed in dev/stage-3d/apply_bundle.py (D3-D5, HQ1's and HQ2's, each parent text
    found once);
  - the packaged source runs: from the extracted ZIP, server/peers.js's unit test, a NEW RUN and a head-on collision on a real server
    (proto_lab.js nr_flow, col_head) and the blast at every frame rate (boom_fps.js);
  - the final regression (dev/stage-3d-hq2/summary_hq2.py on the ZIP's evidence): every step as its class requires (reported here, not
    part of the package check);
  - the split parts join back to the same ZIP (SHA-256 of the joined bytes), each part with its own SHA-256;
  - the shipped files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, the parts <NAME>.zip.part01 ... with PARTS.sha256 and JOIN_INSTRUCTIONS.txt, receipt.json,
STAGE_3D_HQ2_PACKAGE_RECEIPT.txt and STAGE_3D_HQ2_PACKAGE_RECEIPT.txt.sha256."""
import hashlib, json, os, subprocess, sys, tempfile, time, zipfile, ast
from pathlib import Path
REPO, COMMIT, OUT, REMOTE_JSON, name = Path(sys.argv[1]).resolve(), sys.argv[2], Path(sys.argv[3]).resolve(), Path(sys.argv[4]), sys.argv[5]
PART_MIB = int(sys.argv[sys.argv.index('--part-mib') + 1]) if '--part-mib' in sys.argv else 28
PARENT = 'ebb3bd603e8a2bb4ef00cc40aa6b415bccab9763'; PARENT_TREE = 'd0aaf5c47fcdeec1a449392093cf45cb4f6b8d16'
D7 = 'ffe2b53c2e5c6aa76a8db8bd222fd1910c1b0e57'; BUNDLE_BASE = '06949a8a4204a1ce8144b87b2192251b259b21ec'
ANC = {'accepted HQ1 ebb3bd6': PARENT, 'D7 ffe2b53 (an ancestor, never the parent)': D7, 'accepted Stage 3H0 06949a8': BUNDLE_BASE,
       'accepted QA2 edd2af9': 'edd2af954627caf7721c7614df5ff1c7f20d3f3b', 'accepted Stage 3B 6e6fa46': '6e6fa46ecab537f716942b94f873776b09049a40'}
SHIPPED = ['server.js', 'server/peers.js', 'sim.js', 'death_srv.js', 'dphys.js', 'mp.js', 'move.js', 'gore.js', 'ents.js', 'assets/index-DKbV5Nv9.js', 'index.html', 'assets/net-wire.js']
UNCHANGED = ['index.html', 'assets/net-wire.js', 'light.js', 'assets/br-role.js', 'assets/l0-remaster.js', 'assets/ui.js', 'assets/net-interp.js', 'ai.js', 'world.js', 'sfx.js',
             'camcorder.js', 'glitch.js', 'hud.js', 'inventory.js', 'camera_policy.js', 'timing_policy.js', 'dev/sim_head.js', 'package.json']
UNCHANGED_DIRS = ['dev/tests/', 'dev/stage-3d-hq1/', 'dev/stage-3h0/', 'dev/stage-3d/evidence/', 'dev/stage-3c', 'dev/stage-3b', 'STAGE_3D_HQ1_', 'STAGE_3D_REPORT', 'sounds/', 'audio_source/']
def git(*a): return subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True, text=True).stdout
def show(rev, f):
    r = subprocess.run(['git', '-C', str(REPO), 'show', f'{rev}:{f}'], capture_output=True); return r.stdout.decode('utf-8') if r.returncode == 0 else None
isanc = lambda a, b: subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', a, b]).returncode == 0
REMOTE = json.loads(REMOTE_JSON.read_text())
OUT.mkdir(parents=True, exist_ok=True); zpath = OUT / f'{name}.zip'
subprocess.run(['git', '-C', str(REPO), 'archive', '--format=zip', f'--prefix={name}/', '-o', str(zpath), COMMIT], check=True)
data = zpath.read_bytes(); sha = hashlib.sha256(data).hexdigest(); (OUT / f'{name}.zip.sha256').write_text(f'{sha}  {zpath.name}\n')
psize = PART_MIB * 1024 * 1024; parts = []
for i in range(0, len(data), psize):
    pn = OUT / f'{name}.zip.part{len(parts) + 1:02d}'; pn.write_bytes(data[i:i + psize]); parts.append({'file': pn.name, 'bytes': pn.stat().st_size, 'sha256': hashlib.sha256(pn.read_bytes()).hexdigest()})
(OUT / 'PARTS.sha256').write_text(''.join(f"{p['sha256']}  {p['file']}\n" for p in parts) + f'{sha}  {zpath.name}\n')
joined = b''.join((OUT / p['file']).read_bytes() for p in parts); join_ok = hashlib.sha256(joined).hexdigest() == sha
names = ' '.join(p['file'] for p in parts)
(OUT / 'JOIN_INSTRUCTIONS.txt').write_text(
    f'{name}.zip is split into {len(parts)} parts of at most {PART_MIB} MiB.  Join them in order, then check the whole file:\n\n'
    f'  Linux / macOS:\n    sha256sum -c PARTS.sha256 --ignore-missing     (or: shasum -a 256 <part>, compare with PARTS.sha256)\n'
    f'    cat {names} > {name}.zip\n    sha256sum {name}.zip        # must be {sha}\n\n'
    f'  Windows (PowerShell, in the folder of the parts):\n'
    f'    Get-ChildItem {name}.zip.part* | Sort-Object Name | ForEach-Object {{ Get-Content $_ -Encoding Byte -ReadCount 0 }} | Set-Content {name}.zip -Encoding Byte\n'
    f'    (PowerShell 7: use -AsByteStream instead of -Encoding Byte)\n'
    f'    Get-FileHash {name}.zip -Algorithm SHA256        # must be {sha.upper()}\n\n'
    f'  Windows (cmd):\n    copy /b {"+".join(p["file"] for p in parts)} {name}.zip\n    certutil -hashfile {name}.zip SHA256\n')
commit = git('rev-parse', COMMIT).strip(); tree = git('rev-parse', f'{COMMIT}^{{tree}}').strip(); parent = git('rev-parse', f'{COMMIT}^').strip()
listing = {l.split('\t', 1)[1]: l.split('\t', 1)[0].split()[2] for l in git('ls-tree', '-r', COMMIT).splitlines()}
smoke = {}
with tempfile.TemporaryDirectory() as td:
    with zipfile.ZipFile(zpath) as z: bad_zip = z.testzip(); z.extractall(td); entries = len(z.namelist())
    root = Path(td) / name
    files = sorted(str(p.relative_to(root)) for p in root.rglob('*') if p.is_file())
    missing = sorted(set(listing) - set(files)); extra = sorted(set(files) - set(listing))
    mism = [f for f in files if f in listing and subprocess.run(['git', 'hash-object', str(root / f)], check=True, capture_output=True, text=True).stdout.strip() != listing[f]]
    shipped = {f: {'sha256': hashlib.sha256((root / f).read_bytes()).hexdigest(), 'bytes': (root / f).stat().st_size} for f in SHIPPED}
    src = lambda p: (root / p).read_text(encoding='utf-8')
    # the bundle: the 3H0 bundle + every edit apply_bundle.py lists (D3-D5, HQ1, HQ2)
    abtext = src('dev/stage-3d/apply_bundle.py')
    EDITS = ast.literal_eval(abtext[abtext.index('EDITS = [') + len('EDITS = '):abtext.index(']\n\n\ndef build') + 1])
    pb = show(BUNDLE_BASE, 'assets/index-DKbV5Nv9.js'); built = pb; bundle_edits = []
    for cp, what, old, new in EDITS:
        bundle_edits.append({'checkpoint': cp, 'what': what, 'parentTextOnce': pb.count(old) == 1}); built = built.replace(old, new)
    bundle_ok = all(e['parentTextOnce'] for e in bundle_edits) and built == src('assets/index-DKbV5Nv9.js')
    # sim.js and ents.js: their build scripts' own recipes, from the ZIP's sources
    head = src('dev/sim_head.js').split('\n'); k = next(i for i in range(1, len(head)) if head[i].startswith("'use strict';"))
    sim_built = ("/* sim.js - server-side Level 0 simulation.\n * The map, collision, ray-cast and light code below is the game's own (extracted from the production bundle assets/index-*.js).\n"
                 " * The hounds and smilers are driven by ai.js (v16); the 'multiplayer glue' section connects players, bodies, glitched walls and the admin tools. */\n'use strict';\n"
                 + '\n'.join(head[k + 1:]) + src('dev/sim_glue.js'))
    ents_built = ''.join(src(f'dev/ents_src/{f}') for f in ('00_head.js', '10_hound.js', '20_smiler.js', '25_death.js', '30_audio.js', '40_debug.js'))
    built_ok = {'sim.js == dev/build_sim.sh (sim_head.js + sim_glue.js)': sim_built == src('sim.js'), 'ents.js == dev/build_ents.sh (dev/ents_src)': ents_built == src('ents.js')}
    # the packaged source runs (from the extracted ZIP; synthetic admin passcode)
    env = dict(os.environ, ADMIN_PASSCODE='d3-synthetic-admin', PYTHONDONTWRITEBYTECODE='1'); env.pop('PORT', None); env.pop('BODY_TTL', None)
    for label, cmd, to in (('server/peers.js on its own (peers_unit.js)', ['node', 'dev/stage-3d-hq2/peers_unit.js', '--game', '.', '--out', str(Path(td) / 'peers.json')], 300),
                           ('a real server: NEW RUN and a head-on collision (proto_lab.js nr_flow,col_head)', ['node', 'dev/stage-3d-hq2/proto_lab.js', '--game', '.', '--scenario', 'nr_flow,col_head', '--out', str(Path(td) / 'proto.json')], 600),
                           ('the blast at every frame rate (boom_fps.js --n 16)', ['node', 'dev/stage-3d-hq2/boom_fps.js', '--game', '.', '--n', '16', '--out', str(Path(td) / 'fps.json')], 300)):
        r = subprocess.run(cmd, cwd=root, env=env, capture_output=True, text=True, timeout=to)
        tail = [l for l in (r.stdout + r.stderr).strip().splitlines() if l][-1:] or ['']
        smoke[label] = {'exit': r.returncode, 'last': tail[0][:200]}
    smoke_ok = all(v['exit'] == 0 for v in smoke.values())
    r = subprocess.run([sys.executable, '-I', 'dev/stage-3d-hq2/summary_hq2.py', '--out', str(Path(td) / 'summary.json')], cwd=root, capture_output=True, text=True)
    SUMMARY = json.loads((Path(td) / 'summary.json').read_text()) if (Path(td) / 'summary.json').exists() else {'ok': False, 'lines': [], 'why': r.stderr[-500:]}
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip()
since = [l for l in git('diff', '--name-status', PARENT, commit).splitlines() if l]
since_names = [l.split('\t')[-1] for l in since]
sc = subprocess.run([sys.executable, '-I', 'dev/stage-3d-hq2/scope_hq2.py', '--ref', commit], cwd=REPO, capture_output=True, text=True)
scope = json.loads(sc.stdout.strip().splitlines()[-1]) if sc.stdout.strip() else {'ok': False}
unchanged = {f: f not in since_names for f in UNCHANGED}
unchanged_dirs = {d: not any(n.startswith(d) for n in since_names) for d in UNCHANGED_DIRS}
chain = [l for l in git('log', '--format=%H %T %s', '--reverse', f'{PARENT}..{commit}').splitlines()]
merges = [l for l in git('rev-list', '--merges', f'{PARENT}..{commit}').splitlines() if l]
first_parent = git('rev-parse', chain[0].split()[0] + '^').strip() if chain else None
anc = {k: isanc(v, commit) for k, v in ANC.items()}
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
U = REMOTE['untouched']; untouched_ok = all(v['ok'] for v in U.values()) and all(U.get(b, {}).get('ok') for b in ('main', 'stage-3d', 'stage-3d-hq1', 'stage-3h0'))
scope_ok = (parent_tree == PARENT_TREE and first_parent == PARENT and first_parent != D7 and all(anc.values()) and not merges and scope.get('ok') is True
            and all(unchanged.values()) and all(unchanged_dirs.values()))
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'parts': parts, 'partsJoinToTheZip': join_ok,
     'commit': commit, 'tree': tree, 'parentCommit': parent, 'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'hq1Parent': PARENT, 'hq1ParentTree': parent_tree, 'firstCheckpointsParent': first_parent, 'ancestors': anc, 'checkpoints': chain, 'merges': merges, 'remote': REMOTE,
     'changedSinceHQ1': since, 'scope': scope, 'unchangedSinceHQ1': unchanged, 'unchangedFolders': unchanged_dirs,
     'bundle': {'bundle == 3H0 bundle + apply_bundle edits': bundle_ok, 'edits': bundle_edits}, 'built': built_ok, 'smoke': smoke, 'finalRegression': SUMMARY, 'shipped': shipped,
     'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and untouched_ok and scope_ok and bundle_ok and all(built_ok.values()) and smoke_ok and join_ok)
R['finalRegressionOk'] = SUMMARY.get('ok') is True; R['finalRegressionNotAsRequired'] = SUMMARY.get('notAsRequired', [])
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
T = ['THE FAR BACKROOMS - Stage 3D HQ2 (NEW RUN explosion + player collision) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3d-hq2/package_hq2.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}',
     f'zip CRCs   {"all OK (" + str(entries) + " entries tested)" if bad_zip is None else "BAD: " + bad_zip}', f'files      {len(files)} (the commit has {len(listing)})',
     f'parts      {len(parts)} of at most {PART_MIB} MiB (PARTS.sha256, JOIN_INSTRUCTIONS.txt); joined back they are the ZIP: {yn(join_ok)}',
     *[f'  {p["file"]:<64} {p["bytes"]:>10} bytes  {p["sha256"]}' for p in parts], '',
     '== Source revision (branch stage-3d-hq2, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}',
     f'HQ1 parent {PARENT} (tree {parent_tree}; as accepted: {yn(parent_tree == PARENT_TREE)}; the first HQ2 commit\'s parent: {yn(first_parent == PARENT)}; D7 is not: {yn(first_parent != D7)})',
     *[f'ancestor: {k:<44} {yn(v)}' for k, v in anc.items()], '',
     '== HQ2 checkpoints (every commit after ebb3bd6, oldest first: commit  tree  subject) ==', *[f'  {c}' for c in chain], f'  merges: {len(merges)} (a straight line)', '',
     '== GitHub (checked after the final push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}',
     f'REST API commit   {REMOTE["githubApi"]["commit"]}', f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== Branches (remote) ==', f'touched:   stage-3d-hq2  {REMOTE["lsRemote"]}  (new from ebb3bd6; normal pushes only, never forced)',
     *[f'untouched: {b:<22} {v["remote"]}  {yn(v["ok"])}' for b, v in sorted(U.items(), key=lambda x: (x[0] not in ('main', 'stage-3d', 'stage-3d-hq1', 'stage-3h0'), x[0]))],
     f'new remote branches: {", ".join(REMOTE.get("newRemoteBranches") or []) or "none"}', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     f'== Scope (git diff --name-status {PARENT[:7]}..commit; dev/stage-3d-hq2/scope_hq2.py, the allowlist frozen at H2-0) ==',
     f'files changed since HQ1: {len(since)}: ' + ', '.join(f'{c} {n}' for c, n in sorted((scope.get('counts') or {}).items())),
     f'forbidden: {len(scope.get("forbidden") or [])}' + (' -> ' + ', '.join(scope['forbidden']) if scope.get('forbidden') else ''),
     'production files changed (STAGE_3D_HQ2_CHANGED_FILES.txt says what and why):', *[f'  {l}' for l in since if not l.split('\t')[-1].startswith(('dev/', 'STAGE_3D_HQ2_'))],
     'unchanged since HQ1 (byte-identical):', *[f'  {f:<26} {yn(v)}' for f, v in unchanged.items()], *[f'  {d + "*":<26} {yn(v)}' for d, v in unchanged_dirs.items()], '',
     '== The built files are their sources (from the ZIP) ==',
     f'  bundle == the 3H0 bundle + apply_bundle.py edits: {yn(bundle_ok)} ({len(bundle_edits)} edits, each parent text found exactly once: {yn(all(e["parentTextOnce"] for e in bundle_edits))})',
     *[f'    {e["checkpoint"]}: {e["what"][:150]}' for e in bundle_edits if e['checkpoint'] == 'HQ2'], *[f'  {k}: {yn(v)}' for k, v in built_ok.items()], '',
     '== The packaged source runs (from the extracted ZIP, synthetic admin passcode) ==', *[f'  {k}: exit {v["exit"]}  ({v["last"]})' for k, v in smoke.items()], '',
     '== Final regression (dev/stage-3d-hq2/summary_hq2.py on the ZIP\'s own evidence: H2-5 and H2-6) ==', *[f'  {l}' for l in SUMMARY.get('lines', [])],
     f'  every step as its class requires: {yn(SUMMARY.get("ok") is True)}' + (f' - not as required: {", ".join(R["finalRegressionNotAsRequired"])}' if R['finalRegressionNotAsRequired'] else ''), '',
     '== This receipt ==',
     '  It verifies the ZIP above, made by git archive from the commit above. It cannot be inside that commit (a commit cannot hold a',
     '  file that names its own hash), so it is delivered next to the ZIP, with the ZIP\'s .sha256, the parts\' PARTS.sha256 and its own .sha256.', '',
     '== Shipped files (SHA-256, from the ZIP) ==', *[f'  {f:<28} {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], '',
     f'RESULT: the package and its source: {"VERIFIED" if R["ok"] else "PROBLEMS - see receipt.json"}; the final regression: ' + ('every step as its class requires' if R['finalRegressionOk'] else f'{len(R["finalRegressionNotAsRequired"])} step(s) not as required, listed above')]
rt = OUT / 'STAGE_3D_HQ2_PACKAGE_RECEIPT.txt'; rt.write_text('\n'.join(T) + '\n')
(OUT / 'STAGE_3D_HQ2_PACKAGE_RECEIPT.txt.sha256').write_text(f'{hashlib.sha256(rt.read_bytes()).hexdigest()}  {rt.name}\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
