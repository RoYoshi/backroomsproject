#!/usr/bin/env python3
"""Stage 3H0 H0-0 - record the independent verification of the accepted Stage 3C QA2 parent before any 3H0 work (development only).

  python3 -I dev/stage-3h0/record_parent_h0.py PACK_DIR [QA2_ZIP] --out FILE.json      (in the repository)

PACK_DIR is the extracted Stage 3H0 master pack (untrusted data: only read and hashed here).  QA2_ZIP, when given, is the accepted
QA2 package, hashed and compared with the accepted SHA-256.  Records: the remote stage-3c-qa2 tip three ways (git ls-remote, the GitHub
REST commit object, the GitHub REST branch object) and from a plain `git fetch` (FETCH_HEAD), the commit's tree and parent, the pack's own
checksum list, and the read-only QA2 source snapshots in the pack compared byte for byte with the same files in Git at the parent."""
import hashlib, json, os, subprocess, sys, datetime, platform
REPO = 'RoYoshi/backroomsproject'
PARENT = 'edd2af954627caf7721c7614df5ff1c7f20d3f3b'; PARENT_TREE = '108d89fa07634ef4816428939fc7dda1e03ec971'
QA2_ZIP_SHA = 'aa844c6872dad8d77d2b1176aa99259a4b470eabf998c16573794e2d24aeaaff'
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True).stdout.strip()
runb = lambda *a: subprocess.run(a, check=True, capture_output=True).stdout


def sha256(b): return hashlib.sha256(b).hexdigest()


def fsha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''): h.update(c)
    return h.hexdigest()


def main():
    pack = sys.argv[1]; out = sys.argv[sys.argv.index('--out') + 1]
    qa2zip = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else None
    heads = {l.split()[1][len('refs/heads/'):]: l.split()[0] for l in run('git', 'ls-remote', '--heads', 'origin').splitlines()}
    api = json.loads(run('gh', 'api', f'repos/{REPO}/git/commits/{PARENT}'))
    br = json.loads(run('gh', 'api', f'repos/{REPO}/branches/stage-3c-qa2'))
    run('git', 'fetch', '--quiet', 'origin', 'stage-3c-qa2')
    fetched, fetched_tree = run('git', 'rev-parse', 'FETCH_HEAD'), run('git', 'rev-parse', 'FETCH_HEAD^{tree}')
    sums = {}
    for line in open(os.path.join(pack, 'PACK_SHA256SUMS.txt'), encoding='utf-8'):
        if line.strip():
            h, name = line.split(None, 1); name = name.strip(); sums[name] = {'listed': h, 'actual': fsha(os.path.join(pack, name))}
    snaps = {}
    for f in ['mp.js', 'server.js', 'index.html', 'package.json', 'sim.js']:
        g = runb('git', 'show', f'{PARENT}:{f}')
        snaps[f] = {'git': sha256(g), 'bytes': len(g), 'pack': fsha(os.path.join(pack, 'reference', 'qa2_source_read_only', f))}
        snaps[f]['match'] = snaps[f]['git'] == snaps[f]['pack']
    docs = {}
    for f in ['STAGE_3C_QA2_CHANGED_FILES.txt', 'STAGE_3C_QA2_HUMAN_QA.md', 'STAGE_3C_QA2_PERFORMANCE.md', 'STAGE_3C_QA2_Q0_AUDIT.md', 'STAGE_3C_QA2_REPORT.md']:
        g = runb('git', 'show', f'{PARENT}:{f}')
        docs[f] = sha256(g) == fsha(os.path.join(pack, 'reference', 'qa2_acceptance_documents', f))
    r = {'recordedAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
         'acceptedParent': {'commit': PARENT, 'tree': PARENT_TREE},
         'lsRemoteStage3cQa2': heads.get('stage-3c-qa2'),
         'githubApiCommit': {'sha': api['sha'], 'tree': api['tree']['sha'], 'parents': [p['sha'] for p in api['parents']], 'message': api['message'].split('\n')[0]},
         'githubApiBranch': {'sha': br['commit']['sha'], 'tree': br['commit']['commit']['tree']['sha']},
         'gitFetch': {'FETCH_HEAD': fetched, 'tree': fetched_tree},
         'localObject': {'tree': run('git', 'rev-parse', PARENT + '^{tree}')},
         'stage3h0OnRemote': 'stage-3h0' in heads,
         'packChecksums': {'entries': len(sums), 'allMatch': all(v['listed'] == v['actual'] for v in sums.values())},
         'packSnapshotsVsGit': snaps, 'packQa2DocumentsVsGit': docs,
         'environment': {'node': run('node', '--version'), 'git': run('git', '--version'), 'python': platform.python_version(), 'platform': platform.platform()}}
    if qa2zip:
        r['acceptedQa2Zip'] = {'sha256': fsha(qa2zip), 'expected': QA2_ZIP_SHA}; r['acceptedQa2Zip']['match'] = r['acceptedQa2Zip']['sha256'] == QA2_ZIP_SHA
    r['ok'] = (r['lsRemoteStage3cQa2'] == PARENT and api['sha'] == PARENT and api['tree']['sha'] == PARENT_TREE and br['commit']['sha'] == PARENT
               and fetched == PARENT and fetched_tree == PARENT_TREE and r['localObject']['tree'] == PARENT_TREE and r['packChecksums']['allMatch']
               and all(v['match'] for v in snaps.values()) and all(docs.values()) and (not qa2zip or r['acceptedQa2Zip']['match']))
    s = json.dumps(r, indent=1); print(s)
    with open(out, 'w') as f: f.write(s + '\n')
    return 0 if r['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
