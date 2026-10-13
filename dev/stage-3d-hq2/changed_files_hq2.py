#!/usr/bin/env python3
"""Stage 3D HQ2 - write STAGE_3D_HQ2_CHANGED_FILES.txt: every file changed since the accepted HQ1 parent, with what it is (development
only; adapted from dev/stage-3d-hq1/changed_files_hq1.py).

  python3 -I dev/stage-3d-hq2/changed_files_hq2.py [REV]      (in the repository; REV defaults to the working tree, HEAD plus uncommitted)

Production files are listed one by one with their lines added and removed and the checkpoints that changed them, with the reason H2-0's
allowlist gave next to what the change is; the one Stage 3D tool HQ2 extended is listed; HQ2's own tools and evidence are counted by
folder.  Exit status 1 when a file falls in no group."""
import subprocess, sys, collections
from pathlib import Path
PARENT = 'ebb3bd603e8a2bb4ef00cc40aa6b415bccab9763'
WHY = {
    'server.js': 'H2-1 nrIntent: one answer (nra) per NEW RUN press; a client\'s fx and b no longer read; no Vanish record. H2-2 boomStart: the blast as the server\'s own aftermath (fx boom to everyone, a late joiner with el; the Boom corpse at its end); killerEnd for a hound only. H2-3 living players solid: mvCheck sweeps the other players after the walls (server/peers.js), free-spot placement for spawns, respawns, admin moves and the world reset, soft corrections (tp pc:1, at most one per 0.3 s), in-flight packets after a placement ignored. H2-4 worldReset: world {w, x, y} to every connection, fx end for each dropped death or blast; s.w and bodies.w. H2-5 an fx names its world in wn (its w is the Hound C wall again)',
    'sim.js': 'built from dev/sim_glue.js (dev/build_sim.sh). H2-1 newRun / nrWhy / nrWait: the 30 s cooldown as one decision that takes the player out of the world; the vanish window and its join/leave allowances removed. H2-3 moveRoute: how a long hop is allowed (the route), so the other players can be swept along it',
    'death_srv.js': 'H2-2 boomFx (the blast\'s replay message), boomBegin (the server\'s run of it), its length; the eight deaths untouched',
    'dphys.js': 'H2-2 a separate Boom kind (createBoom, stepBoom, beginBoom, prepare\'s Boom branch, boomPlan: seed and direction from the world and the event id, 3.2 s); create, stepOnce, begin and prepare branch off for Boom before any of the old code; HQ1\'s wall marks and light profile reused',
    'mp.js': 'H2-1 __net.nr: the intent, the answer, the button\'s refusal text. H2-2 the boom replay (the player\'s own page too), its light, stains and clock anchor as a death\'s; the run menu\'s words. H2-4 __peerBodies (the solid others at their server positions), soft corrections blended, worldNew / oldWorld (the world epoch). H2-5 oldWorld reads an fx\'s wn; every soft correction up to 600 px blended',
    'move.js': 'H2-4 peerProject: the step loses the part into a living player (36.75 px), keeps the part along him; peerOnPath: a vault does not start into a player. Nothing changes with nobody there',
    'gore.js': 'H2-4 wallStains.clear(): an old world\'s wall stains go at once on a world reset. (H2-0\'s allowlist named gore.js for the blast\'s blood; the blast needed no gore.js change, and this world-reset line is the one that was made: recorded as a deviation from the allowlist\'s stated reason)',
    'ents.js': 'built from dev/ents_src (dev/build_ents.sh). H2-2 deathPlan for a blast (no knock, drag or blows; the server\'s seed and direction); boomVoice: one placed blast sound on the existing audio bus',
    'assets/index-DKbV5Nv9.js': 'exact-text edits only, made by dev/stage-3d/apply_bundle.py: H2-1 Xnr sends the intent online, Xok the approved beat; H2-2 Xok puts the player\'s own light out; H2-4 __api.worldEnd -> Xwr (a world reset ends our own death where the server put us)',
    'server/peers.js': 'new (H2-3): the peer-collision geometry (the swept floor, the slide, the clamp, routes, freeSpot); server-side only, never served',
    'dev/sim_glue.js': 'the source of sim.js (see sim.js)',
    'dev/ents_src/25_death.js': 'a source of ents.js: deathPlan for a blast (see ents.js)',
    'dev/ents_src/30_audio.js': 'a source of ents.js: boomVoice (see ents.js)'}
STAGE3D_TOOLS = {'dev/stage-3d/apply_bundle.py': 'the HQ2 bundle edits (H2-1 Xnr / Xok, H2-2 the light out, H2-4 worldEnd / Xwr), each parent text found exactly once'}
rev = sys.argv[1] if len(sys.argv) > 1 else None
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout
ns = [l.split('\t') for l in run('git', 'diff', '--numstat', PARENT, *([rev] if rev else [])).splitlines() if l]
if not rev:   # untracked files of the working tree too
    for f in run('git', 'ls-files', '--others', '--exclude-standard').splitlines():
        try: n = len(Path(f).read_text(encoding='utf-8').splitlines())
        except Exception: n = '-'
        ns.append([str(n), '0', f])
ns = [r for r in ns if '__pycache__/' not in r[2]]
cps = {}
for r in ns:
    if r[2] in WHY or r[2] in STAGE3D_TOOLS:
        subj = run('git', 'log', '--format=%s', f'{PARENT}..{rev or "HEAD"}', '--', r[2]).splitlines()
        cps[r[2]] = sorted({s.split(':')[0].replace('Stage 3D HQ', 'H') for s in subj})
prod = [r for r in ns if r[2] in WHY and not r[2].startswith('dev/')]; src = [r for r in ns if r[2] in WHY and r[2].startswith('dev/')]
docs = [r for r in ns if '/' not in r[2] and r[2].startswith('STAGE_3D_HQ2_')]
s3d = [r for r in ns if r[2] in STAGE3D_TOOLS]; tool = [r for r in ns if r[2].startswith('dev/stage-3d-hq2/')]
other = [r for r in ns if r not in prod and r not in src and r not in docs and r not in s3d and r not in tool]
key = lambda p: '/'.join(p.split('/')[:5]) if p.startswith('dev/stage-3d-hq2/evidence/') and p.count('/') > 4 else '/'.join(p.split('/')[:4]) if p.startswith('dev/stage-3d-hq2/evidence/') else p
by = collections.Counter(key(r[2]) for r in tool)
cp = lambda p: ' '.join(cps.get(p, []))
L = [f'Stage 3D HQ2 (NEW RUN explosion + player collision): files changed since the accepted HQ1 parent {PARENT[:7]} (stage-3d-hq1) - {"working tree" if not rev else rev}', '',
     f'production: {len(prod)} files ({sum(1 for r in prod if r[2] == "server/peers.js")} new)',
     *[f'  {r[2]:<26} +{r[0]:>4} -{r[1]:>4}  [{cp(r[2])}]\n      {WHY[r[2]]}' for r in sorted(prod, key=lambda r: r[2])], '',
     f'sources of built production files: {len(src)}', *[f'  {r[2]:<26} +{r[0]:>4} -{r[1]:>4}  [{cp(r[2])}]  {WHY[r[2]]}' for r in sorted(src, key=lambda r: r[2])], '',
     f'Stage 3D tool extended for HQ2: {len(s3d)}', *[f'  {r[2]:<30} +{r[0]:>3} -{r[1]:>3}  [{cp(r[2])}]  {STAGE3D_TOOLS[r[2]]}' for r in sorted(s3d, key=lambda r: r[2])], '',
     f'stage documents: {len(docs)}', *[f'  {r[2]}' for r in sorted(docs, key=lambda r: r[2])], '',
     f'HQ2 tools and evidence under dev/stage-3d-hq2/: {len(tool)} files', *[f'  {k:<66} {v}' for k, v in sorted(by.items())], '',
     f'anything else: {len(other)}' + ('' if not other else ' -> ' + ', '.join(r[2] for r in other)), '',
     'Not changed (byte-identical to HQ1): index.html (no new script, same load order), assets/net-wire.js (no new corpse field was needed),',
     'light.js, assets/br-role.js, assets/l0-remaster.js, assets/ui.js, assets/net-interp.js, ai.js, world.js, camcorder.js, glitch.js, hud.js, inventory.js,',
     'camera_policy.js, timing_policy.js, sfx.js, the CSS, the menu, the theme files, sounds/, audio_source/, the deployment workflow, every older test (dev/tests),',
     'every earlier stage\'s tools and evidence (dev/stage-3d apart from apply_bundle.py, dev/stage-3d-hq1, dev/stage-3h0, dev/stage-3c*, dev/stage-3b*).']
Path('STAGE_3D_HQ2_CHANGED_FILES.txt').write_text('\n'.join(L) + '\n'); print('\n'.join(L))
sys.exit(1 if other else 0)
