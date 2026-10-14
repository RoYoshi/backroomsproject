#!/usr/bin/env python3
"""Stage 3E-0 - the small B+ human-QA overlay (the game files B+ changes, to copy over a clean HQ5 game) and its validation (development only).

  python3 -I dev/stage-3e-0/overlay_e0.py REPO COMMIT OUTDIR --qa FILE [--hq3zip ZIP --hq4overlay ZIP --hq5overlay ZIP] [--ico SUPPLIED]

  COMMIT       the stage-3e-0 commit the overlay's game files are taken from (read from Git)
  --qa         the one-page human-QA guide that goes in the ZIP as HUMAN_QA.md
  --hq3zip/--hq4overlay/--hq5overlay (optional): the folder the user most likely plays, rebuilt (the HQ3 human-QA extraction, HQ4's overlay,
               then HQ5's), checked as a target too
  --ico        the user's SUPPLIED/favicon.ico: the overlay's favicon.ico must be it, byte for byte

The overlay (OUTDIR/STAGE_3E0_BPLUS_HUMAN_QA_OVERLAY.zip), paths at the ZIP's root:
  BPLUS_OVERLAY/...      every game file B+ changes or adds (stage-3e-0), at its path in the game folder
  REVERT_TO_HQ5/...      HQ5's own copies of the changed ones (stage-3d-hq5 ad98475); the added favicon.ico is deleted to undo
  WHERE_TO_COPY.txt, OVERLAY_RECEIPT.txt (every file's SHA-256 and the checks below), HUMAN_QA.md,
  BPLUS_SOURCE.diff      git diff ad98475 COMMIT of exactly those game files (the icon shows as a binary file)
Validation, from the ZIP itself, on clean temporary folders:
  1. the ZIP's CRCs; its game files byte-identical to Git (COMMIT and ad98475); favicon.ico = the supplied icon;
  2. BPLUS_OVERLAY copied over an export of stage-3d-hq5 ad98475: every runtime file byte-identical to COMMIT's, only the listed ones changed;
  3. (with the three ZIPs) the HQ3 extraction + HQ4's overlay + HQ5's overlay is HQ5 byte for byte; then the same as 2;
  4. REVERT_TO_HQ5 copied back and favicon.ico deleted: every runtime file byte-identical to stage-3d-hq5 ad98475;
  5. the overlaid HQ5 export runs: its own server (synthetic admin passcode), two real pages, no page error; GET /favicon.ico 200,
     image/x-icon, the supplied bytes; the page names it once; each page asks for and gets the fresher poses (B+); when Alice walks, Bob's
     page applies her 'q' and draws her where its own copy says; BR-RoLE still br-role 1.2-candidate.
Writes the ZIP, its .sha256, OVERLAY_RECEIPT.txt and overlay_receipt.json in OUTDIR; exit 0 only if every check holds."""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time, zipfile, asyncio, math, urllib.request
from pathlib import Path
ap = argparse.ArgumentParser(); ap.add_argument('repo'); ap.add_argument('commit'); ap.add_argument('out'); ap.add_argument('--qa', required=True)
ap.add_argument('--hq3zip'); ap.add_argument('--hq4overlay'); ap.add_argument('--hq5overlay'); ap.add_argument('--ico'); A_ = ap.parse_args()
REPO, OUT = Path(A_.repo).resolve(), Path(A_.out).resolve()
HQ5 = 'ad98475767bcae6794cd01af832de660355da7a2'; HQ3_ZIP_SHA = '61ed1360ffd8327d57ff53e4040c19224aad23deb3cb96e8c436ee7dfdf493e8'
HQ4_OVERLAY_SHA = '753312cf26b84d4bc7ef84f7c720d004ee41c2cb0a98d2bb32db7b850fd684bd'; HQ5_OVERLAY_SHA = '7fab41b91a0704926a9883149d351f851e940355718cb2c5c744d45147c3bbda'
NAME = 'STAGE_3E0_BPLUS_HUMAN_QA_OVERLAY'
sha = lambda b: hashlib.sha256(b).hexdigest()
git = lambda *a: subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True).stdout
blob = lambda rev, p: git('show', f'{rev}:{p}')
commit = git('rev-parse', A_.commit).decode().strip(); tree = git('rev-parse', f'{commit}^{{tree}}').decode().strip(); hq5tree = git('rev-parse', f'{HQ5}^{{tree}}').decode().strip()
SERVE = re.compile(r'^(index\.html|favicon\.ico|camera_policy\.js|timing_policy\.js|world\.js|move\.js|ents\.js|mp\.js|hud\.js|gore\.js|dphys\.js|light\.js|glitch\.js|camcorder\.js|inventory\.js|sfx\.js|assets/[\w.\-]+)$')
SERVER = ['server.js', 'sim.js', 'death_srv.js', 'ai.js', 'world.js', 'package.json']
runtime = lambda p: bool(SERVE.match(p)) or p in SERVER or p.startswith('server/') or p.startswith('sounds/')
OUT.mkdir(parents=True, exist_ok=True)
lstree = lambda rev: {l.split('\t', 1)[1]: l.split('\t', 1)[0].split()[2] for l in git('ls-tree', '-r', rev).decode().splitlines()}
want, hq5t = lstree(commit), lstree(HQ5)
CHANGED = sorted(p for p in set(want) | set(hq5t) if runtime(p) and want.get(p) != hq5t.get(p))
ADDED = [p for p in CHANGED if p not in hq5t]; REMOVED = [p for p in CHANGED if p not in want]
assert not REMOVED, f'B+ removes runtime files {REMOVED}: an overlay cannot do that; stop'
game = {f'BPLUS_OVERLAY/{p}': blob(commit, p) for p in CHANGED}
game.update({f'REVERT_TO_HQ5/{p}': blob(HQ5, p) for p in CHANGED if p not in ADDED})
role = {'index.html': 'one line: <link rel="icon" type="image/x-icon" href="./favicon.ico">', 'favicon.ico': 'NEW: your supplied icon, byte for byte',
        'server/static.js': 'serves /favicon.ico (image/x-icon) and nothing else new', 'mp.js': 'B: the others eased by elapsed time; B+: their fresher poses; ?peers=a|b DEV comparison',
        'server.js': "B+: the player-only 'q' between snapshots and 16 ms pose spacing, for clients that ask ('caps')"}
where = f"""STAGE 3E-0 B+ HUMAN-QA OVERLAY - where to copy

This overlay turns a clean HQ5 game into the B+ candidate (stage-3e-0, commit {commit[:7]}).  It changes {len(CHANGED) - len(ADDED)} files and adds {len(ADDED)}:
{chr(10).join('  ' + p + ('   (new)' if p in ADDED else '') for p in CHANGED)}

It is for an HQ5 game only - a folder that already has BR-RoLE 1.2:
  - the game folder you copied the HQ5 overlay (HQ5_BR_ROLE_1_2_HUMAN_QA_OVERLAY.zip) into, or
  - a checkout / export of stage-3d-hq5 at {HQ5[:7]}.
Both were tested: after the copy every game file is byte-identical to stage-3e-0.  It does NOT apply to an older folder: bring it to HQ5 first.
Do not use it on a game folder you have changed yourself.  The server files change too, so the server must be restarted.

1. Stop the server (Ctrl+C in its window).
2. Copy the CONTENTS of BPLUS_OVERLAY into your game folder (the folder that holds server.js), replacing files when asked.
3. Start it again with your own passcode, then reload every browser tab (Ctrl+F5 / Cmd+Shift+R) - every player needs the new page:
     Windows (cmd):        set ADMIN_PASSCODE=<your own passcode>
                           node server.js 8000
     Windows (PowerShell): $env:ADMIN_PASSCODE="<your own passcode>"; node server.js 8000
     Linux / macOS:        ADMIN_PASSCODE=<your own passcode> node server.js 8000
   and open http://localhost:8000 (Node 18 or later).  The tab shows your icon (a browser may keep an old tab icon until a hard reload or a
   new private window).
4. To compare, a page opened with ?peers=a shows the others exactly as HQ5 did, ?peers=b with the new easing but HQ5's 20 Hz poses
   (e.g. http://localhost:8000/?peers=a).  It changes that page only.

To undo: stop the server, copy the CONTENTS of REVERT_TO_HQ5 the same way and DELETE favicon.ico from the game folder.  The game is then HQ5
again, byte for byte.  Or check out stage-3d-hq5.

Instead of the overlay you can check out the branch:  git checkout stage-3e-0  (commit {commit[:7]}) and start it the same way.
What to look at: HUMAN_QA.md.  File checksums: OVERLAY_RECEIPT.txt.  The source change itself: BPLUS_SOURCE.diff.
"""
qa = Path(A_.qa).read_bytes()
src_diff = git('diff', '--no-color', '--no-ext-diff', HQ5, commit, '--', *CHANGED)


def build(receipt):
    zpath = OUT / f'{NAME}.zip'
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for k, b in game.items(): z.writestr(k, b)
        z.writestr('WHERE_TO_COPY.txt', where); z.writestr('OVERLAY_RECEIPT.txt', receipt); z.writestr('HUMAN_QA.md', qa); z.writestr('BPLUS_SOURCE.diff', src_diff)
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
R = {'commit': commit, 'tree': tree, 'hq5': {'commit': HQ5, 'tree': hq5tree}, 'changed': CHANGED, 'added': ADDED, 'checks': {}}
zpath = build('(the receipt is written after the checks)\n')
with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    with zipfile.ZipFile(zpath) as z:
        bad = z.testzip(); same = {k: z.read(k) == b for k, b in game.items()}
    ico_ok = (not A_.ico) or game.get('BPLUS_OVERLAY/favicon.ico') == Path(A_.ico).read_bytes()
    R['checks']['zip'] = {'crcFirstBad': bad, 'gameFilesEqualGit': same, 'faviconIsSupplied': ico_ok, 'ok': bad is None and all(same.values()) and ico_ok}
    exp = td / 'hq5'; exp.mkdir(); subprocess.run(f'git -C "{REPO}" archive {HQ5} | tar -x -C "{exp}"', shell=True, check=True)
    pre = runtime_vs(exp, hq5t); before = {str(p.relative_to(exp)): sha(p.read_bytes()) for p in exp.rglob('*') if p.is_file() and runtime(str(p.relative_to(exp)))}
    apply_overlay(zpath, 'BPLUS_OVERLAY', exp); r2 = runtime_vs(exp, want)
    after = {str(p.relative_to(exp)): sha(p.read_bytes()) for p in exp.rglob('*') if p.is_file() and runtime(str(p.relative_to(exp)))}
    changed = sorted(p for p in set(before) | set(after) if before.get(p) != after.get(p))
    R['checks']['overHq5Export'] = dict(r2, hq5ExportWasHq5=ok_rt(pre), filesChangedByTheOverlay=changed, ok=ok_rt(pre) and ok_rt(r2) and changed == CHANGED)
    if A_.hq3zip and A_.hq4overlay and A_.hq5overlay:
        h3, h4, h5 = Path(A_.hq3zip), Path(A_.hq4overlay), Path(A_.hq5overlay); s3, s4, s5 = sha(h3.read_bytes()), sha(h4.read_bytes()), sha(h5.read_bytes())
        with zipfile.ZipFile(h3) as z: z.extractall(td / 'hq3zip')
        g = next(p for p in (td / 'hq3zip').iterdir() if p.is_dir())
        for zf, pre_ in ((h4, 'HQ4_HUMAN_QA_OVERLAY/HQ4_OVERLAY/'), (h5, 'HQ5_OVERLAY/')):
            with zipfile.ZipFile(zf) as z:
                for n in z.namelist():
                    if n.startswith(pre_) and not n.endswith('/'): t = g / n[len(pre_):]; t.parent.mkdir(parents=True, exist_ok=True); t.write_bytes(z.read(n))
        asHq5 = runtime_vs(g, hq5t); apply_overlay(zpath, 'BPLUS_OVERLAY', g); r3 = runtime_vs(g, want)
        R['checks']['overHq3Hq4Hq5Chain'] = dict(r3, zips={'hq3': s3 == HQ3_ZIP_SHA, 'hq4overlay': s4 == HQ4_OVERLAY_SHA, 'hq5overlay': s5 == HQ5_OVERLAY_SHA}, wasHq5BeforeBplus=ok_rt(asHq5),
                                                 ok=s3 == HQ3_ZIP_SHA and s4 == HQ4_OVERLAY_SHA and s5 == HQ5_OVERLAY_SHA and ok_rt(asHq5) and ok_rt(r3))
    rv = td / 'revert'; shutil.copytree(exp, rv); apply_overlay(zpath, 'REVERT_TO_HQ5', rv)
    for p in ADDED: (rv / p).unlink()
    r4 = runtime_vs(rv, hq5t); R['checks']['revertToHq5'] = dict(r4, deleted=ADDED, ok=ok_rt(r4))
    sys.path.insert(0, str(REPO / 'dev' / 'stage-3d-hq2')); import hq2lib as Q
    from playwright.async_api import async_playwright
    async def run():
        port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(str(exp), port, str(td / 'srv.log')); errs = []
        try:
            fav = urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{port}/favicon.ico', headers={'Accept-Encoding': 'identity'}), timeout=10)
            fb = fav.read(); fv = {'status': fav.status, 'type': fav.headers.get('Content-Type'), 'sameBytes': (not A_.ico) or fb == Path(A_.ico).read_bytes()}
            async with async_playwright() as p:
                b = await p.chromium.launch(args=Q.ARGS)
                ca, cb = [await b.new_context(viewport={'width': 480, 'height': 320}) for _ in range(2)]
                A = await Q.join(ca, port, 'overlay-e0', 'Alice', errs, auth=True); B = await Q.join(cb, port, 'overlay-e0', 'Bob', errs, auth=True)
                for P in (A, B): await P.evaluate("() => window.__brRole && __brRole.setQuality('low')")
                pa = await A.evaluate("() => [__api.H.x, __api.H.y]"); await B.evaluate("([x, y]) => __api.tp(x, y + 90)", pa); await B.wait_for_timeout(1500)
                q0 = await B.evaluate("() => __peerNet().counts.qApplied")
                await A.keyboard.down('KeyD'); await A.wait_for_timeout(1500); await A.keyboard.up('KeyD'); await A.wait_for_timeout(600)
                info = {'version': await B.evaluate("() => __brRole.version"), 'bob': await B.evaluate("() => { const n = __peerNet(); return { mode: n.mode, fast: n.fast, counts: n.counts } }"),
                        'alice': await A.evaluate("() => { const n = __peerNet(); return { mode: n.mode, fast: n.fast } }"),
                        'iconLinks': await B.evaluate("() => [...document.querySelectorAll('link[rel=\"icon\"]')].map(l => l.getAttribute('href'))"), 'qBefore': q0}
                await b.close()
                return {'favicon': fv, 'pages': info, 'pageErrors': errs[:10]}
        finally:
            Q.lib3d.stop_server(srv)
    r5 = asyncio.run(run()); pg = r5['pages']
    R['checks']['runs'] = dict(r5, ok=not r5['pageErrors'] and r5['favicon']['status'] == 200 and r5['favicon']['type'] == 'image/x-icon' and r5['favicon']['sameBytes']
                               and pg['iconLinks'] == ['./favicon.ico'] and pg['bob']['mode'] == 'bplus' and pg['bob']['fast'] and pg['alice']['fast']
                               and pg['bob']['counts']['qApplied'] > pg['qBefore'] and pg['version'] == 'br-role 1.2-candidate')
R['ok'] = all(c['ok'] for c in R['checks'].values()); R['written'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
yn = lambda b: 'yes' if b else 'NO'
c = R['checks']
files = [f'  {sha(b)}  {k}  ({len(b)} bytes) - ' + (role.get(k.split('/', 1)[1], '') if k.startswith('BPLUS_OVERLAY/') else 'HQ5\'s own file, to undo') for k, b in game.items()] + \
        [f'  {sha(where.encode())}  WHERE_TO_COPY.txt', f'  {sha(qa)}  HUMAN_QA.md', f'  {sha(src_diff)}  BPLUS_SOURCE.diff  (git diff {HQ5[:7]} {commit[:7]} of the files above)']
T = ['Stage 3E-0 B+ human-QA overlay - receipt', f'written {R["written"]} by dev/stage-3e-0/overlay_e0.py', '',
     f'source    stage-3e-0 {commit} (tree {tree})', f'reverts   stage-3d-hq5 {HQ5} (tree {hq5tree})',
     f'game files changed since HQ5: {", ".join(p + (" (new)" if p in ADDED else "") for p in CHANGED)} (nothing else)', '', 'files:', *files, '',
     f'1. ZIP CRCs good, its game files byte-identical to Git, favicon.ico = your supplied icon: {yn(c["zip"]["ok"])}',
     f'2. BPLUS_OVERLAY copied over a clean export of stage-3d-hq5 {HQ5[:7]}: {c["overHq5Export"]["runtimeFiles"]} runtime files byte-identical to stage-3e-0, the copy changed only {", ".join(c["overHq5Export"]["filesChangedByTheOverlay"])}: {yn(c["overHq5Export"]["ok"])}']
if 'overHq3Hq4Hq5Chain' in c:
    o = c['overHq3Hq4Hq5Chain']
    T.append(f'3. the HQ3 human-QA ZIP + HQ4_HUMAN_QA_OVERLAY.zip + HQ5_BR_ROLE_1_2_HUMAN_QA_OVERLAY.zip (all the known ones: {yn(all(o["zips"].values()))}) is HQ5 byte for byte: {yn(o["wasHq5BeforeBplus"])}; '
             f'BPLUS_OVERLAY over it: byte-identical to stage-3e-0: {yn(o["ok"])}')
T += [f'4. REVERT_TO_HQ5 copied back and {", ".join(ADDED)} deleted: byte-identical to stage-3d-hq5 {HQ5[:7]}: {yn(c["revertToHq5"]["ok"])}',
      f'5. the overlaid HQ5 export runs: page errors {len(c["runs"]["pageErrors"])}; GET /favicon.ico {c["runs"]["favicon"]["status"]} {c["runs"]["favicon"]["type"]}, your bytes: {yn(c["runs"]["favicon"]["sameBytes"])}; '
      f'the page names it once: {yn(c["runs"]["pages"]["iconLinks"] == ["./favicon.ico"])}; both pages get the fresher poses: {yn(c["runs"]["pages"]["bob"]["fast"] and c["runs"]["pages"]["alice"]["fast"])}; '
      f"Bob's page applied Alice's 'q' while she walked: {c['runs']['pages']['bob']['counts']['qApplied'] - c['runs']['pages']['qBefore']}; {c['runs']['pages']['version']}: {yn(c['runs']['ok'])}",
      '', f'OVERLAY CHECK: {"PASS" if R["ok"] else "FAIL"}']
receipt = '\n'.join(T) + '\n'
zpath = build(receipt)
with zipfile.ZipFile(zpath) as z:
    R['final'] = {'crcFirstBad': z.testzip(), 'gameFilesEqualGit': all(z.read(k) == b for k, b in game.items()), 'entries': z.namelist()}
R['ok'] = R['ok'] and R['final']['crcFirstBad'] is None and R['final']['gameFilesEqualGit']
zsha = sha(zpath.read_bytes()); R['zip'] = {'file': zpath.name, 'sha256': zsha, 'bytes': zpath.stat().st_size}
(OUT / f'{NAME}.zip.sha256').write_text(f'{zsha}  {zpath.name}\n')
(OUT / 'OVERLAY_RECEIPT.txt').write_text(receipt + f'\nthe ZIP itself: {zpath.name}  {zpath.stat().st_size} bytes  sha256 {zsha}\n')
(OUT / 'overlay_receipt.json').write_text(json.dumps(R, indent=1) + '\n')
print(receipt + f'\nZIP {zpath.name} {zpath.stat().st_size} bytes sha256 {zsha}; final CRC/bytes {yn(R["ok"])}'); sys.exit(0 if R['ok'] else 1)
