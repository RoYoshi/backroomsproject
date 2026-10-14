#!/usr/bin/env python3
"""Stage 3D HQ5 - the small human-QA overlay (BR-RoLE 1.2's one changed file, to copy over a clean HQ4 game) and its validation
(development only).

  python3 -I dev/stage-3d-hq5/overlay_hq5.py REPO COMMIT OUTDIR --qa FILE [--hq3zip ZIP --hq4overlay ZIP]

  COMMIT       the stage-3d-hq5 commit the overlay's game file is taken from (read from Git)
  --qa         the one-page human-QA guide that goes in the ZIP as HUMAN_QA.md
  --hq3zip     THE_FAR_BACKROOMS_STAGE_3D_HQ3_ADMIN_GIBBING_HUMAN_QA.zip and --hq4overlay HQ4_HUMAN_QA_OVERLAY.zip (optional): the folder
               the user most likely plays, rebuilt (the HQ3 human-QA extraction with HQ4's overlay copied over), checked as a target too

The overlay (OUTDIR/HQ5_BR_ROLE_1_2_HUMAN_QA_OVERLAY.zip), paths at the ZIP's root:
  HQ5_OVERLAY/assets/br-role.js      BR-RoLE 1.2 candidate (stage-3d-hq5): the Wanderer's ground contact
  REVERT_TO_HQ4/assets/br-role.js    HQ4's own file (stage-3d-hq4 79e1461), to undo it
  WHERE_TO_COPY.txt, OVERLAY_RECEIPT.txt (every file's SHA-256 and the checks below), HUMAN_QA.md
Validation, from the ZIP itself, on clean temporary folders:
  1. the ZIP's CRCs; its two game files byte-identical to Git (COMMIT and 79e1461);
  2. HQ5_OVERLAY copied over an export of stage-3d-hq4 79e1461: every runtime file byte-identical to COMMIT's, only br-role.js changed;
  3. (with --hq3zip/--hq4overlay) the HQ3 human-QA extraction + HQ4's overlay is byte-identical to HQ4 first; then the same as 2;
  4. REVERT_TO_HQ4 copied back over (2): every runtime file byte-identical to stage-3d-hq4 79e1461;
  5. the overlaid HQ4 export runs: its own server (synthetic admin passcode), a real page, no page error; BR-RoLE 1.2-candidate; the
     avatar has 7 parts (HQ4 fix A); under one fixture, at 8 headings, her cast starts at the body (18 px, HQ4 fix B) and she has a
     ground contact from that fixture; gore.js has HQ3 QA1's fix.
Writes the ZIP, its .sha256, OVERLAY_RECEIPT.txt and overlay_receipt.json in OUTDIR; exit 0 only if every check holds."""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time, zipfile, asyncio, math
from pathlib import Path
ap = argparse.ArgumentParser(); ap.add_argument('repo'); ap.add_argument('commit'); ap.add_argument('out'); ap.add_argument('--qa', required=True)
ap.add_argument('--hq3zip'); ap.add_argument('--hq4overlay'); A_ = ap.parse_args()
REPO, OUT = Path(A_.repo).resolve(), Path(A_.out).resolve()
HQ4 = '79e146124a5941c6578ef84dc9ff13176cc7f1f0'; HQ3_ZIP_SHA = '61ed1360ffd8327d57ff53e4040c19224aad23deb3cb96e8c436ee7dfdf493e8'
HQ4_OVERLAY_SHA = '753312cf26b84d4bc7ef84f7c720d004ee41c2cb0a98d2bb32db7b850fd684bd'
CHANGED = ['assets/br-role.js']; NAME = 'HQ5_BR_ROLE_1_2_HUMAN_QA_OVERLAY'
sha = lambda b: hashlib.sha256(b).hexdigest()
git = lambda *a: subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True).stdout
blob = lambda rev, p: git('show', f'{rev}:{p}')
commit = git('rev-parse', A_.commit).decode().strip(); tree = git('rev-parse', f'{commit}^{{tree}}').decode().strip(); hq4tree = git('rev-parse', f'{HQ4}^{{tree}}').decode().strip()
SERVE = re.compile(r'^(index\.html|camera_policy\.js|timing_policy\.js|world\.js|move\.js|ents\.js|mp\.js|hud\.js|gore\.js|dphys\.js|light\.js|glitch\.js|camcorder\.js|inventory\.js|sfx\.js|assets/[\w.\-]+)$')
SERVER = ['server.js', 'sim.js', 'death_srv.js', 'ai.js', 'world.js', 'package.json']
runtime = lambda p: bool(SERVE.match(p)) or p in SERVER or p.startswith('server/') or p.startswith('sounds/')
OUT.mkdir(parents=True, exist_ok=True)
lstree = lambda rev: {l.split('\t', 1)[1]: l.split('\t', 1)[0].split()[2] for l in git('ls-tree', '-r', rev).decode().splitlines()}
want, hq4t = lstree(commit), lstree(HQ4)
diff_rt = sorted(p for p in set(want) | set(hq4t) if runtime(p) and want.get(p) != hq4t.get(p))
assert diff_rt == CHANGED, f'runtime files changed since HQ4: {diff_rt} - the overlay would be incomplete; stop'

# ---------- the overlay's payload
game = {f'HQ5_OVERLAY/{p}': blob(commit, p) for p in CHANGED}
game.update({f'REVERT_TO_HQ4/{p}': blob(HQ4, p) for p in CHANGED})
ver = lambda b: (re.search(rb"const VERSION = '([^']+)'", b) or [None, b'?'])[1].decode()
role = {'HQ5_OVERLAY/assets/br-role.js': f'{ver(game["HQ5_OVERLAY/assets/br-role.js"])} (stage-3d-hq5): the Wanderer\'s ground contact',
        'REVERT_TO_HQ4/assets/br-role.js': f'{ver(game["REVERT_TO_HQ4/assets/br-role.js"])}, HQ4\'s own file (stage-3d-hq4 {HQ4[:7]}): copy it back to undo'}
where = f"""HQ5 / BR-RoLE 1.2 HUMAN-QA OVERLAY - where to copy

This overlay turns a clean HQ4 game into the HQ5 candidate (stage-3d-hq5, commit {commit[:7]}).  It changes ONE file: assets/br-role.js.

It is for an HQ4 game only - a folder that already has both HQ4 fixes:
  - the HQ3 human-QA game folder you copied the HQ4 overlay (HQ4_HUMAN_QA_OVERLAY.zip) into, or
  - a checkout / export of stage-3d-hq4 at {HQ4[:7]}.
Both were tested: after the copy every game file is byte-identical to stage-3d-hq5.  It does NOT apply to an HQ3 folder that never got the
HQ4 overlay: copy the HQ4 overlay first.  Do not use it on a game folder you have changed yourself.

1. Stop the server if it runs (Ctrl+C in its window).
2. Copy the CONTENTS of HQ5_OVERLAY into your game folder (the folder that holds server.js), replacing the file when asked:
     HQ5_OVERLAY/assets/br-role.js  ->  <game folder>/assets/br-role.js
3. Start it again with your own passcode, then reload every browser tab (Ctrl+F5 / Cmd+Shift+R):
     Windows (cmd):        set ADMIN_PASSCODE=<your own passcode>
                           node server.js 8000
     Windows (PowerShell): $env:ADMIN_PASSCODE="<your own passcode>"; node server.js 8000
     Linux / macOS:        ADMIN_PASSCODE=<your own passcode> node server.js 8000
   and open http://localhost:8000 (Node 18 or later).
   To check: with DEBUG MODE on in the admin panel, BR-RoLE's corner panel reads "br-role 1.2-candidate".

To undo: copy the CONTENTS of REVERT_TO_HQ4 the same way (one file).  Your game is then HQ4 again, byte for byte.
Or check out stage-3d-hq4.

Instead of the overlay you can check out the branch:  git checkout stage-3d-hq5  (commit {commit[:7]}) and start it the same way.
What to look at: HUMAN_QA.md.  File checksums: OVERLAY_RECEIPT.txt.
"""
qa = Path(A_.qa).read_bytes()


def build(receipt):
    zpath = OUT / f'{NAME}.zip'
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for k, b in game.items(): z.writestr(k, b)
        z.writestr('WHERE_TO_COPY.txt', where); z.writestr('OVERLAY_RECEIPT.txt', receipt); z.writestr('HUMAN_QA.md', qa)
    return zpath


def apply_overlay(zf, folder, dest):
    with zipfile.ZipFile(zf) as z:
        for n in z.namelist():
            if n.startswith(folder + '/') and not n.endswith('/'):
                t = dest / n[len(folder) + 1:]; t.parent.mkdir(parents=True, exist_ok=True); t.write_bytes(z.read(n))


ho = lambda f: subprocess.run(['git', 'hash-object', str(f)], check=True, capture_output=True, text=True).stdout.strip()


def runtime_vs(dest, ref):
    files_ = sorted(str(p.relative_to(dest)) for p in dest.rglob('*') if p.is_file() and runtime(str(p.relative_to(dest))))
    ref_rt = sorted(p for p in ref if runtime(p))
    mism = [p for p in files_ if p in ref and ho(dest / p) != ref[p]]
    return {'runtimeFiles': len(files_), 'runtimeInCommit': len(ref_rt), 'missing': sorted(set(ref_rt) - set(files_)), 'extra': sorted(set(files_) - set(ref_rt)), 'different': mism}


ok_rt = lambda r: not r['missing'] and not r['extra'] and not r['different']
R = {'commit': commit, 'tree': tree, 'hq4': {'commit': HQ4, 'tree': hq4tree}, 'runtimeChangedSinceHq4': diff_rt, 'checks': {}}
zpath = build('(the receipt is written after the checks)\n')
with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    # 1. integrity
    with zipfile.ZipFile(zpath) as z:
        bad = z.testzip(); same = {k: z.read(k) == b for k, b in game.items()}
    R['checks']['zip'] = {'crcFirstBad': bad, 'gameFilesEqualGit': same, 'ok': bad is None and all(same.values())}
    # 2. over a clean HQ4 export
    exp = td / 'hq4'; exp.mkdir(); subprocess.run(f'git -C "{REPO}" archive {HQ4} | tar -x -C "{exp}"', shell=True, check=True)
    pre = runtime_vs(exp, hq4t); before = {p: sha((exp / p).read_bytes()) for p in sorted(want) if runtime(p) and (exp / p).exists()}
    apply_overlay(zpath, 'HQ5_OVERLAY', exp); r2 = runtime_vs(exp, want)
    changed = sorted(p for p, h in before.items() if sha((exp / p).read_bytes()) != h)
    R['checks']['overHq4Export'] = dict(r2, hq4ExportWasHq4=ok_rt(pre), filesChangedByTheOverlay=changed, ok=ok_rt(pre) and ok_rt(r2) and changed == CHANGED)
    # 3. over the HQ3 human-QA extraction + HQ4's overlay (the folder the user plays)
    if A_.hq3zip and A_.hq4overlay:
        h3, h4 = Path(A_.hq3zip), Path(A_.hq4overlay); s3, s4 = sha(h3.read_bytes()), sha(h4.read_bytes())
        with zipfile.ZipFile(h3) as z: z.extractall(td / 'hq3zip')
        g = next(p for p in (td / 'hq3zip').iterdir() if p.is_dir())
        with zipfile.ZipFile(h4) as z:
            for n in z.namelist():
                pre4 = 'HQ4_HUMAN_QA_OVERLAY/HQ4_OVERLAY/'
                if n.startswith(pre4) and not n.endswith('/'): t = g / n[len(pre4):]; t.parent.mkdir(parents=True, exist_ok=True); t.write_bytes(z.read(n))
        asHq4 = runtime_vs(g, hq4t); apply_overlay(zpath, 'HQ5_OVERLAY', g); r3 = runtime_vs(g, want)
        R['checks']['overHq3ZipPlusHq4Overlay'] = dict(r3, hq3Zip={'sha256': s3, 'known': s3 == HQ3_ZIP_SHA}, hq4Overlay={'sha256': s4, 'known': s4 == HQ4_OVERLAY_SHA},
                                                      wasHq4BeforeHq5=ok_rt(asHq4), ok=s3 == HQ3_ZIP_SHA and s4 == HQ4_OVERLAY_SHA and ok_rt(asHq4) and ok_rt(r3))
    # 4. the revert
    rv = td / 'revert'; shutil.copytree(exp, rv); apply_overlay(zpath, 'REVERT_TO_HQ4', rv); r4 = runtime_vs(rv, hq4t)
    R['checks']['revertToHq4'] = dict(r4, ok=ok_rt(r4))
    # 5. the overlaid HQ4 export runs
    sys.path.insert(0, str(REPO / 'dev' / 'stage-3d-hq2')); import hq2lib as Q
    from playwright.async_api import async_playwright
    async def run():
        port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(str(exp), port, str(td / 'srv.log')); errs = []
        try:
            async with async_playwright() as p:
                b = await p.chromium.launch(args=Q.ARGS); ctx = await b.new_context(viewport={'width': 1280, 'height': 720})
                P = await Q.join(ctx, port, 'overlay5', 'Alice', errs, auth=True)
                await P.wait_for_timeout(800)
                info = await P.evaluate("""() => { const w = __api.floor().parent, a = w.children.find(c => typeof c.deathPose === 'function');
                    return { version: __brRole.version, parts: a.children.length, ellipse: !!a.children.find(c => c !== a.pack && c !== a.body && c !== a.hat && c !== a.wounds && c !== a.gear && !a.hands.includes(c)) } }""")
                if await P.evaluate("() => __api.lightOn()"): await P.keyboard.press('KeyF')
                L = await P.evaluate("() => [__api.lamps[2].x, __api.lamps[2].y]")
                await P.evaluate("([x, y]) => { __api.tp(x + 100, y); __brRole.setQuality('medium'); __brRole.dev.solo([2]); }", L); await P.wait_for_timeout(2500)
                starts, contacts = [], []
                for k in range(8):
                    t = k * math.pi / 4; c = await P.evaluate("() => { const w = __api.floor().parent, a = w.children.find(c => typeof c.deathPose === 'function'), g = a.toGlobal({ x: 0, y: 0 }); return [g.x, g.y] }")
                    await P.mouse.move(c[0] + 200 * math.cos(t), c[1] + 200 * math.sin(t)); await P.wait_for_timeout(500)
                    starts.append(await P.evaluate("() => (__brRole.actors() || []).filter(j => j.self && j.dominant).map(j => +j.start.toFixed(3))"))
                    contacts.append(await P.evaluate("() => (__brRole.dev.contacts() || []).filter(j => j.self).map(j => j.light + ':' + j.contact)"))
                errs_br = await P.evaluate("() => __brRole.stats().errors")
                await b.close()
                return {'page': info, 'castStarts': starts, 'contacts': contacts, 'brRoleErrors': errs_br, 'pageErrors': errs[:10]}
        finally:
            Q.lib3d.stop_server(srv)
    r5 = asyncio.run(run()); gore_ok = b'g.beginPath().arc(' in (exp / 'gore.js').read_bytes(); flat = [s for q in r5['castStarts'] for s in q]
    R['checks']['runs'] = dict(r5, goreHasQa1Fix=gore_ok, ok=not r5['pageErrors'] and not r5['brRoleErrors'] and r5['page']['version'] == 'br-role 1.2-candidate'
                               and r5['page']['parts'] == 7 and not r5['page']['ellipse'] and len(flat) == 8 and all(abs(s - 18) < 1e-6 for s in flat)
                               and all(any(c.startswith('L2:') for c in q) for q in r5['contacts']) and gore_ok)
R['ok'] = all(c['ok'] for c in R['checks'].values()); R['written'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
yn = lambda b: 'yes' if b else 'NO'
c = R['checks']
files = [f'  {sha(b)}  {k}  ({len(b)} bytes) - {role[k]}' for k, b in game.items()] + [f'  {sha(where.encode())}  WHERE_TO_COPY.txt', f'  {sha(qa)}  HUMAN_QA.md']
T = ['HQ5 / BR-RoLE 1.2 human-QA overlay - receipt', f'written {R["written"]} by dev/stage-3d-hq5/overlay_hq5.py', '',
     f'source    stage-3d-hq5 {commit} (tree {tree})', f'reverts   stage-3d-hq4 {HQ4} (tree {hq4tree})',
     f'game files changed since HQ4: {", ".join(diff_rt)} (nothing else)', '', 'files:', *files, '',
     f'1. ZIP CRCs good, its two game files byte-identical to Git: {yn(c["zip"]["ok"])}',
     f'2. HQ5_OVERLAY copied over a clean export of stage-3d-hq4 {HQ4[:7]}: {c["overHq4Export"]["runtimeFiles"]} runtime files byte-identical to stage-3d-hq5, the copy changed only {", ".join(c["overHq4Export"]["filesChangedByTheOverlay"])}: {yn(c["overHq4Export"]["ok"])}']
if 'overHq3ZipPlusHq4Overlay' in c:
    o = c['overHq3ZipPlusHq4Overlay']
    T.append(f'3. the HQ3 human-QA ZIP (known: {yn(o["hq3Zip"]["known"])}) with HQ4_HUMAN_QA_OVERLAY.zip (known: {yn(o["hq4Overlay"]["known"])}) copied over is HQ4 byte for byte: {yn(o["wasHq4BeforeHq5"])}; '
             f'HQ5_OVERLAY over it: byte-identical to stage-3d-hq5: {yn(o["ok"])}')
T += [f'4. REVERT_TO_HQ4 copied back: byte-identical to stage-3d-hq4 {HQ4[:7]}: {yn(c["revertToHq4"]["ok"])}',
      f'5. the overlaid HQ4 export runs: page errors {len(c["runs"]["pageErrors"])}, BR-RoLE errors {c["runs"]["brRoleErrors"]}; {c["runs"]["page"]["version"]}; avatar parts {c["runs"]["page"]["parts"]} (ellipse: {c["runs"]["page"]["ellipse"]}); '
      f'under one fixture at 8 headings: cast start {[q[0] if q else None for q in c["runs"]["castStarts"]]}, a ground contact from it every time: {yn(all(c["runs"]["contacts"]))}; gore.js QA1 fix {yn(c["runs"]["goreHasQa1Fix"])}: {yn(c["runs"]["ok"])}',
      '', f'OVERLAY CHECK: {"PASS" if R["ok"] else "FAIL"}']
receipt = '\n'.join(T) + '\n'
zpath = build(receipt)                                                       # the final ZIP: the same game files, with this receipt
with zipfile.ZipFile(zpath) as z:
    R['final'] = {'crcFirstBad': z.testzip(), 'gameFilesEqualGit': all(z.read(k) == b for k, b in game.items()), 'entries': z.namelist()}
R['ok'] = R['ok'] and R['final']['crcFirstBad'] is None and R['final']['gameFilesEqualGit']
zsha = sha(zpath.read_bytes()); R['zip'] = {'file': zpath.name, 'sha256': zsha, 'bytes': zpath.stat().st_size}
(OUT / f'{NAME}.zip.sha256').write_text(f'{zsha}  {zpath.name}\n')
(OUT / 'OVERLAY_RECEIPT.txt').write_text(receipt + f'\nthe ZIP itself: {zpath.name}  {zpath.stat().st_size} bytes  sha256 {zsha}\n')
(OUT / 'overlay_receipt.json').write_text(json.dumps(R, indent=1) + '\n')
print(receipt + f'\nZIP {zpath.name} {zpath.stat().st_size} bytes sha256 {zsha}; final CRC/bytes {yn(R["ok"])}'); sys.exit(0 if R['ok'] else 1)
