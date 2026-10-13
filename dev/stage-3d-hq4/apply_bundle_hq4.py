#!/usr/bin/env python3
"""Stage 3D HQ4: the game bundle's HQ4 edit, applied as exact text to the accepted HQ3 QA1 bundle (development only).

  python3 -I dev/stage-3d-hq4/apply_bundle_hq4.py [--check] [--out FILE]      (in the repository; --check: only verify the working copy
                                                                             is exactly this; --out: write HQ4's bundle there instead)

The chain, rebuilt in memory every time (nothing of an earlier stage is modified):
  1. Stage 3H0's bundle (git 06949a8) + every edit dev/stage-3d/apply_bundle.py lists (read from that file, unchanged)
     must give, byte for byte, the accepted HQ3 QA1 bundle (git 4934319): the earlier stages' build still reproduces HQ3;
  2. that accepted bundle + HQ4's edits below (each old text found exactly once) is HQ4's bundle.
Without --check it writes HQ4's bundle to assets/index-DKbV5Nv9.js; with --check it compares the working copy byte for byte.

To undo an HQ4 edit: remove it from HQ4_EDITS and run this again (or restore assets/index-DKbV5Nv9.js from 4934319)."""
import ast, subprocess, sys
from pathlib import Path

B = 'assets/index-DKbV5Nv9.js'
STAGE_3H0 = '06949a8a4204a1ce8144b87b2192251b259b21ec'
ACCEPTED_HQ3 = '49343193e6948c8323f35a34539ac84db5a89835'
HQ4_EDITS = [
    # (checkpoint, what, accepted HQ3 text, HQ4 text)
    ('H4-1', "the Wanderer's decorative dark ellipse removed: the anonymous Graphics ellipse(1,5,19,19) at 30 % black that rebuild() added "
             "before the backpack and the body (it turned with the avatar and showed as a dark crescent behind it); the backpack and the "
             "body stay first, in the same order, drawn exactly as before",
     'this.addChild(new I().ellipse(1,5,19,19).fill({color:0,alpha:.3}),this.pack,this.body);',
     'this.addChild(this.pack,this.body);'),
]


def git_show(rev, path): return subprocess.run(['git', 'show', f'{rev}:{path}'], check=True, capture_output=True).stdout.decode('utf-8')


def apply(base, edits, label):
    out = base
    for cp, what, old, new in edits:
        if base.count(old) != 1: sys.exit(f'{label} {cp} "{what[:60]}": the text is in its base {base.count(old)} times, not once')
        if out.count(old) != 1: sys.exit(f'{label} {cp} "{what[:60]}": the text is no longer there exactly once after the earlier edits')
        out = out.replace(old, new)
    return out


src = Path('dev/stage-3d/apply_bundle.py').read_text(encoding='utf-8')
EDITS_3D = ast.literal_eval(src[src.index('EDITS = [') + len('EDITS = '):src.index(']\n\n\ndef build') + 1])
hq3 = git_show(ACCEPTED_HQ3, B)
rebuilt = apply(git_show(STAGE_3H0, B), EDITS_3D, 'Stage 3D')
if rebuilt != hq3: sys.exit(f'{B}: Stage 3H0 + the {len(EDITS_3D)} Stage 3D edits no longer give the accepted HQ3 bundle - stop')
want = apply(hq3, HQ4_EDITS, 'HQ4')
if '--check' in sys.argv:
    have = Path(B).read_text(encoding='utf-8'); ok = have == want
    print(f'{B}: Stage 3H0 + {len(EDITS_3D)} Stage 3D edits == accepted HQ3 {ACCEPTED_HQ3[:7]}; + {len(HQ4_EDITS)} HQ4 edit(s): working copy {"matches" if ok else "DIFFERS"}')
    sys.exit(0 if ok else 1)
dest = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else B
Path(dest).write_text(want, encoding='utf-8')
print(f'{dest}: Stage 3H0 + {len(EDITS_3D)} Stage 3D edits == accepted HQ3 {ACCEPTED_HQ3[:7]} ({len(hq3)} chars); + {len(HQ4_EDITS)} HQ4 edit(s) -> {len(want)} chars')
for cp, what, old, new in HQ4_EDITS: print(f'  {cp}: {what}')
