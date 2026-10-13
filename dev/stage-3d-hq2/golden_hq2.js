/* Stage 3D HQ2 - the 3H0 server golden traces, HQ1 against HQ2, with HQ2's documented wire additions taken out (development only)
 *
 *   node dev/stage-3d-hq2/golden_hq2.js --old DIR --new DIR [--scenarios a,b] [--out FILE.json] [--keep DIR]
 *
 * dev/stage-3d/golden3d.js cannot run on HQ2: it refuses any server file but death_srv.js that queries the level's geometry, and HQ2's
 * server.js does so on purpose (H2-3: a free spot for a placement, sim.clearAt; a long hop's route, sim.moveRoute).  This tool runs the
 * same closed-world harness (dev/stage-3h0/golden/srv_harness.js: fake clock, seeded randomness, fake sockets) on every scenario of
 * dev/stage-3h0/golden/srv_scenarios.js, once on OLD's whole tree and once on NEW's, and compares the traces line by line after one
 * normalisation, the same on both sides:
 *   - the world number HQ2 adds to messages (`w` in s and bodies, `wn` in fx: D5 as corrected at H2-5 - an fx's own `w` is the Hound C
 *     wall, compared like everything else) is taken out;
 *   - sim.join / sim.leave are compared on the player and the result (HQ1 also passed the time, for the NEW RUN vanish window H2-1 removed);
 *   - the sim's pure queries are taken out (moveOk, moveRoute, clearAt, blockersAt, spawnOk, canRespawn, lifeOf, nrWhy, nrWait): they
 *     change nothing, and what they decide shows in everything the server then does and sends (HQ2 asks more of them, by design);
 *   - everything else - every frame the server sends, every state-changing sim call and its result, console lines, timers, HTTP - is
 *     compared exactly (HTTP bodies of the files HQ2 changed: their path and status, not their bytes).
 * Each scenario is IDENTICAL or not; for one that is not, the first difference and the differing message types are reported, and
 * `expected` says which documented HQ2 change it is (the decision table in STAGE_3D_HQ2_AUDIT.md), from what the difference IS:
 *   lifecycle (D4)   NEW RUN's old channels: a client's fx vanish / b Vanish not relayed or stored; join or leave from alive refused
 *   collision (D1-D2) a position or a tp differs where two living players were within reach of each other, or a placement moved
 *   (anything else is UNEXPLAINED, and fails).  Exit 0 only when every scenario is identical or its difference is one of these. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const H0 = path.resolve(__dirname, '..', 'stage-3h0', 'golden'), HARNESS = path.join(H0, 'srv_harness.js');
const OLD = path.resolve(ARG.old), NEW = path.resolve(ARG.new);
const SCEN = ARG.scenarios ? ARG.scenarios.split(',') : Object.keys(require(path.join(H0, 'srv_scenarios.js')));
const tmp = ARG.keep ? path.resolve(ARG.keep) : fs.mkdtempSync(path.join(os.tmpdir(), 'gh2-')); fs.mkdirSync(tmp, { recursive: true });
const PURE = new Set(['sim.moveOk', 'sim.moveRoute', 'sim.clearAt', 'sim.blockersAt', 'sim.spawnOk', 'sim.canRespawn', 'sim.lifeOf', 'sim.nrWhy', 'sim.nrWait']);

function run(dir, scen, tag) {
  const out = path.join(tmp, `${scen}.${tag}.jsonl`);
  const r = spawnSync(process.execPath, [HARNESS, '--src', path.join(dir, 'server.js'), '--dir', dir, '--scenario', scen, '--out', out, '--struct', out + '.struct.json'], { encoding: 'utf8', timeout: 900000 });
  return { ok: r.status === 0, lines: fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n').filter(Boolean) : [], err: r.status === 0 ? '' : (r.stderr || r.stdout || '').slice(-400) };
}
function files(dir, rel = '') { let o = []; for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) { if (e.name === '.git' || e.name === 'node_modules' || (rel === '' && e.name === 'dev')) continue; const r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) o = o.concat(files(dir, r)); else o.push(r); } return o; }
const CHANGED = new Set([...new Set([...files(OLD), ...files(NEW)])].filter(f => { try { return !fs.readFileSync(path.join(OLD, f)).equals(fs.readFileSync(path.join(NEW, f))); } catch (e) { return true; } }));
const strip = m => { if (!m || typeof m !== 'object') return m; if (m.t === 's' || m.t === 'bodies') delete m.w; if (m.t === 'fx') delete m.wn; return m; };   // (H2-5: an fx's world is wn - its w, the Hound C wall, is compared)
function norm(lines) {
  const out = [];
  for (const line of lines) {
    let a; try { a = JSON.parse(line); } catch (e) { out.push(line); continue; }
    if (!Array.isArray(a)) { out.push(line); continue; }
    if (PURE.has(a[1])) continue;
    if ((a[1] === 'sim.join' || a[1] === 'sim.leave') && Array.isArray(a[2])) a[2] = a[2].slice(0, 1);   // (HQ1 passed the time, for the vanish window H2-1 removed; HQ2 does not)
    if (a[1] === 'sock.frame' && typeof a[5] === 'string') { let m = null; try { m = JSON.parse(a[5]); } catch (e) { } if (m) { a[5] = JSON.stringify(strip(m)); a[4] = '~len'; } out.push(JSON.stringify(a)); continue; }
    if (a[1] === 'http.end' && typeof a[3] === 'string' && CHANGED.has(a[3].split('?')[0].replace(/^\//, ''))) { out.push(JSON.stringify([a[0], a[1], a[2], a[3], '~', '~', a[6]])); continue; }
    out.push(JSON.stringify(a));
  }
  return out;
}
const msgOf = line => { try { const a = JSON.parse(line); if (Array.isArray(a) && a[1] === 'sock.frame') return JSON.parse(a[5]); } catch (e) { } return null; };
function deepDiff(x, y) {
  const out = []; let X, Y; try { X = JSON.parse(x); Y = JSON.parse(y); } catch (e) { return ['(not JSON)']; }
  const walk = (a, b, p) => { if (out.length >= 8) return; if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (typeof a === 'string' && typeof b === 'string' && a[0] === '{' && b[0] === '{') { try { return walk(JSON.parse(a), JSON.parse(b), p + '(json)'); } catch (e) { } }
    if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p + '/' + k); }
    else out.push(p + ': ' + String(JSON.stringify(a)).slice(0, 140) + ' -> ' + String(JSON.stringify(b)).slice(0, 140)); };
  walk(X, Y, ''); return out;
}
/* what the first difference IS (see the header) */
function explain(o, n, i) {
  const oa = (() => { try { return JSON.parse(o[i] || 'null'); } catch (e) { return null; } })(), na = (() => { try { return JSON.parse(n[i] || 'null'); } catch (e) { return null; } })();
  const om = msgOf(o[i] || ''), nm = msgOf(n[i] || '');
  const prevIn = (L, k) => { for (let j = i; j >= Math.max(0, i - k); j--) { const a = (() => { try { return JSON.parse(L[j]); } catch (e) { return null; } })(); if (a && a[1] === 'sock.in') return a; } return null; };
  const inp = prevIn(o, 40) || prevIn(n, 40), inMsg = inp && (() => { try { return JSON.parse(inp[3]); } catch (e) { return inp[3]; } })();
  if ((om && om.t === 'fx' && om.k === 'vanish') || (om && om.t === 'bodies' && (om.b || []).some(r => r.c === 'Vanish')) || (nm && nm.t === 'bodies' && (nm.b || []).some(r => r.c === 'Vanish'))) return { expected: 'lifecycle (D4/D5): a client\'s NEW RUN vanish (fx vanish / b Vanish) is no longer relayed or stored', at: { old: om, new: nm } };
  if (oa && na && oa[1] === na[1] && /^sim\.(join|leave)$/.test(oa[1]) && JSON.stringify(oa[3]) !== JSON.stringify(na[3])) return { expected: `lifecycle (D4): ${oa[1].slice(4)} from alive is refused in HQ2 (HQ1: ${JSON.stringify(oa[3])}, HQ2: ${JSON.stringify(na[3])})`, at: { old: oa, new: na } };
  if ((oa && oa[1] === 'sim.vanish') || (na && na[1] === 'sim.vanish')) return { expected: 'lifecycle (D4): HQ1 accepted a client\'s NEW RUN vanish (sim.vanish); HQ2 no longer reads it', at: { old: oa, new: na } };
  if (inMsg && typeof inMsg === 'object' && (inMsg.t === 'fx' || inMsg.t === 'b') && (inMsg.k === 'vanish' || inMsg.c === 'Vanish')) return { expected: 'lifecycle (D4/D5): what follows a client\'s vanish message (no longer read)', input: inMsg };
  if (om && nm && om.t === 'tp' && nm.t === 'tp') return { expected: 'collision (D2): the server put the player elsewhere (a free spot, or stopped short of another player)', at: { old: om, new: nm } };
  if (om && nm && om.t === 's' && nm.t === 's') { const d = deepDiff(JSON.stringify(om), JSON.stringify(nm)); if (d.every(x => /^\/p\/\d+\/(x|y)|^\/ad\/pl\/\d+\/(x|y)/.test(x))) return { expected: 'collision (D1-D2): a player\'s position differs (only x / y in the player lists)', where: d }; }
  return { expected: null };
}
const report = { tool: 'dev/stage-3d-hq2/golden_hq2.js', old: OLD, new: NEW, changedFiles: [...CHANGED].sort(), normalised: { dropped: [...PURE], fieldsTakenOut: 'w in s, bodies, fx' }, scenarios: {} };
let ok = true;
for (const s of SCEN) {
  const o = run(OLD, s, 'old'), n = run(NEW, s, 'new');
  const on = norm(o.lines), nn = norm(n.lines);
  let first = -1; for (let i = 0; i < Math.max(on.length, nn.length); i++) if (on[i] !== nn[i]) { first = i; break; }
  const R = { harnessOk: o.ok && n.ok, rawLines: [o.lines.length, n.lines.length], comparedLines: [on.length, nn.length], identical: first < 0 && o.ok && n.ok };
  if (!R.harnessOk) R.errors = [o.err, n.err];
  if (first >= 0) {
    const ex = explain(on, nn, first);
    R.firstDiff = { line: first, where: deepDiff(on[first] || 'null', nn[first] || 'null'), old: (on[first] || '').slice(0, 500), new: (nn[first] || '').slice(0, 500) };
    const types = {}; for (let i = first; i < Math.max(on.length, nn.length); i++) if (on[i] !== nn[i]) { const m = msgOf(on[i] || nn[i] || ''); let a = null; try { a = JSON.parse(on[i] || nn[i]); } catch (e) { } const k = m ? 'frame:' + m.t + (m.k ? ':' + m.k : '') : a ? String(a[1]) : '?'; types[k] = (types[k] || 0) + 1; }
    R.differingAfter = types; R.expected = ex.expected; R.explanation = ex;
    // the same events in the same order, whatever their coordinates? (each line's kind: a frame's type and k, a sim call's name, any other line's kind)
    const sig = L => L.map(l => { const m = msgOf(l); if (m) return 'frame:' + m.t + (m.k ? ':' + m.k : ''); try { const a = JSON.parse(l); return Array.isArray(a) ? String(a[1]) : '?'; } catch (e) { return '?'; } });
    const so = sig(on), sn = sig(nn); let fe = -1; for (let i = 0; i < Math.max(so.length, sn.length); i++) if (so[i] !== sn[i]) { fe = i; break; }
    R.sameEventSequence = fe < 0; if (fe >= 0) R.firstEventDifference = { index: fe, old: so[fe] || null, new: sn[fe] || null, oldLine: (on[fe] || '').slice(0, 300), newLine: (nn[fe] || '').slice(0, 300) };
    R.pass = R.harnessOk && !!ex.expected;
  } else R.pass = R.harnessOk;
  if (!R.pass) ok = false;
  report.scenarios[s] = R;
  console.log(`${s}: ${R.identical ? 'IDENTICAL' : 'differs from line ' + R.firstDiff.line + ': ' + (R.expected || 'UNEXPLAINED') + '  ' + JSON.stringify(R.firstDiff.where).slice(0, 200) + (R.sameEventSequence ? '  (the same events in the same order)' : '  (events differ from #' + R.firstEventDifference.index + ': ' + R.firstEventDifference.old + ' -> ' + R.firstEventDifference.new + ')')}`);
}
report.ok = ok;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(report, null, 1) + '\n');
if (!ARG.keep) fs.rmSync(tmp, { recursive: true, force: true });
console.log(ok ? 'GOLDEN HQ2: every scenario identical, or differing by a documented HQ2 change' : 'GOLDEN HQ2: FAIL');
process.exitCode = ok ? 0 : 1;
