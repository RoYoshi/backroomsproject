#!/usr/bin/env python3
"""2D_SHADOWS_TEST_SUMMARY.md from the final evidence (no result is typed by hand).

  mk_test_summary.py REPO OUT [STAGE]

STAGE is the evidence folder of the final tree (default sh6).  SH4's summary was generated the same way from sh4/.
"""
import collections, json, re, sys
from pathlib import Path
REPO, OUT = Path(sys.argv[1]), Path(sys.argv[2]); STAGE = sys.argv[3] if len(sys.argv) > 3 else 'sh6'
E = REPO / 'dev/shadows/evidence'; S = E / STAGE

def results(log):
    rows = []
    for line in log.read_text().splitlines():
        m = re.match(r'^(PASS|FAIL) (\S+) (.*?)(?:   (.*))?$', line)
        if m: rows.append((m.group(1), m.group(2), m.group(3).strip(), (m.group(4) or '').strip()))
    return rows
J = lambda p: json.loads(Path(p).read_text())
suite = lambda R, sid: next((s for s in R['suites'] if s['id'] == sid), None)
short = lambda f: f.split('  - ')[0]
cell = lambda t: t.replace('|', '\\|')

TS = S if (S / 'unit_tests.log').exists() else E / 'sh5'   # SH6 changed no runtime file; its reruns were stopped by instruction, so the SH5 logs (same module, same tests) stand
unit, browser = results(TS / 'unit_tests.log'), results(TS / 'browser_checks.log')
status = {r[1]: r[0] for r in unit + browser}
REQ_CORR = [  # SHADOW_VISIBILITY_CORRECTION_MASTER_PROMPT.txt section 9 -> where it is covered
    ('stronger but bounded alpha', ['V01', 'V02', 'V04', 'V05', 'V06', 'V08']),
    ('finite geometry', ['S10', 'C09']),
    ('smooth flashlight movement', ['S06', 'C07', 'C15']),
    ('beam / range containment', ['V02', 'C18']),
    ('flicker / blackout', ['C03', 'C04', 'C05', 'B02']),
    ('quality ordering', ['V03', 'C11', 'S14']),
    ('no Smiler shadow', ['S07', 'V06', 'B07']),
    ('baked-shadow thinning', ['V07', 'C12']),
    ('stable ordering / caps', ['S11', 'C10', 'C16', 'C08', 'C19']),
    ('darkness-overlay identity', ['B02']),
]
REQ = [  # the original stage prompt's required focused tests -> where they are covered
    ('dominant direction', ['S05']),
    ('correct shadow-away-from-light orientation', ['S05', 'S06', 'C01', 'C02', 'C06', 'C14']),
    ('stable caster ordering', ['S11', 'C10', 'C16']),
    ('wall adjacency', ['S02', 'S03']),
    ('flashlight rotation', ['S06', 'C07', 'C15']),
    ('lamp flicker response', ['C03', 'C04']),
    ('blackout', ['C05', 'B02']),
    ('no NaN / infinite geometry', ['S10', 'C09']),
    ('culling / caps', ['S04', 'S09', 'C08', 'C16', 'C19']),
    ('Low / Medium / High', ['S09', 'S14', 'C11', 'B05']),
    ('Smiler concealment preservation', ['S07', 'B07', 'B03']),
    ('no presentation-to-AI data path', ['S12', 'S15', 'S16', 'B04']),
    ('(also) nothing revealed that the player cannot see', ['S08', 'B03']),
]
def req_table(req, head):
    t = [f'| {head} | tests | result |', '|---|---|---|']
    for name, ids in req: t.append(f"| {name} | {', '.join(ids)} | **{'PASS' if all(status.get(i) == 'PASS' for i in ids) else 'FAIL'}** |")
    return t
L = ['# THE FAR BACKROOMS — 2D Lighting & Shadows: test summary', '',
     '**Status: `2D LIGHTING & SHADOWS — VISIBILITY CORRECTION ENGINEERING COMPLETE — HUMAN QA PENDING`**', '',
     f'Every result below is generated from the evidence in `dev/shadows/evidence/{STAGE}/` (the final tree) and `sh5/` (the visibility captures) by `dev/shadows/report/mk_test_summary.py`. Nothing is typed by hand. Measured values are copied in full; a `|` inside one is escaped for the table.', '',
     '## Required by the visibility-correction pack (section 9)', '', *req_table(REQ_CORR, 'required by the correction pack'), '',
     '## Required by the original stage prompt', '', *req_table(REQ, 'required by the stage prompt'), '',
     *([f"**Where the unit and browser results come from.** They are the logs in `dev/shadows/evidence/{TS.name}/`. SH6 changed no runtime file, and no test file: `assets/shadows-2d.js` and `index.html` are byte-identical to SH5, and so are the test scripts. The planned SH6 reruns were stopped by instruction before they ran. The SH5 results therefore stand for the final tree, and they were not repeated.", ''] if TS != S else []),
     f"## Unit tests — `node dev/shadows/test_shadows.js`: **{sum(r[0] == 'PASS' for r in unit)}/{len(unit)} PASS**", '',
     'The module runs in a Node VM with the real level geometry, ray query, lamp list and equipment light model extracted verbatim from the shipped bundle, the real `light.js` and `world.js`, and a recording mock of the Pixi classes (it keeps polygon arrays by reference and canvas pixels, as Pixi does). V01–V08 are new in SH5: what each shadow class draws, composed as Pixi composes it, with lower bounds (visible) and upper bounds (never near-black).', '',
     '| id | test | result | measured |', '|---|---|---|---|']
for st, i, name, note in unit: L.append(f"| {i} | {cell(name)} | **{st}** | {cell(note)} |")
L += ['', f"## Browser checks — `node dev/shadows/browser_shadows.js` (real client, shipped `node server.js`): **{sum(r[0] == 'PASS' for r in browser)}/{len(browser)} PASS**", '',
      '| id | check | result | measured |', '|---|---|---|---|']
for st, i, name, note in browser: L.append(f"| {i} | {cell(name)} | **{st}** | {cell(note)} |")

vis = (E / 'sh5/visibility/visibility.md').read_text().strip()
L += ['', '## Shadow visibility, SH4 → SH5 (`dev/shadows/evidence/sh5/visibility/`)', '',
      'The same staged scenes at the same frozen instants, each tier compared pixel by pixel with its own OFF capture (`visibility_metrics.js`). Only pixels the player can see something on count. Each cell is p90 / p99 of the darkening, then the share of lit pixels darkened by at least 10 % / 25 %. These are diagnostics: whether the shadows are noticeable is for human QA.', '', vis, '']

# ---------- retained ----------
base = J(E / 'sh0/retained-parent/retained.json'); main = J(S / 'retained/retained.json')
cmp_md = (S / 'retained/compare_vs_parent.md').read_text().strip()
rows = [l for l in cmp_md.splitlines() if l.startswith('| ') and not l.startswith('| suite')]
same = [l.split('|')[1].strip() for l in rows if l.count('| yes ') == 4]; diff = [l.split('|')[1].strip() for l in rows if l.count('| yes ') != 4]
scale = main['meta'].get('timeoutScale', 1)
L += ['## Retained v23.3.6 gameplay suites — final tree vs the immutable parent', '',
      '`python3 dev/shadows/run_retained.py run` ran the unmodified v23.3.6 suites on the final tree' + (f" (the runner's own safety deadlines ×{scale:g}, recorded in the run's metadata: this machine needs it; see SH4)" if scale != 1 else '') + '. `compare` checked each suite against the SH0 baseline of the parent (`evidence/sh0/retained-parent/`): same verdict, same counts, same set of failing assertion names, same error messages. The parent has known failures of its own (npm-test 151/162, browser-play, browser-light 13/15, browser-admin 54/56, the two descriptive suites); a candidate must reproduce them exactly and fail nothing new.', '',
      f"**{len(same)} of {len(rows)} suites reproduce the baseline exactly.**" + (f" The other{'s' if len(diff) > 1 else ''} ({', '.join(diff)}) {'are' if len(diff) > 1 else 'is'} diagnosed below." if diff else ''), '', cmp_md, '']
D = S / 'retained-diag'
if diff and D.exists():
    diag = {d.name: J(d / 'retained.json') for d in sorted(D.iterdir()) if (d / 'retained.json').exists()}
    bset = lambda sid: set(map(short, suite(base, sid)['failures']))
    extra = lambda R, sid: [short(f) for f in suite(R, sid)['failures'] if short(f) not in bset(sid)] if suite(R, sid) else None
    who = lambda k: 'parent' if k.startswith('parent') else 'final tree'
    L += ['### The differences, diagnosed on the same machine', '',
          'Both differing suites were run again on this machine, back to back, alternating a pristine export of the parent `f2805bb` and the final tree, with the suites unchanged (the runner\'s deadlines ×3, recorded). Each run records which export it used (`meta.game`; `retained-diag/EXPORTS.txt` checks the exports against the commits).', '',
          (D / 'table.md').read_text().strip(), '']
    notes = []; attributable = False
    if 'browser-ir' in diff:
        ir = {k: suite(R, 'browser-ir') for k, R in diag.items() if suite(R, 'browser-ir')}
        fails = lambda x: sorted(f for f in map(short, x['failures']) if f != 'ok') or (['no verdict: ' + '; '.join(x.get('errorSignature') or [])] if x['result'] != 'PASS' else [])
        fmt = lambda k, x: f"`{k}` {'PASS' if x['result'] == 'PASS' else 'FAIL ' + ', '.join(fails(x))} ({x['durationSeconds']:.0f} s)"
        m = suite(main, 'browser-ir'); why = m.get('limitation') or '; '.join(m.get('errorSignature') or []) or ', '.join(fails(m))
        par = {k: x for k, x in ir.items() if k.startswith('parent-') and not k.startswith('parent-load')}; fin = {k: x for k, x in ir.items() if k.startswith('final')}
        lod = {k: x for k, x in ir.items() if k.startswith('parent-load')}
        fp = S / 'perf/frame_probe_trees.json'; fl = S / 'perf/frame_probe_load.json'; probe = ''
        if fp.exists() and fl.exists():
            mt = J(fp)['mean']; cal = J(fl)['calibration']; pf = mt.get('parent baseline')
            name = {'sh4 medium': 'SH4', 'sh5.1 medium': 'the final module (SH5, 1.1)', 'sh5.2 medium': 'a reverted lamp-overdraw experiment'}
            trees = [(name.get(k, k), v) for k, v in mt.items() if k != 'parent baseline']
            pcs = lambda v: f'{100 * (v / pf - 1):+.0f} %'.replace('-', '−')
            probe = (f" In that view (`frame_probe.js`, 1900×900, the suite's own corridor, three alternating rounds) the parent draws {pf:.2f} fps; at MEDIUM " +
                     ', '.join(f'{n} {v:.2f} ({pcs(v)})' for n, v in trees) + '. ' +
                     f"A calibrated one-core background load (`cpu_load.js`) slows the parent from {cal[0]['mean']['parent baseline']:.2f} to " +
                     ', '.join(f"{c['mean']['parent baseline']:.2f} fps at {c['load']}" for c in cal[1:]) + f" (transcribed from console output; the file says so); the loaded suite runs used {J(fl)['loadUsedForBrowserIrRuns']}.")
        fin_sets = [set(fails(x)) for x in fin.values() if x['result'] != 'PASS']; lod_union = set().union(*[set(fails(x)) for x in lod.values()]) if lod else set()
        same_mech = bool(lod) and all(x['result'] != 'PASS' for x in lod.values()) and all(st <= lod_union or any(f.startswith('no verdict') for f in st) for st in fin_sets)
        notes.append(f"- **browser-ir**: the main run ended without a verdict ({why}). Same machine, normal speed: parent {', '.join(fmt(k, x) for k, x in par.items())}; final tree {', '.join(fmt(k, x) for k, x in fin.items())}. "
                     "Two of its checks depend on how fast frames come: R5 reads the camcorder's overheat lock 0.7 game-seconds after setting the heat, and R7 reads a second player's darkness after fixed real-time waits (`dev/tests/ir_test.py`)." + probe +
                     (f" Slowed that way, the **unmodified parent** fails the same checks with the same readings: {', '.join(fmt(k, x) for k, x in lod.items())}." if lod else '') +
                     (" So the final tree's failures are this suite's sensitivity to frame time under software rendering on this machine, which the shadow module's fill cost reaches, as SH4's did; they are not a gameplay difference." if same_mech else " The final tree's failures are not fully explained by frame time."))
        if not same_mech or not par or not all(x['result'] == 'PASS' for x in par.values()): attributable = True
    admin_open = False
    if 'browser-admin' in diff:
        ex = {k: extra(R, 'browser-admin') for k, R in diag.items() if suite(R, 'browser-admin')}
        par = {k: v for k, v in ex.items() if k.startswith('parent-') and not k.startswith('parent-load')}; fin = {k: v for k, v in ex.items() if k.startswith('final')}
        lod = {k: v for k, v in ex.items() if k.startswith('parent-load')}
        allx = [x for v in ex.values() for x in v] + extra(main, 'browser-admin'); kinds = collections.Counter(x.split(' ')[0] for x in allx)
        exactF = [k for k, v in fin.items() if not v]; exactP = [k for k, v in par.items() if not v]
        s4 = E / 'sh4/retained-diag/final-1/retained.json'; s4a = suite(J(s4), 'browser-admin') if s4.exists() else None
        sh4note = f" (at SH4 the final tree did: `sh4/retained-diag/final-1`, {s4a['counts']['passed']}/{s4a['counts']['total']})" if s4a and not extra(J(s4), 'browser-admin') else ''
        notes.append(f"- **browser-admin**: extra failures beyond the parent's own T8 and T10: main run {len(extra(main, 'browser-admin'))}; parent at normal speed " +
                     ', '.join(f'`{k}` {len(v)}' for k, v in par.items()) + '; final tree ' + ', '.join(f'`{k}` {len(v)}' for k, v in fin.items()) +
                     (('; parent slowed by the calibrated load ' + ', '.join(f'`{k}` {len(v)}' for k, v in lod.items())) if lod else '') +
                     f". All of them are {', '.join(f'{k} ×{n}' for k, n in sorted(kinds.items()))}. " +
                     ("Its T5 death-preview sequence is timing-sensitive on this machine for the parent too: when one preview does not start within the suite's 9 s window, the next ones see the previous death and fail in a cascade (T5, then T6). SH4 found the same (`sh4/retained-diag/`)." if set(kinds) <= {'T5', 'T6'} else "Not all extra failures are the known T5 / T6 cascade.") +
                     (f" The parent reproduced its own baseline exactly in `{exactP[0]}`" if exactP else '') + (f", the final tree in `{exactF[0]}`." if exactF else ('; the final tree did not in these runs' + sh4note + '.' if exactP else '')))
        if not set(kinds) <= {'T5', 'T6'} or not any(v for v in par.values()) and not any(v for v in lod.values()): attributable = True
        admin_open = bool(exactP) and not exactF
    L += notes + ['', ('- **Verdict:** no gameplay difference found. The suites that decide gameplay (movement, physics, camera, FPS independence, interpolation, AI, networking) reproduce the parent, and several of their logs are byte-identical (below).' +
                       (" **One item stays open:** browser-admin's T5 / T6 cascade happened in every final-tree run here and in one of the parent's two. The same timing sensitivity is the likely cause, but this was not proven before the follow-up runs were stopped by instruction; it is listed for human QA on real hardware." if admin_open else '') if not attributable else '- **Verdict: OPEN** — see the notes above; this is not explained by the machine alone.'), '']
elif diff:
    L += ['**The differences above were not diagnosed (no `retained-diag/`).**', '']
L += ['### Logs compared with the parent\'s byte for byte (`dev/shadows/log_identity.py`)', '',
      '`byte-identical` is the whole file. The other levels strip per-test durations, or compare only the PASS / FAIL lines. A browser suite that prints a single JSON line with timings and positions always reads `differs` here; the comparison above decides those.', '',
      '```', (S / 'retained/byte_identical.txt').read_text().strip(), '```', '',
      'The verdict comparison was run at every checkpoint: SH1 and SH2 reproduced all 21 suites exactly (before the container restart), SH4 19 of 21 with the two others diagnosed as the machine (`sh4/`), and the final tree as above.', '']
fz = (S / 'freeze_verify.txt').read_text().splitlines()
L += ['## Gameplay freeze', '', '`python3 dev/shadows/freeze.py verify` against the SH0 manifest of every parent file (229 of 230 byte-identical; the one changed file is `index.html`, the SH1 script tag):', '', '```',
      fz[0], *[l for l in fz if l.startswith(('IDENTICAL', 'CHANGED', 'REMOVED', 'FREEZE'))], '```', '',
      '## Reproduce', '', '```',
      'git archive f2805bb904c158df17c5c75c3d0d4681049bc246 | tar -x -C /tmp/parent',
      'node dev/shadows/test_shadows.js',
      'node dev/shadows/browser_shadows.js --game .',
      'node dev/shadows/shots.js --game . --out /tmp/shots --scenes room,props,shelf,shelfdark,pillarlit,pillarsweep,damp,houndbo,hound',
      'node dev/shadows/visibility_metrics.js /tmp/shots',
      'python3 dev/shadows/run_retained.py run --game . --out /tmp/retained-final --timeout-scale 3',
      'python3 dev/shadows/run_retained.py compare --base dev/shadows/evidence/sh0/retained-parent/retained.json --cand /tmp/retained-final/retained.json',
      'python3 dev/shadows/run_retained.py run --game /tmp/parent --out /tmp/parent-diag --only browser-admin,browser-ir --timeout-scale 3',
      'python3 dev/shadows/log_identity.py dev/shadows/evidence/sh0/retained-parent /tmp/retained-final',
      'python3 dev/shadows/freeze.py verify --manifest dev/shadows/evidence/sh0/parent_manifest.json --rev HEAD', '```']
OUT.write_text('\n'.join(L) + '\n'); print(f'unit {len(unit)} browser {len(browser)} retained {len(same)}/{len(rows)}')
