#!/usr/bin/env python3
"""Stage 3C - write STAGE_3C_CHANGED_FILES.txt: every file changed since the accepted Stage 3B parent, what it is and why
(development only).   python3 dev/stage-3c/changed_files.py [REPO] [REV]   (REV defaults to the working tree)"""
import subprocess, sys
from pathlib import Path
REPO = Path(sys.argv[1] if len(sys.argv) > 1 else '.'); REV = sys.argv[2] if len(sys.argv) > 2 else None
PARENT = '6e6fa46ecab537f716942b94f873776b09049a40'
git = lambda *a: subprocess.run(['git', '-C', str(REPO), *a], check=True, capture_output=True, text=True).stdout
names = git('diff', '--name-status', PARENT, *([REV] if REV else [])).splitlines() + [f'A\t{f}' for f in git('ls-files', '--others', '--exclude-standard').splitlines() if not REV]
D = {
 'assets/ui.js': 'NEW. The Stage 3C UI controller: main menu, sheets (open / close / focus trap / Escape / focus return), Settings and Credits pages, customize tabs, chips and swatches, the preview start / stop, reduced motion, run-state focus, the HUD Pause and touch INV buttons, the legacy backpack migration. Event-driven; no loops.',
 'assets/ui.css': 'NEW. Tokens and every Stage 3C style: menu, sheets, settings, credits, HUD, pause / caught / won / run panels, hints, touch, customize. Presentation only.',
 'assets/credits_data.js': 'NEW. The editable credits source (empty sections are hidden).',
 'assets/index-DKbV5Nv9.js': 'UI-FACING EDIT, ONE INSERTION: ",window.__avatarApp=Cu" after the customize preview renderer is set up, so assets/ui.js can stop it while Customize is closed. Nothing else in the bundle changes.',
 'mp.js': 'UI-FACING EDIT, ONE LINE: parseLook draws every peer with backpack "none" (cosmetic backpacks removed; an older client\'s pack is not drawn). Networking, timing and everything else unchanged.',
 'inventory.js': 'UI-FACING EDIT, THREE STRINGS: the camcorder wording ("emits no visible light; its night vision uses infrared").',
 'hud.js': 'UI-FACING REWRITE: the settings model only (localStorage fb_settings_v1, same fields, plus rm = reduced motion, migrated and sanitized) and the HUD polish it always had; its dropdown moved to assets/ui.js.',
 'index.html': 'UI-FACING: the main menu, HUD, pause, run-state, customize and touch markup; ui.css, credits_data.js and ui.js are loaded. Every element id of the parent is kept.',
 'STAGE_3C_C0_UI_AUDIT.md': 'DOC. C0 audit: UI owners, seams, saved settings, baseline problems, ownership plan.',
 'STAGE_3C_REPORT.md': 'DOC. The Stage 3C report.', 'STAGE_3C_PERFORMANCE.md': 'DOC. Parent vs Stage 3C UI performance.',
 'STAGE_3C_HUMAN_QA.md': 'DOC. The human-QA guide (scenes A-K).', 'STAGE_3C_CHANGED_FILES.txt': 'DOC. This list.',
 'dev/stage-3c/ui_lib.js': 'DEV. Shared browser helpers.', 'dev/stage-3c/capture_ui.js': 'DEV. Screenshots of every UI surface of one build.',
 'dev/stage-3c/verify_remote_c3.py': 'DEV. Remote checkpoint verification.', 'dev/stage-3c/sheet.py': 'DEV. Screenshots to JPG evidence and contact sheets.',
 'dev/stage-3c/before_after.py': 'DEV. Parent vs Stage 3C contact sheets.', 'dev/stage-3c/changed_files.py': 'DEV. Writes this list.',
 'dev/stage-3c/probe_c1.js': 'DEV. C1 browser checks (menu, sheets, entry).', 'dev/stage-3c/probe_c2.js': 'DEV. C2 browser checks (HUD, pause, run states, touch).',
 'dev/stage-3c/probe_c3.js': 'DEV. C3 browser checks (customize, migration, lock, peers).', 'dev/stage-3c/probe_c4.js': 'DEV. C4 browser checks (settings, migration, accessibility).',
 'dev/stage-3c/probe_c5.js': 'DEV. C5 browser checks (credits, keys, Escape, idle work, responsive, end / restart).',
 'dev/stage-3c/perf_c3.js': 'DEV. UI performance of one build.', 'dev/stage-3c/perf_ab_c3.js': 'DEV. Parent vs Stage 3C, interleaved.',
 'dev/stage-3c/package_c3.py': 'DEV. ZIP, SHA-256 and package receipt.',
}
rows, ev = [], {}
for l in names:
    st, f = l.split('\t', 1)
    if '/evidence/' in f: k = f.split('/evidence/')[1].split('/')[0]; ev[k] = ev.get(k, 0) + 1; continue
    rows.append(f'{ {"A": "added", "M": "modified", "D": "deleted"}.get(st[0], st):<9} {f}\n          {D.get(f, "")}')
T = ['THE FAR BACKROOMS - Stage 3C (UI / HUD / customization / main menu) - changed files', f'since the accepted Stage 3B parent {PARENT} (git diff --name-status{(" " + REV) if REV else ""})', '',
     'Untouched (byte-identical to the parent; checked in the package receipt): the camera and timing policies, server.js, sim.js, ai.js, light.js,',
     'move.js, ents.js, death_srv.js, dphys.js, gore.js, glitch.js, sfx.js, world.js, camcorder.js, assets/br-role.js, assets/l0-remaster.js,',
     'assets/level0_visuals.js, assets/shadows-2d.js, the bundle stylesheet, the other bundle chunks, sounds/, and every earlier dev/ folder.', '', *rows, '',
     'Evidence (dev/stage-3c/evidence/, screenshots as JPG, probe and test results as JSON / logs):', *[f'  {k}/  {n} files' for k, n in sorted(ev.items())]]
(REPO / 'STAGE_3C_CHANGED_FILES.txt').write_text('\n'.join(T) + '\n'); print('\n'.join(T))
