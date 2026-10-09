#!/usr/bin/env python3
"""Stage 3C - verify a pushed checkpoint on GitHub (development only).

  python3 dev/stage-3c/verify_remote_c3.py LABEL [--out FILE.json]   (in the repository, on stage-3c)

Checks: the remote stage-3c tip (git ls-remote) and the GitHub REST commit / tree / parents equal the local HEAD; the commits
since the accepted Stage 3B parent are a straight line from it (no merges) and the first one's parent is exactly 6e6fa46; the
parent is still the remote stage-3b-l-qa2 tip with tree 33ed11b; the accepted camera checkpoint b2783b3 is an ancestor;
main and every other remote branch that existed before Stage 3C are untouched (their tips as recorded at C0 in
evidence/c0/remote_heads_before_stage3c.json)."""
import json, subprocess, sys, datetime, os
REPO = 'RoYoshi/backroomsproject'; BRANCH = 'stage-3c'
PARENT = '6e6fa46ecab537f716942b94f873776b09049a40'; PARENT_TREE = '33ed11b672d3a2a45767accccbb9f04fdd7949c3'
CAMERA = 'b2783b34e1185b30002350f5b482dd8c5e10b000'
UNTOUCHED = {'main': '7781e1ac34aa09970df57fae3fc107a873fa2731', 'stage-3b-l-qa2': PARENT, 'stage-3b-l-qa1': 'd3ec2269af873dbc381d223ad538a43ba06f5c45',
             'stage-3b-n-camera': CAMERA, 'br-role': 'b86966b5f59070b0f4c15b000c70a95e5f3b4e00', 'stage-3b-l': 'b9f3a9b934f40e35d51596f593eae810d077f194',
             'stage-3b-remaster': '69602e7c9e755fcc65402b1563d4d060f5a10066', 'stage-3b-n': '118d45c24d99d2cbc1e7b5b76cb76e041ac40d87',
             'stage-3b-pillar-los': 'ecec8026c85c4cd0bc140ac574d1ce7dec8005f8'}
BEFORE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'evidence', 'c0', 'remote_heads_before_stage3c.json')))   # every remote branch tip as found at C0
UNTOUCHED.update({b: c for b, c in BEFORE.items() if b != BRANCH})
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()
isanc = lambda a, b: subprocess.run(['git', 'merge-base', '--is-ancestor', a, b]).returncode == 0
def main():
    label = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    head, tree, parent = run('git', 'rev-parse', 'HEAD'), run('git', 'rev-parse', 'HEAD^{tree}'), run('git', 'rev-parse', 'HEAD^')
    heads = {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{head}'))
    chain = run('git', 'rev-list', '--first-parent', '--reverse', f'{PARENT}..HEAD').split()
    merges = run('git', 'rev-list', '--merges', f'{PARENT}..HEAD').split()
    r = {'checkpoint': label, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'branch': BRANCH,
         'local': {'commit': head, 'tree': tree, 'parent': parent}, 'lsRemote': heads.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']], 'message': api['message'].split('\n')[0]},
         'sinceStage3bParent': [{'commit': c, 'tree': run('git', 'rev-parse', c + '^{tree}'), 'subject': run('git', 'log', '-1', '--format=%s', c)} for c in chain], 'merges': merges,
         'stage3bParent': {'commit': PARENT, 'tree': run('git', 'rev-parse', PARENT + '^{tree}'), 'remoteStage3bLQa2': heads.get('stage-3b-l-qa2'), 'ancestorOfHead': isanc(PARENT, head),
                           'firstStage3cCommitsParent': run('git', 'rev-parse', chain[0] + '^') if chain else None},
         'cameraCheckpointAncestor': isanc(CAMERA, head),
         'untouched': {b: {'expected': c, 'remote': heads.get(b), 'ok': heads.get(b) == c} for b, c in UNTOUCHED.items()},
         'otherRemoteBranches': sorted(b for b in heads if b not in UNTOUCHED and b != BRANCH), 'remoteHeads': heads}
    r['ok'] = (r['lsRemote'] == head and api['sha'] == head and api['tree']['sha'] == tree and r['githubApi']['parents'] == [parent]
               and chain and r['stage3bParent']['firstStage3cCommitsParent'] == PARENT and not merges and r['stage3bParent']['tree'] == PARENT_TREE
               and r['stage3bParent']['ancestorOfHead'] and r['cameraCheckpointAncestor'] and all(v['ok'] for v in r['untouched'].values()))
    s = json.dumps(r, indent=1); print(s)
    if out: open(out, 'w').write(s + '\n')
    return 0 if r['ok'] else 1
if __name__ == '__main__': sys.exit(main())
