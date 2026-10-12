#!/usr/bin/env python3
"""Stage 3D HQ1 - write STAGE_3D_HQ1_CHANGED_FILES.txt: every file changed since the D7 parent, with what it is (development only;
adapted from dev/stage-3d/changed_files_3d.py).

  python3 -I dev/stage-3d-hq1/changed_files_hq1.py [REV]      (in the repository; REV defaults to the working tree, HEAD plus uncommitted)

Production files are listed one by one with their lines added and removed and the checkpoints that changed them; the Stage 3D tools
HQ1 adjusted are listed one by one; HQ1's own tools and evidence are counted by folder.  Exit status 1 when a file falls in no group."""
import subprocess, sys, collections
from pathlib import Path
PARENT = 'ffe2b53c2e5c6aa76a8db8bd222fd1910c1b0e57'
WHY = {
    'gore.js': 'HQ1-1 wallStains: a wallpaper-face stain per death from the server\'s wall contacts (dphys marks; corpse bl seeds 512-543), the face chosen from the contact normal, stamped through window.__l0v.surfaces; removed and rebuilt by death id',
    'mp.js': 'HQ1-1 the stains driven from replays, corpses and the victim\'s own death (throttled, by death id); HQ1-2 one light timeline per death id (anchor from the server\'s timing, never later), power on every dead light (__peerLights pw, __deathLight.own), no second light at the replay -> corpse handoff',
    'dphys.js': 'HQ1-2 lightProfile (hold 3-7 s, fade 1-2 s, seed; a hash of world and death id), lightPower (hold, irregular falling flicker with blackouts, exactly 0 after), releaseOf (the moment the death lets the light go)',
    'server.js': 'HQ1-2 one light profile per death for a light on at death (not the camcorder) on mk and fx; the corpse\'s age ag in tenths, counted from the death\'s end',
    'death_srv.js': 'HQ1-2 the corpse record carries lf = [hold, fade, seed, release - death length]',
    'assets/net-wire.js': 'HQ1-1 the corpse\'s death id (de) reaches the game\'s record; HQ1-2 its lf',
    'light.js': 'HQ1-2 a dead light\'s power (pw) scales its field, colour and glow; geometry, shadows and masks untouched',
    'assets/br-role.js': 'HQ1-2 the same power in BR-RoLE: the victim\'s own dying beam and every dead peer light',
    'assets/index-DKbV5Nv9.js': 'HQ1-2 the game\'s own lighting (BR-RoLE off) scales the victim\'s dying light and dead peer lights by the same power; HQ1-3a the power read inside BR-RoLE\'s seam so its text stays verbatim (dev/stage-3d/apply_bundle.py)'}
STAGE3D_TOOLS = {
    'dev/stage-3d/apply_bundle.py': 'the two HQ1 bundle edits (HQ1-2; HQ1-3a keeps the seam verbatim)',
    'dev/stage-3d/cli_golden3d.js': '__deathLight declared; dead lights left out of the non-death view of the light list',
    'dev/stage-3d/contract_check3d.js': 'lf among the replay\'s optional fields',
    'dev/stage-3d/death_net.js': 'N10\'s corpse-size line: D7\'s 384 B + 32 for the light profile'}
rev = sys.argv[1] if len(sys.argv) > 1 else None
args = ['git', 'diff', '--numstat', PARENT] + ([rev] if rev else [])
ns = [l.split('\t') for l in subprocess.run(args, check=True, capture_output=True, text=True).stdout.splitlines() if l]
if not rev:   # untracked files of the working tree too
    for f in subprocess.run(['git', 'ls-files', '--others', '--exclude-standard'], check=True, capture_output=True, text=True).stdout.splitlines():
        try: n = len(Path(f).read_text(encoding='utf-8').splitlines())
        except Exception: n = '-'
        ns.append([str(n), '0', f])
prod = [r for r in ns if r[2] in WHY]; docs = [r for r in ns if '/' not in r[2] and r[2].startswith('STAGE_3D_HQ1_')]
s3d = [r for r in ns if r[2] in STAGE3D_TOOLS]; tool = [r for r in ns if r[2].startswith('dev/stage-3d-hq1/')]
other = [r for r in ns if r not in prod and r not in docs and r not in s3d and r not in tool]
key = lambda p: '/'.join(p.split('/')[:5]) if p.startswith('dev/stage-3d-hq1/evidence/') and p.count('/') > 4 else '/'.join(p.split('/')[:4]) if p.startswith('dev/stage-3d-hq1/evidence/') else p
by = collections.Counter(key(r[2]) for r in tool)
L = [f'Stage 3D HQ1 (wall blood + dying lights): files changed since the D7 parent {PARENT[:7]} (stage-3d) - {"working tree" if not rev else rev}', '',
     f'production: {len(prod)} files', *[f'  {r[2]:<28} +{r[0]:>4} -{r[1]:>4}  {WHY[r[2]]}' for r in sorted(prod, key=lambda r: r[2])], '',
     f'Stage 3D tools adjusted for HQ1: {len(s3d)} files', *[f'  {r[2]:<36} +{r[0]:>3} -{r[1]:>3}  {STAGE3D_TOOLS[r[2]]}' for r in sorted(s3d, key=lambda r: r[2])], '',
     f'stage documents: {len(docs)}', *[f'  {r[2]}' for r in sorted(docs, key=lambda r: r[2])], '',
     f'HQ1 tools and evidence under dev/stage-3d-hq1/: {len(tool)} files', *[f'  {k:<62} {v}' for k, v in sorted(by.items())], '',
     f'anything else: {len(other)}' + ('' if not other else ' -> ' + ', '.join(r[2] for r in other)), '',
     'Not changed (byte-identical to D7): index.html (no new script, same load order), assets/l0-remaster.js (its surfaces API is used as it is), ai.js, sim.js,',
     'world.js, move.js, ents.js and dev/ents_src, camcorder.js, glitch.js, hud.js, inventory.js, camera_policy.js, timing_policy.js, sfx.js, server/, assets/net-interp.js,',
     'assets/ui.js, the CSS, the menu, the theme files, sounds/, audio_source/, the deployment workflow, every older test (dev/tests), dev/stage-3d/evidence and every',
     'earlier stage folder.']
Path('STAGE_3D_HQ1_CHANGED_FILES.txt').write_text('\n'.join(L) + '\n'); print('\n'.join(L))
sys.exit(1 if other else 0)
