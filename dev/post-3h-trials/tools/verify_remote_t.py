#!/usr/bin/env python3
"""Post-3H integration trials - verify a pushed trial checkpoint on GitHub (development only; modelled on
dev/stage-3h-modernization/tools/verify_remote_m.py, which is left as it is for Stage 3H's branch).

  python3 -I -B dev/post-3h-trials/tools/verify_remote_t.py LABEL [--out FILE.json]     (in the repository, on the branch)
  python3 -I -B dev/post-3h-trials/tools/verify_remote_t.py --snapshot FILE.json          (before the first push: every remote head)

Checks, after a push:
  - the remote post-3h-trials-1-2-4 tip (git ls-remote, and the GitHub REST commit and branch) equals the local HEAD, its tree and its
    parent;
  - the commits since the owner-accepted C5d 4beba2f (tree 677d4eb) are one straight line without merges, whose first commit's parent is
    exactly C5d; M8 c34f0c2 and B++ 143b63f are ancestors;
  - on GitHub, stage-3h-engine-modernization is still C5d (tree 677d4eb), stage-3h still the frozen 3H2 22751bb (tree d44c4ba),
    stage-3e-0-bplusplus still B++ (tree b25c26e), main still 7781e1a, and every other remote branch is exactly where the snapshot
    (dev/post-3h-trials/inventory/remote_heads_before.json, taken before the first push) found it; no other branch is new.
It reads; it changes nothing.  Exit status 0 only when everything holds."""
import json, subprocess, sys, datetime, os
REPO = 'RoYoshi/backroomsproject'; BRANCH = 'post-3h-trials-1-2-4'
C5D = '4beba2f36deaf17473ad3b955eeefdd6fcfbd90b'; C5D_TREE = '677d4ebf95d960e51dc86792bbc0861e3e1eb4c9'
PROTECTED = {'stage-3h-engine-modernization': (C5D, C5D_TREE), 'stage-3h': ('22751bbc39c91f3e54e3305638b2ef2c9dd12c68', 'd44c4bafa3c1a78e2d910187ecbe1cc2ec18f3c9'),
             'stage-3e-0-bplusplus': ('143b63ff42b88c6780c5043e0f61d64100f81f40', 'b25c26ec3eedab406a6b93f80a59ba6a1cb7c128'), 'main': ('7781e1ac34aa09970df57fae3fc107a873fa2731', None)}
M8 = 'c34f0c22bbacc5ac2813d173bc0591b67af7169f'; BPP = '143b63ff42b88c6780c5043e0f61d64100f81f40'
SNAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'inventory', 'remote_heads_before.json')
def run(*a):
    """A command's output; a GitHub API call is tried up to three times (the proxy can drop one call), anything else once."""
    for attempt in range(3 if a[0] == 'gh' else 1):
        r = subprocess.run(a, capture_output=True, text=True)
        if r.returncode == 0: return r.stdout.strip()
        if attempt < 2 and a[0] == 'gh': __import__('time').sleep(2 + 3 * attempt)
    raise subprocess.CalledProcessError(r.returncode, a, r.stdout, r.stderr)
isanc = lambda a, b: subprocess.run(['git', 'merge-base', '--is-ancestor', a, b]).returncode == 0
heads_now = lambda: {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}
now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def main():
    if sys.argv[1] == '--snapshot':
        h = heads_now(); s = {'takenAt': now(), 'repo': REPO, 'count': len(h), 'heads': dict(sorted(h.items()))}
        with open(sys.argv[2], 'w') as f: f.write(json.dumps(s, indent=1) + '\n')
        print(json.dumps(s, indent=1)); return 0
    label = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    before = json.load(open(SNAP))['heads']
    head, tree, parent = run('git', 'rev-parse', 'HEAD'), run('git', 'rev-parse', 'HEAD^{tree}'), run('git', 'rev-parse', 'HEAD^')
    heads = heads_now()
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{head}'))
    br = json.loads(run('gh', 'api', f'repos/{REPO}/branches/{BRANCH}'))
    prot = {}
    for b, (c, t) in PROTECTED.items():
        j = json.loads(run('gh', 'api', f'repos/{REPO}/branches/{b}'))
        prot[b] = {'expected': c, 'api': j['commit']['sha'], 'apiTree': j['commit']['commit']['tree']['sha'], 'lsRemote': heads.get(b)}
        prot[b]['ok'] = prot[b]['api'] == c == prot[b]['lsRemote'] and (t is None or prot[b]['apiTree'] == t)
    chain = run('git', 'rev-list', '--first-parent', '--reverse', f'{C5D}..HEAD').split()
    merges = run('git', 'rev-list', '--merges', f'{C5D}..HEAD').split()
    first_parent = run('git', 'rev-parse', chain[0] + '^') if chain else None
    untouched = {b: {'expected': c, 'remote': heads.get(b), 'ok': heads.get(b) == c} for b, c in sorted(before.items()) if b != BRANCH}
    r = {'checkpoint': label, 'verifiedAt': now(), 'branch': BRANCH, 'local': {'commit': head, 'tree': tree, 'parent': parent}, 'lsRemote': heads.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']], 'message': api['message'].split('\n')[0],
                       'branchHead': br['commit']['sha'], 'branchTree': br['commit']['commit']['tree']['sha']},
         'sinceC5d': [{'commit': c, 'tree': run('git', 'rev-parse', c + '^{tree}'), 'subject': run('git', 'log', '-1', '--format=%s', c)} for c in chain],
         'merges': merges, 'c5d': {'commit': C5D, 'tree': run('git', 'rev-parse', C5D + '^{tree}'), 'firstCommitsParent': first_parent, 'ancestorOfHead': isanc(C5D, head)},
         'm8AncestorOfHead': isanc(M8, head), 'bppAncestorOfHead': isanc(BPP, head),
         'protected': prot, 'untouched': untouched, 'newRemoteBranches': sorted(b for b in heads if b not in before and b != BRANCH)}
    r['ok'] = bool(head == heads.get(BRANCH) == api['sha'] == br['commit']['sha'] and tree == api['tree']['sha'] == br['commit']['commit']['tree']['sha']
                   and [parent] == r['githubApi']['parents'] and r['c5d']['tree'] == C5D_TREE and first_parent == C5D and not merges and r['c5d']['ancestorOfHead']
                   and r['m8AncestorOfHead'] and r['bppAncestorOfHead'] and all(v['ok'] for v in prot.values())
                   and all(v['ok'] for v in untouched.values()) and not r['newRemoteBranches'])
    s = json.dumps(r, indent=1)
    if out:
        with open(out, 'w') as f: f.write(s + '\n')
    print(s)
    return 0 if r['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
