#!/usr/bin/env python3
"""Stage 3H0 - check the file sizes the stage documents give against the files themselves (development only).

  python3 -I dev/stage-3h0/doc_sizes_h0.py [--rev REV]      (in the repository; REV defaults to the working tree)

Added at H0-6b, after five documents were found still giving, as final, sizes from before H0-5's comment corrections.  It reads:
  - 3H0_ARCHITECTURE_MAP.md section 1: bytes and lines at the parent edd2af9 and after 3H0, and the change in bytes;
  - STAGE_3H0_REPORT.md: the new files' bytes ("What moved") and the "Sizes:" line for mp.js and server.js;
  - STAGE_3H0_CHANGED_FILES.txt: the "A -> B bytes" of mp.js and server.js;
  - 3H0_MP_OWNERSHIP_MAP.md and 3H0_SERVER_OWNERSHIP_MAP.md section 5: the last row's bytes / lines of mp.js and server.js;
and compares each figure with the file (bytes, and lines as newline characters).  Exit status 0 only when every figure matches."""
import argparse, os, re, subprocess, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PARENT = 'edd2af954627caf7721c7614df5ff1c7f20d3f3b'
ap = argparse.ArgumentParser(); ap.add_argument('--rev'); A = ap.parse_args()
def blob(rev, f):
    if rev is None: return open(f, 'rb').read()
    return subprocess.run(['git', 'show', f'{rev}:{f}'], check=True, capture_output=True).stdout
size = lambda rev, f: (len(blob(rev, f)), blob(rev, f).count(b'\n'))
text = lambda f: blob(A.rev, f).decode('utf-8')
num = lambda s: int(s.replace(',', ''))
rows, bad = [], 0
def check(where, what, said, real):
    global bad
    ok = said == real; bad += not ok; rows.append(f'{"ok " if ok else "BAD"} {where}: {what}: the document says {said}, the file is {real}')
arch = text('3H0_ARCHITECTURE_MAP.md').split('## 1. Module sizes', 1)[1].split('\n## ', 1)[0]
for m in re.finditer(r'^\| `([^`]+)` \| ([^|]*)\| ([^|]*)\| ([^|]*)\|', arch, re.M):
    f, before, after, change = m.group(1), m.group(2).strip(), m.group(3).strip(), m.group(4).strip()
    b = re.match(r'([\d,]+) B / (\d+) lines', before); a = re.match(r'([\d,]+) B / (\d+) lines', after)
    if a: check('3H0_ARCHITECTURE_MAP.md', f'{f} after 3H0 (bytes, lines)', (num(a.group(1)), int(a.group(2))), size(A.rev, f))
    if b: check('3H0_ARCHITECTURE_MAP.md', f'{f} at edd2af9 (bytes, lines)', (num(b.group(1)), int(b.group(2))), size(PARENT, f))
    d = re.match(r'\+(\d+) lines', after)
    if d: check('3H0_ARCHITECTURE_MAP.md', f'{f} lines added', int(d.group(1)), size(A.rev, f)[1] - size(PARENT, f)[1])
    c = re.match(r'[−-]([\d,]+) B', change)
    if c and b: check('3H0_ARCHITECTURE_MAP.md', f'{f} change in bytes', -num(c.group(1)), size(A.rev, f)[0] - size(PARENT, f)[0])
rep = text('STAGE_3H0_REPORT.md')
moved = rep.split('## What moved', 1)[1].split('\n## ', 1)[0]
for m in re.finditer(r'^\| `([^`]+)` \| `[^`]+` \|.*\| ([\d,]+) \|$', moved, re.M): check('STAGE_3H0_REPORT.md', f'{m.group(1)} bytes', num(m.group(2)), size(A.rev, m.group(1))[0])
for f in ('mp.js', 'server.js'):
    m = re.search(r'`' + re.escape(f) + r'` ([\d,]+) → ([\d,]+) bytes', moved)
    check('STAGE_3H0_REPORT.md', f'{f} bytes before and after', (num(m.group(1)), num(m.group(2))) if m else None, (size(PARENT, f)[0], size(A.rev, f)[0]))
cf = text('STAGE_3H0_CHANGED_FILES.txt')
for f in ('mp.js', 'server.js'):
    m = re.search(r'^modified  ' + re.escape(f) + r'\n.*?([\d,]+) -> ([\d,]+) bytes', cf, re.M)
    check('STAGE_3H0_CHANGED_FILES.txt', f'{f} bytes before and after', (num(m.group(1)), num(m.group(2))) if m else None, (size(PARENT, f)[0], size(A.rev, f)[0]))
for doc, f in (('3H0_MP_OWNERSHIP_MAP.md', 'mp.js'), ('3H0_SERVER_OWNERSHIP_MAP.md', 'server.js')):
    sec = text(doc).split('## 5.', 1)[1].split('\n## ', 1)[0]
    last = [l for l in sec.split('\n') if re.match(r'^\| (\(H0-0\)|H0-\d)', l)][-1]
    m = re.search(r'\| ([\d,]+) / (\d+) \|', last)
    check(doc, f'{f} (bytes, lines) in the last row, {last.split("|")[1].strip()}', (num(m.group(1)), int(m.group(2))) if m else None, size(A.rev, f))
print('\n'.join(rows)); print(f'{len(rows)} figures checked, {bad} wrong'); sys.exit(1 if bad else 0)
