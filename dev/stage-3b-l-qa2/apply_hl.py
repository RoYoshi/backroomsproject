#!/usr/bin/env python3
"""Stage 3B-L QA2: put the darkness-clip face allowance (dev/stage-3b-l-qa2/hl_qa2.js, between its markers) into the game
bundle in place of the parent's Hl - exactly one function, checked to be the parent's text before it is replaced.  The
bundle is rebuilt from the QA1 parent's (git d3ec226), so running it again after editing hl_qa2.js is safe.

  python3 dev/stage-3b-l-qa2/apply_hl.py [--check]     (in the repository; --check: only verify the bundle holds it)"""
import subprocess, sys
from pathlib import Path
B = Path('assets/index-DKbV5Nv9.js'); SRC = Path('dev/stage-3b-l-qa2/hl_qa2.js')
OLD = ('function Hl(e,t,n=700,r=0){let i=[];for(let e=0;e<96;e++)i.push(e/96*Math.PI*2-Math.PI);for(let r of Vl){if(Math.hypot(r.x-e,r.y-t)>n+96)continue;'
       'let a=Math.atan2(r.y-t,r.x-e);i.push(a-2e-5,a,a+2e-5)}i.sort((e,t)=>e-t);let a=[];for(let o of i){let i=Uc(e,t,o,n),s=Math.min(n,i+(i<n?r:0));'
       'a.push(e+Math.cos(o)*s,t+Math.sin(o)*s)}return a}')
s = SRC.read_text(encoding='utf-8'); a = s.index('// ---- begin (bundle text) ----\n') + len('// ---- begin (bundle text) ----\n'); b = s.index('// ---- end (bundle text) ----')
new = s[a:b].replace('\n', '')
bundle = B.read_text(encoding='utf-8')
parent = subprocess.run(['git', 'show', 'd3ec2269af873dbc381d223ad538a43ba06f5c45:' + str(B)], check=True, capture_output=True).stdout.decode('utf-8')
if '--check' in sys.argv:
    ok = bundle.count(new) == 1 and OLD not in bundle; print('bundle holds hl_qa2.js:', ok); sys.exit(0 if ok else 1)
assert parent.count(OLD) == 1, 'the parent Hl is not in the parent bundle exactly once'
B.write_text(parent.replace(OLD, new), encoding='utf-8'); print('Hl replaced:', len(OLD), '->', len(new), 'chars')
