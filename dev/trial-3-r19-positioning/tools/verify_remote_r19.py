#!/usr/bin/env python3
"""Trial 3 R19 - verify a pushed checkpoint of one of R19's isolated branches on GitHub (development only; made from
dev/trial-3-r9-overhaul/tools/verify_remote_r9.py, which is left as it is).  Trial 3 is not owner-approved.

  python3 -I -B <this> LABEL --branch BRANCH [--out FILE.json]       (in a worktree on BRANCH, after its push)
  python3 -I -B <this> --snapshot FILE.json                          (before the first R19 push: every remote head)

BRANCH is one of R19's three: trial-3-r19-prechase-positioning (S), trial-3-nani-cornering-qol (N), trial-3-r19-combined-humanqa (the
optional QA-only combination).  Checks, after a push:
  - the remote BRANCH tip (git ls-remote, and the GitHub REST commit and branch) equals the local HEAD, its tree and its parent(s); every
    file the checkpoint changed (HEAD against its first parent) has the same blob on GitHub (the REST tree of the pushed commit) as here;
  - S and N: the commits since the frozen R18 receipt 01e5d97 (tree e042ca3) are one straight line without merges whose first commit's
    parent is exactly 01e5d97.  The combination: every commit since 01e5d97 descends from it, and its merges join only S and N commits
    (each merge's parents are commits of the S or N line, or of the combination itself);
  - on GitHub: main and every protected head (R8's chain, the Stage 3H, Trial 4 and polish heads) where R18's verifier pinned them, and
    R18's own branch trial-3-r9-cognitive-ambush-overhaul still the receipt 01e5d97 (tree e042ca3; R17 636f01e its grandparent);
  - every other remote branch exactly where the snapshot (inventory/remote_heads_before_r19.json, taken before the first R19 push) found
    it; the only new branches are R19's own, and each of those descends from 01e5d97.
It reads; it changes nothing.  Exit status 0 only when everything holds."""
import json, subprocess, sys, datetime, os
REPO = 'RoYoshi/backroomsproject'
R19 = ('trial-3-r19-prechase-positioning', 'trial-3-nani-cornering-qol', 'trial-3-r19-combined-humanqa')
BASE = '01e5d97afd7bd1fec4fd4e34ef07953101faef6e'; BASE_TREE = 'e042ca380e7fff5e52a96d2c7354e62f60fedc9a'
R18RUN = 'c3b40dc35b5f8f7d5542134c3c21e66c8ad9cb66'; R17 = '636f01ea074cb969d2f1ef1cff9dd081f24185f9'
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
             'trial-3-skin-stealer': ('020b5b533a3ab1e8edaaa7dd6a02bf29070421fc', '26234cdcd68b59727c68bbd21662b980d8d28bbe'),
             'trial-3-behavior-refinement': ('4518f93dff82e5ee8bfc8abb67dc0ecb4f77959a', '28815b06019ed38aff8c083e93b1ba7056da3d67'),
             'trial-3-predator-refinement': ('f378049a825e53eafc626a637b8c43397e4072f0', 'a6d72690727a58dbab6e770dfda64a1d9dbf70f3'),
             'trial-3-cognitive-predator-refinement': ('02175734d5b9626bf02867f2e6f85a508270e91d', '9dc97e2a848f130b4a9f21921b4e8d1bfb32eed5'),
             'trial-3-r9-cognitive-ambush-overhaul': (BASE, BASE_TREE)}
SNAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'inventory', 'remote_heads_before_r19.json')
def run(*a, ok=False):
    """A command's output; a GitHub API call is tried up to three times (the proxy can drop one call), anything else once.  ok: a failing
    command returns None instead of raising"""
    for attempt in range(3 if a[0] == 'gh' else 1):
        r = subprocess.run(a, capture_output=True, text=True)
        if r.returncode == 0: return r.stdout.strip()
        if attempt < 2 and a[0] == 'gh': __import__('time').sleep(2 + 3 * attempt)
    if ok: return None
    raise subprocess.CalledProcessError(r.returncode, a, r.stdout, r.stderr)
heads_now = lambda: {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}
now = lambda: datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def descends(c, base=BASE):
    """c has base among its ancestors (fetching c first if this clone does not have it)"""
    if run('git', 'cat-file', '-e', c + '^{commit}', ok=True) is None: run('git', 'fetch', '-q', 'origin', c, ok=True)
    return run('git', 'merge-base', '--is-ancestor', base, c, ok=True) is not None


def main():
    if sys.argv[1] == '--snapshot':
        h = heads_now(); s = {'takenAt': now(), 'repo': REPO, 'count': len(h), 'heads': dict(sorted(h.items()))}
        with open(sys.argv[2], 'w') as f: f.write(json.dumps(s, indent=1) + '\n')
        print(json.dumps(s, indent=1)); return 0
    label = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    BRANCH = sys.argv[sys.argv.index('--branch') + 1]
    if BRANCH not in R19: print(f'not an R19 branch: {BRANCH}'); return 2
    before = json.load(open(SNAP))['heads']
    head, tree = run('git', 'rev-parse', 'HEAD'), run('git', 'rev-parse', 'HEAD^{tree}')
    parents = run('git', 'log', '-1', '--format=%P', 'HEAD').split()
    heads = heads_now()
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{head}'))
    br = json.loads(run('gh', 'api', f'repos/{REPO}/branches/{BRANCH}'))
    prot = {}
    for b, (c, t) in PROTECTED.items():
        j = json.loads(run('gh', 'api', f'repos/{REPO}/branches/{b}'))
        prot[b] = {'expected': c, 'api': j['commit']['sha'], 'apiTree': j['commit']['commit']['tree']['sha'], 'lsRemote': heads.get(b)}
        prot[b]['ok'] = prot[b]['api'] == c == prot[b]['lsRemote'] and (t is None or prot[b]['apiTree'] == t)
    r18 = {'receipt': BASE, 'runtime': run('git', 'rev-parse', BASE + '^'), 'r17': run('git', 'rev-parse', BASE + '^^')}
    chain = run('git', 'rev-list', '--reverse', f'{BASE}..HEAD').split()
    merges = run('git', 'rev-list', '--merges', f'{BASE}..HEAD').split()
    first = run('git', 'rev-list', '--first-parent', '--reverse', f'{BASE}..HEAD').split()
    first_parent = run('git', 'rev-parse', first[0] + '^') if first else None
    if BRANCH == R19[2]:
        # the combination: every commit descends from the receipt; each merge's parents are themselves commits since the receipt
        line_ok = bool(chain) and all(descends(c) for c in chain) and all(all(p in chain for p in run('git', 'log', '-1', '--format=%P', m).split()) for m in merges)
    else:
        line_ok = bool(chain) and not merges and first_parent == BASE
    # every file this checkpoint changed (against its first parent): the same blob on GitHub (the pushed commit's tree) as here
    changed = [l.split('\t') for l in run('git', 'diff', '--name-status', '--no-renames', parents[0], head).splitlines()]
    rtree = {t['path']: t['sha'] for t in json.loads(run('gh', 'api', f'repos/{REPO}/git/trees/{tree}?recursive=1'))['tree'] if t['type'] == 'blob'}
    blobs = []
    for st, pth in changed:
        loc = run('git', 'rev-parse', f'{head}:{pth}') if st != 'D' else None
        blobs.append({'path': pth, 'status': st, 'local': loc, 'remote': rtree.get(pth), 'ok': loc == rtree.get(pth)})
    untouched = {b: {'expected': c, 'remote': heads.get(b), 'ok': heads.get(b) == c} for b, c in sorted(before.items()) if b not in R19}
    new = sorted(set(heads) - set(before))
    others = {b: {'remote': heads[b], 'descendsFromR18': descends(heads[b])} for b in new if b in R19 and b != BRANCH}
    r = {'checkpoint': label, 'verifiedAt': now(), 'branch': BRANCH, 'local': {'commit': head, 'tree': tree, 'parents': parents}, 'lsRemote': heads.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']], 'message': api['message'].split('\n')[0],
                       'branchHead': br['commit']['sha'], 'branchTree': br['commit']['commit']['tree']['sha']},
         'sinceBase': [{'commit': c, 'tree': run('git', 'rev-parse', c + '^{tree}'), 'parents': run('git', 'log', '-1', '--format=%P', c).split(), 'subject': run('git', 'log', '-1', '--format=%s', c)} for c in chain],
         'merges': merges, 'base': {'commit': BASE, 'tree': run('git', 'rev-parse', BASE + '^{tree}'), 'firstCommitsParent': first_parent, 'r18': r18},
         'changedFiles': blobs, 'protected': prot, 'otherBranchesUntouched': untouched, 'newBranches': new, 'otherR19Branches': others}
    checks = {
        'remote tip is local HEAD': heads.get(BRANCH) == head == api['sha'] == br['commit']['sha'],
        'tree and parents agree': api['tree']['sha'] == tree == br['commit']['commit']['tree']['sha'] and [p['sha'] for p in api['parents']] == parents,
        'descends from the R18 receipt 01e5d97' + (' (merges only of R19 commits)' if BRANCH == R19[2] else ' in one straight line'): line_ok and r['base']['tree'] == BASE_TREE and r18['runtime'] == R18RUN and r18['r17'] == R17,
        'every changed file has the same blob on GitHub': bool(blobs) and all(b['ok'] for b in blobs),
        'protected branches unchanged (R18 at its receipt)': all(v['ok'] for v in prot.values()),
        'every other branch unchanged': all(v['ok'] for v in untouched.values()),
        'no new branch but R19\'s own, each from R18': all(b in R19 for b in new) and all(v['descendsFromR18'] for v in others.values()),
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
