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
    ('D4', "the victim's own death starts from the server's kill record (mp.js window.__dvic), so victim, spectators and the server's corpse run one death",
     'start(e,t,n,r=-1,V=null,K=null){let H=V||window.__api.H;',
     'start(e,t,n,r=-1,V=null,K=null){let H=V||window.__dvic&&window.__dvic(K)||window.__api.H;'),
    ('D5', "the death sound's blows fall when the physics' blows fall (dphys hits, not a fixed table); a spectator hears it placed: gain, pan and muffling",
     'death(e){if(!this.context||!this.gain)return;if(window.__sfx&&window.__sfx.death(e))return;const t=this.context,n=t.currentTime,H=e===`Hound`,hits=ql[e],bus=t.createDynamicsCompressor();bus.threshold.value=-14;bus.ratio.value=5;bus.connect(this.gain);setTimeout(()=>{try{bus.disconnect()}catch{}},6500);',
     'death(e,O){if(!this.context||!this.gain)return;if(window.__sfx&&window.__sfx.death(e,O))return;const t=this.context,n=t.currentTime,H=e===`Hound`,hits=O&&O.hits||window.__dsndHits&&window.__dsndHits(e)||ql[e],bus=t.createDynamicsCompressor();bus.threshold.value=-14;bus.ratio.value=5;const og3=t.createGain(),lf3=t.createBiquadFilter(),pn3=t.createStereoPanner();og3.gain.value=O&&O.gain!=null?O.gain:1;lf3.type=`lowpass`;lf3.frequency.value=O&&O.lp||20000;pn3.pan.value=O&&O.pan||0;bus.connect(og3);og3.connect(lf3);lf3.connect(pn3);pn3.connect(this.gain);setTimeout(()=>{try{bus.disconnect();og3.disconnect();lf3.disconnect();pn3.disconnect()}catch{}},6500);'),
    ('D5', 'reduced motion: the death\'s camera shake (dphys impulse) is scaled down (window.__dcamK)',
     'i.ph?i.ph.cam.x*this.scale:', 'i.ph?i.ph.cam.x*this.scale*(window.__dcamK?window.__dcamK():1):'),
    ('D5', 'reduced motion: the same for the vertical shake',
     'i.ph?i.ph.cam.y*this.scale:', 'i.ph?i.ph.cam.y*this.scale*(window.__dcamK?window.__dcamK():1):'),
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
