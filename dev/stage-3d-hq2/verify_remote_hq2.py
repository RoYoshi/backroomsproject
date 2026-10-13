#!/usr/bin/env python3
"""Stage 3D HQ2 - verify a pushed HQ2 checkpoint on GitHub (development only; adapted from dev/stage-3d-hq1/verify_remote_hq1.py).

  python3 -I dev/stage-3d-hq2/verify_remote_hq2.py LABEL [--out FILE.json]      (in the repository, on stage-3d-hq2)

Checks, all independently:
  - the remote stage-3d-hq2 tip from `git ls-remote` and the GitHub REST commit and branch (sha, tree, parents) equal the local HEAD / tree / parent;
  - the commits since the accepted HQ1 parent are one straight line (no merges) whose first commit's parent is exactly ebb3bd6 (tree d0aaf5c),
    and HQ1 ebb3bd6, D7 ffe2b53, Stage 3H0 06949a8, QA2 edd2af9 and Stage 3B 6e6fa46 are ancestors;
  - every other remote branch is exactly where it was before HQ2 began (evidence/h2-0/remote_heads_before_hq2.json): main, stage-3d-hq1,
    stage-3d, stage-3h0, the Stage 3C branches and all older branches untouched; any new remote branch is listed.
Exit status 0 only when everything holds."""
import json, subprocess, sys, datetime, os
REPO = 'RoYoshi/backroomsproject'; BRANCH = 'stage-3d-hq2'
PARENT = 'ebb3bd603e8a2bb4ef00cc40aa6b415bccab9763'; PARENT_TREE = 'd0aaf5c47fcdeec1a449392093cf45cb4f6b8d16'
ANCESTORS = {'stage3d_d7': 'ffe2b53c2e5c6aa76a8db8bd222fd1910c1b0e57', 'stage3h0': '06949a8a4204a1ce8144b87b2192251b259b21ec',
             'qa2': 'edd2af954627caf7721c7614df5ff1c7f20d3f3b', 'qa1': '5f30e28532200bca52b57a112c6691498a263e92',
             'stage3b': '6e6fa46ecab537f716942b94f873776b09049a40'}
BEFORE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'evidence', 'h2-0', 'remote_heads_before_hq2.json')))
UNTOUCHED = {b: c for b, c in BEFORE.items() if b != BRANCH}
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()
isanc = lambda a, b: subprocess.run(['git', 'merge-base', '--is-ancestor', a, b]).returncode == 0


def main():
    label = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    head, tree, parent = run('git', 'rev-parse', 'HEAD'), run('git', 'rev-parse', 'HEAD^{tree}'), run('git', 'rev-parse', 'HEAD^')
    heads = {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{head}'))
    br = json.loads(run('gh', 'api', f'repos/{REPO}/branches/{BRANCH}'))
    hq1 = json.loads(run('gh', 'api', f'repos/{REPO}/branches/stage-3d-hq1'))
    chain = run('git', 'rev-list', '--first-parent', '--reverse', f'{PARENT}..HEAD').split()
    merges = run('git', 'rev-list', '--merges', f'{PARENT}..HEAD').split()
    r = {'checkpoint': label, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'branch': BRANCH,
         'local': {'commit': head, 'tree': tree, 'parent': parent}, 'lsRemote': heads.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']],
                       'message': api['message'].split('\n')[0], 'branchHead': br['commit']['sha'], 'branchTree': br['commit']['commit']['tree']['sha']},
         'sinceParent': [{'commit': c, 'tree': run('git', 'rev-parse', c + '^{tree}'), 'subject': run('git', 'log', '-1', '--format=%s', c)} for c in chain],
         'merges': merges,
         'acceptedParent': {'commit': PARENT, 'tree': run('git', 'rev-parse', PARENT + '^{tree}'), 'remoteStage3dHq1': heads.get('stage-3d-hq1'),
                            'apiStage3dHq1': hq1['commit']['sha'], 'apiStage3dHq1Tree': hq1['commit']['commit']['tree']['sha'],
                            'ancestorOfHead': isanc(PARENT, head), 'firstStageCommitsParent': run('git', 'rev-parse', chain[0] + '^') if chain else None},
         'ancestors': {k: isanc(v, head) for k, v in ANCESTORS.items()},
         'untouched': {b: {'expected': c, 'remote': heads.get(b), 'ok': heads.get(b) == c} for b, c in sorted(UNTOUCHED.items())},
         'newRemoteBranches': sorted(b for b in heads if b not in UNTOUCHED and b != BRANCH), 'remoteHeads': heads}
    r['ok'] = (r['lsRemote'] == head and api['sha'] == head and api['tree']['sha'] == tree and r['githubApi']['parents'] == [parent]
               and br['commit']['sha'] == head and br['commit']['commit']['tree']['sha'] == tree
               and bool(chain) and r['acceptedParent']['firstStageCommitsParent'] == PARENT and not merges and r['acceptedParent']['tree'] == PARENT_TREE
               and r['acceptedParent']['remoteStage3dHq1'] == PARENT and r['acceptedParent']['apiStage3dHq1'] == PARENT
               and r['acceptedParent']['apiStage3dHq1Tree'] == PARENT_TREE
               and r['acceptedParent']['ancestorOfHead'] and all(r['ancestors'].values()) and all(v['ok'] for v in r['untouched'].values()))
    s = json.dumps(r, indent=1); print(s)
    if out:
        with open(out, 'w') as f: f.write(s + '\n')
    return 0 if r['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
