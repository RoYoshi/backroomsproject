#!/usr/bin/env python3
"""Trial 3 R20, the B++ killer-identity branch (development only): bpp_browser.js's JSON as one line per page.
    python3 -I dev/trial-3-r20-bpp-killer-identity/tools/browser_summary.py FILE.json"""
import json,sys
R=json.load(open(sys.argv[1]))
print('tree',R.get('tree'),'chromium',R.get('chromium'))
for c in R['cases']:
    print('##',c['name'][:110])
    print('  kills',[(k['e'],k['k'],k['v']) for k in c.get('kills',[])],'ents',[(e['id'],e['kind']) for e in c.get('ents',[])], 'error',c.get('error'))
    for k in ['heldAt','lateFx','lateAt','joinAt','jIn','dropAt','backAt']:
        if k in c: print('  ',k,c[k],end='')
    if any(k in c for k in ['heldAt','joinAt']): print()
    for p in c.get('pages',[]):
        if 'killerHidden' in p:
            print(f"  page{p['page']}: playing {p['playing']} (own death {p['ownDeath']}), killer hidden {p['killerHidden']}/{p['killerJudged']}, bystander hidden {p['bystanderHidden']}/{p['bystanderSeen']}, other kind hidden {p['otherHidden']}, skin-stealer views hidden {p.get('skinHidden')}/{p.get('skinSeen')}, hidden ids {p['hiddenIds']}, replay ids {p['replayIds']}")
        else:
            print(f"  page{p['page']}: playing {p['playing']}, killer shown {p['killerShown']}/{p['killerJudged']}, bystander hidden {p['bystanderHidden']} faded {p['bystanderFaded']} of {p['bystanderSeen']}, attackers {p['attackers']}, H/S slots hidden {p.get('hSlotsHidden')} {p.get('sSlotsHidden')}, replay ids {p.get('replayIds')}")
    print('  after',[(a.get('hidden'),a.get('faded'),a.get('attackers'),a.get('mirrors')) for a in c.get('after',[])])
