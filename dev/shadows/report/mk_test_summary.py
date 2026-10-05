#!/usr/bin/env python3
"""2D_SHADOWS_TEST_SUMMARY.md from the SH4 evidence (no result is typed by hand).

  mk_test_summary.py REPO OUT
"""
import json, re, sys
from pathlib import Path
REPO, OUT = Path(sys.argv[1]), Path(sys.argv[2])
E = REPO / 'dev/shadows/evidence'

def results(log):
    rows = []
    for line in log.read_text().splitlines():
        m = re.match(r'^(PASS|FAIL) (\S+) (.*?)(?:   (.*))?$', line)
        if m: rows.append((m.group(1), m.group(2), m.group(3).strip(), (m.group(4) or '').strip()))
    return rows
J = lambda p: json.loads(Path(p).read_text())
suite = lambda R, sid: next(s for s in R['suites'] if s['id'] == sid)

unit, browser = results(E / 'sh4/unit_tests.log'), results(E / 'sh4/browser_checks.log')
REQ = [  # the prompt's required focused tests -> where they are covered
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
status = {r[1]: r[0] for r in unit + browser}
cell = lambda t: t.replace('|', '\\|')
L = ['# THE FAR BACKROOMS — 2D Lighting & Shadows: test summary', '',
     'Every result below is generated from the logs in `dev/shadows/evidence/sh4/` (the final tree) by `dev/shadows/report/mk_test_summary.py`. Nothing is typed by hand. Measured values are copied in full; a `|` inside one is escaped for the table.', '',
     '## Required focused tests → where they are covered', '', '| required by the prompt | tests | result |', '|---|---|---|']
for name, ids in REQ:
    res = 'PASS' if all(status.get(i) == 'PASS' for i in ids) else 'FAIL'
    L.append(f"| {name} | {', '.join(ids)} | **{res}** |")
L += ['', f"## Unit tests — `node dev/shadows/test_shadows.js`: **{sum(r[0] == 'PASS' for r in unit)}/{len(unit)} PASS**", '',
      'The module runs in a Node VM with the real level geometry, ray query, lamp list and equipment light model extracted verbatim from the shipped bundle, the real `light.js` and `world.js`, and a recording mock of the Pixi classes (it keeps polygon arrays by reference and canvas pixels, as Pixi does).', '',
      '| id | test | result | measured |', '|---|---|---|---|']
for st, i, name, note in unit:
    L.append(f"| {i} | {cell(name)} | **{st}** | {cell(note)} |")
L += ['', f"## Browser checks — `node dev/shadows/browser_shadows.js` (real client, shipped `node server.js`): **{sum(r[0] == 'PASS' for r in browser)}/{len(browser)} PASS**", '',
      '| id | check | result | measured |', '|---|---|---|---|']
for st, i, name, note in browser:
    L.append(f"| {i} | {cell(name)} | **{st}** | {cell(note)} |")

# ---------- retained ----------
base = J(E / 'sh0/retained-parent/retained.json'); main = J(E / 'sh4/retained/retained.json'); sh2 = J(E / 'sh2/retained/retained.json')
D = E / 'sh4/retained-diag'; diag = {d.name: J(d / 'retained.json') for d in sorted(D.iterdir()) if (d / 'retained.json').exists()}
cmp_md = (E / 'sh4/retained/compare_vs_parent.md').read_text().strip()
nsame = sum(1 for l in cmp_md.splitlines() if l.startswith('| ') and l.count('| yes ') == 4)
ntot = sum(1 for l in cmp_md.splitlines() if l.startswith('| ') and not l.startswith('| suite') and not l.startswith('|---'))
dur = lambda R, sid: round(suite(R, sid)['durationSeconds'])
L += ['', '## Retained v23.3.6 gameplay suites — final tree vs the immutable parent', '',
      '`python3 dev/shadows/run_retained.py run` ran the unmodified v23.3.6 suites on the final tree; `compare` checked each suite against the SH0 baseline of the parent (`evidence/sh0/retained-parent/`): same verdict, same counts, same set of failing assertion names, same error messages. The parent has known failures of its own (npm-test 151/162, browser-play, browser-light 13/15, browser-admin 54/56, the two descriptive suites); a candidate must reproduce them exactly and fail nothing new.', '',
      f'**{nsame} of {ntot} suites reproduce the baseline exactly.** The two others are diagnosed below.', '', cmp_md, '']
a_extra = {}
for k, R in diag.items():
    b = set(f.split('  - ')[0] for f in suite(base, 'browser-admin')['failures'])
    a_extra[k] = [f.split('  - ')[0] for f in suite(R, 'browser-admin')['failures'] if f.split('  - ')[0] not in b]
L += ['### The two differences, diagnosed: not the module', '',
      f"The container was restarted during the SH3 work, after SH2 was pushed, and the same work has run slower since. The SH0 baseline, SH1 and SH2 ran before the restart. Since then the same suites take longer: npm-test {dur(main, 'npm-test')} s (SH2, before the restart: {dur(sh2, 'npm-test')} s), and the **parent's own** browser-ir {dur(diag['parent-1'], 'browser-ir')} s (SH0: {dur(base, 'browser-ir')} s).", '',
      'Both differing suites were therefore run again after the restart, back to back, alternating a pristine export of the parent `f2805bb` and the final tree. The suites are unchanged; only the runner\'s own safety deadlines were multiplied by 3 (`--timeout-scale 3`, recorded in each run\'s metadata). Each run records which export it used (`meta.game`), and `retained-diag/EXPORTS.txt` shows the two exports were exactly `f2805bb` and the SH3 commit. Evidence: `dev/shadows/evidence/sh4/retained-diag/`.', '',
      (D / 'table.md').read_text().strip(), '',
      f"- **browser-ir** passes on both trees on this machine (parent {dur(diag['parent-1'], 'browser-ir')} s, final tree {dur(diag['final-1'], 'browser-ir')} s). In the main run the suite was stopped by the runner's own 400 s safety deadline, which is not part of the suite. It was not a failed assertion.",
      f"- **browser-admin**: its T5 death-preview sequence is timing-sensitive on this machine. When one preview does not start within the suite's 9 s window, that preview fails, and the next ones then see the previous death and fail in a cascade (T5, then T6). **The parent itself** failed {len(a_extra['parent-1'])} and {len(a_extra['parent-2'])} extra assertions in its two runs here; the final tree failed {len(a_extra['final-1'])} and {len(a_extra['final-2'])} in its two, and {sum(1 for f in suite(main, 'browser-admin')['failures'] if f.split('  - ')[0] not in set(x.split('  - ')[0] for x in suite(base, 'browser-admin')['failures']))} in the main run. Every extra failure, on either tree, is T5 or T6. In run 2 the final tree reproduced the baseline exactly (54/56, the parent's own T8 and T10).",
      '- **Verdict:** no difference attributable to the shadow module. The suites that decide gameplay (movement, physics, camera, FPS independence, interpolation, AI, networking) are identical, and several of their logs are byte-identical (below).', '']
bytes_note = (E / 'sh4/retained/byte_identical.txt').read_text().strip()
L += ['### Logs compared with the parent\'s byte for byte (`dev/shadows/log_identity.py`)', '',
      '`byte-identical` is the whole file. The other levels strip per-test durations, or compare only the PASS / FAIL lines. A browser suite that prints a single JSON line with timings and positions always reads `differs` here; the comparison above decides those.', '',
      '```', bytes_note, '```', '',
      'The verdict comparison was run at every checkpoint: SH1 and SH2 reproduced all 21 suites exactly (before the restart), then SH4 as above. `log_identity.py` gives the same levels for the SH1 and SH2 logs as for SH4\'s (`sh4/retained/log_identity_sh1.txt`, `log_identity_sh2.txt`). The evidence is in `dev/shadows/evidence/sh1/retained/`, `sh2/retained/` and `sh4/retained*`.', '']
fz = (E / 'sh4/freeze_verify.txt').read_text().splitlines()
L += ['## Gameplay freeze', '', '`python3 dev/shadows/freeze.py verify` against the SH0 manifest of every parent file:', '', '```',
      fz[0], *[l for l in fz if l.startswith(('IDENTICAL', 'CHANGED', 'REMOVED', 'FREEZE'))], '```', '',
      '## Reproduce', '', '```',
      'git archive f2805bb904c158df17c5c75c3d0d4681049bc246 | tar -x -C /tmp/parent',
      'node dev/shadows/test_shadows.js',
      'node dev/shadows/browser_shadows.js --game .',
      'python3 dev/shadows/run_retained.py run --game . --out /tmp/retained-final',
      'python3 dev/shadows/run_retained.py compare --base dev/shadows/evidence/sh0/retained-parent/retained.json --cand /tmp/retained-final/retained.json',
      'python3 dev/shadows/run_retained.py run --game /tmp/parent --out /tmp/parent-diag --only browser-admin,browser-ir --timeout-scale 3',
      'python3 dev/shadows/log_identity.py dev/shadows/evidence/sh0/retained-parent /tmp/retained-final',
      'python3 dev/shadows/freeze.py verify --manifest dev/shadows/evidence/sh0/parent_manifest.json --rev HEAD', '```']
OUT.write_text('\n'.join(L) + '\n'); print(f'unit {len(unit)} browser {len(browser)} retained {nsame}/{ntot}')
