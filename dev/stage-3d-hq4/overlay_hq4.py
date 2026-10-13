#!/usr/bin/env python3
"""Stage 3D HQ4 - the small human-QA overlay: the runtime files HQ4 changes, to copy over an extracted HQ3 human-QA game, and its
validation on a clean extraction of that ZIP (development only).

  python3 -I dev/stage-3d-hq4/overlay_hq4.py REPO COMMIT HQ3_ZIP OUTDIR

  COMMIT   the stage-3d-hq4 commit the overlay is taken from (its files, read from Git)
  HQ3_ZIP  THE_FAR_BACKROOMS_STAGE_3D_HQ3_ADMIN_GIBBING_HUMAN_QA.zip (joined), SHA-256 61ed1360...93e8: the HQ3 human-QA package (commit
           486564d, before the HQ3 QA1 white-streak fix)

The overlay (OUTDIR/HQ4_HUMAN_QA_OVERLAY.zip):
  HQ4_OVERLAY/assets/index-DKbV5Nv9.js   HQ4 (fix A: no decorative ellipse)
  HQ4_OVERLAY/assets/br-role.js          HQ4 (fix B: the cast starts from the body)
  HQ4_OVERLAY/gore.js                    HQ3 QA1's own gore.js, unchanged (the white-streak fix the HQ3 ZIP predates); not an HQ4 edit
  REVERT_TO_HQ3_QA1/assets/...           HQ3 QA1's two files, to undo the overlay (gore.js stays QA1's)
  WHERE_TO_COPY.txt, MANIFEST.txt        what goes where, every file's SHA-256
Validation, each from the overlay ZIP itself, on clean temporary folders:
  1. the HQ3 ZIP's SHA-256 is the known one; it is extracted;
  2. HQ4_OVERLAY is copied over it: every runtime file (the server's, the served ones, the sounds) is then byte-identical to COMMIT's,
     and nothing else changed;
  3. the same over an export of the accepted HQ3 QA1 commit 4934319 (a checkout made after the fix): the same result;
  4. REVERT_TO_HQ3_QA1 copied back over (2): every runtime file is byte-identical to HQ3 QA1's (4934319);
  5. the overlaid HQ3 extraction runs: its own server (synthetic admin passcode), a real page, no page error; the Wanderer's avatar has
     7 parts (no ellipse); under one fixture, turned to 8 headings, BR-RoLE's cast for her starts at the body (18 px) every time;
     gore.js has the QA1 fix.
Writes the ZIP, its .sha256, OVERLAY_RECEIPT.txt; exit 0 only if every check holds."""
import hashlib, json, os, re, shutil, subprocess, sys, tempfile, time, zipfile, asyncio, math
from pathlib import Path
REPO, COMMIT, HQ3_ZIP, OUT = Path(sys.argv[1]).resolve(), sys.argv[2], Path(sys.argv[3]).resolve(), Path(sys.argv[4]).resolve()
HQ3_ZIP_SHA = '61ed1360ffd8327d57ff53e4040c19224aad23deb3cb96e8c436ee7dfdf493e8'
HQ3_QA1 = '49343193e6948c8323f35a34539ac84db5a89835'
CHANGED = ['assets/index-DKbV5Nv9.js', 'assets/br-role.js']; COMPAT = ['gore.js']
NAME = 'HQ4_HUMAN_QA_OVERLAY'
sha = lambda b: hashlib.sha256(b).hexdigest()
git = lambda *a: subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True).stdout
blob = lambda rev, p: git('show', f'{rev}:{p}')
commit = git('rev-parse', COMMIT).decode().strip(); tree = git('rev-parse', f'{COMMIT}^{{tree}}').decode().strip()
SERVE = re.compile(r'^(index\.html|camera_policy\.js|timing_policy\.js|world\.js|move\.js|ents\.js|mp\.js|hud\.js|gore\.js|dphys\.js|light\.js|glitch\.js|camcorder\.js|inventory\.js|sfx\.js|assets/[\w.\-]+)$')
SERVER = ['server.js', 'sim.js', 'death_srv.js', 'ai.js', 'world.js', 'package.json']
runtime = lambda p: bool(SERVE.match(p)) or p in SERVER or p.startswith('server/') or p.startswith('sounds/')
OUT.mkdir(parents=True, exist_ok=True)

# ---------- the overlay
files = {f'HQ4_OVERLAY/{p}': blob(commit, p) for p in CHANGED + COMPAT}
files.update({f'REVERT_TO_HQ3_QA1/{p}': blob(HQ3_QA1, p) for p in CHANGED})
role = {'assets/index-DKbV5Nv9.js': 'HQ4 - fix A: the Wanderer without the decorative dark ellipse', 'assets/br-role.js': 'HQ4 - fix B: the Wanderer\'s cast starts from the round body, never the hands',
        'gore.js': 'HQ3 QA1 baseline, UNCHANGED by HQ4 (the white-streak fix; your HQ3 ZIP predates it) - compatibility, not an HQ4 edit'}
assert files['HQ4_OVERLAY/gore.js'] == blob(HQ3_QA1, 'gore.js'), 'gore.js differs from HQ3 QA1 - stop'
manifest = ['HQ4 human-QA overlay - files, roles and SHA-256', f'source: RoYoshi/backroomsproject branch stage-3d-hq4, commit {commit} (tree {tree})',
            f'reverts to: stage-3d-hq3 commit {HQ3_QA1} (HQ3 QA1)', '']
for k, b in files.items():
    p = k.split('/', 1)[1]; manifest.append(f'{sha(b)}  {k}  ({len(b)} bytes) - ' + (role[p] if k.startswith('HQ4_OVERLAY/') else 'HQ3 QA1 original, to undo the overlay'))
where = f"""HQ4 HUMAN-QA OVERLAY - where to copy

This overlay turns an extracted HQ3 human-QA game into the HQ4 candidate (stage-3d-hq4, commit {commit[:7]}).
It works on either:
  - the folder you unzipped from THE_FAR_BACKROOMS_STAGE_3D_HQ3_ADMIN_GIBBING_HUMAN_QA.zip (with or without the QA1 gore.js copied in), or
  - a checkout / export of stage-3d-hq3 at {HQ3_QA1[:7]} (HQ3 QA1).
Both were tested: after the copy every game file is byte-identical to stage-3d-hq4.  Do not use it on a game folder you have changed yourself.

1. Stop the server if it runs (Ctrl+C in its window).
2. Copy the CONTENTS of HQ4_OVERLAY into your game folder (the folder that holds server.js), replacing files when asked:
     HQ4_OVERLAY/assets/index-DKbV5Nv9.js  ->  <game folder>/assets/index-DKbV5Nv9.js
     HQ4_OVERLAY/assets/br-role.js         ->  <game folder>/assets/br-role.js
     HQ4_OVERLAY/gore.js                   ->  <game folder>/gore.js   (HQ3 QA1's own file, unchanged: the white-streak fix)
3. Start it again with your own passcode, then reload every browser tab (Ctrl+F5 / Cmd+Shift+R):
     Windows (cmd):        set ADMIN_PASSCODE=<your own passcode>
                           node server.js 8000
     Windows (PowerShell): $env:ADMIN_PASSCODE="<your own passcode>"; node server.js 8000
     Linux / macOS:        ADMIN_PASSCODE=<your own passcode> node server.js 8000
   and open http://localhost:8000 (Node 18 or later).

To undo: copy the CONTENTS of REVERT_TO_HQ3_QA1 the same way (two files); gore.js stays QA1's.  Or re-extract the HQ3 ZIP and copy in
the QA1 gore.js.  Or check out stage-3d-hq3.
Check the files with MANIFEST.txt (SHA-256 of each)."""
zpath = OUT / f'{NAME}.zip'
with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
    for k, b in files.items(): z.writestr(f'{NAME}/{k}', b)
    z.writestr(f'{NAME}/WHERE_TO_COPY.txt', where + '\n'); z.writestr(f'{NAME}/MANIFEST.txt', '\n'.join(manifest) + '\n')
zsha = sha(zpath.read_bytes()); (OUT / f'{NAME}.zip.sha256').write_text(f'{zsha}  {zpath.name}\n')

# ---------- validation
R = {'overlay': zpath.name, 'sha256': zsha, 'bytes': zpath.stat().st_size, 'commit': commit, 'tree': tree, 'checks': {}}
want_tree = {l.split('\t', 1)[1]: l.split('\t', 1)[0].split()[2] for l in git('ls-tree', '-r', commit).decode().splitlines()}
qa1_tree = {l.split('\t', 1)[1]: l.split('\t', 1)[0].split()[2] for l in git('ls-tree', '-r', HQ3_QA1).decode().splitlines()}
ho = lambda f: subprocess.run(['git', 'hash-object', str(f)], check=True, capture_output=True, text=True).stdout.strip()


def apply_overlay(zf, folder, root, dest):
    with zipfile.ZipFile(zf) as z:
        for n in z.namelist():
            pre = f'{NAME}/{folder}/'
            if n.startswith(pre) and not n.endswith('/'):
                t = dest / n[len(pre):]; t.parent.mkdir(parents=True, exist_ok=True); t.write_bytes(z.read(n))


def runtime_vs(dest, ref):
    files_ = sorted(str(p.relative_to(dest)) for p in dest.rglob('*') if p.is_file() and runtime(str(p.relative_to(dest))))
    ref_rt = sorted(p for p in ref if runtime(p))
    mism = [p for p in files_ if p in ref and ho(dest / p) != ref[p]]
    return {'runtimeFiles': len(files_), 'runtimeInCommit': len(ref_rt), 'missing': sorted(set(ref_rt) - set(files_)), 'extra': sorted(set(files_) - set(ref_rt)), 'different': mism}


with tempfile.TemporaryDirectory() as td:
    td = Path(td); zs = sha(HQ3_ZIP.read_bytes()); R['hq3Zip'] = {'file': HQ3_ZIP.name, 'sha256': zs, 'known': zs == HQ3_ZIP_SHA}
    with zipfile.ZipFile(HQ3_ZIP) as z: z.extractall(td / 'hq3zip')
    game = next(p for p in (td / 'hq3zip').iterdir() if p.is_dir())
    before = {p: sha((game / p).read_bytes()) for p in CHANGED + COMPAT}
    apply_overlay(zpath, 'HQ4_OVERLAY', game, game)
    r2 = runtime_vs(game, want_tree); changed = [p for p in CHANGED + COMPAT if sha((game / p).read_bytes()) != before[p]]
    R['checks']['overHq3Zip'] = dict(r2, filesChangedByTheOverlay=changed, ok=R['hq3Zip']['known'] and not r2['missing'] and not r2['extra'] and not r2['different'])
    exp = td / 'qa1'; exp.mkdir(); subprocess.run(f'git -C "{REPO}" archive {HQ3_QA1} | tar -x -C "{exp}"', shell=True, check=True)
    apply_overlay(zpath, 'HQ4_OVERLAY', exp, exp); r3 = runtime_vs(exp, want_tree)
    R['checks']['overHq3Qa1Checkout'] = dict(r3, ok=not r3['missing'] and not r3['extra'] and not r3['different'])
    rv = td / 'revert'; shutil.copytree(game, rv); apply_overlay(zpath, 'REVERT_TO_HQ3_QA1', rv, rv); r4 = runtime_vs(rv, qa1_tree)
    R['checks']['revertToHq3Qa1'] = dict(r4, ok=not r4['missing'] and not r4['extra'] and not r4['different'])
    # 5. the overlaid HQ3 extraction runs
    sys.path.insert(0, str(REPO / 'dev' / 'stage-3d-hq2')); import hq2lib as Q
    from playwright.async_api import async_playwright
    async def run():
        port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(str(game), port, str(td / 'srv.log')); errs = []
        try:
            async with async_playwright() as p:
                b = await p.chromium.launch(args=Q.ARGS); ctx = await b.new_context(viewport={'width': 1280, 'height': 720})
                P = await Q.join(ctx, port, 'overlay', 'Alice', errs, auth=True)
                await P.wait_for_timeout(800)
                info = await P.evaluate("""() => { const w = __api.floor().parent, a = w.children.find(c => typeof c.deathPose === 'function');
                    return { parts: a.children.length, ellipse: !!a.children.find(c => c !== a.pack && c !== a.body && c !== a.hat && c !== a.wounds && c !== a.gear && !a.hands.includes(c)) } }""")
                if await P.evaluate("() => __api.lightOn()"): await P.keyboard.press('KeyF')
                L = await P.evaluate("() => [__api.lamps[2].x, __api.lamps[2].y]")
                await P.evaluate("([x, y]) => { __api.tp(x + 100, y); __brRole.setQuality('medium'); __brRole.dev.solo([2]); }", L); await P.wait_for_timeout(2500)
                starts = []
                for k in range(8):
                    t = k * math.pi / 4; c = await P.evaluate("() => { const w = __api.floor().parent, a = w.children.find(c => typeof c.deathPose === 'function'), g = a.toGlobal({ x: 0, y: 0 }); return [g.x, g.y] }")
                    await P.mouse.move(c[0] + 200 * math.cos(t), c[1] + 200 * math.sin(t)); await P.wait_for_timeout(500)
                    starts.append(await P.evaluate("() => (__brRole.actors() || []).filter(j => j.self && j.dominant).map(j => +j.start.toFixed(3))"))
                await b.close()
                return {'avatar': info, 'castStarts': starts, 'pageErrors': errs[:10]}
        finally:
            Q.lib3d.stop_server(srv)
    r5 = asyncio.run(run()); gore_ok = b'g.beginPath().arc(' in (game / 'gore.js').read_bytes()
    flat = [s for q in r5['castStarts'] for s in q]
    R['checks']['runs'] = dict(r5, goreHasQa1Fix=gore_ok, ok=not r5['pageErrors'] and r5['avatar']['parts'] == 7 and not r5['avatar']['ellipse'] and len(flat) == 8 and all(abs(s - 18) < 1e-6 for s in flat) and gore_ok)
R['ok'] = all(c['ok'] for c in R['checks'].values()); R['written'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
(OUT / 'overlay_receipt.json').write_text(json.dumps(R, indent=1) + '\n')
yn = lambda b: 'yes' if b else 'NO'
c = R['checks']
T = ['HQ4 human-QA overlay - receipt', f'written {R["written"]} by dev/stage-3d-hq4/overlay_hq4.py', '',
     f'overlay   {zpath.name}  {R["bytes"]} bytes  sha256 {zsha}', f'source    stage-3d-hq4 {commit} (tree {tree})', '', 'files:', *[f'  {l}' for l in manifest[4:]], '',
     f'1. HQ3 human-QA ZIP {HQ3_ZIP.name}: sha256 {zs} - the known one: {yn(R["hq3Zip"]["known"])}',
     f'2. overlay copied over its clean extraction: {c["overHq3Zip"]["runtimeFiles"]} runtime files, byte-identical to stage-3d-hq4: {yn(c["overHq3Zip"]["ok"])} (files the copy changed: {", ".join(c["overHq3Zip"]["filesChangedByTheOverlay"])})',
     f'3. overlay copied over an export of stage-3d-hq3 {HQ3_QA1[:7]} (HQ3 QA1): byte-identical to stage-3d-hq4: {yn(c["overHq3Qa1Checkout"]["ok"])}',
     f'4. REVERT_TO_HQ3_QA1 copied back: byte-identical to HQ3 QA1 ({HQ3_QA1[:7]}): {yn(c["revertToHq3Qa1"]["ok"])}',
     f'5. the overlaid HQ3 extraction runs: page errors {len(c["runs"]["pageErrors"])}; avatar parts {c["runs"]["avatar"]["parts"]} (ellipse: {c["runs"]["avatar"]["ellipse"]}); '
     f'cast start at 8 headings under one fixture {[q[0] if q else None for q in c["runs"]["castStarts"]]}; gore.js QA1 fix {yn(c["runs"]["goreHasQa1Fix"])}: {yn(c["runs"]["ok"])}',
     '', f'OVERLAY CHECK: {"PASS" if R["ok"] else "FAIL"}']
(OUT / 'OVERLAY_RECEIPT.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T)); sys.exit(0 if R['ok'] else 1)
