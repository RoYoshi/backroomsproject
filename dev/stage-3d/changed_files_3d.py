#!/usr/bin/env python3
"""Stage 3D - write STAGE_3D_CHANGED_FILES.txt: every file changed since the accepted parent, with what it is (development only).

  python3 -I dev/stage-3d/changed_files_3d.py [REV]      (in the repository; REV defaults to the working tree, HEAD plus uncommitted)

Production files are listed one by one with their lines added and removed and the checkpoints that changed them; the stage's tools and
evidence are counted by folder."""
import subprocess, sys, collections
from pathlib import Path
PARENT = '06949a8a4204a1ce8144b87b2192251b259b21ec'
WHY = {'dphys.js': 'D1 rest is final, jaw release, hand twitch, walk-mode collision, blocker cache; D2 blow / wall events and marks; D4 knock and drag in walk mode; D5 sound hook, reduced-motion shake factor; D6 the jaw lets go once, prepare / finish (the server runs it in pieces)',
       'death_srv.js': 'D1 main-context load and warm-up; D2 wall marks in the corpse blood list; D6 begin / step / corpse (spread over the death)',
       'gore.js': 'D2 floor-clamped pools and spatter, wall marks, redraw only on change; D3 corpse drying, caching, culling; D6 drying only on screen, wall-mark plans kept, a culling margin',
       'ents.js': 'built from dev/ents_src (dev/build_ents.sh)', 'dev/ents_src/25_death.js': "D2 Hound C's scripted smear replaced by real wall marks",
       'dev/ents_src/30_audio.js': 'D5 death-only sounds (physics hits, wall, light, hat; spectator voice); D6 a late joiner skips the sounds already past',
       'server.js': 'D2 blood list bound; D3 corpse age; D4 the server-authored death event, replay, corpse, revive / world-reset handling, NEW RUN record checks; D6 the death run spread over the ticks, the NEW RUN record\'s light and look from the server\'s state',
       'sim.js': 'built from dev/sim_head.js + dev/sim_glue.js (dev/build_sim.sh)', 'dev/sim_glue.js': 'D4 worldSeq (counts world resets)',
       'mp.js': 'D3 replay lights, corpse light from the lens; D4 victim from the kill record, no client death claims, dedupe, late join, end; D5 spectator death voice; D6 the own-corpse hiding ends on a new id or a closed connection',
       'assets/net-wire.js': 'D3/D6 corpse age (born) when the server sends it', 'sfx.js': "D5 a drop-in death recording follows a spectator's placement",
       'assets/index-DKbV5Nv9.js': 'D3 corpse culling and caching hooks; D4 victim-from-record hook; D5 death sound options, shake factor (dev/stage-3d/apply_bundle.py)'}
rev = sys.argv[1] if len(sys.argv) > 1 else None
args = ['git', 'diff', '--numstat', PARENT] + ([rev] if rev else [])
ns = [l.split('\t') for l in subprocess.run(args, check=True, capture_output=True, text=True).stdout.splitlines() if l]
if not rev:   # untracked files of the working tree too
    for f in subprocess.run(['git', 'ls-files', '--others', '--exclude-standard'], check=True, capture_output=True, text=True).stdout.splitlines():
        try: n = len(Path(f).read_text(encoding='utf-8').splitlines())
        except Exception: n = '-'
        ns.append([str(n), '0', f])
prod = [r for r in ns if r[2] in WHY]; docs = [r for r in ns if '/' not in r[2] and r[2].startswith('STAGE_3D_')]
tool = [r for r in ns if r[2].startswith('dev/stage-3d/')]; other = [r for r in ns if r not in prod and r not in docs and r not in tool]
by = collections.Counter('/'.join(r[2].split('/')[:4]) if r[2].startswith('dev/stage-3d/evidence/') else '/'.join(r[2].split('/')[:3]) if r[2].count('/') > 2 else r[2] for r in tool)
L = [f'Stage 3D (Gore & Death 2.0): files changed since the accepted parent {PARENT[:7]} (stage-3h0) - {"working tree" if not rev else rev}', '',
     f'production (death code): {len(prod)} files', *[f'  {r[2]:<28} +{r[0]:>4} -{r[1]:>4}  {WHY[r[2]]}' for r in sorted(prod, key=lambda r: r[2])], '',
     f'stage documents: {len(docs)}', *[f'  {r[2]}' for r in sorted(docs, key=lambda r: r[2])], '',
     f'tools and evidence under dev/stage-3d/: {len(tool)} files', *[f'  {k:<44} {v}' for k, v in sorted(by.items())], '',
     f'anything else: {len(other)}' + ('' if not other else ' -> ' + ', '.join(r[2] for r in other)), '',
     'Not changed (byte-identical to the parent): index.html (no new script, same load order), ai.js, world.js, move.js, light.js, glitch.js, camcorder.js, hud.js,',
     'inventory.js, camera_policy.js, timing_policy.js, server/ws.js, server/fields.js, server/static.js, assets/net-interp.js, assets/ui.js, the CSS, the menu,',
     'BR-RoLE, Level 0 visuals, the theme files, sounds/, audio_source/, the deployment workflow, every older test (dev/tests) and every earlier stage folder.']
Path('STAGE_3D_CHANGED_FILES.txt').write_text('\n'.join(L) + '\n'); print('\n'.join(L))
sys.exit(1 if other else 0)
