#!/usr/bin/env python3
"""Stage 3D HQ3 human-QA package: a ZIP of the final commit (git archive), its SHA-256, split parts with their own checksums, and a short
receipt (development only; a lean version of dev/stage-3d-hq2/package_hq2.py).

  python3 -I dev/stage-3d-hq3/package_hq3.py REPO COMMIT OUTDIR REMOTE_JSON NAME [--part-mib 28] [--refaudio DIR]

  REMOTE_JSON  dev/stage-3d-hq3/verify_remote_hq3.py LABEL --out FILE, run after the final push
  --refaudio   the pack's reference_audio folder: none of its files may be in the ZIP (candidates, not approved)

The receipt shows, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id); nothing missing or extra; every CRC OK;
  - the commit, its tree, the HQ3 commits after the accepted HQ2 parent f542b7c in a straight line; what GitHub reports after the push;
    every other branch untouched;
  - the files changed since HQ2, and the ones HQ3 leaves alone byte-identical to HQ2 (the bundle, index.html, move.js, the lighting, the
    AI, the sounds); sim.js == dev/build_sim.sh's sim_head.js + sim_glue.js; no reference-audio candidate shipped;
  - the packaged source runs: from the extracted ZIP, the page and the gib code are served, the gibs without a screen (gib_check.js --n 24)
    and UNLIMITED NEW RUN's limits on a real server (nr_free_unit.js);
  - the split parts join back to the same ZIP.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, the parts with PARTS.sha256 and JOIN_INSTRUCTIONS.txt, receipt.json,
STAGE_3D_HQ3_PACKAGE_RECEIPT.txt and its .sha256."""
import hashlib, json, os, subprocess, sys, tempfile, time, zipfile, socket, urllib.request
from pathlib import Path
REPO, COMMIT, OUT, REMOTE_JSON, name = Path(sys.argv[1]).resolve(), sys.argv[2], Path(sys.argv[3]).resolve(), Path(sys.argv[4]), sys.argv[5]
PART_MIB = int(sys.argv[sys.argv.index('--part-mib') + 1]) if '--part-mib' in sys.argv else 28
REFAUDIO = Path(sys.argv[sys.argv.index('--refaudio') + 1]) if '--refaudio' in sys.argv else None
PARENT = 'f542b7cbd90f95148e644e6cba513cf55ddd52c9'; PARENT_TREE = '6730834df06b36917ec9f3b7e56f56c8ee5487de'
PROTECTED = ('main', 'stage-3d', 'stage-3d-hq1', 'stage-3d-hq2', 'stage-3h0')
SHIPPED = ['server.js', 'sim.js', 'death_srv.js', 'dphys.js', 'gore.js', 'mp.js', 'assets/net-wire.js', 'index.html', 'assets/index-DKbV5Nv9.js', 'move.js']
UNCHANGED = ['assets/index-DKbV5Nv9.js', 'index.html', 'move.js', 'light.js', 'ai.js', 'world.js', 'sfx.js', 'ents.js', 'camcorder.js', 'server/peers.js',
             'assets/br-role.js', 'assets/l0-remaster.js', 'assets/net-interp.js', 'dev/sim_head.js', 'package.json']
UNCHANGED_DIRS = ['sounds/', 'audio_source/', 'dev/ents_src/', 'dev/tests/', 'dev/stage-3d-hq2/', 'dev/stage-3d-hq1/', 'dev/stage-3d/', 'dev/stage-3h0/', 'STAGE_3D_HQ2_', 'STAGE_3D_HQ1_']
def git(*a): return subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True, text=True).stdout
REMOTE = json.loads(REMOTE_JSON.read_text())
OUT.mkdir(parents=True, exist_ok=True); zpath = OUT / f'{name}.zip'
subprocess.run(['git', '-C', str(REPO), 'archive', '--format=zip', f'--prefix={name}/', '-o', str(zpath), COMMIT], check=True)
data = zpath.read_bytes(); sha = hashlib.sha256(data).hexdigest(); (OUT / f'{name}.zip.sha256').write_text(f'{sha}  {zpath.name}\n')
psize = PART_MIB * 1024 * 1024; parts = []
for i in range(0, len(data), psize):
    pn = OUT / f'{name}.zip.part{len(parts) + 1:02d}'; pn.write_bytes(data[i:i + psize]); parts.append({'file': pn.name, 'bytes': pn.stat().st_size, 'sha256': hashlib.sha256(pn.read_bytes()).hexdigest()})
(OUT / 'PARTS.sha256').write_text(''.join(f"{p['sha256']}  {p['file']}\n" for p in parts) + f'{sha}  {zpath.name}\n')
join_ok = hashlib.sha256(b''.join((OUT / p['file']).read_bytes() for p in parts)).hexdigest() == sha
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
ref_hashes = {hashlib.sha256(p.read_bytes()).hexdigest(): str(p.relative_to(REFAUDIO)) for p in REFAUDIO.rglob('*') if p.is_file()} if REFAUDIO else {}
smoke = {}
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
with tempfile.TemporaryDirectory() as td:
    with zipfile.ZipFile(zpath) as z: bad_zip = z.testzip(); z.extractall(td); entries = len(z.namelist())
    root = Path(td) / name
    files = sorted(str(p.relative_to(root)) for p in root.rglob('*') if p.is_file())
    missing = sorted(set(listing) - set(files)); extra = sorted(set(files) - set(listing))
    mism = [f for f in files if f in listing and subprocess.run(['git', 'hash-object', str(root / f)], check=True, capture_output=True, text=True).stdout.strip() != listing[f]]
    ref_in_zip = sorted({ref_hashes[h] for f in files for h in [hashlib.sha256((root / f).read_bytes()).hexdigest()] if h in ref_hashes}) if ref_hashes else []
    shipped = {f: {'sha256': hashlib.sha256((root / f).read_bytes()).hexdigest(), 'bytes': (root / f).stat().st_size} for f in SHIPPED}
    src = lambda p: (root / p).read_text(encoding='utf-8')
    head = src('dev/sim_head.js').split('\n'); k = next(i for i in range(1, len(head)) if head[i].startswith("'use strict';"))
    sim_built = ("/* sim.js - server-side Level 0 simulation.\n * The map, collision, ray-cast and light code below is the game's own (extracted from the production bundle assets/index-*.js).\n"
                 " * The hounds and smilers are driven by ai.js (v16); the 'multiplayer glue' section connects players, bodies, glitched walls and the admin tools. */\n'use strict';\n"
                 + '\n'.join(head[k + 1:]) + src('dev/sim_glue.js'))
    built_ok = sim_built == src('sim.js')
    env = dict(os.environ, ADMIN_PASSCODE='d3-synthetic-admin', PYTHONDONTWRITEBYTECODE='1'); env.pop('PORT', None); env.pop('BODY_TTL', None)
    # the page and the gib code are served by the packaged server
    port = free_port(); log = open(Path(td) / 'serve.log', 'w')
    sp = subprocess.Popen(['node', 'server.js', str(port)], cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
    served = {}
    try:
        for _ in range(100):
            try: socket.create_connection(('127.0.0.1', port), timeout=.2).close(); break
            except OSError: time.sleep(.1)
        for path, f in (('/', 'index.html'), ('/dphys.js', 'dphys.js'), ('/gore.js', 'gore.js'), ('/mp.js', 'mp.js')):
            try:
                req = urllib.request.Request(f'http://127.0.0.1:{port}{path}', headers={'Accept-Encoding': 'identity'})
                with urllib.request.urlopen(req, timeout=10) as r: body = r.read(); served[path] = {'status': r.status, 'sameAsFile': body == (root / f).read_bytes()}
            except Exception as e: served[path] = {'status': None, 'error': str(e)[:120]}
    finally:
        sp.terminate(); sp.wait(10); log.close()
    smoke['the packaged server serves the page and the gib code (/, /dphys.js, /gore.js, /mp.js: 200, the files themselves)'] = {'exit': 0 if all(v.get('status') == 200 and v.get('sameAsFile') for v in served.values()) else 1, 'last': json.dumps(served)[:300]}
    for label, cmd, to in (('the gibs without a screen (gib_check.js --n 24)', ['node', 'dev/stage-3d-hq3/gib_check.js', '--game', '.', '--n', '24', '--out', str(Path(td) / 'gib.json')], 300),
                           ('UNLIMITED NEW RUN skips only the 30 s, on a real server (nr_free_unit.js)', ['node', 'dev/stage-3d-hq3/nr_free_unit.js', '--game', '.', '--out', str(Path(td) / 'nfu.json')], 300)):
        r = subprocess.run(cmd, cwd=root, env=env, capture_output=True, text=True, timeout=to)
        tail = [l for l in (r.stdout + r.stderr).strip().splitlines() if l][-1:] or ['']
        smoke[label] = {'exit': r.returncode, 'last': tail[0][:200]}
    smoke_ok = all(v['exit'] == 0 for v in smoke.values())
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip()
since = [l for l in git('diff', '--name-status', PARENT, commit).splitlines() if l]
since_names = [l.split('\t')[-1] for l in since]
unchanged = {f: f in listing and f not in since_names for f in UNCHANGED}                                        # (present, and not changed)
unchanged_dirs = {d: any(n.startswith(d) for n in listing) and not any(n.startswith(d) for n in since_names) for d in UNCHANGED_DIRS}
chain = [l for l in git('log', '--format=%H %T %s', '--reverse', f'{PARENT}..{commit}').splitlines()]
merges = [l for l in git('rev-list', '--merges', f'{PARENT}..{commit}').splitlines() if l]
first_parent = git('rev-parse', chain[0].split()[0] + '^').strip() if chain else None
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
U = REMOTE['untouched']; untouched_ok = all(v['ok'] for v in U.values()) and all(U.get(b, {}).get('ok') for b in PROTECTED)
scope_ok = parent_tree == PARENT_TREE and first_parent == PARENT and not merges and all(unchanged.values()) and all(unchanged_dirs.values())
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'parts': parts, 'partsJoinToTheZip': join_ok,
     'commit': commit, 'tree': tree, 'parentCommit': parent, 'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'hq2Parent': PARENT, 'hq2ParentTree': parent_tree, 'firstCheckpointsParent': first_parent, 'checkpoints': chain, 'merges': merges, 'remote': REMOTE,
     'changedSinceHQ2': since, 'unchangedSinceHQ2': unchanged, 'unchangedFolders': unchanged_dirs, 'simBuilt': built_ok,
     'referenceAudioFilesChecked': len(ref_hashes), 'referenceAudioInZip': ref_in_zip, 'smoke': smoke, 'shipped': shipped, 'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and untouched_ok and scope_ok and built_ok and smoke_ok and join_ok
               and REFAUDIO is not None and len(ref_hashes) > 0 and not ref_in_zip)
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
prod = [l for l in since if not l.split('\t')[-1].startswith(('dev/', 'STAGE_3D_HQ3_'))]
T = ['THE FAR BACKROOMS - Stage 3D HQ3 (admin refinement + instant NEW RUN gibbing) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3d-hq3/package_hq3.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}',
     f'zip CRCs   {"all OK (" + str(entries) + " entries tested)" if bad_zip is None else "BAD: " + bad_zip}',
     f'files      {len(files)} (the commit has {len(listing)}); missing {len(missing)}, extra {len(extra)}, different from the committed blob {len(mism)}',
     f'parts      {len(parts)} of at most {PART_MIB} MiB (PARTS.sha256, JOIN_INSTRUCTIONS.txt); joined back they are the ZIP: {yn(join_ok)}',
     *[f'  {p["file"]:<64} {p["bytes"]:>10} bytes  {p["sha256"]}' for p in parts], '',
     '== Source revision (branch stage-3d-hq3, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}',
     f'HQ2 parent {PARENT} (tree {parent_tree}; as accepted: {yn(parent_tree == PARENT_TREE)}; the first HQ3 commit\'s parent: {yn(first_parent == PARENT)})', '',
     '== HQ3 commits (every commit after f542b7c, oldest first: commit  tree  subject) ==', *[f'  {c}' for c in chain], f'  merges: {len(merges)} (a straight line)', '',
     '== GitHub (checked after the final push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}',
     f'REST API commit   {REMOTE["githubApi"]["commit"]}', f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== Branches (remote) ==', f'touched:   stage-3d-hq3  {REMOTE["lsRemote"]}  (new from f542b7c; normal pushes only, never forced)',
     *[f'untouched: {b:<22} {v["remote"]}  {yn(v["ok"])}' for b, v in sorted(U.items(), key=lambda x: (x[0] not in PROTECTED, x[0]))],
     f'new remote branches: {", ".join(REMOTE.get("newRemoteBranches") or []) or "none"}', '',
     '== Scope ==', f'production files changed since HQ2 ({len(prod)}):', *[f'  {l}' for l in prod],
     f'other changes: dev/stage-3d-hq3/ (tools, evidence) and the STAGE_3D_HQ3_* documents ({len(since) - len(prod)} files)',
     *[f'unchanged since HQ2: {f:<34} {yn(v)}' for f, v in unchanged.items()], *[f'unchanged since HQ2: {d:<34} {yn(v)}' for d, v in unchanged_dirs.items()],
     f'sim.js == dev/build_sim.sh (sim_head.js + sim_glue.js), from the ZIP: {yn(built_ok)}',
     f'reference-audio candidates in the ZIP: {len(ref_in_zip)} of {len(ref_hashes)} checked by content ({yn(REFAUDIO is not None and not ref_in_zip)} = none shipped)', '',
     '== The packaged source runs (from the extracted ZIP; synthetic admin passcode) ==', *[f'{yn(v["exit"] == 0):<4} {k}  ({v["last"]})' for k, v in smoke.items()], '',
     '== Shipped files (sha256) ==', *[f'  {v["sha256"]}  {f}  ({v["bytes"]} bytes)' for f, v in shipped.items()], '',
     f'PACKAGE CHECK: {"PASS" if R["ok"] else "FAIL"}', '',
     'This receipt verifies the package and its source. It is not a human-QA verdict: only the user decides that (STAGE_3D_HQ3_HUMAN_QA.md).', '']
rp = OUT / 'STAGE_3D_HQ3_PACKAGE_RECEIPT.txt'; rp.write_text('\n'.join(T))
(OUT / 'STAGE_3D_HQ3_PACKAGE_RECEIPT.txt.sha256').write_text(f'{hashlib.sha256(rp.read_bytes()).hexdigest()}  {rp.name}\n')
print('\n'.join(T[:12])); print('PACKAGE CHECK:', 'PASS' if R['ok'] else 'FAIL'); sys.exit(0 if R['ok'] else 1)
