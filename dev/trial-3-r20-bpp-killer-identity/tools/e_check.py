#!/usr/bin/env python3
"""Trial 3 R20, the B++ killer-identity branch (development only): is every death replay's e the server's own killer?

    python3 -I dev/trial-3-r20-bpp-killer-identity/tools/e_check.py DIR [DIR ...]

DIR holds server traces as the gate's srv_golden / bpp_golden keep them (*.new.jsonl, srv_harness.js's lines).  For every
{t:'fx', k:'death'} frame it finds the same death's kill record (the victim's snapshot 'mk' with the same death id de, sent within
500 ms of the death's start: the replay goes out in the same tick, just before it; a late joiner's is sent later with its el) and requires e == mk.e and c == mk.k.  When the victim never received a
kill record in the trace (it was gone), the capture that held it just before (the snapshot's 'cp': {ph, e, k}) is the reference.
Prints one line per trace and the totals; exit 1 on any disagreement or a replay with no reference."""
import json, glob, os, sys

def frames(path):
    for line in open(path, encoding='utf-8'):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if len(e) > 5 and e[1] == 'sock.frame' and isinstance(e[5], str) and e[5].startswith('{'):
            try:
                yield e[0], json.loads(e[5])
            except ValueError:
                pass

def main(dirs):
    total = agree = 0
    bad_all = []
    for d in dirs:
        for f in sorted(glob.glob(os.path.join(d, '*.new.jsonl'))):
            mks, cps, fx = [], [], []
            for t, m in frames(f):
                if m.get('t') == 's' and m.get('mk'):
                    mks.append((t, m['mk'].get('de'), m['mk'].get('k'), m['mk'].get('e')))
                if m.get('t') == 's' and m.get('cp'):
                    cps.append((t, m['cp'].get('k'), m['cp'].get('e')))
                if m.get('t') == 'fx' and m.get('k') == 'death':
                    fx.append((t, m.get('id'), m.get('c'), m.get('e'), m.get('de'), m.get('el')))
            if not fx:
                continue
            by_mk = by_cp = 0
            bad = []
            for t, pid, c, ev, de, el in fx:
                at = t - 1000 * float(el or 0)                    # when the death began (a late joiner's replay is sent with its el)
                same = [x for x in mks if x[1] == de and abs(x[0] - at) <= 500]   # (de starts again in a new world: the same tick only)
                if same:
                    ref = min(same, key=lambda x: abs(x[0] - at))
                    good = ref[3] == ev and ref[2] == c
                    by_mk += good
                else:
                    held = [x for x in cps if x[0] <= t and x[1] == c]
                    ref = held[-1] if held else None
                    good = bool(ref) and ref[2] == ev
                    by_cp += good
                total += 1
                agree += good
                if not good:
                    bad.append({'t': t, 'victim': pid, 'c': c, 'e': ev, 'de': de, 'reference': ref})
            kinds = sorted(set(x[2] for x in fx))
            print(f"{os.path.basename(f)}: {len(fx)} replay frames ({', '.join(kinds)}); e = the kill record's e: {by_mk}; "
                  f"= the holding capture's e (no kill record in the trace): {by_cp}; disagreeing: {len(bad)} {json.dumps(bad[:3])}")
            bad_all += bad
    print(f"TOTAL: {agree} of {total} replay frames name the server's own killer" + ('' if not bad_all else ' - DISAGREEMENT'))
    return 0 if total and not bad_all else 1

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
