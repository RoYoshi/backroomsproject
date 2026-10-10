#!/usr/bin/env python3
"""Stage 3C QA2 - write STAGE_3C_QA2_CHANGED_FILES.txt: every file changed since QA1 (5f30e28), what it is and why (development only).

  python3 -I dev/stage-3c-qa2/changed_files_qa2.py REPO [REV]     (REV defaults to the working tree, untracked files included)

Evidence files are summarised per folder. Exit 1 if a changed file has no description (so nothing is listed without a reason)."""
import subprocess, sys
from collections import Counter
from pathlib import Path
REPO = Path(sys.argv[1]); REV = sys.argv[2] if len(sys.argv) > 2 else None
PARENT = '5f30e28532200bca52b57a112c6691498a263e92'
git = lambda *a: subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True, text=True).stdout
rows = [l.split('\t', 1) for l in git('diff', '--name-status', PARENT, *([REV] if REV else [])).splitlines()]
if not REV: rows += [['A', f] for f in git('ls-files', '--others', '--exclude-standard').splitlines()]
D = {
 'STAGE_3C_QA2_CHANGED_FILES.txt': 'DOC. This list.',
 'STAGE_3C_QA2_HUMAN_QA.md': 'DOC. What to check by hand: scenes A to J of the acceptance matrix, and what is expected in each.',
 'STAGE_3C_QA2_MENU_COMPARISON.jpg': 'DOC. QA1 and QA2 menus side by side (desktop, phone, phone on its side).',
 'STAGE_3C_QA2_PERFORMANCE.md': 'DOC. Performance: QA1 vs QA2 starts (cold, warm), the ready gate\'s cost, the menu idle and play with menus closed.',
 'STAGE_3C_QA2_Q0_AUDIT.md': 'DOC. QA2-0 audit: parent and branches, the supplied logo inspected, the QA1 boot measured frame by frame, the autoplay facts, the plan.',
 'STAGE_3C_QA2_REPORT.md': 'DOC. The QA2 report.',
 'assets/MAIN_MENU_LOGO_USER_SUPPLIED.png': 'THE USER\'S LOGO. Byte-identical to the supplied visual_reference/MAIN_MENU_LOGO_USER_SUPPLIED.png (SHA-256 906e19a8...), 2048 x 1152. The main menu\'s title.',
 'assets/ui.css': 'QA1 UI FILE, EDITED. The title box is the logo\'s sign box (no crop, stretch or filter); the menu scrim is opaque black and html.tfb-black keeps the page black behind the menu and everything opened from it; QA1\'s staggered menu entrance removed (the menu is revealed whole); title sizes re-fitted per breakpoint; the title box clips the logo\'s fully transparent surround (no visible pixel lies outside it); R1: the menu\'s logo-first entrance (mmIgnite, then the parts in order; reduced-motion fades).',
 'assets/ui.js': 'QA1 UI FILE, EDITED. The boot gate (required assets as promises: stylesheets, credits, the logo decoded, the menu music downloaded and decoded, the game runtime, fonts capped at 2.5 s; ready -> reveal, or the black ready gate where the browser wants a gesture; the music and the menu start in one step); the theme module (prepared during the boot, begun with the reveal; same playback, seams, fade and restart as QA1); the black curtain at ENTER LEVEL 0; tfb-black with the run state; __ui.boot() (with each boot piece\'s ready time); R1: the logo-first entrance with the theme (first load and every return), and END\'s return through black (the game\'s own local output gain ramped down with the picture, its context suspended on the menu, restored at the next run).',
 'index.html': 'ACCOUNTED EDIT. QA1\'s file plus exactly: the boot block in the head (black-first rules before every stylesheet, and window.__boot: the boot states and the error with RETRY), the root element\'s boot classes, the boot layer (#boot: Loading, the first-download note, the ready gate\'s line, the error) as the body\'s first element (also the run curtain and, R1, the black END fades into), and the title lettering replaced by the user\'s logo (<img id="mmLogo">). Every QA1 element id kept.',
 'dev/stage-3c-qa2/black_field.py': 'DEV. Is the field around the menu black? (share of pixels above a limit outside the menu\'s own parts).',
 'dev/stage-3c-qa2/boot_capture.js': 'DEV. A start recorded frame by frame from navigation (Chromium screencast), cold and warm, optional throttling, the gate passed as a player would.',
 'dev/stage-3c-qa2/boot_sheet.py': 'DEV. Analyses a boot_capture recording: non-black share per frame, contact sheets.',
 'dev/stage-3c-qa2/capture_boot.js': 'DEV. Start evidence: the gate path (desktop key, phone tap) and the direct path, as contact sheets.',
 'dev/stage-3c-qa2/capture_menu.js': 'DEV. Menu, entry, Settings and Customize captures at twelve sizes, with the layout boxes.',
 'dev/stage-3c-qa2/changed_files_qa2.py': 'DEV. Writes this list.',
 'dev/stage-3c-qa2/logo_match.py': 'DEV. Is the logo on screen the user\'s file? (pixel comparison against the file drawn on black).',
 'dev/stage-3c-qa2/menu_comparison_qa2.py': 'DEV. Builds STAGE_3C_QA2_MENU_COMPARISON.jpg.',
 'dev/stage-3c-qa2/package_qa2.py': 'DEV. The human-QA package and its receipt.',
 'dev/stage-3c-qa2/perf_ab_qa2.js': 'DEV. QA1 vs QA2 on the menu and in play (an adapted copy of dev/stage-3c/perf_c3.js), interleaved.',
 'dev/stage-3c-qa2/perf_start_qa2.js': 'DEV. QA1 vs QA2 starts (cold, warm) and the ready gate\'s cost.',
 'dev/stage-3c-qa2/probe_b1.js': 'DEV. QA2-1 probe: the boot gate (black first paint, states, no partial menu, failures with RETRY, reduced motion), updated for the music at QA2-3.',
 'dev/stage-3c-qa2/probe_b2.js': 'DEV. QA2-2 probe: the logo (identity, no alteration, pixel match), the black field, the run boundary, layouts.',
 'dev/stage-3c-qa2/probe_b3.js': 'DEV. QA2-3 probe: the ready gate, key / click / tap, the direct path, Cache Storage, seams, the theme\'s life, ENTER (frames), END, failures, the slow first download; R1: both entrances (logo first, theme with it, the order, reduced motion) and END\'s return (frames, the game\'s sound, nothing sent).',
 'dev/stage-3c-qa2/qa2_lib.js': 'DEV. Browser helpers: reading the page without a user gesture; passing the gate with real input.',
 'dev/stage-3c-qa2/transition_sheet.py': 'DEV. Classifies the frames of a recorded transition (before / black / dim / lit) and makes a contact sheet.',
 'dev/stage-3c-qa2/run_final_checks.sh': 'DEV. R3: the one bounded final validation pass (each step with its own time limit).',
 'dev/stage-3c-qa2/verify_remote_qa2.py': 'DEV. Remote verification after each push (commit, tree, parent chain, untouched branches).',
 'dev/stage-3c-qa2/regress/run.js': 'DEV. Writes the adapted copies below from the unchanged originals, runs them on QA2, and lists every check: PASS, or FAIL with the decision that superseded it.',
 'dev/stage-3c-qa2/regress/ui_lib_gate.js': 'DEV. dev/stage-3c/ui_lib.js for QA2: every page the older probes open passes the boot and its ready gate (one key press) first.',
 'dev/stage-3c-qa2/regress/perf_c3.js': 'DEV. Adapted copy of dev/stage-3c/perf_c3.js, written by perf_ab_qa2.js (the original is unchanged).',
 'dev/stage-3c-qa2/regress/lifecycle_mp.py': 'DEV. Adapted copy of dev/tests/lifecycle_mp.py (waits for the boot and passes its gate), written by run.js; the original is unchanged.',
}
for n in ['probe_q1', 'probe_q2', 'probe_q3', 'probe_q4', 'probe_q5', 'lifecycle']:
    D[f'dev/stage-3c-qa2/regress/{n}.js'] = f'DEV. Adapted copy of dev/stage-3c-qa1/{n}.js (helpers from ui_lib_gate.js), written by run.js; the original is unchanged.'
for n in ['probe_c1', 'probe_c2', 'probe_c3', 'probe_c4', 'probe_c5']:
    D[f'dev/stage-3c-qa2/regress/{n}.js'] = f'DEV. Adapted copy of QA1\'s dev/stage-3c-qa1/first_candidate/{n}.js (helpers from ui_lib_gate.js), written by run.js; the originals are unchanged.'
KIND = {'A': 'added', 'M': 'modified', 'D': 'deleted'}
ev = Counter(); out = []; missing = []
for st, f in sorted(rows, key=lambda r: r[1]):
    if '/evidence/' in f:
        ev[f.split('/evidence/')[0] + '/evidence/' + f.split('/evidence/')[1].split('/')[0] + '/'] += 1; continue
    d = D.get(f)
    if d is None: missing.append(f); d = 'NOT DESCRIBED'
    out.append(f'{KIND.get(st[0], st):<9} {f}\n          {d}')
T = ['THE FAR BACKROOMS - Stage 3C QA2 (main menu branding / black background / boot asset gate) - changed files',
     f'since Stage 3C QA1 {PARENT} (git diff --name-status; branch stage-3c-qa2)', '',
     'Untouched (byte-identical to QA1; checked file by file in the package receipt): the game bundle (assets/index-DKbV5Nv9.js and its stylesheet),',
     'mp.js, server.js, sim.js, ai.js, move.js, light.js, ents.js, world.js, camcorder.js, death_srv.js, dphys.js, gore.js, glitch.js, sfx.js, redirect.js,',
     'the camera and timing policies, assets/br-role.js, assets/l0-remaster.js, assets/level0_visuals.js, assets/shadows-2d.js, hud.js, inventory.js,',
     'assets/credits_data.js, assets/manifest.webmanifest, the theme audio (assets/MainTheme_Menu*.wav, audio_source/), package.json, sounds/,',
     'and every earlier dev/ folder (dev/stage-3c/ and dev/stage-3c-qa1/ included).', '', *out, '',
     'evidence (screenshots, contact sheets, probe outputs; development only, never served):', *[f'          {k}  {n} files' for k, n in sorted(ev.items())]]
(REPO / 'STAGE_3C_QA2_CHANGED_FILES.txt').write_text('\n'.join(T) + '\n')
print('\n'.join(T))
if missing: print('NOT DESCRIBED: ' + ', '.join(missing)); sys.exit(1)
