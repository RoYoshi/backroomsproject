#!/usr/bin/env python3
"""Stage 3H2 - the small Stage 3H human-QA overlay (the game files Stage 3H2 changes or adds, to copy over the accepted B++ game) and
its validation (development only; modelled on dev/stage-3e-0-bpp/overlay_bpp.py, which is left as it is).

  python3 -I -B dev/stage-3h/tools/h2_overlay.py REPO COMMIT OUTDIR --qa FILE

  COMMIT  the stage-3h commit the overlay's game files are taken from (read from Git)
  --qa    the one-page human-QA guide that goes in the ZIP as HUMAN_QA.md

The overlay (OUTDIR/STAGE3H_HUMAN_QA_OVERLAY.zip), paths at the ZIP's root:
  STAGE3H_OVERLAY/...   every game file Stage 3H2 changes or adds (COMMIT), at its path in the game folder
  REVERT_TO_BPP/...     the accepted B++ copies (143b63f) of the files it changes; the files it adds are named in WHERE_TO_COPY.txt, to
                        delete
  WHERE_TO_COPY.txt, OVERLAY_RECEIPT.txt (every file's SHA-256 and the checks below), HUMAN_QA.md,
  STAGE3H_SOURCE.diff   git diff 143b63f COMMIT of exactly those game files
Validation, from the ZIP itself, on clean temporary folders:
  1. the ZIP's CRCs and its entries; its game files byte-identical to Git (COMMIT and B++); the changed files are exactly the seven
     Stage 3H2 declared (three replaced, four added), and no game file is removed;
  2. every runtime file of B++ (143b63f) is byte-identical to the B++ overlay's source (d501afe): a folder the delivered B++ overlay
     made is the B++ this overlay is tested over;
  3. STAGE3H_OVERLAY copied over a clean export of B++: every runtime file byte-identical to COMMIT's; the copy changed or added only
     the seven files;
  4. REVERT_TO_BPP copied back and the four added files deleted: every runtime file byte-identical to B++ (without the deletions the
     only difference is those four files, which nothing loads);
  5. the overlaid folder runs: its own server (synthetic admin passcode); the two new page scripts served, the two new server files not;
     two real pages, no page error; the page has the four helper namespaces, frozen; the offline hum check equals a B++ page's at 60,
     120 and 240 Hz; both pages get the fresher poses and Bob's page applies Alice's 'q' while she walks; BR-RoLE still
     br-role 1.2-candidate; the placement race (Bob brought 545 px) kept; NEW RUN through the game's own buttons: approved (the run
     menu says YOU BLEW YOURSELF UP), SPAWN, then refused within the 30 s (the button says NEW RUN · WAIT N S).
Every server it starts uses the synthetic admin passcode of dev/stage-3d/lib3d.py, never the user's and never the built-in default.
Writes the ZIP, its .sha256, OVERLAY_RECEIPT.txt and overlay_receipt.json in OUTDIR; exit 0 only if every check holds."""
import argparse, hashlib, json, re, shutil, subprocess, sys, tempfile, time, zipfile, asyncio, urllib.request, urllib.error
from pathlib import Path
ap = argparse.ArgumentParser(); ap.add_argument('repo'); ap.add_argument('commit'); ap.add_argument('out'); ap.add_argument('--qa', required=True)
A_ = ap.parse_args()
REPO, OUT = Path(A_.repo).resolve(), Path(A_.out).resolve()
BPP = '143b63ff42b88c6780c5043e0f61d64100f81f40'
BPP_OVERLAY_SRC = 'd501afe4c065a555de709bb11f438a47a7b643ba'      # the commit BPLUSPLUS_HUMAN_QA_OVERLAY.zip was built from (its receipt)
NAME = 'STAGE3H_HUMAN_QA_OVERLAY'
EXPECT = ['assets/mp-hum.js', 'assets/net-newrun.js', 'index.html', 'mp.js', 'server.js', 'server/aftermath.js', 'server/newrun.js']
EXPECT_ADDED = ['assets/mp-hum.js', 'assets/net-newrun.js', 'server/aftermath.js', 'server/newrun.js']
sha = lambda b: hashlib.sha256(b).hexdigest()
git = lambda *a: subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True).stdout
blob = lambda rev, p: git('show', f'{rev}:{p}')
commit = git('rev-parse', A_.commit).decode().strip(); tree = git('rev-parse', f'{commit}^{{tree}}').decode().strip()
btree = git('rev-parse', f'{BPP}^{{tree}}').decode().strip()
# what the server serves: the allowlist itself, read from server/static.js (unchanged by Stage 3H2: checked)
assert blob(commit, 'server/static.js') == blob(BPP, 'server/static.js'), 'server/static.js changed: not expected; stop'
_m = re.search(r'const SERVE = /\^\\/\((.*?)\)\$/;', blob(BPP, 'server/static.js').decode())
assert _m, 'the SERVE allowlist was not found in server/static.js'
SERVE = re.compile('^(' + _m.group(1).replace('\\/', '/') + ')$')
SERVER = ['server.js', 'sim.js', 'death_srv.js', 'ai.js', 'world.js', 'package.json']
runtime = lambda p: bool(SERVE.match(p)) or p in SERVER or p.startswith('server/') or p.startswith('sounds/')
OUT.mkdir(parents=True, exist_ok=True)
lstree = lambda rev: {l.split('\t', 1)[1]: l.split('\t', 1)[0].split()[2] for l in git('ls-tree', '-r', rev).decode().splitlines()}
want, bt, bo = lstree(commit), lstree(BPP), lstree(BPP_OVERLAY_SRC)
CHANGED = sorted(p for p in set(want) | set(bt) if runtime(p) and want.get(p) != bt.get(p))
ADDED = [p for p in CHANGED if p not in bt]; REMOVED = [p for p in CHANGED if p not in want]; REPLACED = [p for p in CHANGED if p not in ADDED]
assert CHANGED == EXPECT and ADDED == EXPECT_ADDED and not REMOVED, f'Stage 3H2 changes {CHANGED}, adds {ADDED}, removes {REMOVED}: not expected; stop'
game = {f'STAGE3H_OVERLAY/{p}': blob(commit, p) for p in CHANGED}
game.update({f'REVERT_TO_BPP/{p}': blob(BPP, p) for p in REPLACED})
role = {'server.js': 'C-1, C-2: loads server/newrun.js and server/aftermath.js; the lines they hold are gone from here; one comment back above moveTo',
        'server/newrun.js': "C-1 (new): NEW RUN's decision - B++ server.js 204-211, 227-244, verbatim",
        'server/aftermath.js': 'C-2 (new): the death aftermath, corpses and the NEW RUN blast - B++ server.js 116-163, 182-185, 212-226, verbatim',
        'mp.js': 'C-3, C-4: reads assets/net-newrun.js and assets/mp-hum.js; the lines they hold are gone from here',
        'index.html': 'C-3, C-4: loads the two new page scripts, right after glitch.js',
        'assets/net-newrun.js': "C-3 (new): NEW RUN's button and run-menu words - B++ mp.js 85-90, 98-103, verbatim",
        'assets/mp-hum.js': 'C-4 (new): the fluorescent light hum - B++ mp.js 887-984, verbatim'}
where = f"""STAGE 3H HUMAN-QA OVERLAY - where to copy

This overlay turns the ACCEPTED B++ game into the Stage 3H candidate (branch stage-3h; its game files are those of commit {commit[:7]}).
It replaces {len(REPLACED)} files and adds {len(ADDED)}:
  replaced: {', '.join(REPLACED)}
  added:    {', '.join(ADDED)}
Page files change too: reload every tab.

It is for a B++ game only:
  - the game folder you copied the B++ overlay (BPLUSPLUS_HUMAN_QA_OVERLAY.zip) into, or
  - a checkout / export of stage-3e-0-bplusplus at {BPP[:7]}.
Both were tested (OVERLAY_RECEIPT.txt): after the copy every game file is byte-identical to the candidate's.  Do not use it on an older
folder (bring it to B++ first) or on a folder you have changed yourself.

1. Stop the server (Ctrl+C in its window).
2. Copy the CONTENTS of STAGE3H_OVERLAY into your game folder (the folder that holds server.js), replacing files when asked.  Its
   assets and server folders go into the game folder's own assets and server folders: two files in each are new.
3. Start it again with your own passcode, then reload every browser tab (Ctrl+F5 / Cmd+Shift+R) so every page loads the new scripts:
     Windows (cmd):        set ADMIN_PASSCODE=<your own passcode>
                           node server.js 8000
     Windows (PowerShell): $env:ADMIN_PASSCODE="<your own passcode>"; node server.js 8000
     Linux / macOS:        ADMIN_PASSCODE=<your own passcode> node server.js 8000
   and open http://localhost:8000 (Node 18 or later).

Keep the seven files together.  The new server.js needs the two new server files, and the new mp.js needs the two new page scripts,
which only the new index.html loads.

To undo: stop the server, copy the CONTENTS of REVERT_TO_BPP the same way, then DELETE these {len(ADDED)} files from the game folder:
{chr(10).join('  ' + p for p in ADDED)}
and start it again.  The game is then the accepted B++ again, byte for byte.  If you forget to delete them, nothing loads them: the
game still plays as B++, with {len(ADDED)} unused files in the folder.

Instead of the overlay you can check out the branch:  git checkout stage-3h  and start it the same way (later commits than {commit[:7]}
add only documents).
What to look at: HUMAN_QA.md.  File checksums: OVERLAY_RECEIPT.txt.  The source change itself: STAGE3H_SOURCE.diff.
"""
qa = Path(A_.qa).read_bytes()
src_diff = git('diff', '--no-color', '--no-ext-diff', BPP, commit, '--', *CHANGED)
ENTRIES = sorted(list(game) + ['WHERE_TO_COPY.txt', 'OVERLAY_RECEIPT.txt', 'HUMAN_QA.md', 'STAGE3H_SOURCE.diff'])


def build(receipt):
    zpath = OUT / f'{NAME}.zip'
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for k, b in game.items(): z.writestr(k, b)
        z.writestr('WHERE_TO_COPY.txt', where); z.writestr('OVERLAY_RECEIPT.txt', receipt); z.writestr('HUMAN_QA.md', qa); z.writestr('STAGE3H_SOURCE.diff', src_diff)
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
R = {'commit': commit, 'tree': tree, 'bpp': {'commit': BPP, 'tree': btree}, 'changed': CHANGED, 'added': ADDED, 'replaced': REPLACED, 'checks': {}}
zpath = build('(the receipt is written after the checks)\n')
with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    with zipfile.ZipFile(zpath) as z:
        bad = z.testzip(); same = {k: z.read(k) == b for k, b in game.items()}; names = sorted(z.namelist())
    R['checks']['zip'] = {'crcFirstBad': bad, 'gameFilesEqualGit': same, 'entries': names, 'entriesAsExpected': names == ENTRIES,
                          'ok': bad is None and all(same.values()) and names == ENTRIES}
    rt_bpp = {p: h for p, h in bt.items() if runtime(p)}; rt_bo = {p: h for p, h in bo.items() if runtime(p)}
    R['checks']['bppIsWhatTheBppOverlayMade'] = {'bppOverlaySource': BPP_OVERLAY_SRC, 'runtimeFiles': len(rt_bpp),
                                                 'different': sorted(p for p in set(rt_bpp) | set(rt_bo) if rt_bpp.get(p) != rt_bo.get(p)), 'ok': rt_bpp == rt_bo}
    exp = td / 'bpp'; exp.mkdir(); subprocess.run(f'git -C "{REPO}" archive {BPP} | tar -x -C "{exp}"', shell=True, check=True)
    ref = td / 'bpp_ref'; shutil.copytree(exp, ref)                     # a clean B++ folder, kept for the B++ page in check 5
    pre = runtime_vs(exp, bt); before = snap(exp)
    apply_overlay(zpath, 'STAGE3H_OVERLAY', exp); r3 = runtime_vs(exp, want); after = snap(exp)
    changed = sorted(p for p in set(before) | set(after) if before.get(p) != after.get(p))
    R['checks']['overBppExport'] = dict(r3, bppExportWasBpp=ok_rt(pre), filesChangedByTheOverlay=changed, ok=ok_rt(pre) and ok_rt(r3) and changed == CHANGED)
    rv = td / 'revert'; shutil.copytree(exp, rv); apply_overlay(zpath, 'REVERT_TO_BPP', rv)
    kept = runtime_vs(rv, bt)                                            # before the deletions
    for p in ADDED: (rv / p).unlink()
    r4 = runtime_vs(rv, bt)
    R['checks']['revertToBpp'] = dict(r4, withoutDeletingOnlyTheAddedFilesDiffer=(kept['extra'] == ADDED and not kept['different'] and not kept['missing']),
                                      ok=ok_rt(r4) and kept['extra'] == ADDED and not kept['different'] and not kept['missing'])
    sys.path.insert(0, str(REPO / 'dev' / 'stage-3d-hq2')); import hq2lib as Q
    from playwright.async_api import async_playwright

    def http(port, path):
        try:
            r = urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{port}/{path}', headers={'Accept-Encoding': 'identity'}), timeout=10)
            return r.status, r.headers.get('Content-Type'), r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.headers.get('Content-Type'), b''

    async def bpp_page():
        """a B++ page, for reference: its offline hum check and its helper namespaces"""
        port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(str(ref), port, str(td / 'srv_bpp.log')); errs = []
        try:
            async with async_playwright() as p:
                b = await p.chromium.launch(args=Q.ARGS); ctx = await b.new_context(viewport={'width': 480, 'height': 320}); P = await ctx.new_page()
                P.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
                await P.goto(f'http://127.0.0.1:{port}/?room=overlay-h2-ref', timeout=90000)
                await P.wait_for_function("()=>!!(window.__net && window.__net.testHum)", timeout=90000)
                r = {'hum': await P.evaluate("()=>window.__net.testHum([60, 120, 240])"), 'mpLib': await P.evaluate("()=>Object.keys(window.__mpLib || {}).sort()")}
                await b.close()
                return dict(r, pageErrors=errs)
        finally:
            Q.lib3d.stop_server(srv)

    async def run():
        port = Q.lib3d.free_port(); srv = Q.lib3d.start_server(str(exp), port, str(td / 'srv.log')); errs = []
        try:
            served = {}
            for f in ADDED:
                st, ty, body = http(port, f)
                served[f] = {'status': st, 'type': ty, 'sameBytes': body == blob(commit, f) if st == 200 else None}
            async with async_playwright() as p:
                b = await p.chromium.launch(args=Q.ARGS)
                ca, cb = [await b.new_context(viewport={'width': 480, 'height': 320}) for _ in range(2)]
                A = await Q.join(ca, port, 'overlay-h2', 'Alice', errs); B = await Q.join(cb, port, 'overlay-h2', 'Bob', errs)
                aid, bid = await A.evaluate("() => __api.H.id"), await B.evaluate("() => __api.H.id")
                Q.place(port, 'overlay-h2', [(aid, 862, 720), (bid, 862, 880)], god=(aid, bid), clear=True)
                for P in (A, B): await P.evaluate("() => window.__brRole && __brRole.setQuality('low')")
                lib = await A.evaluate("""() => { const L = window.__mpLib || {}; return { keys: Object.keys(L).sort(),
                    frozen: ['wire', 'interp', 'newrun', 'hum'].every(k => L[k] && Object.isFrozen(L[k])),
                    newrun: Object.keys(L.newrun || {}).sort(), hum: Object.keys(L.hum || {}).sort() }; }""")
                hum = await A.evaluate("() => window.__net.testHum([60, 120, 240])")
                await B.wait_for_timeout(1500); q0 = await B.evaluate("() => __peerNet().counts.qApplied")
                await A.bring_to_front(); await A.keyboard.down('KeyD'); await A.wait_for_timeout(1200); await A.keyboard.up('KeyD'); await A.wait_for_timeout(500)
                info = {'version': await B.evaluate("() => __brRole.version"), 'bob': await B.evaluate("() => { const n = __peerNet(); return { mode: n.mode, fast: n.fast, counts: n.counts } }"),
                        'alice': await A.evaluate("() => { const n = __peerNet(); return { mode: n.mode, fast: n.fast } }"), 'qBefore': q0, 'mpLib': lib, 'hum': hum}
                # the placement race on real pages (B++-0): Bob 545 px from where the admin brings him
                Q.place(port, 'overlay-h2', [(bid, 504, 888)]); await B.wait_for_timeout(2000)
                bob0 = await B.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]")
                Q.place(port, 'overlay-h2', [(bid, 1012, 690)]); await B.wait_for_timeout(2500)
                bob1 = await B.evaluate("() => [Math.round(__api.H.x), Math.round(__api.H.y)]")
                seen = await A.evaluate("(id) => { const p = __peerNet().peers.find(q => q.id === id); return p ? [p.tx, p.ty] : null }", bid)
                info['placement'] = {'bobBefore': bob0, 'bobPage': bob1, 'serverSaysViaAlice': seen, 'kept': bob0 == [504, 888] and bob1 == [1012, 690] and seen == [1012, 690]}
                # NEW RUN through the game's own buttons (C-1, C-2, C-3): Esc, NEW RUN - approved; SPAWN; Esc, NEW RUN - refused (the 30 s)
                await A.bring_to_front(); await A.keyboard.press('Escape'); await A.wait_for_timeout(600)
                await A.click('#reset', timeout=15000); await A.wait_for_timeout(5000)
                nr1 = await A.evaluate("""() => ({ last: window.__nrDebug().last, runMenu: !document.getElementById('runMenu').hidden,
                    eyebrow: document.querySelector('#runMenu .eyebrow').textContent, intro: document.querySelector('#runMenu .intro').textContent })""")
                await A.click('#runSpawn', timeout=15000); await A.wait_for_timeout(4000)
                await A.keyboard.press('Escape'); await A.wait_for_timeout(600)
                await A.click('#reset', timeout=15000); await A.wait_for_timeout(800)
                nr2 = await A.evaluate("() => ({ last: window.__nrDebug().last, label: document.getElementById('reset').textContent, runMenu: !document.getElementById('runMenu').hidden })")
                nr2['labelN'] = re.sub(r'\d+', 'N', nr2['label'] or '')
                l1, l2 = nr1['last'] or {}, nr2['last'] or {}
                info['newRun'] = {'approved': nr1, 'refused': nr2,
                                  'ok': l1.get('ok') == 1 and nr1['runMenu'] and nr1['eyebrow'] == 'YOU BLEW YOURSELF UP' and nr1['intro'] == 'What is left of you stays where you stood.'
                                  and l2.get('ok') == 0 and l2.get('why') == 'cooldown' and nr2['labelN'] == 'NEW RUN · WAIT N S' and not nr2['runMenu']}
                await b.close()
                return {'served': served, 'pages': info, 'pageErrors': errs[:10]}
        finally:
            Q.lib3d.stop_server(srv)
    ref_page = asyncio.run(bpp_page()); r5 = asyncio.run(run()); pg = r5['pages']
    served_ok = all(r5['served'][f]['status'] == 200 and r5['served'][f]['sameBytes'] for f in ADDED if f.startswith('assets/')) and \
        all(r5['served'][f]['status'] == 404 for f in ADDED if f.startswith('server/'))
    hum_same = all(abs(pg['hum'][str(f)] - ref_page['hum'][str(f)]) <= 0.2 for f in (60, 120, 240))
    R['checks']['runs'] = dict(r5, bppPage=ref_page, humWithin02dBOfBpp=hum_same, servedAsExpected=served_ok,
                               ok=not r5['pageErrors'] and not ref_page['pageErrors'] and served_ok and hum_same
                               and pg['mpLib']['keys'] == ['hum', 'interp', 'newrun', 'wire'] and pg['mpLib']['frozen']
                               and pg['mpLib']['newrun'] == ['nrButton', 'runMenuWords'] and pg['mpLib']['hum'] == ['buildHum', 'humUpdate']
                               and ref_page['mpLib'] == ['interp', 'wire']
                               and pg['bob']['mode'] == 'bplus' and pg['bob']['fast'] and pg['alice']['fast'] and pg['bob']['counts']['qApplied'] > pg['qBefore']
                               and pg['version'] == 'br-role 1.2-candidate' and pg['placement']['kept'] and pg['newRun']['ok'])
R['ok'] = all(c['ok'] for c in R['checks'].values()); R['written'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
yn = lambda b: 'yes' if b else 'NO'
c = R['checks']; pg = c['runs']['pages']; nr = pg['newRun']
files = [f'  {sha(b)}  {k}  ({len(b)} bytes) - ' + (role[k.split('/', 1)[1]] if k.startswith('STAGE3H_OVERLAY/') else 'the accepted B++ file, to undo') for k, b in game.items()] + \
        [f'  {sha(where.encode())}  WHERE_TO_COPY.txt', f'  {sha(qa)}  HUMAN_QA.md', f'  {sha(src_diff)}  STAGE3H_SOURCE.diff  (git diff {BPP[:7]} {commit[:7]} of the files above)']
hum_txt = lambda h: ' / '.join(f'{h[str(f)]}' for f in (60, 120, 240)) + ' dB'
T = ['Stage 3H human-QA overlay - receipt', f'written {R["written"]} by dev/stage-3h/tools/h2_overlay.py', '',
     f'source    stage-3h {commit} (tree {tree})', f'reverts   B++ (accepted) {BPP} (tree {btree})',
     f'game files changed since B++: {", ".join(REPLACED)}; added: {", ".join(ADDED)}; nothing else, nothing removed', '', 'files:', *files, '',
     f'1. ZIP CRCs good, its entries as listed, its game files byte-identical to Git: {yn(c["zip"]["ok"])}',
     f'2. every runtime file of B++ {BPP[:7]} byte-identical to the B++ overlay\'s source {BPP_OVERLAY_SRC[:7]} ({c["bppIsWhatTheBppOverlayMade"]["runtimeFiles"]} files): {yn(c["bppIsWhatTheBppOverlayMade"]["ok"])}',
     f'3. STAGE3H_OVERLAY copied over a clean export of B++ {BPP[:7]}: {c["overBppExport"]["runtimeFiles"]} runtime files byte-identical to stage-3h {commit[:7]}, the copy changed or added only {", ".join(c["overBppExport"]["filesChangedByTheOverlay"])}: {yn(c["overBppExport"]["ok"])}',
     f'4. REVERT_TO_BPP copied back and the {len(ADDED)} added files deleted: byte-identical to B++ {BPP[:7]}; before the deletions only those files differed: {yn(c["revertToBpp"]["ok"])}',
     f'5. the overlaid folder runs: page errors {len(c["runs"]["pageErrors"])}; the new page scripts served byte for byte and the new server files not (404): {yn(c["runs"]["servedAsExpected"])}; '
     f'helpers {", ".join(pg["mpLib"]["keys"])} (frozen: {yn(pg["mpLib"]["frozen"])}; a B++ page has {", ".join(c["runs"]["bppPage"]["mpLib"])}); '
     f'offline hum at 60 / 120 / 240 Hz {hum_txt(pg["hum"])}, a B++ page {hum_txt(c["runs"]["bppPage"]["hum"])}: {yn(c["runs"]["humWithin02dBOfBpp"])}; '
     f'both pages get the fresher poses: {yn(pg["bob"]["fast"] and pg["alice"]["fast"])}; Bob\'s page applied Alice\'s \'q\' while she walked: {pg["bob"]["counts"]["qApplied"] - pg["qBefore"]}; {pg["version"]}; '
     f'Bob brought 545 px ({pg["placement"]["bobBefore"]} -> (1012, 690)): his page {pg["placement"]["bobPage"]}, the server as Alice\'s page has him {pg["placement"]["serverSaysViaAlice"]}, kept: {yn(pg["placement"]["kept"])}; '
     f'NEW RUN approved, the run menu "{nr["approved"]["eyebrow"]}"; after SPAWN refused ({(nr["refused"]["last"] or {}).get("why")}), the button "{nr["refused"]["labelN"]}": {yn(nr["ok"])}: {yn(c["runs"]["ok"])}',
     '', 'Human QA has NOT been done: the checks above are automated.  The hum was measured offline, not heard.', '', f'OVERLAY CHECK: {"PASS" if R["ok"] else "FAIL"}']
receipt = '\n'.join(T) + '\n'
zpath = build(receipt)
with zipfile.ZipFile(zpath) as z:
    R['final'] = {'crcFirstBad': z.testzip(), 'gameFilesEqualGit': all(z.read(k) == b for k, b in game.items()), 'entries': sorted(z.namelist())}
R['ok'] = R['ok'] and R['final']['crcFirstBad'] is None and R['final']['gameFilesEqualGit'] and R['final']['entries'] == ENTRIES
zsha = sha(zpath.read_bytes()); R['zip'] = {'file': zpath.name, 'sha256': zsha, 'bytes': zpath.stat().st_size}
(OUT / f'{NAME}.zip.sha256').write_text(f'{zsha}  {zpath.name}\n')
(OUT / 'OVERLAY_RECEIPT.txt').write_text(receipt + f'\nthe ZIP itself: {zpath.name}  {zpath.stat().st_size} bytes  sha256 {zsha}\n')
(OUT / 'overlay_receipt.json').write_text(json.dumps(R, indent=1) + '\n')
print(receipt + f'\nZIP {zpath.name} {zpath.stat().st_size} bytes sha256 {zsha}; final CRC/bytes/entries {yn(R["ok"])}'); sys.exit(0 if R['ok'] else 1)
