#!/usr/bin/env python3
"""Stage 3D: the game bundle's death edits, applied as exact text to the accepted parent's bundle (git 06949a8, stage-3h0).

  python3 -I dev/stage-3d/apply_bundle.py [--check]      (in the repository; --check: only verify the bundle is exactly this)

Each edit replaces one piece of the parent's text that occurs exactly once, by its new text.  The bundle is always rebuilt from the
parent's, so the result does not depend on what the working copy holds, and running it again is safe.  --check rebuilds it in memory
and compares it with the working copy byte for byte.

The edits are small hooks: the logic they call lives in readable files (gore.js, mp.js, dphys.js) loaded before the bundle.
"""
import subprocess, sys
from pathlib import Path

B = 'assets/index-DKbV5Nv9.js'
PARENT = '06949a8a4204a1ce8144b87b2192251b259b21ec'
EDITS = [
    # (checkpoint, what, parent text, new text)
    ('D3', 'corpse views: drawn only near the camera (gore.cull decides from the record and the scene)',
     't.visible=(e.id!==i.corpseId||!i.active)&&!(window.__hideBodies&&window.__hideBodies.has(e.ownerId))}',
     't.visible=(e.id!==i.corpseId||!i.active)&&!(window.__hideBodies&&window.__hideBodies.has(e.ownerId))&&!(window.__gore&&window.__gore.cull&&window.__gore.cull(e,this))}'),
    ('D3', 'a corpse view, once built, is kept as one texture (gore.cached); its blood dries on it over the first minute',
     'n.position.set(t.hat.x,t.hat.y),n.rotation=t.hat.angle,this.addChild(n)}}},tu=class{',
     'n.position.set(t.hat.x,t.hat.y),n.rotation=t.hat.angle,this.addChild(n)}window.__gore&&window.__gore.cached&&window.__gore.cached(this,t)}},tu=class{'),
]


def build(parent):
    out = parent
    for cp, what, old, new in EDITS:
        if parent.count(old) != 1: sys.exit(f'{cp} "{what}": the parent text is in the parent bundle {parent.count(old)} times, not once')
        if out.count(old) != 1: sys.exit(f'{cp} "{what}": the parent text is no longer there exactly once after the earlier edits')
        out = out.replace(old, new)
    return out


parent = subprocess.run(['git', 'show', f'{PARENT}:{B}'], check=True, capture_output=True).stdout.decode('utf-8')
want = build(parent)
if '--check' in sys.argv:
    have = Path(B).read_text(encoding='utf-8'); ok = have == want
    print(f'{B}: {len(EDITS)} edits on the parent; working copy {"matches" if ok else "DIFFERS"}'); sys.exit(0 if ok else 1)
Path(B).write_text(want, encoding='utf-8')
print(f'{B}: {len(EDITS)} edits applied to the parent ({len(parent)} -> {len(want)} chars)')
for cp, what, old, new in EDITS: print(f'  {cp}: {what}')
