/* Stage 3H0 - does the server golden harness notice small behavior changes?  (development only)
 *
 *   node dev/stage-3h0/golden/srv_mutants.js [--out FILE.json]
 *
 * Takes the accepted parent's server.js, makes one small deliberate change at a time (a "mutant": an off-by-one limit, swapped keys, a looser
 * allowlist, a lost try, a different cadence ...), runs the scenarios that should see it, and checks that the trace differs from the
 * unchanged parent's.  A mutant that is not noticed is a blind spot of the harness and is reported as such; none of these changes is ever
 * applied to the real file. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const HERE = __dirname, REPO = path.resolve(HERE, '..', '..', '..'), REF = 'edd2af954627caf7721c7614df5ff1c7f20d3f3b';
const OUTF = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const base = execFileSync('git', ['-C', REPO, 'show', REF + ':server.js'], { encoding: 'utf8' });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'h0mut-'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function trace(src, scen) {
  const f = path.join(tmp, 'm.js'), o = path.join(tmp, 'o.jsonl'); fs.writeFileSync(f, src); try { fs.unlinkSync(o); } catch (e) { }
  const r = spawnSync(process.execPath, [path.join(HERE, 'srv_harness.js'), '--src', f, '--dir', REPO, '--scenario', scen, '--out', o], { encoding: 'utf8', timeout: 600000 });
  return { status: r.status, sha: fs.existsSync(o) ? sha(fs.readFileSync(o)) : null };
}
const M = [
  ['inbound text limit 1400 -> 1401', 'op === 1 && len < 1400', 'op === 1 && len < 1401', ['ws_frames']],
  ['ping is answered with an echo payload', 'sock.write(Buffer.from([0x8a, 0]))', "sock.write(Buffer.from([0x8a, 2, 104, 105]))", ['ws_frames']],
  ['close frame ignored instead of ending', 'if (op === 8) return sock.end();', 'if (op === 8) continue;', ['ws_frames']],
  ['no try around parsing / handling', 'try { onMessage(JSON.parse(pl)); } catch (e) { /* ignore bad input */ }', 'onMessage(JSON.parse(pl));', ['ws_frames']],
  ['outbound 16-bit length limit moved', 'n < 65536 ?', 'n < 1000 ?', ['deaths']],
  ['peer keys reordered (c before n)', 'n: c.name, c: c.color,', 'c: c.color, n: c.name,', ['lifecycle']],
  ['peer angle rounded to 1 decimal', 'a: +c.angle.toFixed(2)', 'a: +c.angle.toFixed(1)', ['lifecycle', 'p_fields']],
  ['snapshot every 3rd wake', 'SNAP_EVERY = 2', 'SNAP_EVERY = 3', ['schedule']],
  ['wake every 26 ms', 'TICK_MS = 25', 'TICK_MS = 26', ['boot', 'schedule']],
  ['accumulator cap 0.25 -> 0.3 s', 'Math.min(0.25, (now - room.last) / 1000)', 'Math.min(0.3, (now - room.last) / 1000)', ['schedule']],
  ['15-step limit -> 14', 'n++ < 15', 'n++ < 14', ['schedule']],
  ['admin data every 4th wake', 'ADMIN_EVERY = 4', 'ADMIN_EVERY = 2', ['admin']],
  ['allowlist also serves dev/', "|assets\\/[\\w.\\-]+)$/", "|assets\\/[\\w.\\-]+|dev\\/[\\w.\\-\\/]+)$/", ['http_base']],
  ['png gzipped too', "if (ext !== '.png' && /\\bgzip\\b/", "if (/\\bgzip\\b/", ['http_base']],
  ['wav served as audio/wav', "'.png': 'image/png' }", "'.png': 'image/png', '.wav': 'audio/wav' }", ['http_base']],
  ['sounds cache 300 -> 301', "'public, max-age=300'", "'public, max-age=301'", ['http_base']],
  ['room cap 8 -> 9', 'MAX_ROOM = 8', 'MAX_ROOM = 9', ['ws_upgrade']],
  ['room names keep dots', ".replace(/[^\\w-]/g, '')", ".replace(/[^\\w.-]/g, '')", ['ws_upgrade']],
  ['position throttle 30 -> 31 ms', 'now - me.last < 30', 'now - me.last < 31', ['lifecycle', 'p_fields']],
  ['missing l no longer counts as raised', 'me.raised = m.l !== 0', 'me.raised = !!m.l', ['p_fields']],
  ['infrared cap 2 -> 3', 'Math.max(0, Math.min(2, m.ir | 0))', 'Math.max(0, Math.min(3, m.ir | 0))', ['p_fields']],
  ['legacy torch maps to flashlight', "torch: 'lantern'", "torch: 'flashlight'", ['p_fields']],
  ['looks: a fifth hat allowed', "['none', 'cap', 'beanie', 'hardhat']", "['none', 'cap', 'beanie', 'hardhat', 'crown']", ['p_fields']],
  ['light parts may have 6 colours', 'a.length <= 5', 'a.length <= 6', ['p_fields']],
  ['fx cooldown 1500 -> 1400 ms', 't - (me.fxAt || 0) < 1500', 't - (me.fxAt || 0) < 1400', ['deaths', 'lifecycle']],
  ['server replay after 1.6 s', 'now - a.at > 1500', 'now - a.at > 1600', ['deaths']],
  ['corpse slack 8 -> 7 s', '(gone ? .6 : 8)', '(gone ? .6 : 7)', ['deaths']],
  ['corpse blood keeps 7 bursts', '.slice(0, 6).map(b =>', '.slice(0, 7).map(b =>', ['deaths']],
  ['lockout after 6 wrong guesses', 'if (++f.n >= 5)', 'if (++f.n >= 6)', ['admin']],
  ['broadcast cut at 139', ".slice(0, 140).trim()", ".slice(0, 139).trim()", ['admin']],
  ['pong throttle 400 -> 200 ms', 't - (me.pingAt || 0) > 400', 't - (me.pingAt || 0) > 200', ['admin', 'ws_frames']],
  ['kick close after 100 ms', '} }, 150); }', '} }, 100); }', ['admin']],
  ['exit message rounds down', "secs: Math.round(c.player.exitT || 0)", "secs: Math.floor(c.player.exitT || 0)", ['exit_glitch']],
  ['movement budget burst 1.5 -> 1.4 s', 'BURST: 1.5', 'BURST: 1.4', ['lifecycle']],
  ['one frame buffer shared by every connection', [['  let buf = Buffer.alloc(0);\n  sock.on(\'data\'', '  sock.on(\'data\''], ['const rooms = new Map();', 'const rooms = new Map(); let buf = Buffer.alloc(0);']], null, ['ws_frames']],
  ['close / error listeners before data', [["  sock.on('data', d => {", "  sock.on('close', () => {}); sock.on('data', d => {"]], null, ['ws_upgrade']],
  ['handshake without the trailing blank line', "'\\r\\n\\r\\n');", "'\\r\\n');", ['ws_upgrade']],
];
/* changes no input can reveal (reported, not counted): every admin answer the commands can produce is under 50 characters, so the 90-character
 * cut is never reached by the current commands */
const EQUIVALENT = [['ares message cut at 80 instead of 90', 'String(msg).slice(0, 90)', 'String(msg).slice(0, 80)', 'no admin answer reaches 80 characters (longest seen: 44)']];
const baseline = {}; const results = [];
for (const [, , , scens] of M) for (const s of scens) if (!baseline[s]) baseline[s] = trace(base, s).sha;
for (const [name, from, to, scens] of M) {
  const pairs = Array.isArray(from) ? from : [[from, to]];
  if (!pairs.every(([f]) => base.includes(f))) { results.push({ name, applied: false, detected: null, note: 'pattern not found' }); console.log('SKIP ' + name + ' (pattern not found)'); continue; }
  let src = base; for (const [f, t2] of pairs) src = src.replace(f, t2);
  const per = scens.map(s => { const t = trace(src, s); return { scenario: s, status: t.status, differs: t.sha !== baseline[s] }; });
  const detected = per.some(p => p.differs);
  results.push({ name, applied: true, detected, per });
  console.log((detected ? 'CAUGHT ' : 'MISSED ') + name + '  [' + per.map(p => p.scenario + (p.differs ? ' differs' : ' same') + (p.status ? ' exit ' + p.status : '')).join(', ') + ']');
}
const rep = { tool: 'dev/stage-3h0/golden/srv_mutants.js', ref: REF, equivalentNotCounted: EQUIVALENT.map(e => ({ name: e[0], why: e[3] })), mutants: results.length, applied: results.filter(r => r.applied).length, caught: results.filter(r => r.detected).length,
  missed: results.filter(r => r.applied && !r.detected).map(r => r.name), results };
console.log(`${rep.caught}/${rep.applied} mutants caught` + (rep.missed.length ? '; missed: ' + rep.missed.join('; ') : ''));
if (OUTF) fs.writeFileSync(OUTF, JSON.stringify(rep, null, 1) + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
process.exitCode = rep.missed.length || rep.applied !== rep.mutants ? 1 : 0;
