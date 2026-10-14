#!/usr/bin/env python3
"""Stage 3H1 - verify a pushed 3H1 commit on GitHub (development only; modelled on dev/stage-3e-0-bpp/verify_remote_bpp.py).

  python3 -I dev/stage-3h/tools/verify_remote_h1.py LABEL [--out FILE.json]      (in the repository, on stage-3h)

Checks:
  - the remote stage-3h tip (git ls-remote, and the GitHub REST commit and branch) equals the local HEAD, its tree and its parent;
  - the commits since the accepted B++ head 143b63f (tree b25c26e) are one straight line without merges, whose first commit's parent is
    exactly 143b63f;
  - GitHub's stage-3e-0-bplusplus is still 143b63f with tree b25c26e, and main, stage-3e-0, stage-3d-hq5 and stage-3h0 are where they were;
  - every other remote branch is exactly where it was before 3H1 (evidence/h1/remote_heads_before_3h1.json), and there is no other new
    branch.
It reads; it changes nothing.  Exit status 0 only when everything holds."""
import json, subprocess, sys, datetime, os
REPO = 'RoYoshi/backroomsproject'; BRANCH = 'stage-3h'
PARENT = '143b63ff42b88c6780c5043e0f61d64100f81f40'; PARENT_TREE = 'b25c26ec3eedab406a6b93f80a59ba6a1cb7c128'
BEFORE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'evidence', 'h1', 'remote_heads_before_3h1.json')))['heads']
KEY = ['main', 'stage-3e-0-bplusplus', 'stage-3e-0', 'stage-3d-hq5', 'stage-3h0']
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()
isanc = lambda a, b: subprocess.run(['git', 'merge-base', '--is-ancestor', a, b]).returncode == 0


def main():
    label = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    head, tree, parent = run('git', 'rev-parse', 'HEAD'), run('git', 'rev-parse', 'HEAD^{tree}'), run('git', 'rev-parse', 'HEAD^')
    heads = {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{head}'))
    br = json.loads(run('gh', 'api', f'repos/{REPO}/branches/{BRANCH}'))
    key = {b: json.loads(run('gh', 'api', f'repos/{REPO}/branches/{b}')) for b in KEY}
    chain = run('git', 'rev-list', '--first-parent', '--reverse', f'{PARENT}..HEAD').split()
    merges = run('git', 'rev-list', '--merges', f'{PARENT}..HEAD').split()
    first_parent = run('git', 'rev-parse', chain[0] + '^') if chain else None
    untouched = {b: {'expected': c, 'remote': heads.get(b), 'ok': heads.get(b) == c} for b, c in sorted(BEFORE.items()) if b != BRANCH}
    keyApi = {b: {'expected': BEFORE.get(b), 'api': key[b]['commit']['sha'], 'apiTree': key[b]['commit']['commit']['tree']['sha'], 'ok': key[b]['commit']['sha'] == BEFORE.get(b)} for b in KEY}
    r = {'checkpoint': label, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'branch': BRANCH,
         'local': {'commit': head, 'tree': tree, 'parent': parent}, 'lsRemote': heads.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']],
                       'message': api['message'].split('\n')[0], 'branchHead': br['commit']['sha'], 'branchTree': br['commit']['commit']['tree']['sha']},
         'sinceAcceptedBpp': [{'commit': c, 'tree': run('git', 'rev-parse', c + '^{tree}'), 'subject': run('git', 'log', '-1', '--format=%s', c)} for c in chain],
         'merges': merges,
         'acceptedBpp': {'commit': PARENT, 'tree': run('git', 'rev-parse', PARENT + '^{tree}'), 'firstH1CommitsParent': first_parent, 'ancestorOfHead': isanc(PARENT, head)},
         'keyBranchesApi': keyApi, 'untouched': untouched, 'newRemoteBranches': sorted(b for b in heads if b not in BEFORE and b != BRANCH)}
    ap = r['acceptedBpp']
    r['ok'] = bool(head == heads.get(BRANCH) == api['sha'] == br['commit']['sha'] and tree == api['tree']['sha'] == br['commit']['commit']['tree']['sha']
                   and [parent] == r['githubApi']['parents'] and ap['tree'] == PARENT_TREE and first_parent == PARENT and not merges and ap['ancestorOfHead']
                   and keyApi['stage-3e-0-bplusplus']['apiTree'] == PARENT_TREE and all(v['ok'] for v in keyApi.values())
                   and all(v['ok'] for v in untouched.values()) and not r['newRemoteBranches'])
    s = json.dumps(r, indent=1)
    if out:
        with open(out, 'w') as f: f.write(s + '\n')
    print(s)
    return 0 if r['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
