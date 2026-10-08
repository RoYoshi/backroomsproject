#!/usr/bin/env python3
"""Stage 3B final polish (Phase B, Stage 3B-L) - verify a pushed checkpoint on GitHub (development only).

  python3 dev/stage-3b-l/verify_remote_3bl.py LABEL [--branch stage-3b-l] [--out FILE.json]       (run in the repository)

Checks: the remote branch tip (git ls-remote) and the GitHub REST commit / tree / parents all equal the local HEAD; the
Phase A camera checkpoint (stage-3b-n-camera, b2783b3) is still the remote camera branch and an ancestor of HEAD; main,
br-role, stage-3b-remaster and the superseded broad stage-3b-n work are untouched (7781e1a / b86966b / 69602e7 / 118d45c);
the accepted Stage 3B parent 69602e7 is an ancestor of HEAD; no stage-3b-w / stage-3c branch exists."""
import json, subprocess, sys, datetime
REPO = 'RoYoshi/backroomsproject'; SUPERSEDED = '118d45c24d99d2cbc1e7b5b76cb76e041ac40d87'
MAIN = '7781e1ac34aa09970df57fae3fc107a873fa2731'; BRROLE = 'b86966b5f59070b0f4c15b000c70a95e5f3b4e00'; PARENT = '69602e7c9e755fcc65402b1563d4d060f5a10066'
CAMERA = 'b2783b34e1185b30002350f5b482dd8c5e10b000'; CAMERA_TREE = 'bdef2606b50dc485eac648a70300e33bf7a32723'
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()
def main():
    label = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    BRANCH = sys.argv[sys.argv.index('--branch') + 1] if '--branch' in sys.argv else 'stage-3b-l'
    head, tree, parent = run('git', 'rev-parse', 'HEAD'), run('git', 'rev-parse', 'HEAD^{tree}'), run('git', 'rev-parse', 'HEAD^')
    heads = {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{head}'))
    anc = subprocess.run(['git', 'merge-base', '--is-ancestor', PARENT, head]).returncode == 0
    cam_anc = subprocess.run(['git', 'merge-base', '--is-ancestor', CAMERA, head]).returncode == 0
    cam_tree = run('git', 'rev-parse', CAMERA + '^{tree}')
    later = [b for b in heads if b.lower().replace('_', '-') in ('stage-3b-w', 'stage-3c') or b.lower().startswith(('stage-3b-w', 'stage-3c'))]
    r = {'checkpoint': label, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
         'branch': BRANCH, 'local': {'commit': head, 'tree': tree, 'parent': parent}, 'lsRemote': heads.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']], 'message': api['message'].split('\n')[0]},
         'cameraCheckpoint': {'branch': 'stage-3b-n-camera', 'remote': heads.get('stage-3b-n-camera'), 'commit': CAMERA, 'tree': cam_tree, 'ancestorOfHead': cam_anc},
         'mainUntouched': heads.get('main'), 'brRoleUntouched': heads.get('br-role'), 'stage3bRemasterUntouched': heads.get('stage-3b-remaster'), 'supersededStage3bNUntouched': heads.get('stage-3b-n'),
         'acceptedStage3bParentIsAncestor': anc, 'stage3bWor3cBranches': later}
    r['ok'] = (r['lsRemote'] == head and api['sha'] == head and api['tree']['sha'] == tree and r['githubApi']['parents'] == [parent]
               and heads.get('stage-3b-n-camera') == CAMERA and cam_tree == CAMERA_TREE and cam_anc
               and heads.get('main') == MAIN and heads.get('br-role') == BRROLE and heads.get('stage-3b-remaster') == PARENT and heads.get('stage-3b-n') == SUPERSEDED and anc and not later)
    s = json.dumps(r, indent=1); print(s)
    if out: open(out, 'w').write(s + '\n')
    return 0 if r['ok'] else 1
if __name__ == '__main__': sys.exit(main())
