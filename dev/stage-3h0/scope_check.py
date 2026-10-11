#!/usr/bin/env python3
"""Stage 3H0 - is every change inside the stage's scope?  (development only)

  python3 -I dev/stage-3h0/scope_check.py [--out FILE.json]      (in the repository, on stage-3h0)

1. Every file that differs between the accepted parent edd2af9 and HEAD (plus anything uncommitted or untracked) is put in one class:
     production  the files an approved extraction changed or created (listed below, with the checkpoint)
     test        the one existing test 3H0 may change (dev/tests/interp_test.js, H0-3)
     tooling     dev/stage-3h0/** (the stage's own tools and evidence)
     docs        the stage's documents at the repository root (3H0_*.md, STAGE_3H0_*)
   Anything else is OUT OF SCOPE and fails the check.
2. For mp.js and server.js: every line removed since the parent must reappear, character for character, in one of the files cut out of
   them (the move), unless it is one of the few lines changed by design (listed: the inline look encoders that became lookStr(...)).
   Every line added to them is listed: they must be the require / namespace lines and those call sites.
3. index.html: the only difference allowed is the two added <script> lines.
Exit status 0 only when all of that holds."""
import subprocess, sys, json, os, difflib
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PARENT = 'edd2af954627caf7721c7614df5ff1c7f20d3f3b'
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout
PRODUCTION = {'mp.js': 'H0-2, H0-3', 'index.html': 'H0-2, H0-3', 'assets/net-wire.js': 'H0-2', 'assets/net-interp.js': 'H0-3',
              'server.js': 'H0-4a, H0-4b, H0-4c', 'server/ws.js': 'H0-4a', 'server/fields.js': 'H0-4b', 'server/static.js': 'H0-4c'}
TESTS = {'dev/tests/interp_test.js': 'H0-3: reads the interpolation from assets/net-interp.js when present'}
def cls(p):
    if p in PRODUCTION: return 'production'
    if p in TESTS: return 'test'
    if p.startswith('dev/stage-3h0/'): return 'tooling'
    if '/' not in p and (p.startswith('3H0_') or p.startswith('STAGE_3H0_')): return 'docs'
    return 'OUT OF SCOPE'
changed = set(run('git', 'diff', '--name-only', PARENT, 'HEAD').split())
changed |= set(run('git', 'diff', '--name-only', 'HEAD').split())                                     # uncommitted
changed |= set(run('git', 'ls-files', '--others', '--exclude-standard').split())                     # untracked
rep = {'tool': 'dev/stage-3h0/scope_check.py', 'parent': PARENT, 'head': run('git', 'rev-parse', 'HEAD').strip(), 'files': {}, 'counts': {}}
for p in sorted(changed): rep['files'][p] = cls(p)
for c in set(rep['files'].values()): rep['counts'][c] = sum(v == c for v in rep['files'].values())
out_of_scope = [p for p, c in rep['files'].items() if c == 'OUT OF SCOPE']
# 2. the moves
def lines_at(ref, p):
    try: return run('git', 'show', f'{ref}:{p}').split('\n')
    except subprocess.CalledProcessError: return []
cur = lambda p: open(p, encoding='utf8').read().split('\n')
moved = {}
BY_DESIGN = {   # removed lines that did not move verbatim, on purpose: what each became
    "lk: [A.look.hat, A.look.texture, A.look.hands, A.look.main, A.look.backpack].join('|')": 'H0-2: lk: lookStr(A.look)',
    "lk: [t.appearance.hat, t.appearance.texture, t.appearance.hands, t.appearance.main, t.appearance.backpack].join('|')": 'H0-2: lk: lookStr(t.appearance)',
    "lk: window.__api ? [window.__api.look.hat, window.__api.look.texture, window.__api.look.hands, window.__api.look.main, window.__api.look.backpack].join('|') : undefined": 'H0-2: lk: window.__api ? lookStr(window.__api.look) : undefined',
    "const srv = http.createServer((req, res) => {": "H0-4c: the handler's header; now module.exports = ROOT => (req, res) => { in server/static.js, and http.createServer(require('./server/static.js')(ROOT))",
    "sock.on('data', d => {": "H0-4a: the parser's header; now return d => { inside reader() in server/ws.js, and sock.on('data', reader(sock, onMessage))",
}
for host, cut in (('mp.js', ['assets/net-wire.js', 'assets/net-interp.js']), ('server.js', ['server/ws.js', 'server/fields.js', 'server/static.js'])):
    old, new = lines_at(PARENT, host), cur(host)
    pool = set(l.strip() for f in cut for l in cur(f))
    removed, added = [], []
    for op in difflib.ndiff(old, new):
        if op.startswith('- '): removed.append(op[2:])
        elif op.startswith('+ '): added.append(op[2:])
    not_moved = [l for l in removed if l.strip() and l.strip() not in pool]
    unexplained = [l for l in not_moved if not any(b in l for b in BY_DESIGN)]
    moved[host] = {'linesRemoved': len(removed), 'removedLinesFoundVerbatimInTheNewFiles': len(removed) - len(not_moved),
                   'removedLinesChangedByDesign': [{'line': l.strip()[:200], 'became': next(v for k, v in BY_DESIGN.items() if k in l)} for l in not_moved if l not in unexplained],
                   'removedLinesUnexplained': [l.strip()[:200] for l in unexplained], 'linesAdded': [l.strip()[:220] for l in added]}
rep['moves'] = moved
# 3. index.html
o, n = lines_at(PARENT, 'index.html'), cur('index.html')
diff = [d for d in difflib.ndiff(o, n) if d[:2] in ('- ', '+ ')]
rep['indexHtml'] = {'difference': diff, 'ok': diff == ['+ <script src="./assets/net-wire.js"></script>', '+ <script src="./assets/net-interp.js"></script>']}
rep['ok'] = not out_of_scope and all(not m['removedLinesUnexplained'] for m in moved.values()) and rep['indexHtml']['ok']
rep['outOfScope'] = out_of_scope
out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
if out: json.dump(rep, open(out, 'w'), indent=1)
print('files changed since the parent:', len(changed), rep['counts'])
for p in out_of_scope: print('  OUT OF SCOPE', p)
for h, m in moved.items():
    print(f"{h}: {m['linesRemoved']} lines removed, {m['removedLinesFoundVerbatimInTheNewFiles']} of them verbatim in the new files, "
          f"{len(m['removedLinesChangedByDesign'])} changed by design, {len(m['removedLinesUnexplained'])} unexplained; {len(m['linesAdded'])} lines added")
    for l in m['linesAdded']: print('   +', l[:160])
    for l in m['removedLinesUnexplained']: print('   UNEXPLAINED -', l[:160])
print('index.html:', 'only the two script lines' if rep['indexHtml']['ok'] else rep['indexHtml']['difference'])
print('scope:', 'OK' if rep['ok'] else 'NOT OK')
sys.exit(0 if rep['ok'] else 1)
