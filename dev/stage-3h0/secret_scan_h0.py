#!/usr/bin/env python3
"""Stage 3H0 - scan every file the stage added or changed for secrets before it is published (development only).

  python3 -I dev/stage-3h0/secret_scan_h0.py [--rev REV] [--extra FILE] [--out FILE.json]      (in the repository)

The files are those changed since the accepted parent edd2af9: at REV (read from Git), or, without --rev, in the working tree (staged,
unstaged and untracked).  Gzip files are scanned decompressed; images and audio are scanned as raw bytes, for the literal strings only.

Checks, each reported with file and line; every match on a reported line is masked, so no secret is ever printed or written:
  - the server's built-in default admin passcode, read at run time from the parent's server.js (never written here), and its SHA-256:
    allowed only on its own line in server.js, which 3H0 does not change;
  - optional literal strings from --extra FILE, one per line, kept outside the repository (for example the owner's e-mail address);
  - credential shapes: GitHub, AWS, Slack, Google, Stripe and API-style keys, JWTs, bearer tokens, private-key blocks, URLs with a password;
  - e-mail addresses other than Git's noreply address and the reserved example domains;
  - IPv4 addresses outside loopback, private, link-local and the documentation ranges (192.0.2/24, 198.51.100/24, 203.0.113/24);
  - personal home folders: a named user's folder under a Users folder (macOS, Windows) or under /home other than the build machine's;
  - no file whose name says it is private (the private security findings stay outside the repository).
Before scanning, a self-test feeds the checks synthetic text in memory (nothing is written): each planted item must be found, and each
look-alike that is allowed (documentation and private addresses, version numbers, example e-mail domains, the passcode's own line in
server.js) must not be.  Exit status 0 only when the self-test passes and the scan finds nothing."""
import argparse, gzip, hashlib, ipaddress, json, os, re, subprocess, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
PARENT = 'edd2af954627caf7721c7614df5ff1c7f20d3f3b'
ap = argparse.ArgumentParser(); ap.add_argument('--rev'); ap.add_argument('--extra'); ap.add_argument('--out'); A = ap.parse_args()
git = lambda *a: subprocess.run(['git', *a], check=True, capture_output=True).stdout
m = re.search(rb"ADMIN_PASSCODE\s*\|\|\s*'([^']+)'", git('show', f'{PARENT}:server.js'))
if not m: sys.exit('the default passcode line was not found in the parent server.js')
PASS = m.group(1).decode()
LITERALS = [('default admin passcode', PASS), ('SHA-256 of the default admin passcode', hashlib.sha256(PASS.encode()).hexdigest())]
EXTRA = [(f'extra string {i + 1}', s.strip()) for i, s in enumerate(open(A.extra, encoding='utf-8')) if s.strip()] if A.extra else []
PASS_LINE = 'const ADMIN_PASS = process.env.ADMIN_PASSCODE ||'          # the one place the default may stay: its own line in server.js
PATTERNS = [('GitHub token', r'\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})'), ('AWS access key', r'\b(AKIA|ASIA)[0-9A-Z]{16}\b'),
            ('Slack token', r'\bxox[abprs]-[A-Za-z0-9-]{10,}'), ('Google API key', r'\bAIza[0-9A-Za-z_\-]{35}'), ('Stripe key', r'\b[sr]k_(live|test)_[0-9A-Za-z]{16,}'),
            ('API-style secret key', r'\bsk-(ant-)?[A-Za-z0-9_\-]{20,}'), ('JWT', r'\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}'),
            ('bearer token', r'(?i)\bbearer\s+[A-Za-z0-9._\-]{20,}'), ('private key block', r'-----BEGIN [A-Z ]*PRIVATE KEY-----'),
            ('URL with a password', r'\b[a-z][a-z0-9+.\-]*://[^/\s:@"\']+:[^/\s@"\']+@')]
EMAIL = re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b')
EMAIL_OK = re.compile(r'(?i)(^noreply@anthropic\.com$|@([a-z0-9\-]+\.)*(example\.(com|org|net)|[a-z0-9\-]+\.(invalid|test|example|localhost))$)')
IPV4 = re.compile(r'(?<![\w.])(\d{1,3}(?:\.\d{1,3}){3})(?!\w)(?!\.\d)')
DOC_NETS = [ipaddress.ip_network(n) for n in ('192.0.2.0/24', '198.51.100.0/24', '203.0.113.0/24')]
HOMES = re.compile(r'(/Users/[A-Za-z0-9._\-]+|[A-Za-z]:\\{1,2}Users\\{1,2}[A-Za-z0-9._\-]+|/home/(?!claude\b)[A-Za-z0-9._\-]+)')
BINARY = ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.wav', '.mp3', '.ogg', '.zip')
mask = lambda s: s[:2] + '…' + s[-2:] if len(s) > 8 else '[masked]'
CHECKS = [k for k, _ in LITERALS] + ['extra string N'] + [k for k, _ in PATTERNS] + ['e-mail address', 'public IPv4 address', 'personal home folder', 'a file named private']

def line_hits(name, line, literals):
    """Every finding on one line of text, as (check, start, end)."""
    out = []
    for kind, s in literals:
        for x in re.finditer(re.escape(s), line, re.I):
            if not (kind == 'default admin passcode' and name == 'server.js' and line.lstrip().startswith(PASS_LINE)): out.append((kind, x.start(), x.end()))
    for kind, rx in PATTERNS: out += [(kind, x.start(), x.end()) for x in re.finditer(rx, line)]
    out += [('e-mail address', x.start(), x.end()) for x in EMAIL.finditer(line) if not EMAIL_OK.search(x.group(0))]
    for x in IPV4.finditer(line):
        try: ip = ipaddress.ip_address(x.group(1))
        except ValueError: continue
        if not (ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_unspecified or ip.is_multicast or any(ip in d for d in DOC_NETS)):
            out.append(('public IPv4 address', x.start(1), x.end(1)))
    out += [('personal home folder', x.start(), x.end()) for x in HOMES.finditer(line)]
    return out

def masked(line, spans):
    """The line with every finding on it masked; overlapping findings are joined first and masked as one."""
    iv = []
    for a, b in sorted((a, b) for _, a, b in spans):
        if iv and a <= iv[-1][1]: iv[-1][1] = max(iv[-1][1], b)
        else: iv.append([a, b])
    res, pos = [], 0
    for a, b in iv: res += [line[pos:a], mask(line[a:b])]; pos = b
    return (''.join(res) + line[pos:]).strip()[:200]

def scan(name, b, literals):
    """The findings in one file's bytes."""
    found = []
    if 'private' in os.path.basename(name).lower(): found.append({'check': 'a file named private', 'file': name, 'line': 0, 'context': mask(os.path.basename(name))})
    if name.endswith('.gz'):
        try: b = gzip.decompress(b)
        except OSError: pass
    if os.path.splitext(name[:-3] if name.endswith('.gz') else name)[1].lower() in BINARY:
        low = b.lower()
        for kind, s in literals:
            k = s.lower().encode()
            if k in low: found.append({'check': kind, 'file': name, 'line': 0, 'context': f'(binary file: {low.count(k)} occurrence(s))'})
        return found
    for ln, line in enumerate(b.decode('utf-8', 'replace').split('\n'), 1):
        h = line_hits(name, line, literals)
        found += [{'check': kind, 'file': name, 'line': ln, 'context': masked(line, h)} for kind, a, e in h]
    return found

def self_test():
    """Synthetic text, in memory only: every planted item must be found, and no allowed look-alike."""
    lit = LITERALS + [('extra string 1', 'planted-extra-string')]
    j = lambda *p: '.'.join(p)
    planted = [('default admin passcode', 'a.log', ('x ' + PASS.upper() + ' y').encode()), ('default admin passcode', 'b.png', b'\x89PNG' + PASS.encode() + b'\0'),
               ('SHA-256 of the default admin passcode', 'c.json', ('{"h":"' + hashlib.sha256(PASS.encode()).hexdigest() + '"}').encode()),
               ('extra string 1', 'd.jsonl.gz', gzip.compress(b'{"m":"PLANTED-EXTRA-STRING"}')), ('GitHub token', 'e.log', ('ghp_' + 'A1' * 18).encode()),
               ('AWS access key', 'e.log', b'AKIA' + b'ABCDEFGHIJ234567'), ('Slack token', 'e.log', b'xoxb-' + b'1234567890-abcdef'),
               ('Google API key', 'e.log', b'AIza' + b'B' * 35), ('Stripe key', 'e.log', b'sk_' + b'live_' + b'C' * 24), ('API-style secret key', 'e.log', b'sk-' + b'ant-' + b'D' * 30),
               ('JWT', 'e.log', b'eyJ' + b'hbGciOiJIUzI1NiJ9.' + b'eyJzdWIiOiIxMjM0In0.' + b'abcdefghijklmnop'), ('bearer token', 'e.log', b'Authorization: Bearer ' + b'E' * 32),
               ('private key block', 'e.log', b'-----BEGIN ' + b'RSA PRIVATE KEY-----'), ('URL with a password', 'e.log', b'https://' + b'user:pw@' + b'host.example.org/x'),
               ('e-mail address', 'f.json', b'{"e":"someone@' + b'gmail.com"}'), ('public IPv4 address', 'f.json', j('8', '8', '8', '8').encode()),
               ('public IPv4 address', 'f.json', ('at ' + j('93', '184', '216', '34') + '.').encode()), ('personal home folder', 'g.txt', b'/Users' + b'/alice/x'),
               ('personal home folder', 'g.txt', b'C:\\Users' + b'\\bob\\y'), ('personal home folder', 'g.txt', b'/home' + b'/carol/z'), ('a file named private', '3H0_PRIVATE_NOTES.md', b'x')]
    allowed = [('h.json', j('203', '0', '113', '9') + ' ' + j('198', '51', '100', '7') + ' ' + j('192', '0', '2', '1') + ' 127.0.0.1 10.0.0.1 192.168.1.1 0.0.0.0 1.2.3.4.5'),
               ('h.json', 'noreply@anthropic.com a@example.com b@host.example.org c@x.invalid /home/claude/x h0-synthetic-admin'),
               ('server.js', PASS_LINE + " '" + PASS + "';")]
    res = [(k, n, any(f['check'] == k for f in scan(n, b, lit))) for k, n, b in planted]
    false = [f for n, t in allowed for f in scan(n, t.encode(), lit)]
    missed = [f'{k} ({n})' for k, n, ok in res if not ok]
    return {'planted': len(planted), 'caught': len(planted) - len(missed), 'missed': missed, 'allowedLookAlikes': len(allowed),
            'falseFindings': [f['check'] for f in false], 'ok': not missed and not false}

if A.rev: names = [n for n in git('diff', '--name-only', '--diff-filter=AM', PARENT, A.rev).decode().splitlines() if n]
else:
    names = [n for n in git('diff', '--name-only', '--diff-filter=AM', PARENT).decode().splitlines() if n]
    names += [n for n in git('ls-files', '--others', '--exclude-standard').decode().splitlines() if n and n not in names]
read = (lambda n: git('show', f'{A.rev}:{n}')) if A.rev else (lambda n: open(n, 'rb').read())
ST = self_test(); found, kinds = [], {}
for n in sorted(names):
    try: b = read(n)
    except (subprocess.CalledProcessError, FileNotFoundError, IsADirectoryError): continue
    ext = os.path.splitext(n[:-3] if n.endswith('.gz') else n)[1].lower(); kinds[ext] = kinds.get(ext, 0) + 1
    found += scan(n, b, LITERALS + EXTRA)
by = {}
for f in found: by[f['check']] = by.get(f['check'], 0) + 1
R = {'tool': 'dev/stage-3h0/secret_scan_h0.py', 'rev': A.rev or 'working tree', 'parent': PARENT, 'filesScanned': sum(kinds.values()), 'byType': dict(sorted(kinds.items())),
     'extraStrings': len(EXTRA), 'checks': CHECKS, 'selfTest': ST, 'findings': len(found), 'byCheck': by, 'details': found, 'clean': not found, 'ok': ST['ok'] and not found}
if A.out: open(A.out, 'w').write(json.dumps(R, indent=1, ensure_ascii=False) + '\n')
print(f'self-test: {ST["caught"]}/{ST["planted"]} planted items found, {len(ST["falseFindings"])} findings on {ST["allowedLookAlikes"]} lines of allowed look-alikes: {"PASS" if ST["ok"] else "FAIL " + json.dumps(ST)}')
print(f'{R["filesScanned"]} files scanned (' + ', '.join(f'{v} {k or "(no extension)"}' for k, v in sorted(kinds.items())) + f'), {len(EXTRA)} extra string(s)')
print('checks: ' + ', '.join(CHECKS))
for f in found[:60]: print(f'  {f["check"]}: {f["file"]}:{f["line"]}: {f["context"][:150]}')
print('CLEAN: nothing found' if not found else f'FOUND {len(found)}: {by}')
sys.exit(0 if R['ok'] else 1)
