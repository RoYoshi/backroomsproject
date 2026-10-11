#!/usr/bin/env python3
"""Stage 3H0 - write STAGE_3H0_CHANGED_FILES.txt: every file changed since the accepted parent edd2af9, with what it is (development only).

  python3 -I dev/stage-3h0/changed_files_h0.py [REV]      (in the repository; REV defaults to the working tree, staged and unstaged)

Production, test and document files are listed one by one with a description.  The stage's tools are listed one by one; its evidence is
listed per folder, with the number of files, so the list stays readable.  A changed file the script has no description for is listed
as UNDESCRIBED, and the script exits 1."""
import subprocess, sys, os, collections
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PARENT = 'edd2af954627caf7721c7614df5ff1c7f20d3f3b'
rev = sys.argv[1] if len(sys.argv) > 1 else None
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout
if rev: rows = [l.split('\t') for l in run('git', 'diff', '--name-status', PARENT, rev).splitlines() if l]
else:
    rows = [l.split('\t') for l in run('git', 'diff', '--name-status', PARENT).splitlines() if l]
    seen = {r[-1] for r in rows}
    rows += [['A', f] for f in run('git', 'ls-files', '--others', '--exclude-standard').split() if f not in seen]
ST = {'A': 'added', 'M': 'modified', 'D': 'deleted'}
D = {
 'mp.js': 'PRODUCTION, MOVED OUT OF. H0-2: the wire codec moved to assets/net-wire.js (toRec, partList, partObj, parseLook verbatim; the three inline look encoders now call lookStr). H0-3: the snapshot interpolation moved to assets/net-interp.js (NET, netReset, netHist, angD2, netPose verbatim). mp.js reads both on the first two lines of its IIFE and keeps everything else, including window.__net, window.__NET and window.__netPose (the same objects). 72,790 -> 68,144 bytes.',
 'index.html': 'PRODUCTION, TWO LINES ADDED. <script src="./assets/net-wire.js"> and <script src="./assets/net-interp.js">, immediately before mp.js. Nothing else.',
 'assets/net-wire.js': 'PRODUCTION, NEW (H0-2). The look / light-part / corpse field codec, moved verbatim from mp.js; window.__mpLib.wire. Classic script, no side effects but its namespace entry.',
 'assets/net-interp.js': 'PRODUCTION, NEW (H0-3). The snapshot interpolation, moved verbatim from mp.js; window.__mpLib.interp. Classic script, no side effects but its namespace entry.',
 'server.js': 'PRODUCTION, MOVED OUT OF. H0-4a: frame() and the inbound frame parser to server/ws.js. H0-4b: the field checks to server/fields.js. H0-4c: the static file serving to server/static.js. Each is required where its code was; the upgrade (raw WebSocket acceptance), sessions, the tick, admin, movement and aftermath stay. Still started by `node server.js [port]`. 30,485 -> 26,506 bytes.',
 'server/ws.js': 'PRODUCTION, NEW (H0-4a). The WebSocket framing: frame(str) and reader(sock, onMessage), moved verbatim. CommonJS, never served.',
 'server/fields.js': 'PRODUCTION, NEW (H0-4b). The checks on what clients send: num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook, moved verbatim. CommonJS, never served.',
 'server/static.js': 'PRODUCTION, NEW (H0-4c). The static file serving: the SERVE allowlist, MIME types, gzip cache and the request handler, moved verbatim; the export is a function of ROOT that returns the handler. CommonJS, never served.',
 'dev/tests/interp_test.js': 'EXISTING TEST, ADAPTED (H0-3). It cut the interpolation code out of mp.js by its text; it now reads it from assets/net-interp.js when that exists (else mp.js, and OLD_MP as before). Its output is identical before and after the move.',
 '3H0_Q0_AUDIT.md': 'DOC (H0-0). Source authority, start paths, protected files, test couplings, findings, risk map, plan and preliminary GO / NO-GO.',
 '3H0_MP_OWNERSHIP_MAP.md': 'DOC (H0-0, updated per checkpoint). Who owns what in mp.js, before and after.',
 '3H0_SERVER_OWNERSHIP_MAP.md': 'DOC (H0-0, updated per checkpoint). Who owns what in server.js, before and after.',
 '3H0_MP_API_LOCK.md': "DOC (H0-0, section 7 per checkpoint). mp.js's public surface (window.__net, globals, DOM, listeners, timers, load order), and what 3H0 added.",
 '3H0_SERVER_API_LOCK.md': "DOC (H0-0, section 7 per checkpoint). server.js's public surface (start-up, console, HTTP, WebSocket, the calls into sim.js, state), and what 3H0 added.",
 '3H0_PROTOCOL_INVENTORY.md': 'DOC (H0-0; section 8 at H0-5). The frozen wire protocol, and where its code lives after 3H0.',
 '3H0_H0_1_BASELINE.md': 'DOC (H0-1). The golden traces, baselines, sensitivity runs and performance rules recorded before any extraction.',
 '3H0_EQUIVALENCE_REPORT.md': 'DOC (H0-2 onward). One equivalence receipt per extraction, with the failing first runs kept and explained.',
 '3H0_ARCHITECTURE_MAP.md': 'DOC (H0-5). Before / after diagrams of mp.js and server.js, module sizes, one message end to end, where to change things now.',
 '3H0_DEFERRED_FULL_3H.md': 'DOC (H0-5). Every seam with its GO / NO-GO and reason, what full 3H needs first, and the findings recorded on the way.',
 '3H0_FUTURE_LEVEL_AUTHORING_SEAMS.md': 'DOC (H0-5). Where Level 0 is wired into the code today, a possible separation for a future level editor, and the open questions. Nothing of it is built.',
 'STAGE_3H0_REPORT.md': 'DOC (H0-6). The Stage 3H0 report.',
 'STAGE_3H0_CHANGED_FILES.txt': 'DOC (H0-6). This list.',
 'STAGE_3H0_PERFORMANCE.md': 'DOC (H0-6). Performance: the rules fixed at H0-1, every checkpoint, and the final runs.',
 'STAGE_3H0_HUMAN_QA.md': 'DOC (H0-6). What to check by hand.',
}
TOOLS = {
 'dev/stage-3h0/README.md': 'what every tool and evidence folder is',
 'dev/stage-3h0/verify_remote_h0.py': 'verifies a pushed checkpoint on GitHub independently',
 'dev/stage-3h0/record_parent_h0.py': "H0-0's independent check of the accepted parent",
 'dev/stage-3h0/protocol_contract.json': 'the wire contract the traces are checked against',
 'dev/stage-3h0/scope_check.py': 'every change is in scope; removed lines moved verbatim',
 'dev/stage-3h0/summarize_h05.py': 'the final regression summary',
 'dev/stage-3h0/changed_files_h0.py': 'writes this list',
 'dev/stage-3h0/package_h0.py': 'the ZIP, its SHA-256 and the package receipt',
 'dev/stage-3h0/secret_scan_h0.py': 'scans every added or changed file for secrets, with a self-test',
}
GOLDEN = 'dev/stage-3h0/golden/'
groups, lines, undescribed = collections.Counter(), [], []
head = ['THE FAR BACKROOMS - Stage 3H0 (safe architecture: mp.js / server.js extraction) - changed files',
        f'since the accepted Stage 3C QA2 commit {PARENT} (git diff --name-status; branch stage-3h0)', '',
        'Untouched (byte-identical to the parent; checked in the package receipt): the game bundle and its stylesheet, sim.js, ai.js, world.js,',
        'move.js, ents.js, light.js, glitch.js, gore.js, dphys.js, death_srv.js, camcorder.js, sfx.js, hud.js, inventory.js, the camera and timing',
        'policies, assets/ui.js and ui.css (QA2 menu, boot, HUD, keybinds, touch), assets/br-role.js, assets/l0-remaster.js, assets/level0_visuals.js, the logo, the',
        'theme audio, the manifest, package.json, the start scripts, .github/ (deployment), sounds/, and every dev/ folder but dev/stage-3h0/ and the',
        'one adapted test. main and every Stage 3C branch are untouched.', '']
for st, *names in sorted(rows, key=lambda r: (0 if r[-1] in D and not r[-1].startswith(('3H0', 'STAGE_3H0')) else 1 if r[-1] in D else 2, r[-1])):
    f = names[-1]
    if f in D: lines += [f'{ST.get(st[0], st):<9} {f}', f'          {D[f]}']
    elif f in TOOLS: lines += [f'{ST.get(st[0], st):<9} {f}', f'          DEV TOOL. {TOOLS[f][0].upper() + TOOLS[f][1:]}.']
    elif f.startswith(GOLDEN): lines += [f'{ST.get(st[0], st):<9} {f}', f'          DEV TOOL (golden traces and equivalence; dev/stage-3h0/README.md says what it does).']
    elif f.startswith('dev/stage-3h0/evidence/'):
        parts = f.split('/'); groups['/'.join(parts[:4]) + '/'] += 1
    else: undescribed.append(f); lines += [f'{ST.get(st[0], st):<9} {f}', '          UNDESCRIBED']
lines += ['', 'evidence (dev/stage-3h0/evidence/; dev/stage-3h0/README.md describes each folder):']
lines += [f'added     {g:<44} {n} files' for g, n in sorted(groups.items())]
open('STAGE_3H0_CHANGED_FILES.txt', 'w').write('\n'.join(head + lines) + '\n')
print('\n'.join(head + lines))
sys.exit(1 if undescribed else 0)
