#!/usr/bin/env python3
"""Stage 3E-0 B++ - the small B++ human-QA overlay (the game files B++ changes, to copy over the accepted B+ game) and its validation
(development only).

  python3 -I dev/stage-3e-0-bpp/overlay_bpp.py REPO COMMIT OUTDIR --qa FILE --bplus-overlay ZIP [--ico SUPPLIED]

  COMMIT           the stage-3e-0-bplusplus commit the overlay's game files are taken from (read from Git)
  --qa             the one-page human-QA guide that goes in the ZIP as HUMAN_QA.md
  --bplus-overlay  STAGE_3E0_BPLUS_HUMAN_QA_OVERLAY.zip (the accepted B+ delivery): HQ5 + it = the folder the user most likely plays
  --ico            the user's SUPPLIED/favicon.ico: it must still be served byte for byte

The overlay (OUTDIR/BPLUSPLUS_HUMAN_QA_OVERLAY.zip), paths at the ZIP's root:
  BPLUSPLUS_OVERLAY/...  every game file B++ changes (stage-3e-0-bplusplus), at its path in the game folder
  REVERT_TO_BPLUS/...    the accepted B+ copies of the same files (stage-3e-0 1f2deba)
  WHERE_TO_COPY.txt, OVERLAY_RECEIPT.txt (every file's SHA-256 and the checks below), HUMAN_QA.md,
  BPLUSPLUS_SOURCE.diff  git diff 1f2deba COMMIT of exactly those game files
Validation, from the ZIP itself, on clean temporary folders:
  1. the ZIP's CRCs; its game files byte-identical to Git (COMMIT and 1f2deba); B++ adds and removes no game file; favicon.ico is B+'s
     own and the supplied icon;
  2. BPLUSPLUS_OVERLAY copied over an export of the accepted B+ (1f2deba): every runtime file byte-identical to COMMIT's, only the listed
     ones changed;
  3. (with --bplus-overlay) an export of HQ5 + the B+ overlay ZIP (its SHA-256 checked) is B+ byte for byte; then the same as 2;
  4. REVERT_TO_BPLUS copied back: every runtime file byte-identical to the accepted B+;
  5. the overlaid B+ folder runs: its own server (synthetic admin passcode), two real pages, no page error; GET /favicon.ico 200,
     image/x-icon, the supplied bytes; both pages get the fresher poses and Bob's page applies Alice's 'q' while she walks; BR-RoLE
     still br-role 1.2-candidate; and the placement race: Bob brought to (504, 888), then 2 s later to (1012, 690) - 545 px, the case
     B+ lost 6 of 6 on real pages - his page and the server (as Alice's page has him) end at (1012, 690).
Writes the ZIP, its .sha256, OVERLAY_RECEIPT.txt and overlay_receipt.json in OUTDIR; exit 0 only if every check holds."""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time, zipfile, asyncio, urllib.request
from pathlib import Path
ap = argparse.ArgumentParser(); ap.add_argument('repo'); ap.add_argument('commit'); ap.add_argument('out'); ap.add_argument('--qa', required=True)
ap.add_argument('--bplus-overlay', dest='bplus_overlay'); ap.add_argument('--ico'); A_ = ap.parse_args()
REPO, OUT = Path(A_.repo).resolve(), Path(A_.out).resolve()
BPLUS = '1f2deba0fc4a1facd41366fb2da9b88af3bd5a52'; HQ5 = 'ad98475767bcae6794cd01af832de660355da7a2'
BPLUS_OVERLAY_SHA = '139f4664645825792de54cba2d57cf084adca4546676a7b4e115ec03806e349e'
NAME = 'BPLUSPLUS_HUMAN_QA_OVERLAY'
sha = lambda b: hashlib.sha256(b).hexdigest()
git = lambda *a: subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True).stdout
blob = lambda rev, p: git('show', f'{rev}:{p}')
commit = git('rev-parse', A_.commit).decode().strip(); tree = git('rev-parse', f'{commit}^{{tree}}').decode().strip(); btree = git('rev-parse', f'{BPLUS}^{{tree}}').decode().strip()
SERVE = re.compile(r'^(index\.html|favicon\.ico|camera_policy\.js|timing_policy\.js|world\.js|move\.js|ents\.js|mp\.js|hud\.js|gore\.js|dphys\.js|light\.js|glitch\.js|camcorder\.js|inventory\.js|sfx\.js|assets/[\w.\-]+)$')
SERVER = ['server.js', 'sim.js', 'death_srv.js', 'ai.js', 'world.js', 'package.json']
runtime = lambda p: bool(SERVE.match(p)) or p in SERVER or p.startswith('server/') or p.startswith('sounds/')
OUT.mkdir(parents=True, exist_ok=True)
lstree = lambda rev: {l.split('\t', 1)[1]: l.split('\t', 1)[0].split()[2] for l in git('ls-tree', '-r', rev).decode().splitlines()}
want, bt = lstree(commit), lstree(BPLUS)
CHANGED = sorted(p for p in set(want) | set(bt) if runtime(p) and want.get(p) != bt.get(p))
ADDED = [p for p in CHANGED if p not in bt]; REMOVED = [p for p in CHANGED if p not in want]
assert CHANGED and not ADDED and not REMOVED, f'B++ changes {CHANGED}, adds {ADDED}, removes {REMOVED}: not expected; stop'
CLIENT = [p for p in CHANGED if SERVE.match(p)]
game = {f'BPLUSPLUS_OVERLAY/{p}': blob(commit, p) for p in CHANGED}
game.update({f'REVERT_TO_BPLUS/{p}': blob(BPLUS, p) for p in CHANGED})
role = {'server.js': "B++-0: a pose sent before a server placement (teleport, world reset) can no longer undo it"}
where = f"""STAGE 3E-0 B++ HUMAN-QA OVERLAY - where to copy

This overlay turns the ACCEPTED B+ game into the B++ candidate (stage-3e-0-bplusplus, commit {commit[:7]}).  It changes {len(CHANGED)} file{'s' if len(CHANGED) != 1 else ''}:
{chr(10).join('  ' + p for p in CHANGED)}
{'No file the browser loads changes: the pages stay exactly B+; only the server changes.' if not CLIENT else 'Page files change too: reload every tab.'}

It is for a B+ game only:
  - the game folder you copied the B+ overlay (STAGE_3E0_BPLUS_HUMAN_QA_OVERLAY.zip) into, or
  - a checkout / export of stage-3e-0 at {BPLUS[:7]}.
Both were tested: after the copy every game file is byte-identical to stage-3e-0-bplusplus.  Do not use it on an older folder (bring it
to B+ first) or on a folder you have changed yourself.

1. Stop the server (Ctrl+C in its window).
2. Copy the CONTENTS of BPLUSPLUS_OVERLAY into your game folder (the folder that holds server.js), replacing files when asked.
3. Start it again with your own passcode, then reload every browser tab (Ctrl+F5 / Cmd+Shift+R) so every page reconnects:
     Windows (cmd):        set ADMIN_PASSCODE=<your own passcode>
                           node server.js 8000
     Windows (PowerShell): $env:ADMIN_PASSCODE="<your own passcode>"; node server.js 8000
     Linux / macOS:        ADMIN_PASSCODE=<your own passcode> node server.js 8000
   and open http://localhost:8000 (Node 18 or later).

To undo: stop the server, copy the CONTENTS of REVERT_TO_BPLUS the same way and start it again.  The game is then the accepted B+ again,
byte for byte.  Or check out stage-3e-0.

Instead of the overlay you can check out the branch:  git checkout stage-3e-0-bplusplus  (commit {commit[:7]}) and start it the same way.
What to look at: HUMAN_QA.md.  File checksums: OVERLAY_RECEIPT.txt.  The source change itself: BPLUSPLUS_SOURCE.diff.
"""
qa = Path(A_.qa).read_bytes()
src_diff = git('diff', '--no-color', '--no-ext-diff', BPLUS, commit, '--', *CHANGED)


def build(receipt):
    zpath = OUT / f'{NAME}.zip'
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for k, b in game.items(): z.writestr(k, b)
        z.writestr('WHERE_TO_COPY.txt', where); z.writestr('OVERLAY_RECEIPT.txt', receipt); z.writestr('HUMAN_QA.md', qa); z.writestr('BPLUSPLUS_SOURCE.diff', src_diff)
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
snap = lambda d: {str(p.relative_to(d)): sha(p.read_bytes()) for p in d.rglob('*') if p.is_file() and runtime(str(p.relative_to(d)))}
R = {'commit': commit, 'tree': tree, 'bplus': {'commit': BPLUS, 'tree': btree}, 'changed': CHANGED, 'clientFilesChanged': CLIENT, 'checks': {}}
zpath = build('(the receipt is written after the checks)\n')
with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    with zipfile.ZipFile(zpath) as z:
        bad = z.testzip(); same = {k: z.read(k) == b for k, b in game.items()}
    ico_ok = (not A_.ico) or (want.get('favicon.ico') == bt.get('favicon.ico') and blob(commit, 'favicon.ico') == Path(A_.ico).read_bytes())
    R['checks']['zip'] = {'crcFirstBad': bad, 'gameFilesEqualGit': same, 'faviconUnchangedAndSupplied': ico_ok, 'ok': bad is None and all(same.values()) and ico_ok}
    exp = td / 'bplus'; exp.mkdir(); subprocess.run(f'git -C "{REPO}" archive {BPLUS} | tar -x -C "{exp}"', shell=True, check=True)
    pre = runtime_vs(exp, bt); before = snap(exp)
    apply_overlay(zpath, 'BPLUSPLUS_OVERLAY', exp); r2 = runtime_vs(exp, want); after = snap(exp)
    changed = sorted(p for p in set(before) | set(after) if before.get(p) != after.get(p))
    R['checks']['overBplusExport'] = dict(r2, bplusExportWasBplus=ok_rt(pre), filesChangedByTheOverlay=changed, ok=ok_rt(pre) and ok_rt(r2) and changed == CHANGED)
    if A_.bplus_overlay:
        bo = Path(A_.bplus_overlay); so = sha(bo.read_bytes())
        g = td / 'hq5_plus_bplus'; g.mkdir(); subprocess.run(f'git -C "{REPO}" archive {HQ5} | tar -x -C "{g}"', shell=True, check=True)
        apply_overlay(bo, 'BPLUS_OVERLAY', g); asB = runtime_vs(g, bt)
        apply_overlay(zpath, 'BPLUSPLUS_OVERLAY', g); r3 = runtime_vs(g, want)
        R['checks']['overHq5PlusBplusOverlay'] = dict(r3, bplusOverlaySha=so, bplusOverlayIsTheDelivered=so == BPLUS_OVERLAY_SHA, wasBplusBeforeBpp=ok_rt(asB), ok=so == BPLUS_OVERLAY_SHA and ok_rt(asB) and ok_rt(r3))
    rv = td / 'revert'; shutil.copytree(exp, rv); apply_overlay(zpath, 'REVERT_TO_BPLUS', rv)
    r4 = runtime_vs(rv, bt); R['checks']['revertToBplus'] = dict(r4, ok=ok_rt(r4))
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
                A = await Q.join(ca, port, 'overlay-bpp', 'Alice', errs); B = await Q.join(cb, port, 'overlay-bpp', 'Bob', errs)
                aid, bid = await A.evaluate("() => __api.H.id"), await B.evaluate("() => __api.H.id")
                Q.place(port, 'overlay-bpp', [(aid, 862, 720), (bid, 862, 880)], god=(aid, bid), clear=True)
                for P in (A, B): await P.evaluate("() => window.__brRole && __brRole.setQuality('low')")
                await B.wait_for_timeout(1500); q0 = await B.evaluate("() => __peerNet().counts.qApplied")
                await A.bring_to_front(); await A.keyboard.down('KeyD'); await A.wait_for_timeout(1200); await A.keyboard.up('KeyD'); await A.wait_for_timeout(500)
                info = {'version': await B.evaluate("() => __brRole.version"), 'bob': await B.evaluate("() => { const n = __peerNet(); return { mode: n.mode, fast: n.fast, counts: n.counts } }"),
                        'alice': await A.evaluate("() => { const n = __peerNet(); return { mode: n.mode, fast: n.fast } }"),
                        'iconLinks': await B.evaluate("() => [...document.querySelectorAll('link[rel=\"icon\"]')].map(l => l.getAttribute('href'))"), 'qBefore': q0}
                # the placement race on real pages: Bob 545 px from where the admin brings him
                Q.place(port, 'overlay-bpp', [(bid, 504, 888)]); await B.wait_for_timeout(2000)
                bob0 = await B.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]")
                Q.place(port, 'overlay-bpp', [(bid, 1012, 690)]); await B.wait_for_timeout(2500)
                bob1 = await B.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]")
                seen = await A.evaluate("(id) => { const p = __peerNet().peers.find(q => q.id === id); return p ? [p.tx, p.ty] : null }", bid)
                info['placement'] = {'bobBefore': bob0, 'bobPage': bob1, 'serverSaysViaAlice': seen, 'kept': bob0 == [504, 888] and bob1 == [1012, 690] and seen == [1012, 690]}
                await b.close()
                return {'favicon': fv, 'pages': info, 'pageErrors': errs[:10]}
        finally:
            Q.lib3d.stop_server(srv)
    r5 = asyncio.run(run()); pg = r5['pages']
    R['checks']['runs'] = dict(r5, ok=not r5['pageErrors'] and r5['favicon']['status'] == 200 and r5['favicon']['type'] == 'image/x-icon' and r5['favicon']['sameBytes']
                               and pg['iconLinks'] == ['./favicon.ico'] and pg['bob']['mode'] == 'bplus' and pg['bob']['fast'] and pg['alice']['fast']
                               and pg['bob']['counts']['qApplied'] > pg['qBefore'] and pg['version'] == 'br-role 1.2-candidate' and pg['placement']['kept'])
R['ok'] = all(c['ok'] for c in R['checks'].values()); R['written'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
yn = lambda b: 'yes' if b else 'NO'
c = R['checks']
files = [f'  {sha(b)}  {k}  ({len(b)} bytes) - ' + (role.get(k.split('/', 1)[1], '') if k.startswith('BPLUSPLUS_OVERLAY/') else 'the accepted B+ file, to undo') for k, b in game.items()] + \
        [f'  {sha(where.encode())}  WHERE_TO_COPY.txt', f'  {sha(qa)}  HUMAN_QA.md', f'  {sha(src_diff)}  BPLUSPLUS_SOURCE.diff  (git diff {BPLUS[:7]} {commit[:7]} of the files above)']
T = ['Stage 3E-0 B++ human-QA overlay - receipt', f'written {R["written"]} by dev/stage-3e-0-bpp/overlay_bpp.py', '',
     f'source    stage-3e-0-bplusplus {commit} (tree {tree})', f'reverts   stage-3e-0 (accepted B+) {BPLUS} (tree {btree})',
     f'game files changed since B+: {", ".join(CHANGED)} (nothing else; no file the browser loads: {yn(not CLIENT)})', '', 'files:', *files, '',
     f'1. ZIP CRCs good, its game files byte-identical to Git, favicon.ico unchanged and your supplied icon: {yn(c["zip"]["ok"])}',
     f'2. BPLUSPLUS_OVERLAY copied over a clean export of stage-3e-0 {BPLUS[:7]}: {c["overBplusExport"]["runtimeFiles"]} runtime files byte-identical to stage-3e-0-bplusplus, the copy changed only {", ".join(c["overBplusExport"]["filesChangedByTheOverlay"])}: {yn(c["overBplusExport"]["ok"])}']
if 'overHq5PlusBplusOverlay' in c:
    o = c['overHq5PlusBplusOverlay']
    T.append(f'3. HQ5 + STAGE_3E0_BPLUS_HUMAN_QA_OVERLAY.zip (the delivered one: {yn(o["bplusOverlayIsTheDelivered"])}) is B+ byte for byte: {yn(o["wasBplusBeforeBpp"])}; BPLUSPLUS_OVERLAY over it: byte-identical to stage-3e-0-bplusplus: {yn(o["ok"])}')
pl = c['runs']['pages']['placement']
T += [f'4. REVERT_TO_BPLUS copied back: byte-identical to stage-3e-0 {BPLUS[:7]}: {yn(c["revertToBplus"]["ok"])}',
      f'5. the overlaid B+ folder runs: page errors {len(c["runs"]["pageErrors"])}; GET /favicon.ico {c["runs"]["favicon"]["status"]} {c["runs"]["favicon"]["type"]}, your bytes: {yn(c["runs"]["favicon"]["sameBytes"])}; '
      f'both pages get the fresher poses: {yn(c["runs"]["pages"]["bob"]["fast"] and c["runs"]["pages"]["alice"]["fast"])}; '
      f"Bob's page applied Alice's 'q' while she walked: {c['runs']['pages']['bob']['counts']['qApplied'] - c['runs']['pages']['qBefore']}; {c['runs']['pages']['version']}; "
      f"Bob brought 545 px ({pl['bobBefore']} -> (1012, 690)): his page {pl['bobPage']}, the server as Alice's page has him {pl['serverSaysViaAlice']}, kept: {yn(pl['kept'])}: {yn(c['runs']['ok'])}",
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
