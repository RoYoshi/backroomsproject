#!/usr/bin/env python3
"""Stage 3H engine modernization - verify a pushed checkpoint on GitHub (development only; modelled on dev/stage-3h/tools/verify_remote_h1.py,
which is left as it is).

  python3 -I -B dev/stage-3h-modernization/tools/verify_remote_m.py LABEL [--out FILE.json]       (in the repository, on the branch)
  python3 -I -B dev/stage-3h-modernization/tools/verify_remote_m.py --snapshot FILE.json             (before the first push: every remote head)

Checks, after a push:
  - the remote stage-3h-engine-modernization tip (git ls-remote, and the GitHub REST commit and branch) equals the local HEAD, its tree
    and its parent;
  - the commits since the frozen Stage 3H2 parent 22751bb (tree d44c4ba) are one straight line without merges, whose first commit's
    parent is exactly 22751bb, and B++ 143b63f is an ancestor;
  - GitHub's stage-3h is still 22751bb (tree d44c4ba), stage-3e-0-bplusplus still 143b63f (tree b25c26e), and main, stage-3h0 and every
    other remote branch is exactly where the snapshot (inventory/remote_heads_before.json) found it; no other branch is new.
It reads; it changes nothing.  Exit status 0 only when everything holds."""
import json, subprocess, sys, datetime, os
REPO = 'RoYoshi/backroomsproject'; BRANCH = 'stage-3h-engine-modernization'
PARENT = '22751bbc39c91f3e54e3305638b2ef2c9dd12c68'; PARENT_TREE = 'd44c4bafa3c1a78e2d910187ecbe1cc2ec18f3c9'
BPP = '143b63ff42b88c6780c5043e0f61d64100f81f40'; BPP_TREE = 'b25c26ec3eedab406a6b93f80a59ba6a1cb7c128'
SNAP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'inventory', 'remote_heads_before.json')
KEY = ['stage-3h', 'stage-3e-0-bplusplus', 'main', 'stage-3h0']
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()
isanc = lambda a, b: subprocess.run(['git', 'merge-base', '--is-ancestor', a, b]).returncode == 0
heads_now = lambda: {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}


def main():
    if sys.argv[1] == '--snapshot':
        h = heads_now(); s = {'takenAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'repo': REPO, 'count': len(h), 'heads': dict(sorted(h.items()))}
        with open(sys.argv[2], 'w') as f: f.write(json.dumps(s, indent=1) + '\n')
        print(json.dumps(s, indent=1)); return 0
    label = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    before = json.load(open(SNAP))['heads']
    head, tree, parent = run('git', 'rev-parse', 'HEAD'), run('git', 'rev-parse', 'HEAD^{tree}'), run('git', 'rev-parse', 'HEAD^')
    heads = heads_now()
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{head}'))
    br = json.loads(run('gh', 'api', f'repos/{REPO}/branches/{BRANCH}'))
    key = {b: json.loads(run('gh', 'api', f'repos/{REPO}/branches/{b}')) for b in KEY}
    chain = run('git', 'rev-list', '--first-parent', '--reverse', f'{PARENT}..HEAD').split()
    merges = run('git', 'rev-list', '--merges', f'{PARENT}..HEAD').split()
    first_parent = run('git', 'rev-parse', chain[0] + '^') if chain else None
    untouched = {b: {'expected': c, 'remote': heads.get(b), 'ok': heads.get(b) == c} for b, c in sorted(before.items()) if b != BRANCH}
    keyApi = {b: {'expected': before.get(b), 'api': key[b]['commit']['sha'], 'apiTree': key[b]['commit']['commit']['tree']['sha'], 'ok': key[b]['commit']['sha'] == before.get(b)} for b in KEY}
    r = {'checkpoint': label, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'branch': BRANCH,
         'local': {'commit': head, 'tree': tree, 'parent': parent}, 'lsRemote': heads.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']],
                       'message': api['message'].split('\n')[0], 'branchHead': br['commit']['sha'], 'branchTree': br['commit']['commit']['tree']['sha']},
         'sinceFrozen3H2': [{'commit': c, 'tree': run('git', 'rev-parse', c + '^{tree}'), 'subject': run('git', 'log', '-1', '--format=%s', c)} for c in chain],
         'merges': merges,
         'frozen3H2': {'commit': PARENT, 'tree': run('git', 'rev-parse', PARENT + '^{tree}'), 'firstCommitsParent': first_parent, 'ancestorOfHead': isanc(PARENT, head)},
         'acceptedBpp': {'commit': BPP, 'ancestorOfHead': isanc(BPP, head)},
         'keyBranchesApi': keyApi, 'untouched': untouched, 'newRemoteBranches': sorted(b for b in heads if b not in before and b != BRANCH)}
    f3 = r['frozen3H2']
    r['ok'] = bool(head == heads.get(BRANCH) == api['sha'] == br['commit']['sha'] and tree == api['tree']['sha'] == br['commit']['commit']['tree']['sha']
                   and [parent] == r['githubApi']['parents'] and f3['tree'] == PARENT_TREE and first_parent == PARENT and not merges and f3['ancestorOfHead']
                   and r['acceptedBpp']['ancestorOfHead'] and keyApi['stage-3h']['api'] == PARENT and keyApi['stage-3h']['apiTree'] == PARENT_TREE
                   and keyApi['stage-3e-0-bplusplus']['api'] == BPP and keyApi['stage-3e-0-bplusplus']['apiTree'] == BPP_TREE
                   and all(v['ok'] for v in keyApi.values()) and all(v['ok'] for v in untouched.values()) and not r['newRemoteBranches'])
    s = json.dumps(r, indent=1)
    if out:
        with open(out, 'w') as f: f.write(s + '\n')
    print(s)
    return 0 if r['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
