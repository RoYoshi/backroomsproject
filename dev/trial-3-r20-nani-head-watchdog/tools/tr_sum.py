import json,sys,collections
for f in sys.argv[1:]:
  d=json.load(open(f)); print('=====',f,d['patched'])
  for k,v in d['kinds'].items():
    secs=v['ticks']/60
    print(f" {k}: {secs:.0f}s near/mid; STUCK label {v['label']:.1f}s ({100*v['label']/secs:.2f}%), open-air {v['labelOpen']:.1f}s, frozen(no steer) {v['labelFrozen']:.1f}s (still {v['labelFrozenStill']:.1f}); sidesteps {v['side']} replans {v['replan']}; wd checks {v['wdChecks']} stuck {v['wdStuck']} embedded {v['wdEmb']}")
    print('   grow s:', {a:round(b,1) for a,b in v['grow'].items()}, ' open:', {a:round(b,1) for a,b in v['growOpen'].items()})
    E=v['episodes']; big=[e for e in E if e['max']>=.35]
    print(f"   episodes {len(E)} (>=.35s: {len(big)}); by plan:", collections.Counter(e['plan'] for e in big).most_common(8))
    print('   by act:', collections.Counter(e['act'] for e in big).most_common(8), ' openFrac>=.9:', sum(1 for e in big if e['openFrac']>=.9), ' frozen>=.5:', sum(1 for e in big if e['frozenFrac']>=.5))
    for ev in v['wdEvents'][:12]: print('   WD', json.dumps(ev)[:600])
