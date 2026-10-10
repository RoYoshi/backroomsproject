#!/usr/bin/env python3
"""Stage 3C QA2 - verify a pushed checkpoint on GitHub (development only; adapted from dev/stage-3c-qa1/verify_remote_qa1.py).

  python3 dev/stage-3c-qa2/verify_remote_qa2.py LABEL [--out FILE.json]   (in the repository, on stage-3c-qa2)

Checks: the remote stage-3c-qa2 tip (git ls-remote) and the GitHub REST commit / tree / parents equal the local HEAD; the commits
since the QA1 parent are a straight line from it (no merges) and the first one's parent is exactly 5f30e28 (tree 374911e); the first
Stage 3C candidate 76bcc4a and the accepted Stage 3B commit 6e6fa46 are ancestors; stage-3c-qa1, stage-3c, main and every other
remote branch that existed before QA2 are untouched (their tips as recorded at QA2-0 in evidence/q0/remote_heads_before_qa2.json)."""
import json, subprocess, sys, datetime, os
REPO = 'RoYoshi/backroomsproject'; BRANCH = 'stage-3c-qa2'
PARENT = '5f30e28532200bca52b57a112c6691498a263e92'; PARENT_TREE = '374911e01e2a66706a3938fcd2f7495ee4133a49'
FIRST3C = '76bcc4acaa14814f84c2b9ae66acc5ffdfe2cace'; STAGE3B = '6e6fa46ecab537f716942b94f873776b09049a40'
BEFORE = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'evidence', 'q0', 'remote_heads_before_qa2.json')))
UNTOUCHED = {b: c for b, c in BEFORE.items() if b != BRANCH}
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
         'sinceQa1': [{'commit': c, 'tree': run('git', 'rev-parse', c + '^{tree}'), 'subject': run('git', 'log', '-1', '--format=%s', c)} for c in chain], 'merges': merges,
         'qa1Parent': {'commit': PARENT, 'tree': run('git', 'rev-parse', PARENT + '^{tree}'), 'remoteStage3cQa1': heads.get('stage-3c-qa1'), 'ancestorOfHead': isanc(PARENT, head),
                       'firstQa2CommitsParent': run('git', 'rev-parse', chain[0] + '^') if chain else None},
         'first3cAncestor': isanc(FIRST3C, head), 'stage3bAncestor': isanc(STAGE3B, head),
         'untouched': {b: {'expected': c, 'remote': heads.get(b), 'ok': heads.get(b) == c} for b, c in sorted(UNTOUCHED.items())},
         'otherRemoteBranches': sorted(b for b in heads if b not in UNTOUCHED and b != BRANCH), 'remoteHeads': heads}
    r['ok'] = (r['lsRemote'] == head and api['sha'] == head and api['tree']['sha'] == tree and r['githubApi']['parents'] == [parent]
               and bool(chain) and r['qa1Parent']['firstQa2CommitsParent'] == PARENT and not merges and r['qa1Parent']['tree'] == PARENT_TREE
               and r['qa1Parent']['ancestorOfHead'] and r['first3cAncestor'] and r['stage3bAncestor'] and all(v['ok'] for v in r['untouched'].values()))
    s = json.dumps(r, indent=1); print(s)
    if out: open(out, 'w').write(s + '\n')
    return 0 if r['ok'] else 1
if __name__ == '__main__': sys.exit(main())
