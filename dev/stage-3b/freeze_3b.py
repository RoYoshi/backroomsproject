#!/usr/bin/env python3
"""Stage 3B gameplay freeze: the SH0 manifest of the immutable v23.3.6 parent, with BR-RoLE's presentation allowance
(dev/br-role/freeze_br.py, imported, unchanged) plus Stage 3B's.

  python3 dev/stage-3b/freeze_3b.py --dir PATH        (a checkout or an extracted ZIP; exit 1 on any violation)

Every file of the parent must be byte-identical, except exactly two presentation files, and each of those must give back
the parent's bytes when the Stage 3B edits and then the BR-RoLE edits are undone:
  index.html                BR-RoLE's br-role.js tag + Stage 3B's two tags (TAGS_3B)
  assets/index-DKbV5Nv9.js  BR-RoLE's guarded hooks + Stage 3B's two guarded hooks in the renderer's build() (HOOKS_3B)
New files are allowed only as presentation or development: BR-RoLE's, plus assets/level0_visuals.js (the presentation
authority), assets/l0-remaster.js (the remaster module), dev/stage-3b/**, STAGE_3B_*.  world.js and every other
special-protection file must be identical (listed one by one).
"""
import argparse, hashlib, importlib.util, json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('freeze_br', HERE.parent / 'br-role' / 'freeze_br.py'); FB = importlib.util.module_from_spec(spec); spec.loader.exec_module(FB)
TAGS_3B = [b'<script src="./assets/level0_visuals.js"></script><script src="./assets/l0-remaster.js"></script>']
HOOKS_3B = [  # (Stage 3B bundle text, the text it replaced)
    (b"L=window.__l0v?__l0v.lamp(t,e,this.lampTop):this.lampTop;", b"L=this.lampTop;"),
    (b"this.creatures.mask=this.sightMask,window.__l0v&&__l0v.built(this.world,i,this.lampTop,this.app)}beginDeath(e){", b"this.creatures.mask=this.sightMask}beginDeath(e){"),
]
NEW_OK_FILES = FB.NEW_OK_FILES + ('assets/level0_visuals.js', 'assets/l0-remaster.js')
NEW_OK_PREFIXES = FB.NEW_OK_PREFIXES + ('dev/stage-3b/', 'STAGE_3B_')
sha = FB.sha

def undo(b, pairs):
    for new, old in pairs:
        n = b.count(new)
        if n == 0: continue                      # a hook not (yet) present is fine; only an exact, single occurrence is undone
        if n != 1: return None
        b = b.replace(new, old, 1)
    return b

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--dir', required=True); ap.add_argument('--label', default=None); a = ap.parse_args()
    root = Path(a.dir).resolve(); man = json.loads(FB.MAN.read_text()); base = {f['path']: f for f in man['files']}
    have = {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file() and '.git' not in p.relative_to(root).parts}
    changed, removed, viol, undone, hooks = [], [], [], {}, {}
    for p, f in base.items():
        fp = root / p
        if not fp.exists(): removed.append(p); viol.append('removed ' + p); continue
        b = fp.read_bytes()
        if sha(b) == f['sha256']: continue
        changed.append(p)
        if p == 'index.html':
            hooks[p] = sum(b.count(t) for t in TAGS_3B)
            r = b
            for t in TAGS_3B:
                if r.count(t) > 1: r = None; break
                r = r.replace(t, b'', 1)
            ok = r is not None and r.count(FB.TAG) == 1 and sha(r.replace(FB.TAG, b'', 1)) == f['sha256']; undone[p] = ok
            if not ok: viol.append('index.html differs from the parent by more than the br-role.js and Stage 3B tags')
        elif p == 'assets/index-DKbV5Nv9.js':
            hooks[p] = sum(b.count(new) for new, _ in HOOKS_3B)
            r = undo(b, HOOKS_3B); ok = r is not None
            if ok:
                for new, old in FB.HOOKS:
                    if r.count(new) != 1: ok = False; break
                    r = r.replace(new, old, 1)
            ok = ok and sha(r) == f['sha256']; undone[p] = ok
            if not ok: viol.append('the bundle differs from the parent by more than the BR-RoLE and Stage 3B hooks')
        else: viol.append(f'changed {f["class"]} file {p}')
    added = sorted(p for p in have - set(base))
    for p in added:
        if not (p in NEW_OK_FILES or p.startswith(NEW_OK_PREFIXES)): viol.append('unexpected new file ' + p)
    label = a.label or str(root)
    print(f'candidate {label}: {len(base) - len(changed) - len(removed)}/{len(base)} parent files byte-identical; {len(changed)} changed; {len(removed)} removed; {len(added)} added')
    for p in FB.PROTECTED: print(('IDENTICAL ' if (root / p).exists() and sha((root / p).read_bytes()) == base[p]['sha256'] else 'CHANGED   ') + p)
    for p in changed: print(f'CHANGED [presentation] {p}: Stage 3B edits ({hooks.get(p, 0)}) then BR-RoLE edits undone give the parent byte for byte: {"yes" if undone.get(p) else "NO"}')
    for v in viol: print('VIOLATION', v)
    print('FREEZE OK' if not viol else 'FREEZE VIOLATED')
    return 0 if not viol else 1

if __name__ == '__main__': sys.exit(main())
