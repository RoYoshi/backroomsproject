#!/usr/bin/env python3
"""Stage 3B pillar LOS correction - verify a pushed checkpoint on GitHub (development only).

  python3 dev/stage-3b-pillar-los/verify_remote_plos.py LABEL [--branch stage-3b-pillar-los] [--out FILE.json]   (in the repository)

Checks: the remote branch tip (git ls-remote) and the GitHub REST commit / tree / parents all equal the local HEAD; the QA1
parent (stage-3b-l-qa1, d3ec226, tree cffbc31) is still the remote stage-3b-l-qa1 and an ancestor of HEAD; the accepted
camera checkpoint (stage-3b-n-camera, b2783b3, tree bdef260) is unchanged and an ancestor of HEAD; main, br-role, stage-3b-l,
stage-3b-remaster and the superseded broad stage-3b-n work are untouched (7781e1a / b86966b / b9f3a9b / 69602e7 / 118d45c);
no stage-3b-w / stage-3c branch exists."""
import json, subprocess, sys, datetime
REPO = 'RoYoshi/backroomsproject'
PARENT = 'd3ec2269af873dbc381d223ad538a43ba06f5c45'; PARENT_TREE = 'cffbc3125619170d9a55344b2519042a720a798d'
CAMERA = 'b2783b34e1185b30002350f5b482dd8c5e10b000'; CAMERA_TREE = 'bdef2606b50dc485eac648a70300e33bf7a32723'
MAIN = '7781e1ac34aa09970df57fae3fc107a873fa2731'; BRROLE = 'b86966b5f59070b0f4c15b000c70a95e5f3b4e00'; STAGE3BL = 'b9f3a9b934f40e35d51596f593eae810d077f194'
REMASTER = '69602e7c9e755fcc65402b1563d4d060f5a10066'; SUPERSEDED = '118d45c24d99d2cbc1e7b5b76cb76e041ac40d87'
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()
isanc = lambda a, b: subprocess.run(['git', 'merge-base', '--is-ancestor', a, b]).returncode == 0
def main():
    label = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    BRANCH = sys.argv[sys.argv.index('--branch') + 1] if '--branch' in sys.argv else 'stage-3b-pillar-los'
    head, tree, parent = run('git', 'rev-parse', 'HEAD'), run('git', 'rev-parse', 'HEAD^{tree}'), run('git', 'rev-parse', 'HEAD^')
    heads = {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{head}'))
    later = [b for b in heads if b.lower().replace('_', '-').startswith(('stage-3b-w', 'stage-3c'))]
    r = {'checkpoint': label, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
         'branch': BRANCH, 'local': {'commit': head, 'tree': tree, 'parent': parent}, 'lsRemote': heads.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']], 'message': api['message'].split('\n')[0]},
         'qa1Parent': {'branch': 'stage-3b-l-qa1', 'remote': heads.get('stage-3b-l-qa1'), 'commit': PARENT, 'tree': run('git', 'rev-parse', PARENT + '^{tree}'), 'ancestorOfHead': isanc(PARENT, head)},
         'cameraCheckpoint': {'branch': 'stage-3b-n-camera', 'remote': heads.get('stage-3b-n-camera'), 'commit': CAMERA, 'tree': run('git', 'rev-parse', CAMERA + '^{tree}'), 'ancestorOfHead': isanc(CAMERA, head)},
         'mainUntouched': heads.get('main'), 'brRoleUntouched': heads.get('br-role'), 'stage3bLUntouched': heads.get('stage-3b-l'),
         'stage3bRemasterUntouched': heads.get('stage-3b-remaster'), 'supersededStage3bNUntouched': heads.get('stage-3b-n'), 'stage3bWor3cBranches': later}
    r['ok'] = (r['lsRemote'] == head and api['sha'] == head and api['tree']['sha'] == tree and r['githubApi']['parents'] == [parent]
               and heads.get('stage-3b-l-qa1') == PARENT and r['qa1Parent']['tree'] == PARENT_TREE and r['qa1Parent']['ancestorOfHead']
               and heads.get('stage-3b-n-camera') == CAMERA and r['cameraCheckpoint']['tree'] == CAMERA_TREE and r['cameraCheckpoint']['ancestorOfHead']
               and heads.get('main') == MAIN and heads.get('br-role') == BRROLE and heads.get('stage-3b-l') == STAGE3BL
               and heads.get('stage-3b-remaster') == REMASTER and heads.get('stage-3b-n') == SUPERSEDED and not later)
    s = json.dumps(r, indent=1); print(s)
    if out: open(out, 'w').write(s + '\n')
    return 0 if r['ok'] else 1
if __name__ == '__main__': sys.exit(main())
