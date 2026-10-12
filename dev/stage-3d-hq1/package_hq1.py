#!/usr/bin/env python3
"""Stage 3D HQ1 human-QA package: a ZIP of the final commit (git archive), its SHA-256, split parts with their own checksums, and a receipt
(development only; adapted from dev/stage-3d/package_3d.py).

  python3 -I dev/stage-3d-hq1/package_hq1.py REPO COMMIT OUTDIR REMOTE_JSON NAME [--part-mib 28]

  REMOTE_JSON  dev/stage-3d-hq1/verify_remote_hq1.py LABEL --out FILE, run after the final push

The receipt proves, from the ZIP itself (extracted to a temporary folder):
  - every file in the ZIP is the committed blob (git hash-object == the commit's blob id); nothing missing or extra; every CRC OK;
  - the commit, its tree, every HQ1 checkpoint after the D7 parent ffe2b53 (tree b226afe) in a straight line; D7, the accepted Stage
    3H0 06949a8, QA2 edd2af9 and the accepted Stage 3B 6e6fa46 are ancestors; what GitHub reports after the push; every other branch untouched;
  - scope: every changed file is one of HQ1's two corrections (wall blood, dying lights), the stage's tooling and evidence, or an HQ1
    document; every other file is byte-identical to D7 (index.html among them: no new script, no load-order change);
  - the built files are their sources: ents.js and sim.js untouched since D7; the bundle == the 3H0 bundle with exactly the edits listed in
    dev/stage-3d/apply_bundle.py (D3-D5 and HQ1's two, each parent text found once);
  - the final regression (dev/stage-3d-hq1/evidence/hq1-3/summary.json): every line as gated, and any gated line not met, listed (reported, not
    part of the package check);
  - the split parts join back to the same ZIP (SHA-256 of the joined bytes), each part with its own SHA-256;
  - the shipped files' SHA-256.
Writes OUTDIR/<NAME>.zip, <NAME>.zip.sha256, the parts <NAME>.zip.part01 ... with PARTS.sha256 and JOIN_INSTRUCTIONS.txt, receipt.json
and STAGE_3D_HQ1_PACKAGE_RECEIPT.txt."""
import hashlib, json, subprocess, sys, tempfile, time, zipfile, ast
from pathlib import Path
REPO, COMMIT, OUT, REMOTE_JSON, name = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4]), sys.argv[5]
PART_MIB = int(sys.argv[sys.argv.index('--part-mib') + 1]) if '--part-mib' in sys.argv else 28
PARENT = 'ffe2b53c2e5c6aa76a8db8bd222fd1910c1b0e57'; PARENT_TREE = 'b226afe5cd0461d49947565d7f046d69f560cb9e'
BUNDLE_BASE = '06949a8a4204a1ce8144b87b2192251b259b21ec'
ANC = {'D7 ffe2b53': PARENT, 'accepted Stage 3H0 06949a8': BUNDLE_BASE, 'accepted QA2 edd2af9': 'edd2af954627caf7721c7614df5ff1c7f20d3f3b',
       'accepted Stage 3B 6e6fa46': '6e6fa46ecab537f716942b94f873776b09049a40'}
PRODUCTION = {'gore.js': 'HQ1-1 wallpaper stains', 'mp.js': 'HQ1-1 which wall contacts are shown; HQ1-2 the dying lights\' timeline and power',
              'assets/net-wire.js': 'HQ1-1 the corpse\'s death id; HQ1-2 its light profile', 'dphys.js': 'HQ1-2 lightProfile, lightPower, releaseOf',
              'server.js': 'HQ1-2 the profile on the kill record and replay; corpse age in tenths, from the death\'s end', 'death_srv.js': 'HQ1-2 the profile on the corpse',
              'light.js': 'HQ1-2 a dead light\'s power', 'assets/br-role.js': 'HQ1-2 a dead light\'s power', 'assets/index-DKbV5Nv9.js': 'HQ1-2 two exact-text hooks (dev/stage-3d/apply_bundle.py); HQ1-3a BR-RoLE\'s seam kept verbatim'}
DEV_TOOLS_CHANGED = {'dev/stage-3d/apply_bundle.py', 'dev/stage-3d/cli_golden3d.js', 'dev/stage-3d/contract_check3d.js', 'dev/stage-3d/death_net.js'}
SHIPPED = ['gore.js', 'mp.js', 'assets/net-wire.js', 'dphys.js', 'server.js', 'death_srv.js', 'light.js', 'assets/br-role.js', 'assets/index-DKbV5Nv9.js', 'assets/l0-remaster.js', 'index.html']
def git(*a): return subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True, text=True).stdout
def show(rev, f):
    r = subprocess.run(['git', '-C', str(REPO), 'show', f'{rev}:{f}'], capture_output=True); return r.stdout.decode('utf-8') if r.returncode == 0 else None
isanc = lambda a, b: subprocess.run(['git', '-C', str(REPO), 'merge-base', '--is-ancestor', a, b]).returncode == 0
REMOTE = json.loads(REMOTE_JSON.read_text())
OUT.mkdir(parents=True, exist_ok=True); zpath = OUT / f'{name}.zip'
subprocess.run(['git', '-C', str(REPO), 'archive', '--format=zip', f'--prefix={name}/', '-o', str(zpath), COMMIT], check=True)
data = zpath.read_bytes(); sha = hashlib.sha256(data).hexdigest(); (OUT / f'{name}.zip.sha256').write_text(f'{sha}  {zpath.name}\n')
# split parts
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
with tempfile.TemporaryDirectory() as td:
    with zipfile.ZipFile(zpath) as z: bad_zip = z.testzip(); z.extractall(td); entries = len(z.namelist())
    root = Path(td) / name
    files = sorted(str(p.relative_to(root)) for p in root.rglob('*') if p.is_file())
    missing = sorted(set(listing) - set(files)); extra = sorted(set(files) - set(listing))
    mism = [f for f in files if f in listing and subprocess.run(['git', 'hash-object', str(root / f)], check=True, capture_output=True, text=True).stdout.strip() != listing[f]]
    shipped = {f: {'sha256': hashlib.sha256((root / f).read_bytes()).hexdigest(), 'bytes': (root / f).stat().st_size} for f in SHIPPED}
    src = lambda p: (root / p).read_text(encoding='utf-8')
    abtext = src('dev/stage-3d/apply_bundle.py')
    EDITS = ast.literal_eval(abtext[abtext.index('EDITS = [') + len('EDITS = '):abtext.index(']\n\n\ndef build') + 1])
    pb = show(BUNDLE_BASE, 'assets/index-DKbV5Nv9.js'); built = pb; bundle_edits = []
    for cp, what, old, new in EDITS:
        bundle_edits.append({'checkpoint': cp, 'what': what, 'parentTextOnce': pb.count(old) == 1}); built = built.replace(old, new)
    bundle_ok = all(e['parentTextOnce'] for e in bundle_edits) and built == src('assets/index-DKbV5Nv9.js')
    summary_path = root / 'dev' / 'stage-3d-hq1' / 'evidence' / 'hq1-3' / 'summary.json'
    SUMMARY = json.loads(summary_path.read_text()) if summary_path.exists() else {'ok': False, 'why': 'evidence/hq1-3/summary.json missing'}
parent_tree = git('rev-parse', f'{PARENT}^{{tree}}').strip()
since = [l for l in git('diff', '--name-status', PARENT, commit).splitlines() if l]
since_names = [l.split('\t')[-1] for l in since]
def cls(p):
    if p in PRODUCTION: return 'production'
    if p.startswith('dev/stage-3d-hq1/') or p in DEV_TOOLS_CHANGED: return 'tooling'
    if '/' not in p and p.startswith('STAGE_3D_HQ1_'): return 'docs'
    return 'OUT OF SCOPE'
classes = {p: cls(p) for p in since_names}
outside = [p for p, c in classes.items() if c == 'OUT OF SCOPE']
built_unchanged = {f: not any(n == f for n in since_names) for f in ('ents.js', 'sim.js', 'index.html', 'ai.js', 'world.js', 'move.js', 'sfx.js', 'assets/l0-remaster.js', 'assets/ui.js', 'assets/net-interp.js')}
chain = [l for l in git('log', '--format=%H %T %s', '--reverse', f'{PARENT}..{commit}').splitlines()]
merges = [l for l in git('rev-list', '--merges', f'{PARENT}..{commit}').splitlines() if l]
first_parent = git('rev-parse', chain[0].split()[0] + '^').strip() if chain else None
anc = {k: isanc(v, commit) for k, v in ANC.items()}
remote_ok = (REMOTE['local']['commit'] == commit == REMOTE['lsRemote'] == REMOTE['githubApi']['commit'] and REMOTE['githubApi']['tree'] == tree
             and REMOTE['githubApi']['parents'] == [parent] and REMOTE.get('ok') is True)
U = REMOTE['untouched']; untouched_ok = all(v['ok'] for v in U.values()) and all(U.get(b, {}).get('ok') for b in ('stage-3h0', 'main', 'stage-3d'))
scope_ok = parent_tree == PARENT_TREE and first_parent == PARENT and all(anc.values()) and not merges and not outside and all(built_unchanged.values())
R = {'package': zpath.name, 'sha256': sha, 'bytes': zpath.stat().st_size, 'zipIntegrity': bad_zip is None, 'zipEntries': entries, 'parts': parts, 'partsJoinToTheZip': join_ok,
     'commit': commit, 'tree': tree, 'parentCommit': parent, 'filesInZip': len(files), 'filesInCommit': len(listing), 'missing': missing, 'extra': extra, 'contentMismatches': mism,
     'd7Parent': PARENT, 'd7ParentTree': parent_tree, 'firstCheckpointsParent': first_parent, 'ancestors': anc, 'checkpoints': chain, 'merges': merges, 'remote': REMOTE,
     'changedSinceD7': since, 'classes': {c: sum(v == c for v in classes.values()) for c in set(classes.values())}, 'outsideScope': outside, 'unchangedSinceD7': built_unchanged,
     'bundle': {'bundle == 3H0 bundle + apply_bundle edits': bundle_ok, 'edits': bundle_edits}, 'finalRegression': SUMMARY, 'shipped': shipped,
     'written': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
R['ok'] = bool(bad_zip is None and not missing and not extra and not mism and remote_ok and untouched_ok and scope_ok and bundle_ok and join_ok)   # the package and its source
R['finalRegressionOk'] = SUMMARY.get('ok') is True; R['finalRegressionNotMet'] = [l[5:] for l in SUMMARY.get('lines', []) if l.startswith('FAIL ')]
(OUT / 'receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
T = ['THE FAR BACKROOMS - Stage 3D HQ1 (wall blood + dying lights) - package and source verification receipt', '',
     f'written {R["written"]} by dev/stage-3d-hq1/package_hq1.py', '',
     '== Package ==', f'file       {zpath.name}', f'bytes      {R["bytes"]}', f'sha256     {sha}',
     f'zip CRCs   {"all OK (" + str(entries) + " entries tested)" if bad_zip is None else "BAD: " + bad_zip}', f'files      {len(files)} (the commit has {len(listing)})',
     f'parts      {len(parts)} of at most {PART_MIB} MiB (PARTS.sha256, JOIN_INSTRUCTIONS.txt); joined back they are the ZIP: {yn(join_ok)}',
     *[f'  {p["file"]:<64} {p["bytes"]:>10} bytes  {p["sha256"]}' for p in parts], '',
     '== Source revision (branch stage-3d-hq1, repository RoYoshi/backroomsproject) ==', f'commit     {commit}', f'subject    {git("log", "-1", "--format=%s", commit).strip()}',
     f'tree       {tree}', f'parent     {parent}',
     f'D7 parent  {PARENT} (tree {parent_tree}; as stated: {yn(parent_tree == PARENT_TREE)}; the first HQ1 commit\'s parent: {yn(first_parent == PARENT)})',
     *[f'ancestor: {k:<30} {yn(v)}' for k, v in anc.items()], '',
     '== HQ1 checkpoints (every commit after ffe2b53, oldest first: commit  tree  subject) ==', *[f'  {c}' for c in chain], f'  merges: {len(merges)} (a straight line)', '',
     '== GitHub (checked after the final push) ==', f'verified at       {REMOTE["verifiedAt"]}', f'git ls-remote     {REMOTE["lsRemote"]}',
     f'REST API commit   {REMOTE["githubApi"]["commit"]}', f'REST API tree     {REMOTE["githubApi"]["tree"]}', f'REST API parents  {", ".join(REMOTE["githubApi"]["parents"])}',
     f'matches the packaged commit, tree and parent: {yn(remote_ok)}', '',
     '== Branches (remote) ==', f'touched:   stage-3d-hq1  {REMOTE["lsRemote"]}  (new from ffe2b53; normal pushes only, never forced)',
     *[f'untouched: {b:<22} {v["remote"]}  {yn(v["ok"])}' for b, v in sorted(U.items(), key=lambda x: (x[0] not in ('main', 'stage-3d', 'stage-3h0'), x[0]))],
     f'new remote branches: {", ".join(REMOTE.get("newRemoteBranches") or []) or "none"}', '',
     '== The ZIP is exactly the commit (checked from the extracted ZIP) ==',
     f'files in ZIP {len(files)}, files in commit {len(listing)}; missing {len(missing)}, extra {len(extra)}, content mismatches {len(mism)}', '',
     f'== Scope (git diff --name-status {PARENT[:7]}..commit) ==',
     f'files changed since D7: {len(since)}: ' + ', '.join(f'{c} {n}' for c, n in sorted(R['classes'].items())),
     f'outside scope: {len(outside)}' + (' -> ' + ', '.join(outside) if outside else ''),
     'production files (the two corrections):', *[f'  {l:<34} {PRODUCTION[l.split(chr(9))[-1]]}' for l in since if l.split('\t')[-1] in PRODUCTION],
     'HQ1 documents:', *[f'  {l}' for l in since if classes[l.split(chr(9))[-1]] == 'docs'],
     f'tooling and evidence (dev/stage-3d-hq1/ and four dev/stage-3d tools): {sum(c == "tooling" for c in classes.values())} files', '',
     'unchanged since D7 (byte-identical):', *[f'  {f:<26} {yn(v)}' for f, v in built_unchanged.items()], '',
     '== The bundle is its source (from the ZIP) ==',
     f'  bundle == the 3H0 bundle + apply_bundle.py edits: {yn(bundle_ok)} ({len(bundle_edits)} edits, each parent text found exactly once: {yn(all(e["parentTextOnce"] for e in bundle_edits))})',
     *[f'    {e["checkpoint"]}: {e["what"]}' for e in bundle_edits], '',
     '== Final regression on the final source tree (dev/stage-3d-hq1/evidence/hq1-3/summary.json) ==', *[f'  {l}' for l in SUMMARY.get('lines', [])],
     f'  all gated lines as required: {yn(SUMMARY.get("ok") is True)}' + (f' - not met: {len(R["finalRegressionNotMet"])} (the FAIL lines above; STAGE_3D_HQ1_REPORT.md)' if R['finalRegressionNotMet'] else ''),
     f'  over a performance line (reported, not passed): {len(SUMMARY.get("over", []))}' + (' - see STAGE_3D_HQ1_PERFORMANCE.md' if SUMMARY.get('over') else ''), '',
      '== This receipt ==',
     '  It verifies the ZIP above, made by git archive from the commit above. It cannot be inside that commit (a commit cannot hold a',
     '  file that names its own hash), so it is delivered next to the ZIP, with the ZIP\'s .sha256 and the parts\' PARTS.sha256.', '',
     '== Shipped files (SHA-256, from the ZIP) ==', *[f'  {f:<28} {v["sha256"]}  {v["bytes"]} bytes' for f, v in shipped.items()], '',
     f'RESULT: the package and its source: {"VERIFIED" if R["ok"] else "PROBLEMS - see receipt.json"}; the final regression: ' + ('every gated line holds' if R['finalRegressionOk'] else f'{len(R["finalRegressionNotMet"])} gated line(s) not met, reported above and in STAGE_3D_HQ1_REPORT.md')]
(OUT / 'STAGE_3D_HQ1_PACKAGE_RECEIPT.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
