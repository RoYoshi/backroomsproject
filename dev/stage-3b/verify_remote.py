#!/usr/bin/env python3
"""Stage 3B - verify a pushed checkpoint on GitHub (development only).

  python3 dev/stage-3b/verify_remote.py LABEL [--out FILE.json]

Checks: the remote stage-3b-remaster tip (git ls-remote) and the GitHub REST commit / tree / parents all equal the local
HEAD; main and br-role are untouched (7781e1a / b86966b); the accepted BR-RoLE 1.0 parent b86966b is an ancestor."""
import json, subprocess, sys, datetime
REPO = 'RoYoshi/backroomsproject'; BRANCH = 'stage-3b-remaster'
MAIN = '7781e1ac34aa09970df57fae3fc107a873fa2731'; PARENT = 'b86966b5f59070b0f4c15b000c70a95e5f3b4e00'
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()
def main():
    label = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else None
    head, tree, parent = run('git', 'rev-parse', 'HEAD'), run('git', 'rev-parse', 'HEAD^{tree}'), run('git', 'rev-parse', 'HEAD^')
    ls = {l.split()[1].split('/')[-1]: l.split()[0] for l in run('git', 'ls-remote', 'origin', 'refs/heads/' + BRANCH, 'refs/heads/main', 'refs/heads/br-role').splitlines()}
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{head}'))
    anc = subprocess.run(['git', 'merge-base', '--is-ancestor', PARENT, head]).returncode == 0
    r = {'checkpoint': label, 'verifiedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
         'local': {'commit': head, 'tree': tree, 'parent': parent}, 'lsRemote': ls.get(BRANCH),
         'githubApi': {'commit': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']], 'message': api['message'].split('\n')[0]},
         'mainUntouched': ls.get('main'), 'brRoleUntouched': ls.get('br-role'), 'acceptedParentIsAncestor': anc}
    r['ok'] = (r['lsRemote'] == head and api['sha'] == head and api['tree']['sha'] == tree and r['githubApi']['parents'] == [parent]
               and ls.get('main') == MAIN and ls.get('br-role') == PARENT and anc)
    s = json.dumps(r, indent=1); print(s)
    if out: open(out, 'w').write(s + '\n')
    return 0 if r['ok'] else 1
if __name__ == '__main__': sys.exit(main())
