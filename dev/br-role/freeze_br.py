#!/usr/bin/env python3
"""BR-RoLE gameplay freeze: the SH0 manifest of the immutable v23.3.6 parent, with BR-RoLE's presentation allowance.

  python3 dev/br-role/freeze_br.py --dir PATH        (a checkout or an extracted ZIP; exit 1 on any violation)

Every file of the parent must be byte-identical, except exactly two presentation files, and each of those must give back
the parent's bytes when BR-RoLE's edit is undone:
  index.html                the one <script src="./assets/br-role.js"></script> tag (SH1-SH7 loaded shadows-2d.js there)
  assets/index-DKbV5Nv9.js  the guarded hook inside drawLight / drawPeers (HOOKS below, undone verbatim)
New files are allowed only as presentation or development: assets/br-role.js, assets/shadows-2d.js (the SH7 donor, not
loaded), dev/br-role/**, dev/shadows/**, BR_ROLE_*, 2D_SHADOWS_*.  The special-protection files are listed one by one.
"""
import argparse, hashlib, json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
MAN = HERE.parent / 'shadows/evidence/sh0/parent_manifest.json'
PROTECTED = ['ai.js', 'sim.js', 'move.js', 'server.js', 'mp.js', 'death_srv.js', 'dphys.js', 'camera_policy.js', 'world.js', 'light.js', 'ents.js', 'camcorder.js', 'timing_policy.js']
TAG = b'<script src="./assets/br-role.js"></script>'
HOOKS = [  # (BR-RoLE bundle text, the v23.3.6 text it replaced)
    (b"let BR=window.__brRole&&window.__brRole.on()?window.__brRole:null,l=this.death.active?this.death.body:H,u=c(l.x,l.y,18,670);BR||(u.addColorStop(0,`rgba(0,0,0,.14)`),u.addColorStop(.5,`rgba(0,0,0,.045)`),u.addColorStop(1,`rgba(0,0,0,0)`),n.fillStyle=u,s(l.x-670,l.y-670,1340,1340)),BR||V.blackout||Fc.forEach(",
     b"let l=this.death.active?this.death.body:H,u=c(l.x,l.y,18,670);u.addColorStop(0,`rgba(0,0,0,.14)`),u.addColorStop(.5,`rgba(0,0,0,.045)`),u.addColorStop(1,`rgba(0,0,0,0)`),n.fillStyle=u,s(l.x-670,l.y-670,1340,1340),V.blackout||Fc.forEach("),
    (b"_=mk(d,m,h,g);BR&&BR.draw(n,{t,on:e,r,ox:i,oy:a,w:this.width,h:this.height,viewer:l,src:d,kind:H.equipment.kind,color:p,death:this.death.active});if(!BR&&e&&!f.nv){",
     b"_=mk(d,m,h,g);if(e&&!f.nv){"),
    (b"window.__peerLights&&window.__peerLights.length&&drawPeers(mk,t,!!BR)", b"window.__peerLights&&window.__peerLights.length&&drawPeers(mk,t)"),
    (b"function drawPeers(mk,t,B){for(let p of window.__peerLights){if(p.kind===`camcorder`){window.__cam&&window.__cam.peerIR(mk,p);continue}if(B)continue;",
     b"function drawPeers(mk,t){for(let p of window.__peerLights){if(p.kind===`camcorder`){window.__cam&&window.__cam.peerIR(mk,p);continue}"),
]
NEW_OK_FILES = ('assets/br-role.js', 'assets/shadows-2d.js')
NEW_OK_PREFIXES = ('dev/br-role/', 'dev/shadows/', 'BR_ROLE_', '2D_SHADOWS_')
sha = lambda b: hashlib.sha256(b).hexdigest()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--dir', required=True); ap.add_argument('--label', default=None); a = ap.parse_args()
    root = Path(a.dir).resolve(); man = json.loads(MAN.read_text()); base = {f['path']: f for f in man['files']}
    have = {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and '.git' not in p.relative_to(root).parts}
    changed, removed, viol, undone = [], [], [], {}
    for p, f in base.items():
        fp = root / p
        if not fp.exists(): removed.append(p); viol.append('removed ' + p); continue
        b = fp.read_bytes()
        if sha(b) == f['sha256']: continue
        changed.append(p)
        if p == 'index.html':
            ok = b.count(TAG) == 1 and sha(b.replace(TAG, b'', 1)) == f['sha256']; undone[p] = ok
            if not ok: viol.append('index.html differs from the parent by more than the br-role.js tag')
        elif p == 'assets/index-DKbV5Nv9.js':
            r = b; ok = True
            for new, old in HOOKS:
                if r.count(new) != 1: ok = False; break
                r = r.replace(new, old, 1)
            ok = ok and sha(r) == f['sha256']; undone[p] = ok
            if not ok: viol.append('the bundle differs from the parent by more than the BR-RoLE hook')
        else: viol.append(f'changed {f["class"]} file {p}')
    added = sorted(p for p in have - set(base))
    for p in added:
        if not (p in NEW_OK_FILES or p.startswith(NEW_OK_PREFIXES)): viol.append('unexpected new file ' + p)
    label = a.label or str(root)
    print(f'candidate {label}: {len(base) - len(changed) - len(removed)}/{len(base)} parent files byte-identical; {len(changed)} changed; {len(removed)} removed; {len(added)} added')
    for p in PROTECTED: print(('IDENTICAL ' if (root / p).exists() and sha((root / p).read_bytes()) == base[p]['sha256'] else 'CHANGED   ') + p)
    for p in changed: print(f'CHANGED [presentation] {p}: BR-RoLE edit undone gives the parent byte for byte: {"yes" if undone.get(p) else "NO"}')
    for v in viol: print('VIOLATION', v)
    print('FREEZE OK' if not viol else 'FREEZE VIOLATED')
    return 0 if not viol else 1

if __name__ == '__main__': sys.exit(main())
