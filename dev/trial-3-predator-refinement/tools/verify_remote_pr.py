#!/usr/bin/env python3
"""Trial 3 predator refinement - verify a pushed checkpoint of trial-3-predator-refinement on GitHub (development only; a copy of
dev/trial-3-behavior-refinement/tools/verify_remote_br.py, which is left as it is for that branch).

  python3 -I -B dev/trial-3-predator-refinement/tools/verify_remote_pr.py LABEL [--out FILE.json]   (in the repository, on the branch)
  python3 -I -B dev/trial-3-predator-refinement/tools/verify_remote_pr.py --snapshot FILE.json        (before the first push: every remote head)

Checks, after a push:
  - the remote trial-3-predator-refinement tip (git ls-remote, and the GitHub REST commit and branch) equals the local HEAD, its tree and
    its parent;
  - the commits since the unapproved behaviour-refinement head 4518f93 (tree 28815b0) are one straight line without merges, whose first
    commit's parent is exactly 4518f93;
  - on GitHub: main still 7781e1a; stage-3h-engine-modernization still C5d 4beba2f (tree 677d4eb); stage-3h still the frozen 3H2
    22751bb (tree d44c4ba); stage-3e-0-bplusplus still B++ 143b63f (tree b25c26e); post-3h-trials-1-2-4 still 58fcf5b;
    trial-4-rgb-chat-accessibility still 518b990 (tree 72e60eb); post-trial4-review-polish still 1a89863 (tree ddc6385);
    post-trial4-chat-voice-polish still C5 63805e9 (tree 60e4452); pre-trial3-final-polish still P9 1ff9374 (tree d6b71b8);
    trial-3-skin-stealer still 020b5b5 (tree 26234cd); trial-3-behavior-refinement still 4518f93 (tree 28815b0); and every other remote
    branch exactly where the snapshot (dev/trial-3-predator-refinement/inventory/remote_heads_before.json, taken before the first push)
    found it; no other branch is new.
It reads; it changes nothing.  Exit status 0 only when everything holds."""
import json, subprocess, sys, datetime, os
REPO = 'RoYoshi/backroomsproject'; BRANCH = 'trial-3-predator-refinement'
BASE = '4518f93dff82e5ee8bfc8abb67dc0ecb4f77959a'; BASE_TREE = '28815b06019ed38aff8c083e93b1ba7056da3d67'
T3 = '020b5b533a3ab1e8edaaa7dd6a02bf29070421fc'; T3_TREE = '26234cdcd68b59727c68bbd21662b980d8d28bbe'
P9 = '1ff9374babc034eafed4c7c26dc941f46fc55908'; P9_TREE = 'd6b71b88e2baaec0cce1eb8a222ccc66ad1a1aef'
PROTECTED = {'main': ('7781e1ac34aa09970df57fae3fc107a873fa2731', None),
             'stage-3h-engine-modernization': ('4beba2f36deaf17473ad3b955eeefdd6fcfbd90b', '677d4ebf95d960e51dc86792bbc0861e3e1eb4c9'),
             'stage-3h': ('22751bbc39c91f3e54e3305638b2ef2c9dd12c68', 'd44c4bafa3c1a78e2d910187ecbe1cc2ec18f3c9'),
             'stage-3e-0-bplusplus': ('143b63ff42b88c6780c5043e0f61d64100f81f40', 'b25c26ec3eedab406a6b93f80a59ba6a1cb7c128'),
             'post-3h-trials-1-2-4': ('58fcf5b9ab8a115ea266f0e39d16bed49c0cdfa5', None),
             'trial-4-rgb-chat-accessibility': ('518b99021b601963cfe0ee79e9bfd2cccd2f3748', '72e60eb7b68a8dc3d2f735599d8ab828fc21691e'),
             'post-trial4-review-polish': ('1a89863286d218c8b67ccc5456ee08bbf8c15066', 'ddc6385c0f6d7112bfaf9dac3e40154acd4bbaed'),
             'post-trial4-chat-voice-polish': ('63805e98867c3677261307b8cd597f63592b8c45', '60e4452bb90c3a9650022dcdae9c2a225c356a8d'),
             'pre-trial3-final-polish': (P9, P9_TREE),
             'trial-3-skin-stealer': (T3, T3_TREE),
             'trial-3-behavior-refinement': (BASE, BASE_TREE)}
SNAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'inventory', 'remote_heads_before.json')
def run(*a):
    """A command's output; a GitHub API call is tried up to three times (the proxy can drop one call), anything else once."""
    for attempt in range(3 if a[0] == 'gh' else 1):
        r = subprocess.run(a, capture_output=True, text=True)
        if r.returncode == 0: return r.stdout.strip()
        if attempt < 2 and a[0] == 'gh': __import__('time').sleep(2 + 3 * attempt)
    raise subprocess.CalledProcessError(r.returncode, a, r.stdout, r.stderr)
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
    chain = run('git', 'rev-list', '--first-parent', '--reverse', f'{BASE}..HEAD').split()
    merges = run('git', 'rev-list', '--merges', f'{BASE}..HEAD').split()
    first_parent = run('git', 'rev-parse', chain[0] + '^') if chain else None
    untouched = {b: {'expected': c, 'remote': heads.get(b), 'ok': heads.get(b) == c} for b, c in sorted(before.items()) if b != BRANCH}
    new = sorted(set(heads) - set(before) - {BRANCH})
    r = {'checkpoint': label, 'verifiedAt': now(), 'branch': BRANCH, 'local': {'commit': head, 'tree': tree, 'parent': parent}, 'lsRemote': heads.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']], 'message': api['message'].split('\n')[0],
                       'branchHead': br['commit']['sha'], 'branchTree': br['commit']['commit']['tree']['sha']},
         'sinceBase': [{'commit': c, 'tree': run('git', 'rev-parse', c + '^{tree}'), 'subject': run('git', 'log', '-1', '--format=%s', c)} for c in chain],
         'merges': merges, 'base': {'commit': BASE, 'tree': run('git', 'rev-parse', BASE + '^{tree}'), 'firstCommitsParent': first_parent},
         'protected': prot, 'otherBranchesUntouched': untouched, 'newBranches': new}
    checks = {
        'remote tip is local HEAD': heads.get(BRANCH) == head == api['sha'] == br['commit']['sha'],
        'tree and parent agree': api['tree']['sha'] == tree == br['commit']['commit']['tree']['sha'] and [p['sha'] for p in api['parents']] == [parent],
        'one straight line from 4518f93': bool(chain) and not merges and first_parent == BASE and r['base']['tree'] == BASE_TREE,
        'protected branches unchanged': all(v['ok'] for v in prot.values()),
        'every other branch unchanged': all(v['ok'] for v in untouched.values()),
        'no new branch besides this one': not new,
    }
    r['checks'] = checks; r['ok'] = all(checks.values())
    txt = json.dumps(r, indent=1) + '\n'
    if out:
        with open(out, 'w') as f: f.write(txt)
    for k, v in checks.items(): print(('ok   ' if v else 'FAIL ') + k)
    print(f"{label}: {'VERIFIED' if r['ok'] else 'NOT VERIFIED'} - {head} (tree {tree})")
    return 0 if r['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
