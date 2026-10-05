#!/usr/bin/env python3
"""2D Lighting & Shadows - which retained-suite logs a candidate run reproduces byte for byte.

  python3 dev/shadows/log_identity.py BASE_DIR CAND_DIR [--out FILE]

BASE_DIR and CAND_DIR are two `run_retained.py run --out` folders (the parent and a candidate). For every suite log of
the baseline it reports the strictest level at which the candidate's log matches:

  byte-identical            the two files are equal byte for byte
  identical except timings  equal once per-test durations such as `[1364ms]` / `(2.3 s)` are removed
  PASS/FAIL lines identical every PASS / FAIL result line (durations removed) is the same, in the same order; other
                            lines (progress, timestamps, ports, random ids) differ
  differs                   nothing above holds; such a suite is judged by `run_retained.py compare` (verdict, counts,
                            failing assertions and error messages), which is what decides a regression

This is supporting evidence only. It never decides PASS / FAIL and changes no suite.
"""
import argparse, re, sys
from pathlib import Path

TIMING = re.compile(r'\s*[\[(]\d+(?:\.\d+)?\s*(?:ms|s)[\])]')
RESULT = re.compile(r'^\s*(PASS|FAIL)\b')


def level(b, c):
    if b == c: return 'byte-identical', ''
    bt, ct = b.decode('utf-8', 'replace'), c.decode('utf-8', 'replace')
    bn, cn = TIMING.sub('', bt), TIMING.sub('', ct)
    if bn == cn: return 'identical except timings', ''
    br = [l for l in bn.splitlines() if RESULT.match(l)]; cr = [l for l in cn.splitlines() if RESULT.match(l)]
    if br and br == cr: return 'PASS/FAIL lines identical', f'{len(br)} result lines'
    bl, cl = bn.splitlines(), cn.splitlines()
    same = sum(1 for x, y in zip(bl, cl) if x == y)
    return 'differs', f'{same} of {max(len(bl), len(cl))} lines equal after removing durations'


def main():
    P = argparse.ArgumentParser(); P.add_argument('base'); P.add_argument('cand'); P.add_argument('--out')
    a = P.parse_args(); B, C = Path(a.base), Path(a.cand)
    rows = []
    for f in sorted(B.glob('*.log')):
        g = C / f.name
        if not g.exists(): rows.append((f.stem, 'missing in candidate', '')); continue
        rows.append((f.stem, *level(f.read_bytes(), g.read_bytes())))
    w = max(len(r[0]) for r in rows)
    L = [f'{s:<{w}}  {lv}' + (f'  ({note})' if note else '') for s, lv, note in rows]
    tally = {}
    for _, lv, _ in rows: tally[lv] = tally.get(lv, 0) + 1
    L += ['', 'summary: ' + ', '.join(f'{n} {k}' for k, n in sorted(tally.items(), key=lambda kv: -kv[1]))]
    txt = '\n'.join(L) + '\n'
    if a.out: Path(a.out).write_text(txt)
    print(txt, end='')
    return 0


if __name__ == '__main__':
    sys.exit(main())
