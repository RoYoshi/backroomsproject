#!/usr/bin/env python3
"""Stage 3D HQ2 - deliberately broken copies of the game, to prove a test catches what it claims to catch (development only)

  python3 -I dev/stage-3d-hq2/mutate.py --from DIR --to DIR --mutation NAME      (DIR: an export of the commit under test, e.g. git archive)
  python3 -I dev/stage-3d-hq2/mutate.py --list

Copies the game folder and makes ONE exact-text change (it must occur exactly once, or the tool stops), so a test run against the copy
must FAIL.  The repository is never touched.  Each mutation names the gate it attacks and the test expected to catch it."""
import argparse, os, shutil, sys, json

MUT = {
    # H2-1 / E02: the server forgets the cooldown
    'e02_no_cooldown': {'file': 'sim.js', 'old': 'const NR_CD=30;', 'new': 'const NR_CD=0;',
                        'gate': 'E02', 'caughtBy': 'proto_lab.js nr_e02'},
    # H2-1 / E01: the server approves but leaves the player in the world (the old phantom: alive and visible after "leaving")
    'e01_stays_alive': {'file': 'sim.js', 'old': 'p.nrAt=now;p.active=false;p.dead=``;p.caught=null;p.kill=null;eng.forgetPlayer(p.id);return``',
                        'new': 'p.nrAt=now;return``', 'gate': 'E01/E02', 'caughtBy': 'proto_lab.js nr_flow'},
    # H2-1 / E02: the client starts its NEW RUN locally before the server's answer (the HQ1 bug, re-created in the new client)
    'e02_local_first': {'file': 'mp.js', 'old': "nrButton('…'); tx({ t: 'nr', q, w: worldW });",
                        'new': "nrButton('…'); tx({ t: 'nr', q, w: worldW }); if (ok) ok({ ok: 1, q });",
                        'gate': 'E02', 'caughtBy': 'nr_browser.py --plan e02'},
}

ap = argparse.ArgumentParser(); ap.add_argument('--from', dest='src'); ap.add_argument('--to'); ap.add_argument('--mutation'); ap.add_argument('--list', action='store_true')
A = ap.parse_args()
if A.list:
    print(json.dumps({k: {x: v[x] for x in ('file', 'gate', 'caughtBy')} for k, v in MUT.items()}, indent=1)); sys.exit(0)
m = MUT[A.mutation]
if os.path.exists(A.to): sys.exit(f'{A.to} exists: give a new folder')
shutil.copytree(A.src, A.to)
f = os.path.join(A.to, m['file']); s = open(f, encoding='utf-8').read()
if s.count(m['old']) != 1: sys.exit(f"{A.mutation}: the text is in {m['file']} {s.count(m['old'])} times, not once")
open(f, 'w', encoding='utf-8').write(s.replace(m['old'], m['new']))
print(json.dumps({'mutation': A.mutation, 'file': m['file'], 'gate': m['gate'], 'caughtBy': m['caughtBy'], 'copy': A.to}))
