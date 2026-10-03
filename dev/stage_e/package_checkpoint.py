#!/usr/bin/env python3
"""Export a committed milestone; checksum and independently extract every entry.

Output is external to the source tree. Never includes .git or nested checkpoints.
"""
import argparse, hashlib, json, pathlib, subprocess, tempfile, zipfile

def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('milestone')
    ap.add_argument('output_directory')
    ap.add_argument('--base', default='c034a6d3d22e4eeb5f183a3017c429caf9bed356')
    ap.add_argument('--name')
    args=ap.parse_args()
    root=pathlib.Path(__file__).resolve().parents[2]
    if git(root,'status','--porcelain').strip():
        raise SystemExit('Refusing to package an uncommitted tree')
    commit=git(root,'rev-parse','HEAD').decode().strip()
    paths=[p.decode() for p in git(root,'ls-files','-z').split(b'\0') if p]
    out=pathlib.Path(args.output_directory).resolve();out.mkdir(parents=True,exist_ok=True)
    name=args.name or f'thefarbackrooms-level0-25d-stageE-{args.milestone}-CHECKPOINT.zip'
    dest=out/name
    if dest.exists(): raise SystemExit('Refusing to overwrite a checkpoint')
    manifest={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
    with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(paths): z.write(root/p,'thefarbackrooms-level0/'+p)
    with zipfile.ZipFile(dest) as z:
        assert z.testzip() is None
        with tempfile.TemporaryDirectory(prefix='stage E extraction ') as temp:
            z.extractall(temp)
            for p,expected in manifest.items():
                assert hashlib.sha256((pathlib.Path(temp)/'thefarbackrooms-level0'/p).read_bytes()).hexdigest()==expected,p
    digest=hashlib.sha256(dest.read_bytes()).hexdigest()
    changed=git(root,'diff','--name-status',args.base,commit).decode()
    prefix='25D_STAGE_E_'+args.milestone
    (out/(prefix+'_SHA256.txt')).write_text(digest+'  '+name+'\n')
    (out/(prefix+'_CHANGED_FILES.txt')).write_text(changed)
    verification={'milestone':args.milestone,'commit':commit,'base':args.base,'archive':name,'sha256':digest,'zipCRC':'PASS','cleanExtractionWithSpaces':'PASS','files':len(paths),'fileSHA256':manifest,'changedFiles':changed.splitlines(),'stageFStarted':False}
    (out/(prefix+'_PACKAGE_VERIFICATION.json')).write_text(json.dumps(verification,indent=2)+'\n')
    print(json.dumps({k:v for k,v in verification.items() if k!='fileSHA256'},indent=2))

if __name__=='__main__':main()
