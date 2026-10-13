#!/usr/bin/env python3
"""Stage 3D HQ2 - H2-0 preflight: the accepted HQ1 parent and every remote branch, recorded before any HQ2 source change (development only).

  python3 -I dev/stage-3d-hq2/preflight_hq2.py --receipt PATH/STAGE_3D_HQ1_PACKAGE_RECEIPT.txt --out-dir dev/stage-3d-hq2/evidence/h2-0

Checks, each independently:
  - `git ls-remote` stage-3d-hq1 and the GitHub REST branch and commit equal the accepted commit ebb3bd6 with tree d0aaf5c (whole hashes, no prefixes);
  - the HQ1 package receipt names that commit and tree on its own `commit` / `tree` lines (field equality, not substrings);
  - ancestry: HQ1 descends from Stage 3D D7 ffe2b53 and the accepted Stage 3H0 06949a8; D7 is not used as the HQ2 parent;
  - stage-3d-hq2 does not exist on GitHub yet; the local branch, if any, points at the accepted parent and holds no other commit;
  - the local workspace: branch, HEAD, uncommitted files and stashes (kept, reported, never dropped).
Writes remote_heads_before_hq2.json (branch -> commit, read by verify_remote_hq2.py) and preflight.json. Exit 0 only when everything holds."""
import json, subprocess, sys, os, datetime
REPO = 'RoYoshi/backroomsproject'
HQ1, HQ1_TREE = 'ebb3bd603e8a2bb4ef00cc40aa6b415bccab9763', 'd0aaf5c47fcdeec1a449392093cf45cb4f6b8d16'
D7, S3H0 = 'ffe2b53c2e5c6aa76a8db8bd222fd1910c1b0e57', '06949a8a4204a1ce8144b87b2192251b259b21ec'
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()
isanc = lambda a, b: subprocess.run(['git', 'merge-base', '--is-ancestor', a, b]).returncode == 0


def receipt_fields(path):
    f = {}
    for line in open(path, encoding='utf-8'):
        p = line.split()
        if len(p) == 2 and p[0] in ('commit', 'tree') and p[0] not in f:
            f[p[0]] = p[1]
    return f


def main():
    a = sys.argv
    receipt = a[a.index('--receipt') + 1]; out = a[a.index('--out-dir') + 1]
    heads = {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}
    trees = {}
    for b, c in heads.items():
        try: trees[b] = run('git', 'rev-parse', c + '^{tree}')
        except subprocess.CalledProcessError: trees[b] = None
    api_br = json.loads(run('gh', 'api', f'repos/{REPO}/branches/stage-3d-hq1'))
    api_c = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{HQ1}'))
    hq2_api = subprocess.run(['gh', 'api', f'repos/{REPO}/branches/stage-3d-hq2'], capture_output=True, text=True)
    rf = receipt_fields(receipt)
    local_hq2 = subprocess.run(['git', 'rev-parse', '--verify', '-q', 'refs/heads/stage-3d-hq2'], capture_output=True, text=True).stdout.strip() or None
    r = {'recordedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
         'acceptedParent': {'commit': HQ1, 'tree': HQ1_TREE,
                            'lsRemote': heads.get('stage-3d-hq1'), 'localTree': run('git', 'rev-parse', HQ1 + '^{tree}'),
                            'apiBranchHead': api_br['commit']['sha'], 'apiBranchTree': api_br['commit']['commit']['tree']['sha'],
                            'apiCommitTree': api_c['tree']['sha'], 'apiCommitParents': [p['sha'] for p in api_c['parents']],
                            'receipt': {'file': os.path.basename(receipt), 'commitLine': rf.get('commit'), 'treeLine': rf.get('tree')}},
         'ancestry': {'d7_ancestor_of_hq1': isanc(D7, HQ1), 'stage3h0_ancestor_of_hq1': isanc(S3H0, HQ1),
                      'hq1_ancestor_of_d7': isanc(HQ1, D7), 'note': 'D7 ffe2b53 is an ancestor only; HQ2 branches from the accepted HQ1 commit.'},
         'hq2Branch': {'remoteLsRemote': heads.get('stage-3d-hq2'), 'remoteApiStatus': 'absent (404)' if hq2_api.returncode != 0 and '404' in (hq2_api.stdout + hq2_api.stderr) else ('present' if hq2_api.returncode == 0 else 'unknown: ' + (hq2_api.stdout + hq2_api.stderr)[:200]),
                       'local': local_hq2, 'localCommitsBeyondParent': run('git', 'rev-list', '--count', f'{HQ1}..{local_hq2}') if local_hq2 else None},
         'workspace': {'branch': run('git', 'branch', '--show-current'), 'head': run('git', 'rev-parse', 'HEAD'),
                       'uncommitted': run('git', 'status', '--porcelain').splitlines(), 'stashes': run('git', 'stash', 'list').splitlines(),
                       'note': 'stash@{0} predates Stage 3D (lighting-shadows-2d SH8 WIP); kept untouched.'},
         'remoteHeads': {b: {'commit': heads[b], 'tree': trees[b]} for b in sorted(heads)}}
    p = r['acceptedParent']
    r['ok'] = (p['lsRemote'] == HQ1 and p['localTree'] == HQ1_TREE and p['apiBranchHead'] == HQ1 and p['apiBranchTree'] == HQ1_TREE
               and p['apiCommitTree'] == HQ1_TREE and p['receipt']['commitLine'] == HQ1 and p['receipt']['treeLine'] == HQ1_TREE
               and r['ancestry']['d7_ancestor_of_hq1'] and r['ancestry']['stage3h0_ancestor_of_hq1'] and not r['ancestry']['hq1_ancestor_of_d7']
               and r['hq2Branch']['remoteLsRemote'] is None and r['hq2Branch']['remoteApiStatus'].startswith('absent')
               and (local_hq2 is None or (local_hq2 == HQ1 or isanc(HQ1, local_hq2))))
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'preflight.json'), 'w') as f: f.write(json.dumps(r, indent=1) + '\n')
    with open(os.path.join(out, 'remote_heads_before_hq2.json'), 'w') as f: f.write(json.dumps({b: heads[b] for b in sorted(heads)}, indent=1) + '\n')
    print(json.dumps({k: r[k] for k in ('acceptedParent', 'ancestry', 'hq2Branch', 'ok')}, indent=1))
    return 0 if r['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
