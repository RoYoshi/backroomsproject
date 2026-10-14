#!/usr/bin/env python3
"""Stage 3E-0 - verify a pushed B+ checkpoint on GitHub (development only; a copy of dev/stage-3d-hq5/verify_remote_hq5.py with 3E-0's parent).

  python3 -I dev/stage-3e-0/verify_remote_e0.py LABEL [--out FILE.json]      (in the repository, on stage-3e-0)

Checks: the remote stage-3e-0 tip (git ls-remote and the GitHub REST commit and branch) equals the local HEAD, tree and parent; the
commits since the accepted HQ5 parent ad98475 (tree 9f721d3) are one straight line whose first commit's parent is exactly ad98475, and
HQ4 79e1461, HQ3 QA1 4934319, HQ2 f542b7c and HQ1 ebb3bd6 are ancestors; GitHub's stage-3d-hq5 is still ad98475; every other remote branch
is exactly where it was before 3E-0 (evidence/e0-0/remote_heads_before_e0.json); no stage-3e-0-bplusplus.  Exit status 0 only when everything holds."""
import json, subprocess, sys, datetime, os
REPO = 'RoYoshi/backroomsproject'; BRANCH = 'stage-3e-0'
PARENT = 'ad98475767bcae6794cd01af832de660355da7a2'; PARENT_TREE = '9f721d371693656110f58c8e8fb6b6382ded6fa8'; HQ4 = '79e146124a5941c6578ef84dc9ff13176cc7f1f0'
HQ3 = '49343193e6948c8323f35a34539ac84db5a89835'; HQ2 = 'f542b7cbd90f95148e644e6cba513cf55ddd52c9'; HQ1 = 'ebb3bd603e8a2bb4ef00cc40aa6b415bccab9763'
BEFORE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'evidence', 'e0-0', 'remote_heads_before_e0.json')))
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()
isanc = lambda a, b: subprocess.run(['git', 'merge-base', '--is-ancestor', a, b]).returncode == 0


def main():
    label = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    head, tree, parent = run('git', 'rev-parse', 'HEAD'), run('git', 'rev-parse', 'HEAD^{tree}'), run('git', 'rev-parse', 'HEAD^')
    heads = {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{head}'))
    br = json.loads(run('gh', 'api', f'repos/{REPO}/branches/{BRANCH}'))
    hq5 = json.loads(run('gh', 'api', f'repos/{REPO}/branches/stage-3d-hq5'))
    chain = run('git', 'rev-list', '--first-parent', '--reverse', f'{PARENT}..HEAD').split()
    merges = run('git', 'rev-list', '--merges', f'{PARENT}..HEAD').split()
    first_parent = run('git', 'rev-parse', chain[0] + '^') if chain else None
    untouched = {b: {'expected': c, 'remote': heads.get(b), 'ok': heads.get(b) == c} for b, c in sorted(BEFORE.items()) if b != BRANCH}
    r = {'checkpoint': label, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'branch': BRANCH,
         'local': {'commit': head, 'tree': tree, 'parent': parent}, 'lsRemote': heads.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']],
                       'message': api['message'].split('\n')[0], 'branchHead': br['commit']['sha'], 'branchTree': br['commit']['commit']['tree']['sha']},
         'sinceParent': [{'commit': c, 'tree': run('git', 'rev-parse', c + '^{tree}'), 'subject': run('git', 'log', '-1', '--format=%s', c)} for c in chain],
         'merges': merges, 'acceptedParent': {'commit': PARENT, 'tree': run('git', 'rev-parse', PARENT + '^{tree}'), 'apiStage3dHq5': hq5['commit']['sha'],
                                              'firstE0CommitsParent': first_parent, 'ancestorOfHead': isanc(PARENT, head), 'hq4Ancestor': isanc(HQ4, head), 'hq3Ancestor': isanc(HQ3, head),
                                              'hq2Ancestor': isanc(HQ2, head), 'hq1Ancestor': isanc(HQ1, head)},
         'untouched': untouched, 'newRemoteBranches': sorted(b for b in heads if b not in BEFORE and b != BRANCH), 'bplusplusExists': 'stage-3e-0-bplusplus' in heads}
    ap = r['acceptedParent']
    r['ok'] = bool(head == heads.get(BRANCH) == api['sha'] == br['commit']['sha'] and tree == api['tree']['sha'] == br['commit']['commit']['tree']['sha']
                   and [parent] == r['githubApi']['parents'] and ap['tree'] == PARENT_TREE and first_parent == PARENT
                   and hq5['commit']['sha'] == PARENT and not merges and ap['ancestorOfHead'] and ap['hq4Ancestor'] and ap['hq3Ancestor'] and ap['hq2Ancestor'] and ap['hq1Ancestor']
                   and all(v['ok'] for v in untouched.values()) and not r['newRemoteBranches'] and not r['bplusplusExists'])
    s = json.dumps(r, indent=1)
    if out:
        with open(out, 'w') as f: f.write(s + '\n')
    print(s)
    return 0 if r['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
