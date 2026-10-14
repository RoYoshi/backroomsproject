#!/usr/bin/env python3
"""Stage 3E-0 B++ - verify a pushed B++ checkpoint on GitHub (development only; dev/stage-3e-0/verify_remote_e0.py with B++'s parent).

  python3 -I dev/stage-3e-0-bpp/verify_remote_bpp.py LABEL [--out FILE.json]      (in the repository, on stage-3e-0-bplusplus)

Checks:
  - the remote stage-3e-0-bplusplus tip (git ls-remote, the GitHub REST commit and branch) equals the local HEAD, tree and parent;
  - the commits since the accepted B+ delivery head 1f2deba (tree 11686a0) are one straight line, without merges, whose first commit's
    parent is exactly 1f2deba;
  - the B+ source 004b43f and HQ5 ad98475 are ancestors;
  - GitHub's stage-3e-0 is still 1f2deba, and stage-3d-hq5 is still ad98475;
  - every other remote branch is exactly where it was before B++ (evidence/p0/remote_heads_before_bpp.json), and no other new branch.
Exit status 0 only when everything holds."""
import json, subprocess, sys, datetime, os
REPO = 'RoYoshi/backroomsproject'; BRANCH = 'stage-3e-0-bplusplus'
PARENT = '1f2deba0fc4a1facd41366fb2da9b88af3bd5a52'; PARENT_TREE = '11686a0ab061a5a463bbfbd3bc7c8c42e26febd2'
BPLUS_SRC = '004b43f751856ff567b87c7e6d3f0bed8939a618'; HQ5 = 'ad98475767bcae6794cd01af832de660355da7a2'
BEFORE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'evidence', 'p0', 'remote_heads_before_bpp.json')))['heads']
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()
isanc = lambda a, b: subprocess.run(['git', 'merge-base', '--is-ancestor', a, b]).returncode == 0


def main():
    label = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    head, tree, parent = run('git', 'rev-parse', 'HEAD'), run('git', 'rev-parse', 'HEAD^{tree}'), run('git', 'rev-parse', 'HEAD^')
    heads = {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{head}'))
    br = json.loads(run('gh', 'api', f'repos/{REPO}/branches/{BRANCH}'))
    bplus = json.loads(run('gh', 'api', f'repos/{REPO}/branches/stage-3e-0'))
    hq5 = json.loads(run('gh', 'api', f'repos/{REPO}/branches/stage-3d-hq5'))
    chain = run('git', 'rev-list', '--first-parent', '--reverse', f'{PARENT}..HEAD').split()
    merges = run('git', 'rev-list', '--merges', f'{PARENT}..HEAD').split()
    first_parent = run('git', 'rev-parse', chain[0] + '^') if chain else None
    untouched = {b: {'expected': c, 'remote': heads.get(b), 'ok': heads.get(b) == c} for b, c in sorted(BEFORE.items()) if b != BRANCH}
    r = {'checkpoint': label, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'branch': BRANCH,
         'local': {'commit': head, 'tree': tree, 'parent': parent}, 'lsRemote': heads.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']],
                       'message': api['message'].split('\n')[0], 'branchHead': br['commit']['sha'], 'branchTree': br['commit']['commit']['tree']['sha']},
         'sinceAcceptedBplus': [{'commit': c, 'tree': run('git', 'rev-parse', c + '^{tree}'), 'subject': run('git', 'log', '-1', '--format=%s', c)} for c in chain],
         'merges': merges,
         'acceptedBplus': {'commit': PARENT, 'tree': run('git', 'rev-parse', PARENT + '^{tree}'), 'apiStage3e0': bplus['commit']['sha'], 'apiStage3e0Tree': bplus['commit']['commit']['tree']['sha'],
                           'firstBppCommitsParent': first_parent, 'ancestorOfHead': isanc(PARENT, head), 'bplusSourceAncestor': isanc(BPLUS_SRC, head),
                           'hq5Ancestor': isanc(HQ5, head), 'apiStage3dHq5': hq5['commit']['sha']},
         'untouched': untouched, 'newRemoteBranches': sorted(b for b in heads if b not in BEFORE and b != BRANCH)}
    ap = r['acceptedBplus']
    r['ok'] = bool(head == heads.get(BRANCH) == api['sha'] == br['commit']['sha'] and tree == api['tree']['sha'] == br['commit']['commit']['tree']['sha']
                   and [parent] == r['githubApi']['parents'] and ap['tree'] == PARENT_TREE and first_parent == PARENT and not merges
                   and ap['apiStage3e0'] == PARENT and ap['apiStage3e0Tree'] == PARENT_TREE and ap['ancestorOfHead'] and ap['bplusSourceAncestor'] and ap['hq5Ancestor']
                   and ap['apiStage3dHq5'] == HQ5 and all(v['ok'] for v in untouched.values()) and not r['newRemoteBranches'])
    s = json.dumps(r, indent=1)
    if out:
        with open(out, 'w') as f: f.write(s + '\n')
    print(s)
    return 0 if r['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
