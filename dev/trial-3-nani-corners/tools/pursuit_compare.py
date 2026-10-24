#!/usr/bin/env python3
# dev/trial-3-nani-corners/tools/pursuit_compare.py - Trial 3 R19: pursuit_outcomes.js records of two trees, paired run by run (the same
# seeded scene).  python3 -I pursuit_compare.py BASE.json OTHER.json   (development tool; Trial 3 is not owner-approved)
import json, sys, statistics as st
A, B = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
key = lambda r: (r['kind'], r['scene'], r['i'])
a = {key(r): r for r in A['runs'] if not r.get('skipped')}; b = {key(r): r for r in B['runs'] if not r.get('skipped')}
groups = sorted({(k[0], k[1]) for k in a})
print(f"| species, scene | runs | caught {A['tree']} -> {B['tree']} | median catch (s) | mean time to catch or the end (s) | attacks begun | median mean distance (px) | runs differing: sooner / later / the same | waypoints dropped |")
print('|---|---|---|---|---|---|---|---|---|')
for g in groups:
    ks = [k for k in a if (k[0], k[1]) == g and k in b]
    ra, rb = [a[k] for k in ks], [b[k] for k in ks]
    ca, cb = sum(r['caught'] for r in ra), sum(r['caught'] for r in rb)
    ma = st.median([r['t'] for r in ra if r['caught']]) if ca else None; mb = st.median([r['t'] for r in rb if r['caught']]) if cb else None
    ta, tb = st.mean([r['t'] for r in ra]), st.mean([r['t'] for r in rb])
    sooner = sum(1 for x, y in zip(ra, rb) if y['t'] < x['t'] - 1e-9); later = sum(1 for x, y in zip(ra, rb) if y['t'] > x['t'] + 1e-9)
    print(f"| {g[0]}, {g[1]} | {len(ks)} | {ca} -> {cb} | {ma} -> {mb} | {ta:.2f} -> {tb:.2f} | {sum(r['attacks'] for r in ra)} -> {sum(r['attacks'] for r in rb)} | {st.median([r['meanD'] for r in ra])} -> {st.median([r['meanD'] for r in rb])} | {sooner} / {later} / {len(ks) - sooner - later} | {sum(r.get('passed', 0) for r in rb)} |")
