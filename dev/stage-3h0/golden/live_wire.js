/* Stage 3H0 - live wire trace: the real server.js and the real game in Chromium, two players in one room, played through the game's own
 * buttons; every WebSocket frame each page sends and receives is recorded (CDP) and summarized per phase (development only).
 *
 *   node dev/stage-3h0/golden/live_wire.js --old-dir DIR [--new-dir DIR] [--out FILE.json]
 *
 * --old-dir is a checkout of the accepted parent (git archive edd2af9); --new-dir defaults to the working tree.  Each is served by its own
 * `node server.js PORT` (synthetic admin passcode), one after the other.  Timing here is real (and slow: software rendering), so the
 * comparison is structural, not byte for byte: per phase and page, which message types went each way, every key set seen for each type, the
 * exact counts of the event messages (everything but the periodic p / s / ping / pong), and who saw whom in the peer lists.
 *
 * Phases: both in the menu; B enters; A enters; A's NEW RUN (vanish) and SPAWN; a second NEW RUN inside the 30 s cooldown (the known,
 * deferred mismatch: recorded as it is); END to the menu; A enters again; a death through the admin preview, then RESPAWN; the server
 * restarts (both reconnect). */
'use strict';
const fs = require('fs'), path = require('path');
const { spawn, execSync } = require('child_process');
const Q = require('../../stage-3c-qa2/qa2_lib.js'); const { sleep } = Q;
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..');
const PASS = 'h0-synthetic-admin';
const PERIODIC = new Set(['p', 's', 'ping', 'pong']);
function serve(dir, port) {
  try { execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' }); } catch (e) { }
  const p = spawn('node', ['server.js', String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }) });
  p.log = []; p.stdout.on('data', d => p.log.push(String(d))); p.stderr.on('data', d => p.log.push('ERR ' + String(d)));
  return p;
}
async function up(port) { for (let i = 0; i < 100; i++) { if (await Q.get(port, '/index.html') === 200) return true; await sleep(100); } return false; }
async function variant(dir, port, label) {
  let srv = serve(dir, port); await up(port);
  const b = await Q.browser();
  const room = 'h0live' + label;
  const frames = { A: [], B: [] };
  let phase = 'boot';
  const tap = who => async s => { await s.cdp.send('Network.enable'); s.cdp.on('Network.webSocketFrameSent', e => frames[who].push([phase, 'tx', e.response.payloadData])); s.cdp.on('Network.webSocketFrameReceived', e => frames[who].push([phase, 'rx', e.response.payloadData])); };
  const A = await Q.page(b, port, { room, viewport: { width: 1280, height: 720 }, before: tap('A') });
  const B = await Q.page(b, port, { room, viewport: { width: 1280, height: 720 }, before: tap('B') });
  const ids = {};
  const idOf = async s => s.P.evaluate(() => window.__wsTap && window.__wsTap.id);
  const phaseIds = {};
  const step = async (name, fn, wait) => { phase = name; if (fn) await fn(); await sleep(wait); phaseIds[name] = { A: await idOf(A), B: await idOf(B) }; };   // ids after the phase (a restarted server gives new ones)
  await step('menu', null, 3000);
  ids.A = await idOf(A); ids.B = await idOf(B);
  /* no chance in the world: B (an admin from here on) removes every monster and makes both players gods, so the only events are the scripted
   * ones (a real hound killing one of them in one run and not the other would make two identical builds look different) */
  await step('setup', async () => {
    await B.P.evaluate(p => window.__net.testAuth(p), PASS); await sleep(1000);
    await B.P.evaluate(ids => { const tx = o => window.__ws.send(JSON.stringify(o)); tx({ t: 'a', c: 'hounds', mode: 'remove', n: 10 }); tx({ t: 'a', c: 'smilers', mode: 'remove', n: 10 });
      tx({ t: 'a', c: 'god', id: ids.A }); tx({ t: 'a', c: 'god', id: ids.B }); }, ids);
  }, 2000);
  await step('B_enters', () => Q.start(B.P, 'OBS-B'), 4000);
  await step('A_enters', () => Q.start(A.P, 'RUN-A'), 4000);
  const pause = async s => { await s.P.keyboard.press('Escape'); await sleep(600); };
  await step('A_new_run', async () => { await pause(A); await A.P.click('#reset'); }, 5000);
  await step('A_spawn', () => A.P.click('#runSpawn'), 4000);
  await step('A_new_run_again', async () => { await pause(A); await A.P.click('#reset'); }, 5000);
  await step('A_end', () => A.P.click('#runEnd'), 4000);
  await step('A_enters_again', () => Q.start(A.P, 'RUN-A'), 4000);
  await step('A_admin_death', async () => {
    await A.P.evaluate(p => window.__net.testAuth(p), PASS); await sleep(800);
    await A.P.evaluate(() => { window.__ws.send(JSON.stringify({ t: 'a', c: 'near', k: 'hound' })); });
    await sleep(800);
    await A.P.evaluate(() => window.__ws && window.__ws.send(JSON.stringify({ t: 'a', c: 'preview', k: 'hound', var: 'A' })));
  }, 14000);
  await step('A_respawn', async () => { const vis = await A.P.evaluate(() => !document.getElementById('caught').hidden); if (vis) await A.P.click('#retry'); else await A.P.evaluate(() => document.getElementById('retry').click()); }, 4000);
  await step('server_down', async () => { srv.kill('SIGTERM'); }, 1500);
  await step('server_restart', async () => { srv = serve(dir, port); await up(port); }, 7000);
  phase = 'done';
  const errs = { A: A.errs.slice(), B: B.errs.slice() };
  await b.close(); srv.kill('SIGTERM');
  return { frames, ids, phaseIds, errs, serverLog: srv.log.join('').split('\n').filter(Boolean) };
}
/* The comparison is structural and its tolerances were fixed before any extraction (3H0_H0_1_BASELINE.md), because the live game runs on
 * real time and two runs of the SAME build differ in timing races the protocol allows:
 *   - session messages (join, leave, respawn, admin, a, kick, revive, exit) must match in number; other event types only in presence;
 *   - key sets ignore the fields whose presence is a timing race: s.mk / s.ad / s.you / s.dbg / s.dx (which wake a snapshot falls on) and
 *     fx.srv (whether the victim's own replay beat the server's 1.5 s fallback under software rendering);
 *   - tp counts are not compared (a movement correction depends on frame timing); its presence is.
 * The byte-exact gate is the deterministic harnesses; this layer shows the real bundle, mp.js and server.js still play the same session. */
const EXACT = new Set(['join', 'leave', 'respawn', 'admin', 'a', 'kick', 'revive', 'exit']);
const RACY = { s: ['mk', 'ad', 'you', 'dbg', 'dx'], fx: ['srv'] };
function summarize(v) {
  const out = {};
  for (const who of ['A', 'B']) {
    for (const [ph, dir, data] of v.frames[who]) {
      if (ph === 'done') continue;                                          // frames after the scripted session, while the browser closes
      const ids = v.phaseIds[ph] || v.ids, label = id => id === ids.A ? 'A' : id === ids.B ? 'B' : id == null ? 'none' : 'other';
      let m; try { m = JSON.parse(data); } catch (e) { m = { t: '~unparsed' }; }
      const k = `${ph}|${who}|${dir}`; const o = out[k] = out[k] || { types: {}, keys: {}, peersSeen: [] };
      const t = m.t || '~none';
      o.types[t] = (o.types[t] || 0) + 1;
      const ks = Object.keys(m).filter(x => !(RACY[t] || []).includes(x)).join(','); o.keys[t] = o.keys[t] || []; if (!o.keys[t].includes(ks)) o.keys[t].push(ks);
      if (t === 's' && Array.isArray(m.p)) for (const p of m.p) { const l = label(p.id); if (!o.peersSeen.includes(l)) o.peersSeen.push(l); }
    }
  }
  for (const o of Object.values(out)) {
    o.events = Object.fromEntries(Object.entries(o.types).filter(([t]) => !PERIODIC.has(t)).sort(([a], [b]) => a < b ? -1 : 1).map(([t, n]) => [t, EXACT.has(t) ? n : 'present']));
    o.periodic = Object.keys(o.types).filter(t => PERIODIC.has(t)).sort();
    o.keys = Object.fromEntries(Object.keys(o.keys).sort().map(t => [t, o.keys[t].sort()])); o.peersSeen.sort(); delete o.types;
  }
  return out;
}
(async () => {
  const res = {};
  for (const [label, dir, port] of [['old', path.resolve(ARG['old-dir']), 8611], ['new', path.resolve(ARG['new-dir'] || REPO), 8612]]) {
    const t0 = Date.now(); const v = await variant(dir, port, label);
    res[label] = { dir, ms: Date.now() - t0, ids: v.ids, errors: v.errs, serverLog: v.serverLog.filter(l => !/The Far Backrooms →/.test(l)), summary: summarize(v), frames: { A: v.frames.A.length, B: v.frames.B.length } };
    console.log(`${label}: ${res[label].frames.A} + ${res[label].frames.B} frames in ${res[label].ms} ms; errors A ${v.errs.A.length} B ${v.errs.B.length}`);
  }
  const keys = [...new Set(Object.keys(res.old.summary).concat(Object.keys(res.new.summary)))].sort();
  const diffs = [];
  for (const k of keys) {
    const a = res.old.summary[k] || null, n = res.new.summary[k] || null;
    for (const f of ['events', 'periodic', 'keys', 'peersSeen']) { const x = JSON.stringify(a && a[f]), y = JSON.stringify(n && n[f]); if (x !== y) diffs.push({ at: k, field: f, old: x, new: y }); }
  }
  const report = { tool: 'dev/stage-3h0/golden/live_wire.js', comparedAt: new Date().toISOString(), phases: keys, structurallyIdentical: !diffs.length, diffs, old: res.old, new: res.new };
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(report, null, 1) + '\n');
  console.log(diffs.length ? `STRUCTURAL DIFFERENCES: ${diffs.length}\n` + diffs.slice(0, 12).map(d => `  ${d.at} ${d.field}\n    old ${String(d.old).slice(0, 220)}\n    new ${String(d.new).slice(0, 220)}`).join('\n') : 'live wire: structurally identical in every phase');
  for (const k of keys) { const o = res.new.summary[k]; console.log(`  ${k}: events ${JSON.stringify(o && o.events)} periodic ${JSON.stringify(o && o.periodic)} peers ${JSON.stringify(o && o.peersSeen)}`); }
  process.exitCode = diffs.length ? 1 : 0;
})().catch(e => { console.error('ERROR', e && e.stack || e); process.exitCode = 2; });
