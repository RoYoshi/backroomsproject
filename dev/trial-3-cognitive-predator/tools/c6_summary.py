#!/usr/bin/env python3
# dev/trial-3-cognitive-predator/tools/c6_summary.py - one line per real-page try from tools/c6_browser.js output (development only).
#   python3 -I -B dev/trial-3-cognitive-predator/tools/c6_summary.py RUN.json LABEL [RUN.json LABEL ...]
# Reads the JSON only; prints what happened to the page (A), the first strike, the closest approach, a cut-off, the page's own
# movement (and how often it was held up by a wall), its events and the plans the creature went through.
import json,sys,math
def summ(path,label):
    d=json.load(open(path)); out=[]
    for r in d['runs']:
        if r.get('error'): out.append(f"{label} {r['scene']} #{r['try']}: ERROR {r['error'][:120]}"); continue
        tl=' > '.join(t[1].split(' ')[0] for t in r['timeline'] if t[1] not in ('?',))
        ev='; '.join(f"{e[0]} {e[1]}" for e in r.get('events',[]))
        A=r.get('Ame',[]); moved=round(sum(math.hypot(A[i][1]-A[i-1][1],A[i][2]-A[i-1][2]) for i in range(1,len(A))))
        skips=sum(1 for i in r.get('inputs',[]) if i[1]=='skip')
        res='SETUP MISS (never saw a page)' if r['setupMiss'] else ('A killed at %s s' % r['watcherDied'] if r['watcherDied'] is not None else 'A alive at the end')
        extra=''
        if r['scene']=='escape' and r.get('runFrom'): extra=f"; ran from {r['runFrom']['d']} px"
        if r['scene']=='decoy': extra=f"; B first seen {r['firstSeen'].get(str(r['ids']['B']))} s"
        out.append(f"{label} {r['scene']} #{r['try']} hunger {r['hunger']}: {res}; first strike {r['firstStrike']} s; closest {r['closest']} px; cut-off {r['cutAt']} s{extra}; page moved {moved} px (held-up skips {skips}) | events: {ev} | plans: {tl}")
    return out
for p,l in zip(sys.argv[1::2],sys.argv[2::2]):
    for line in summ(p,l): print(line)
