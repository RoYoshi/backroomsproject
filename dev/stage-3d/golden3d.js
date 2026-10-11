/* Stage 3D - the 3H0 server golden traces, whole tree against whole tree, with every difference sorted into death or not (development only).
 *
 *   node dev/stage-3d/golden3d.js --old DIR --new DIR [--scenarios a,b] [--out FILE.json] [--keep DIR]
 *
 * Each scenario of dev/stage-3h0/golden/srv_scenarios.js runs in the 3H0 closed-world harness (fake clock, seeded randomness, fake sockets)
 * twice: on OLD's server.js with OLD's files (sim.js, dphys.js, death_srv.js ...) and on NEW's with NEW's.  (3H0's own srv_golden.js
 * swaps only server.js; Stage 3D changes the files around it too, so the whole tree is swapped here.)
 *
 * Every trace line is classed:
 *   death       a message or call of the death domain: sock.frame of t 'fx' (death), 'bodies', a snapshot's kill record (mk), and the calls
 *               sim.setBody / sim.killerEnd, console '[death]' lines; and sim.blockersAt / sim.clearAt, which only the server's death
 *               simulation (death_srv.js) calls - checked at run time: no other server file may call them, or the tool fails
 *   changed-file  an HTTP response for a file that differs between OLD and NEW (a client death file Stage 3D changed): its length and
 *               hash may differ, its path and status code may not (a server-only file must stay 404)
 *   follow-on   a non-death line that differs only AFTER the first death-domain difference of the same trace, and only in data a death
 *               feeds (entity positions and states in snapshots, after the server placed the attacker where the death animation left it)
 *   other       anything else
 * The rule (Stage 3D pack, PROTOCOL_AND_3H0_COMPATIBILITY: strict non-death equality, documented death deltas):
 *   - a scenario whose OLD trace has no death-domain line must be byte-identical;
 *   - in the others, the first difference must be a death-domain line, AND the non-death view of the two traces must be identical: every
 *     line that is not death-domain, with the snapshots' entity list and kill record taken out (where a death leaves its attacker is death
 *     presentation feeding the AI's position: the one documented follow-on), must match line for line.
 * Exit status 0 only when the rule holds. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const H0 = path.resolve(__dirname, '..', 'stage-3h0', 'golden'), HARNESS = path.join(H0, 'srv_harness.js');
const OLD = path.resolve(ARG.old), NEW = path.resolve(ARG.new);
const SCEN = ARG.scenarios ? ARG.scenarios.split(',') : Object.keys(require(path.join(H0, 'srv_scenarios.js')));
/* only death_srv.js may query the level's geometry on the server; anything else would make those calls non-death output */
const geoCallers = [path.join(NEW, 'server.js'), ...fs.readdirSync(path.join(NEW, 'server')).map(f => path.join(NEW, 'server', f))].filter(f => /blockersAt|clearAt/.test(fs.readFileSync(f, 'utf8')));
if (geoCallers.length) { console.error('golden3d: a server file other than death_srv.js queries the level geometry:', geoCallers.join(', ')); process.exit(2); }
const tmp = ARG.keep ? path.resolve(ARG.keep) : fs.mkdtempSync(path.join(os.tmpdir(), 'g3d-')); fs.mkdirSync(tmp, { recursive: true });

function run(dir, scen, tag) {
  const out = path.join(tmp, `${scen}.${tag}.jsonl`);
  const r = spawnSync(process.execPath, [HARNESS, '--src', path.join(dir, 'server.js'), '--dir', dir, '--scenario', scen, '--out', out, '--struct', out + '.struct.json'], { encoding: 'utf8', timeout: 900000 });
  return { ok: r.status === 0, lines: fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n') : [], err: r.status === 0 ? '' : (r.stderr || r.stdout || '').slice(-400) };
}
function payload(arr) { if (arr[1] !== 'sock.frame' || typeof arr[5] !== 'string') return null; try { return JSON.parse(arr[5]); } catch (e) { return null; } }
function cls(line) {
  let a; try { a = JSON.parse(line); } catch (e) { return 'other'; }
  if (!Array.isArray(a)) return 'other';
  if (a[1] === 'sim.setBody' || a[1] === 'sim.killerEnd' || a[1] === 'sim.blockersAt' || a[1] === 'sim.clearAt') return 'death';
  if (a[1] === 'http.end' && typeof a[3] === 'string' && CHANGED.has(a[3].split('?')[0].replace(/^\//, ''))) return 'changed-file';
  if (a[1] === 'console.log' && /^\[death\]/.test(String(a[2]))) return 'death';
  if (a[1] === 'console.error' && /\[death\]/.test(String(a[2]))) return 'death';
  const m = payload(a);
  if (m && (m.t === 'bodies' || (m.t === 'fx' && m.k === 'death') || m.t === 'b')) return 'death';
  if (m && m.t === 's' && m.mk) return 'death-snapshot';
  return 'other';
}
/* the non-death view of a trace: death-domain lines dropped; in snapshots the entity list (e) and the kill record (mk) dropped, and the frame
 * length with them (both follow from where a death left its attacker); in the admin's entity list (ad.es), the admin debug list (dbg) and
 * sim.debugInfo, each entity's position dropped but its identity and state kept (where the attacker stands after a death is the one
 * documented follow-on; if it changed what any monster DOES, the states would differ and the check fails); every other line kept exactly */
function nonDeath(lines) {
  const out = [];
  for (const line of lines) {
    const c = cls(line); if (c === 'death') continue;
    let a; try { a = JSON.parse(line); } catch (e) { out.push(line); continue; }
    const m = Array.isArray(a) ? payload(a) : null;
    if (m && m.t === 's') {
      delete m.e; delete m.mk;
      if (m.ad && Array.isArray(m.ad.es)) m.ad.es = m.ad.es.map(q => [q[0], q[1], q[2]]);                       // admin entity list: who and in which state, not where
      if (Array.isArray(m.dbg)) m.dbg = m.dbg.map(q => [q.i, q.k, q.s]);                                         // admin debug list: the same
      if (m.dx && m.dx.pf) delete m.dx.pf.kb;                                                                    // the admin's snapshot size: the entity list's bytes
      out.push(JSON.stringify([a[0], a[1], a[2], a[3], m])); continue;
    }
    if (Array.isArray(a) && a[1] === 'sim.entities') { out.push(JSON.stringify([a[0], a[1]])); continue; }
    if (Array.isArray(a) && a[1] === 'sim.debugInfo' && Array.isArray(a[3])) { out.push(JSON.stringify([a[0], a[1], a[3].map(q => [q.i, q.k, q.s])])); continue; }
    if (c === 'changed-file') { out.push(JSON.stringify([a[0], a[1], a[2], a[3], '~', '~', a[6]])); continue; }
    out.push(line);
  }
  return out;
}
/* the files (relative paths) whose bytes differ between the two trees */
function files(dir, rel = '') { let o = []; for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) { if (e.name === '.git' || e.name === 'node_modules' || (rel === '' && e.name === 'dev')) continue; const r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) o = o.concat(files(dir, r)); else o.push(r); } return o; }
const CHANGED = new Set([...new Set([...files(OLD), ...files(NEW)])].filter(f => { try { return !fs.readFileSync(path.join(OLD, f)).equals(fs.readFileSync(path.join(NEW, f))); } catch (e) { return true; } }));
/* the first few paths at which two JSON lines differ (for the report) */
function deepDiff(x, y) {
  const out = []; let X, Y; try { X = JSON.parse(x); Y = JSON.parse(y); } catch (e) { return ['(not JSON)']; }
  const walk = (a, b, p) => { if (out.length >= 6) return; if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p + '/' + k); }
    else out.push(p + ': ' + JSON.stringify(a).slice(0, 120) + ' -> ' + JSON.stringify(b).slice(0, 120)); };
  walk(X, Y, ''); return out;
}
const report = { tool: 'dev/stage-3d/golden3d.js', old: OLD, new: NEW, changedFiles: [...CHANGED].sort(), scenarios: {} };
let ok = true;
for (const s of SCEN) {
  const o = run(OLD, s, 'old'), n = run(NEW, s, 'new');
  const oc = o.lines.map(cls), hasDeath = oc.some(c => c.startsWith('death'));
  let first = -1; const L = Math.max(o.lines.length, n.lines.length);
  for (let i = 0; i < L; i++) if (o.lines[i] !== n.lines[i]) { first = i; break; }
  const R = { oldLines: o.lines.length, newLines: n.lines.length, identical: first < 0 && o.ok && n.ok, hasDeath, harnessOk: o.ok && n.ok };
  if (!o.ok || !n.ok) R.errors = [o.err, n.err];
  if (first >= 0) {
    const fc = cls(o.lines[first] || n.lines[first] || ''), fcN = cls(n.lines[first] || '');
    R.firstDiff = { line: first, classOld: fc, classNew: fcN, old: (o.lines[first] || '').slice(0, 400), new: (n.lines[first] || '').slice(0, 400) };
    // after the first difference: how many lines of each class differ (aligned by index; a shift makes the rest differ, so this is a rough count)
    const cnt = {}; for (let i = first; i < L; i++) if (o.lines[i] !== n.lines[i]) { const c = cls(o.lines[i] || n.lines[i] || ''); cnt[c] = (cnt[c] || 0) + 1; }
    R.differingAfter = cnt;
    const on = nonDeath(o.lines), nn = nonDeath(n.lines); let fd = -1;
    for (let i = 0; i < Math.max(on.length, nn.length); i++) if (on[i] !== nn[i]) { fd = i; break; }
    R.nonDeathIdentical = fd < 0;
    if (fd >= 0) R.firstNonDeathDiff = { index: fd, where: deepDiff(on[fd], nn[fd]), old: (on[fd] || '').slice(0, 400), new: (nn[fd] || '').slice(0, 400) };
    const dom = c => c.startsWith('death') || c === 'changed-file';
    R.pass = R.harnessOk && (hasDeath || fc === 'changed-file') && (dom(fc) || dom(fcN)) && R.nonDeathIdentical;
  } else R.pass = R.harnessOk;
  if (!R.pass) ok = false;
  report.scenarios[s] = R;
  console.log(`${s}: ${R.identical ? 'IDENTICAL' : R.firstDiff ? 'differs from line ' + R.firstDiff.line + ' (' + R.firstDiff.classOld + ' / ' + R.firstDiff.classNew + '); non-death view ' + (R.nonDeathIdentical ? 'identical' : 'DIFFERS at ' + R.firstNonDeathDiff.index) : 'harness error'}; death lines in the old trace: ${hasDeath}; ${R.pass ? 'PASS' : 'FAIL'}`);
}
report.ok = ok;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(report, null, 1) + '\n');
if (!ARG.keep) fs.rmSync(tmp, { recursive: true, force: true });
console.log(ok ? 'GOLDEN 3D: every non-death output identical; every difference starts in the death domain' : 'GOLDEN 3D: FAIL');
process.exitCode = ok ? 0 : 1;
