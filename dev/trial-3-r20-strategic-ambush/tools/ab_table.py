# dev/trial-3-r20-strategic-ambush/tools/ab_table.py - Trial 3 R20, S track: the A/B table of hunt_sim.js runs (16 seeds x 10 min each)
# python3 -I ab_table.py FOLDER   (development tool; Trial 3 is not owner-approved)
import json,sys,os
S=sys.argv[1]   # the folder of the A/B runs (evidence/C/ab)
rows=[('A0 R19 code (N tree)','A0'),('V1 R19 code + stamina/chase only','V1'),('V6 strategy, drain 11','V6'),('V4 strategy, drain 12','V4'),('C3 strategy, drain 13 (proposal)','C3'),('V5 strategy, drain 14','V5'),('V2 C3 with R19 ears','V2'),('V7 C3 with half the ear boost','V7'),('V8 C3 pressing after walkers (R19 press)','V8'),('C4 walkers pressed at its investigation pace','C4'),('F the proposal (V8 + its corrections)','F')]
print('| variant | hunger | kills | escapes | meetings | chases | presses | run s | run s / min near | longest run | runs > 3 s | surprise captures | interceptions | posts | waits where it stands | lowest stamina | exhausted s |')
print('|'+'---|'*17)
for name,f in rows:
  for h in ['.55','.85']:
    p=f'{S}/{f}_{h}.json'
    if not os.path.exists(p): continue
    d=json.load(open(p)); r=d['r20']; t=r['tally']
    print(f"| {name} | {h} | {d['kills']} | {d['escapes']} | {d['meetings']} | {d['chases']} | {d['presses']} | {r['runS']} | {r['runS']/max(1,(d['mins']*60-d['farS']))*60:.1f} | {r['runSegs']['max']} | {r['runSegs']['over3']} | {r['surprised']}/{r['captures']} | {d['interceptions']} | {t.get('post',0)} | {t.get('waitHere',0)+t.get('postHere',0)} | {d['stamina']['lowest']} | {d['stamina']['exhaustedS']} |")
