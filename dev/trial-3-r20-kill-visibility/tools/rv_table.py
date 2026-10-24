#!/usr/bin/env python3
# dev/trial-3-r20-kill-visibility/tools/rv_table.py - Trial 3 R20 (kill visibility): rv_browser.js's records of two trees side by side,
# as a markdown table.  Development tool; evidence, not a gate step.  Trial 3 is not owner-approved.
#   python3 dev/trial-3-r20-kill-visibility/tools/rv_table.py A.json B.json > table.md
import json, sys
A, B = (json.load(open(f)) for f in sys.argv[1:3])
def cell(c):
    if not c or c.get('error'): return 'ERROR ' + str((c or {}).get('error'))[:60]
    out = []
    for p in c['pages']:
        L = ['victim', 'spectator (its connection drops and comes back)', 'a page whose replay arrives 1.2 s late', 'a fresh page joining'] if c['name'].startswith('RV04') else ['victim', 'spectator' if len(c['pages']) < 3 else 'second victim', 'a third page watching']
        nm = L[p['page']] if p['page'] < len(L) else str(p['page'])
        if not p['playing']: out.append(f"{nm}: no kill frames"); continue
        s = f"{nm}: {p['playing']} kill frames; bystander Skin-Stealers hidden {p['bystanderHidden']}/{p['bystanderSeen']}; killer drawn {p['killerShown']}/{p['killerJudged']}; attackers {p['attackers'][0]}-{p['attackers'][1]}"
        if p['hSlotsHidden']: s += f"; Hound hidden {p['hSlotsHidden']}"
        if p['sSlotsHidden']: s += f"; Smiler hidden {p['sSlotsHidden']}"
        out.append(s)
    af = c.get('after') or []
    out.append('after: ' + ('every mirror drawn' if af and all(a.get('hidden', 1) == 0 and a.get('faded', 1) == 0 and a.get('attackers', 1) == 0 for a in af) else json.dumps(af)))
    return '<br>'.join(out)
print(f"| case | killers (server) | {A['tree']} | {B['tree']} |")
print('|---|---|---|---|')
bn = {c['name']: c for c in B['cases']}
for c in A['cases']:
    d = bn.get(c['name'])
    ks = ', '.join(f"{k['k']} #{k['e']} {k['v']}" for k in (c.get('kills') or []))
    kd = ', '.join(f"{k['k']} #{k['e']} {k['v']}" for k in ((d or {}).get('kills') or []))
    print(f"| {c['name']} | {ks} / {kd} | {cell(c)} | {cell(d)} |")
