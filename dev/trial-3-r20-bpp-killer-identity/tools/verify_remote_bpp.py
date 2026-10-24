#!/usr/bin/env python3
"""Trial 3 R20, the B++ killer-identity branch: verify its pushed checkpoint on GitHub (development only; it reads, it changes nothing).

    python3 -I -B dev/trial-3-r20-bpp-killer-identity/tools/verify_remote_bpp.py [--out FILE.json]     (in a worktree on the branch, after its push)

Checks:
  - the remote branch tip (git ls-remote, and the GitHub REST branch and commit) equals the local HEAD, with the same tree and parents;
  - every file HEAD changed against 3a0d741 (R20 combined, where the branch starts) has the same blob on GitHub (the REST tree of the
    pushed commit) as here, and none is missing;
  - every commit since 3a0d741 descends from it, in one straight line without merges;
  - main, R18's receipt, R19 combined and R20 combined (trial-3-r20-combined-humanqa) are where they were: the branch touched none of them.
Exit status 0 only when everything holds."""
import json, subprocess, sys
REPO = 'RoYoshi/backroomsproject'
BRANCH = 'trial-3-r20-bpp-killer-identity'
START = '3a0d7418a8b472e211f45b5f440a421c94e4ddae'
PINNED = {'main': '7781e1ac34aa09970df57fae3fc107a873fa2731',
          'trial-3-r9-cognitive-ambush-overhaul': '01e5d97afd7bd1fec4fd4e34ef07953101faef6e',
          'trial-3-r19-combined-humanqa': '2f11eae188c7ec08e81efbaa2bb5bacf80ce6772',
          'trial-3-r20-combined-humanqa': 'f5b58d7'}
git = lambda *a: subprocess.run(['git', *a], check=True, capture_output=True, text=True).stdout.strip()
gh = lambda p: json.loads(subprocess.run(['gh', 'api', p], check=True, capture_output=True, text=True).stdout)
R = {'branch': BRANCH, 'checks': []}
def check(name, ok, detail=''):
    R['checks'].append({'name': name, 'ok': bool(ok), 'detail': detail}); print(f"{'PASS' if ok else 'FAIL'} {name}{': ' + detail if detail else ''}")
head = git('rev-parse', 'HEAD'); tree = git('rev-parse', 'HEAD^{tree}'); parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split()[1:]
R['head'] = head
ls = dict((l.split('\t')[1], l.split('\t')[0]) for l in git('ls-remote', 'origin').splitlines() if '\t' in l)
check('ls-remote tip is the local HEAD', ls.get('refs/heads/' + BRANCH) == head, head)
b = gh(f'repos/{REPO}/branches/{BRANCH}'); c = gh(f'repos/{REPO}/git/commits/{head}')
check('GitHub branch tip is the local HEAD', b['commit']['sha'] == head)
check('GitHub commit tree and parents are the local ones', c['tree']['sha'] == tree and [p['sha'] for p in c['parents']] == parents, f'tree {tree}')
rt = gh(f'repos/{REPO}/git/trees/{tree}?recursive=1'); blobs = {e['path']: e['sha'] for e in rt['tree'] if e['type'] == 'blob'}
check('the GitHub tree is complete (not truncated)', not rt.get('truncated'))
changed = [f for f in git('diff', '--name-only', START, 'HEAD').splitlines() if f]
bad = [f for f in changed if blobs.get(f) != git('rev-parse', 'HEAD:' + f)]
check(f'every file changed since {START[:7]} has the same blob on GitHub', not bad, f'{len(changed)} files' + (f'; differ: {bad[:5]}' if bad else ''))
line = git('rev-list', '--ancestry-path', '--parents', f'{START}..HEAD').splitlines()
check(f'the commits since {START[:7]} are one straight line from it', git('merge-base', '--is-ancestor', START, 'HEAD') == '' and all(len(x.split()) == 2 for x in line), f'{len(line)} commits')
for ref, sha in PINNED.items():
    now = ls.get('refs/heads/' + ref, '')
    check(f'{ref} untouched', now.startswith(sha), now[:12])
R['ok'] = all(x['ok'] for x in R['checks'])
if '--out' in sys.argv: open(sys.argv[sys.argv.index('--out') + 1], 'w').write(json.dumps(R, indent=1) + '\n')
print('REMOTE CHECKPOINT: ' + ('VERIFIED' if R['ok'] else 'NOT VERIFIED'))
sys.exit(0 if R['ok'] else 1)
