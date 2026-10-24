#!/usr/bin/env python3
# dev/trial-3-nani-corners/tools/pursuit_chaos.py - Trial 3 R19 (the owner's addendum): how much of a difference between two trees' lap
# chases is the change, and how much is a lap chase's own sensitivity.  Pairs pursuit_outcomes.js records run by run:
#   python3 -I pursuit_chaos.py R18.json N.json R18_jitter.json N_jitter.json
# R18 -> N is the change; R18 -> R18 with every creature 1 px off, and N -> N likewise, are the control (no code change at all).
# Development tool; Trial 3 is not owner-approved.
import json, sys, statistics as st
R = [json.load(open(f)) for f in sys.argv[1:5]]
key = lambda r: (r['kind'], r['scene'], r['i'])
def idx(J): return {key(r): r for r in J['runs'] if not r.get('skipped')}
def pair(a, b, label, kinds):
    A, B = idx(a), idx(b)
    for kind in kinds:
        ks = [k for k in A if k[0] == kind and k in B]
        d = [B[k]['t'] - A[k]['t'] for k in ks]; diff = [x for x in d if abs(x) > 1e-9]
        ca, cb = sum(A[k]['caught'] for k in ks), sum(B[k]['caught'] for k in ks)
        sooner, later = sum(1 for x in diff if x < 0), sum(1 for x in diff if x > 0)
        drops = sum(1 for k in ks if B[k].get('passed'))
        print(f"| {label} | {kind} | {len(ks)} | {ca} -> {cb} | {st.mean([A[k]['t'] for k in ks]):.2f} -> {st.mean([B[k]['t'] for k in ks]):.2f} | {len(diff)} ({sooner} sooner, {later} later) | {(st.mean(diff) if diff else 0):+.2f} | {(max(abs(x) for x in diff) if diff else 0):.2f} | {sum(A[k]['attacks'] for k in ks)} -> {sum(B[k]['attacks'] for k in ks)} | {drops} |")
print('| pair | species | lap runs | caught | mean time to catch or the end (s) | runs that differ | mean change where they differ (s) | largest change (s) | attacks begun | runs with a waypoint dropped |')
print('|---|---|---|---|---|---|---|---|---|---|')
kinds = sorted({r['kind'] for r in R[0]['runs']})
pair(R[0], R[1], 'R18 -> N (the change)', kinds)
pair(R[0], R[2], 'R18 -> R18, creatures 1 px off (control)', kinds)
pair(R[1], R[3], 'N -> N, creatures 1 px off (control)', kinds)
