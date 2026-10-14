#!/usr/bin/env python3
"""Stage 3H engine modernization (H3M-7) - the root's historical reports moved into dev/archive/, byte for byte, with a ledger (development only).

  python3 -I -B dev/stage-3h-modernization/tools/m7_archive_root.py --apply     move them (git mv), write the ledger, the indexes and the
                                                                                 root listings
  python3 -I -B dev/stage-3h-modernization/tools/m7_archive_root.py --verify    check the ledger against the files (exit 1 on any mismatch)
  python3 -I -B dev/stage-3h-modernization/tools/m7_archive_root.py --root-after   rewrite ROOT_AFTER.txt from the root as it is now (once the
                                                                                 short README.md is written)
  python3 -I -B dev/stage-3h-modernization/tools/m7_archive_root.py --audit [--out FILE.json]
        the reference audit and the root scorecard: every file that names a moved report, by where it is.  An active file (src/, public/,
        generated/, docs/, the root, dev/tools/) may name one only by its new path, in the move declarations of the gate's scope step, or
        in the game's own bytes (two served scripts' comments, the source of one, and the lineage record of index.html's text: kept, and
        noted in the ledger).  Any other active reference by the old root name fails (exit 1).  The earlier stages' files, this stage's
        inventories and tools, and the archive itself keep the old names as they were: they are counted, not changed

The plan is H3M-0's inventory/ROOT_ARCHIVE_PLAN.csv (128 stage reports, change lists, QA pages and two images), plus the root README.md:
its 552 lines of version history move to dev/archive/readme-history/README_UNTIL_3H.md, and a short README takes its place (written by
hand, not by this tool).  Each file is moved with git mv, never rewritten: its Git blob id and SHA-256 are recorded before and after, and
must be equal.  Before moving, the targets are checked for collisions (case and Unicode folded) and must not exist.

Written:
  dev/archive/root_cleanup.csv   the ledger: old_path, new_path, git_blob_sha, sha256_before, sha256_after, type, reference_action,
                                 verified_date, notes (one row per file; the master pack's schema)
  dev/archive/INDEX.md           every era, its folder, and every file's old root name -> new path
  dev/archive/<era>/README.md    the era's files, each with its title
  dev/archive/ROOT_BEFORE.txt, ROOT_AFTER.txt   the root listing before and after
Nothing at the old paths is left behind (no redirect stubs): the ledger and the index map the old names.  Historical documents and the
tools of earlier stages keep naming the old root paths, as they were; the game's own files are not touched (two served scripts name a
report in a comment: the ledger maps those too)."""
import argparse, collections, csv, datetime, hashlib, io, json, os, re, subprocess, sys, unicodedata
ap = argparse.ArgumentParser(); g = ap.add_mutually_exclusive_group(required=True); g.add_argument('--apply', action='store_true'); g.add_argument('--verify', action='store_true')
g.add_argument('--root-after', action='store_true'); g.add_argument('--audit', action='store_true'); ap.add_argument('--out')
A = ap.parse_args()
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
os.chdir(REPO)
PLAN = 'dev/stage-3h-modernization/inventory/ROOT_ARCHIVE_PLAN.csv'
LEDGER, INDEX = 'dev/archive/root_cleanup.csv', 'dev/archive/INDEX.md'
README_OLD, README_NEW = 'README.md', 'dev/archive/readme-history/README_UNTIL_3H.md'
FIELDS = ['old_path', 'new_path', 'git_blob_sha', 'sha256_before', 'sha256_after', 'type', 'reference_action', 'verified_date', 'notes']
ERAS = {'2d-shadows': '2D shadows (SH0 to SH4)', 'br-role': 'BR-RoLE 1.0 to 1.2', 'part-2': 'Part 2 (AI, camera, FPS, Human QA hotfixes)',
        'readme-history': 'the root README until Stage 3H', 'stage-2e': 'Stage 2E', 'stage-2f': 'Stage 2F', 'stage-3b': 'Stage 3B (visuals, lighting, props)',
        'stage-3c': 'Stage 3C (UI and menus)', 'stage-3d': 'Stage 3D (deaths, NEW RUN, HQ1 to HQ5)', 'stage-3e-0': 'Stage 3E-0 (B+ and B++)',
        'stage-3h0': 'Stage 3H0 (the first extraction)'}
sha = lambda b: hashlib.sha256(b).hexdigest()
blob = lambda b: hashlib.sha1(b'blob %d\0' % len(b) + b).hexdigest()
git = lambda *a: subprocess.run(['git', *a], capture_output=True, text=True, check=True).stdout
def root_listing():
    return '\n'.join(sorted(e + ('/' if os.path.isdir(e) else '') for e in os.listdir('.') if e != '.git')) + '\n'
def title(p):
    if not p.endswith('.md'): return ''
    for l in open(p, encoding='utf-8', errors='replace'):
        if l.startswith('#'): return l.lstrip('#').strip()
    return ''

if A.root_after:
    open('dev/archive/ROOT_AFTER.txt', 'w', encoding='utf-8').write(root_listing())
    print('dev/archive/ROOT_AFTER.txt: ' + ', '.join(root_listing().split()))
    sys.exit(0)

if A.audit:
    rows = list(csv.DictReader(open(LEDGER, encoding='utf-8')))
    names = sorted({os.path.basename(r['old_path']) for r in rows if r['old_path'] != README_OLD}, key=len, reverse=True)
    rx = re.compile(r'(?<![\w.-])(' + '|'.join(map(re.escape, names)) + r')(?![\w.-])')
    KEPT = {'public/assets/level0_visuals.js', 'src/frameworks/lost/client/level0_visuals.js', 'public/index.html'}
    DECL = 'dev/tools/gate/declared_changes.json'
    def where(f):
        if f.startswith('dev/archive/'): return 'archive'
        if f.startswith('dev/stage-3h-modernization/'): return 'this stage'
        if f.startswith('dev/') and not f.startswith('dev/tools/'): return 'earlier stages'
        return 'active'
    files = [f for f in git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0') if f and os.path.isfile(f)]
    R = {'tool': 'dev/stage-3h-modernization/tools/m7_archive_root.py --audit', 'moved': len(rows), 'classes': {}, 'active': [], 'problems': []}
    for f in sorted(files):
        try: text = open(f, encoding='utf-8').read()
        except (UnicodeDecodeError, OSError): continue
        refs = []
        for m in rx.finditer(text):
            before = text[max(0, m.start() - 40):m.start()]
            kind = 'archive path' if re.search(r'dev/archive/[a-z0-9-]+/$', before) else 'relative path' if before.endswith('/') else 'bare name'
            refs.append((m.group(1), kind, text.count('\n', 0, m.start()) + 1))
        if not refs: continue
        c = R['classes'].setdefault(where(f), {'files': 0, 'references': 0, 'by kind': {}})
        c['files'] += 1; c['references'] += len(refs)
        for _, kind, _l in refs: c['by kind'][kind] = c['by kind'].get(kind, 0) + 1
        if where(f) != 'active': continue
        for name, kind, line in refs:
            if kind == 'archive path': why = 'by its new path'
            elif f == DECL: why = 'the move declarations (the gate\'s scope step)'
            elif f in KEPT or f.startswith('src/core/client/bundle/lineage/'): why = 'the game\'s own bytes, kept (the ledger notes it)'
            else: why = None; R['problems'].append(f'{f}:{line}: names {name} ({kind}), not by its new path')
            R['active'].append({'file': f, 'line': line, 'name': name, 'kind': kind, 'accepted': why})
    before_l, after_l = open('dev/archive/ROOT_BEFORE.txt', encoding='utf-8').read().split(), root_listing().split()
    kinds = collections.Counter(r['type'] for r in rows)
    R['scorecard'] = {'root entries before': len(before_l), 'root entries now': len(after_l), 'root files before': sum(not e.endswith('/') for e in before_l),
                      'root files now': sum(not e.endswith('/') for e in after_l), 'root now': after_l, 'moved': len(rows), 'moved by type': dict(sorted(kinds.items())),
                      'eras': len({r['new_path'].split('/')[2] for r in rows}), 'ROOT_AFTER.txt current': open('dev/archive/ROOT_AFTER.txt', encoding='utf-8').read() == root_listing()}
    R['ok'] = not R['problems'] and R['scorecard']['ROOT_AFTER.txt current']
    if A.out: open(A.out, 'w', encoding='utf-8').write(json.dumps(R, indent=1) + '\n')
    S = R['scorecard']
    print(f"ROOT: {S['root entries before']} entries before ({S['root files before']} files), {S['root entries now']} now ({S['root files now']} files): {' '.join(S['root now'])}")
    print(f"MOVED: {S['moved']} files into {S['eras']} eras of dev/archive/ ({', '.join(f'{n} {k}' for k, n in S['moved by type'].items())}); ROOT_AFTER.txt {'current' if S['ROOT_AFTER.txt current'] else 'NOT CURRENT'}")
    for cl in ('active', 'this stage', 'earlier stages', 'archive'):
        c = R['classes'].get(cl, {'files': 0, 'references': 0, 'by kind': {}})
        print(f"{cl:15s} {c['files']:4d} files, {c['references']:5d} references ({', '.join(f'{n} {k}' for k, n in sorted(c['by kind'].items())) or '-'})")
    for (f, why), n in collections.Counter((a['file'], a['accepted'] or 'PROBLEM') for a in R['active']).items(): print(f"  active: {f}: {n} reference{'s' if n > 1 else ''}: {why}")
    for p in R['problems']: print('  PROBLEM ' + p)
    print('REFERENCE AUDIT: ' + ('PASS' if R['ok'] else 'FAIL') + f" ({len(R['problems'])} problems)")
    sys.exit(0 if R['ok'] else 1)

if A.verify:
    rows = list(csv.DictReader(open(LEDGER, encoding='utf-8'))); bad = []
    for r in rows:
        if not os.path.isfile(r['new_path']): bad.append(f"{r['new_path']}: missing"); continue
        b = open(r['new_path'], 'rb').read()
        if sha(b) != r['sha256_after'] or sha(b) != r['sha256_before'] or blob(b) != r['git_blob_sha']: bad.append(f"{r['new_path']}: not the moved bytes")
        if r['old_path'] != README_OLD and os.path.exists(r['old_path']): bad.append(f"{r['old_path']}: still at the root")
    base = git('ls-tree', '-r', '--name-only', '143b63ff42b88c6780c5043e0f61d64100f81f40').split('\n')
    for r in rows:
        if r['old_path'] not in base: bad.append(f"{r['old_path']}: not a file of B++")
    for x in bad: print('MISMATCH ' + x)
    print(f'ARCHIVE LEDGER: {len(rows)} files; ' + ('every one is where the ledger says, byte for byte' if not bad else f'{len(bad)} MISMATCHES'))
    sys.exit(1 if bad else 0)

plan = list(csv.DictReader(open(PLAN, encoding='utf-8')))
moves = [(r['old_path'], r['proposed_new_path'], r['type'], r['reference_action'], r['git_blob_sha']) for r in plan]
moves.append((README_OLD, README_NEW, 'markdown', 'the root README until Stage 3H; a short README now stands at the root and links to this one', git('rev-parse', 'HEAD:' + README_OLD).strip()))
fold = collections.Counter(unicodedata.normalize('NFC', m[1]).casefold() for m in moves)
if any(n > 1 for n in fold.values()): sys.exit('target collision: nothing moved')
if any(os.path.exists(m[1]) for m in moves): sys.exit('a target exists already: nothing moved')
before = root_listing(); today = datetime.date.today().isoformat(); out = []
for old, new, typ, action, plan_blob in moves:
    b = open(old, 'rb').read()
    if blob(b) != plan_blob or git('rev-parse', 'HEAD:' + old).strip() != plan_blob: sys.exit(f'{old}: not the file the plan recorded; stopped (earlier moves stand: git status shows them)')
    os.makedirs(os.path.dirname(new), exist_ok=True)
    subprocess.run(['git', 'mv', old, new], check=True)
    a = open(new, 'rb').read()
    if a != b: sys.exit(f'{new}: the bytes changed in the move')
    notes = 'the game names it in a comment of a served script (unchanged)' if old in ('STAGE_3B_PROP_CANON_AUDIT.md', 'STAGE_3C_QA1_REPORT.md') else ''
    out.append({'old_path': old, 'new_path': new, 'git_blob_sha': plan_blob, 'sha256_before': sha(b), 'sha256_after': sha(a), 'type': typ,
                'reference_action': action, 'verified_date': today, 'notes': notes})
os.makedirs('dev/archive', exist_ok=True)
with open(LEDGER, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator='\n'); w.writeheader(); w.writerows(out)
open('dev/archive/ROOT_BEFORE.txt', 'w', encoding='utf-8').write(before)
open('dev/archive/ROOT_AFTER.txt', 'w', encoding='utf-8').write(root_listing())   # (README.md is written next, by hand: it is listed in INDEX.md)
by = collections.defaultdict(list)
for r in out: by[r['new_path'].split('/')[2]].append(r)
idx = ['# dev/archive: the reports of earlier stages', '',
       'Development only: nothing here is served. Until Stage 3H these files stood at the repository root. H3M-7 moved them here with',
       '`git mv`, byte for byte: their Git blob ids and SHA-256 are in `root_cleanup.csv`, and',
       '`python3 -I -B dev/stage-3h-modernization/tools/m7_archive_root.py --verify` checks them.', '',
       'Historical documents and the tools of earlier stages still name these files by their old root paths; they are kept as they were.',
       'Use the table below, or the ledger, to find a file by its old name. Two of the game\'s own scripts name a report in a comment',
       '(`public/assets/level0_visuals.js`: STAGE_3B_PROP_CANON_AUDIT.md; `public/index.html`: STAGE_3C_QA1_REPORT.md); the game is not',
       'changed for that, so the ledger maps them too.', '',
       '| Era | Folder | Files |', '|---|---|---|']
for era in sorted(by): idx.append(f'| {ERAS.get(era, era)} | [`{era}/`]({era}/README.md) | {len(by[era])} |')
idx += ['', '## Every file, by its old root name', '', '| Old path (root) | Now |', '|---|---|']
for r in sorted(out, key=lambda r: r['old_path'].casefold()): idx.append(f"| `{r['old_path']}` | [`{r['new_path'][len('dev/archive/'):]}`]({r['new_path'][len('dev/archive/'):]}) |")
open(INDEX, 'w', encoding='utf-8').write('\n'.join(idx) + '\n')
for era, rs in by.items():
    lines = [f'# dev/archive/{era}: {ERAS.get(era, era)}', '', 'Moved here from the repository root at Stage 3H (H3M-7), byte for byte (`../root_cleanup.csv`). The index of',
             'every era is `../INDEX.md`.', '', '| File | What it is |', '|---|---|']
    for r in sorted(rs, key=lambda r: r['new_path'].casefold()):
        n = os.path.basename(r['new_path']); t = title(r['new_path']) or {'text': 'a plain-text list or report', 'image': 'an image'}.get(r['type'], '')
        lines.append(f'| [`{n}`]({n}) | {t.replace("|", "/")} |')
    open(f'dev/archive/{era}/README.md', 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print(f'moved {len(out)} files into dev/archive/ ({len(by)} eras); ledger {LEDGER}; index {INDEX}')
