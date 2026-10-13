#!/usr/bin/env python3
"""Stage 3D HQ2 - every test of the final regression (H2-5) and of H2-6, with its exact result and why it may fail (development only)

  python3 -I dev/stage-3d-hq2/summary_hq2.py [--out FILE.json] [--text FILE.txt]      (in the repository)

Reads dev/stage-3d-hq2/evidence/h2-5/steps.txt and h2-6/steps.txt (every step, its exit code; a step run again later counts by its
LAST run - the earlier ones are kept in attempts/ with their reasons) and each step's log, and puts every step in one class:
  gate            must pass (exit 0)
  data            a measurement other steps judge (exit 0)
  before-fix      one of H2-5's two repairs measured on H2-4's commit: must FAIL (the bug was there)
  mutation        a deliberate break on a copy of the final tree: must FAIL (the test catches it)
  replaced        an older tool HQ2 changes on purpose (STAGE_3D_HQ2_REGRESSION.md section 4): must fail, and its replacement must pass
  older-suite     an older suite with known failures: the names that fail must be EXACTLY the inherited ones (the same on the HQ1 parent,
                  or HQ1's own record) plus the documented HQ2 protocol deltas - nothing more, nothing less
  parent          the same older suite on the HQ1 parent export, for the comparison
For every older suite the failing names are read from its log ("FAIL <id> ...").  Exit 0 when every step is as its class requires."""
import json, re, sys
from pathlib import Path
EV = Path('dev/stage-3d-hq2/evidence')
STEPS = [('h2-5', EV / 'h2-5' / 'steps.txt'), ('h2-6', EV / 'h2-6' / 'steps.txt')]
# the older suites: (inherited failures, HQ1's source for them) and HQ2's documented protocol deltas, each with its replacement
OLDER = {
    'existing/npm_test': ({'P01', 'P08', 'H07', 'NV09', 'C1', 'C3', 'C4', 'C5', 'C9 / C10', 'C18', '2F F22'}, 'existing/npm_test_parent',
                          {'L9': ['proto/nr_all', 'browser/nr_e02'], '2F F13': ['existing/f13_hq2']}),
    'existing/audit_net': ({'D3'}, 'HQ1-3 record (16/17, D3)', {'A1': ['old_fixtures'], 'M4': ['old_fixtures'], 'R2': ['old_fixtures']}),
    'existing/audit_net2_again': ({'DD2'}, 'existing/audit_net2_parent', {'LC4': ['proto/nr_all', 'browser/nr_e02'], 'MT1': ['old_fixtures']}),
    'existing/audit_net2_again_2': ({'DD2'}, 'existing/audit_net2_parent', {'LC4': ['proto/nr_all', 'browser/nr_e02'], 'MT1': ['old_fixtures']}),
    'existing/s_audit': (set(), 'existing/s_audit_parent', {'L9': ['proto/nr_all', 'browser/nr_e02']}),
    'death_net': (set(), 'HQ1-3 record (16/16)', {'N9': ['proto/nr_all']}),
    'existing/live': ({'L5d', 'L5e', 'L5f'}, 'HQ1-3 record (14/17)', {}),
    'existing/test_shadows': ({'S06', 'S16', 'V08', 'X01', 'X02'}, 'existing/test_shadows_parent', {}),
    'existing/humanqa_hotfix': ({'HQA X03'}, 'existing/humanqa_hotfix_parent', {}),
}
# the first run of audit_net2 failed LC1 once as well (a real hound killed the held client mid-sequence; a join from death is allowed):
# run twice more on HQ2 and once on HQ1, LC1 passing each time (STAGE_3D_HQ2_REGRESSION.md section 6) - judged by those runs
SUPERSEDED = {'existing/audit_net2': 'existing/audit_net2_again, existing/audit_net2_again_2 (LC1 failed once in the first run: STAGE_3D_HQ2_REGRESSION.md section 6)'}
REPLACED = {'golden/golden3d_refuses': 'golden/golden_hq2', 'golden/cli_golden3d_on_hq2': 'golden/cli_golden_hq2', 'golden/contract3d_on_hq2': 'golden/contract_hq2'}
BEFORE_FIX_MUST_FAIL = {'before_fix/fx_wall_h24', 'before_fix/contract_raw_h24', 'before_fix/c10_rough_h24', 'before_fix/parity_judge_h24'}
DATA = {'before_fix/wire_capture_h24', 'before_fix/parity_houndC_h24', 'golden/wire_capture'}


def steps():
    last = {}
    for cp, f in STEPS:
        if not f.exists(): continue
        for ln in f.read_text().splitlines():
            m = re.match(r'^(\S+) exit=(-?\d+) seconds=(\d+)', ln)
            if m: last[m.group(1)] = {'checkpoint': cp, 'exit': int(m.group(2)), 'seconds': int(m.group(3)), 'log': str(EV / cp / (m.group(1) + '.log'))}
    return last


def log_of(s):
    p = Path(s['log']); return p.read_text(errors='replace') if p.exists() else ''


def counts(txt):
    m = re.findall(r'(\d+)/(\d+) (?:checks )?passed', txt)
    if m: return f'{m[-1][0]}/{m[-1][1]}'
    if 'ALL PASS' in txt: return 'ALL PASS'
    ps = sum(1 for l in txt.splitlines() if l.startswith('PASS ')); fs = sum(1 for l in txt.splitlines() if l.startswith('FAIL '))
    if ps + fs: return f'{ps}/{ps + fs}'
    return None


def failing(txt):
    ids = set()
    for ln in txt.splitlines():
        m = re.match(r'^FAIL ((?:2F |HQA )?[A-Z]+\d+[a-z]?(?: / [A-Z]+\d+)?)\b', ln)
        if m: ids.add(m.group(1))
    return ids


def main():
    S = steps(); out = []
    def add(name, cls, ok, info): out.append({'step': name, 'class': cls, 'ok': bool(ok), **info})
    for name, s in S.items():
        txt = log_of(s); c = counts(txt); base = {'checkpoint': s['checkpoint'], 'exit': s['exit'], 'counts': c}
        if name.startswith('mutation/'): add(name, 'mutation', s['exit'] != 0, base)
        elif name in BEFORE_FIX_MUST_FAIL: add(name, 'before-fix', s['exit'] != 0, base)
        elif name in DATA: add(name, 'data', s['exit'] == 0, base)
        elif name in REPLACED:
            rep = S.get(REPLACED[name]); add(name, 'replaced', s['exit'] != 0 and rep and rep['exit'] == 0, dict(base, replacement=REPLACED[name], replacementExit=rep and rep['exit']))
        elif name in SUPERSEDED: add(name, 'superseded', True, dict(base, by=SUPERSEDED[name], failing=sorted(failing(txt))))
        elif name in OLDER:
            inh, src, deltas = OLDER[name]; got = failing(txt); want = inh | set(deltas)
            par = S.get(src); parFail = failing(log_of(par)) if par else None
            repOk = all(S.get(r) is not None and S[r]['exit'] == 0 for v in deltas.values() for r in v)       # every replacement ran and passed
            ok = got == want and (parFail is None or parFail == inh) and repOk
            add(name, 'older-suite', ok, dict(base, failing=sorted(got), inherited=sorted(inh), inheritedSource=src, parentFailing=sorted(parFail) if parFail is not None else None,
                                            hq2Deltas={d: deltas[d] for d in sorted(deltas)}, replacementsPass=repOk, unexpected=sorted(got - want), missing=sorted(want - got)))
        elif name.endswith('_parent') or re.search(r'(^|_)hq1(_|$)', name.split('/')[-1]):
            add(name, 'parent', True, base)
        else: add(name, 'gate', s['exit'] == 0, base)
    R = {'tool': 'dev/stage-3d-hq2/summary_hq2.py', 'steps': len(out), 'byClass': {}, 'notAsRequired': [x['step'] for x in out if not x['ok']], 'rows': out}
    for x in out: R['byClass'][x['class']] = R['byClass'].get(x['class'], 0) + 1
    R['ok'] = not R['notAsRequired']
    lines = []
    for x in out:
        tag = 'OK  ' if x['ok'] else 'NOT '
        extra = ''
        if x['class'] == 'older-suite': extra = f"  failing {', '.join(x['failing']) or '-'} = inherited {', '.join(x['inherited']) or '-'} ({x['inheritedSource']}) + HQ2 deltas {', '.join(f'{d} (replaced by {chr(43).join(v)})' for d, v in x['hq2Deltas'].items()) or '-'}" + (f"  UNEXPECTED {x['unexpected']}" if x['unexpected'] else '') + (f"  MISSING {x['missing']}" if x['missing'] else '')
        elif x['class'] == 'replaced': extra = f"  replaced by {x['replacement']} (exit {x['replacementExit']})"
        elif x['class'] == 'superseded': extra = f"  judged by {x['by']}"
        lines.append(f"{tag}{x['class']:<12} {x['step']:<44} exit={x['exit']:<3} {x['counts'] or '':<9}{extra}")
    R['lines'] = lines
    a = sys.argv
    if '--out' in a: Path(a[a.index('--out') + 1]).write_text(json.dumps(R, indent=1) + '\n')
    if '--text' in a: Path(a[a.index('--text') + 1]).write_text('\n'.join(lines) + f"\n\n{len(out)} steps: " + ', '.join(f'{k} {v}' for k, v in sorted(R['byClass'].items())) + f"; not as required: {len(R['notAsRequired'])}\n")
    print('\n'.join(lines)); print(f"{len(out)} steps; not as required: {R['notAsRequired']}")
    return 0 if R['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
