/* Stage 3H2 (H2-0) - live wire trace on B++: the real server.js and the real game in Chromium, two players in one room, played through the
 * game's own buttons; every WebSocket frame each page sends and receives is recorded (CDP) and summarized per phase (development only).
 *
 *   node dev/stage-3h/golden/live_wire_h2.js --old-dir DIR [--new-dir DIR] [--out FILE.json] [--step-timeout 30000] [--shots DIR]
 *                                            [--variants old|new]   (one side only: a diagnostic run, never a result: exit 2)
 *                                            [--save-raw DIR]       (each side's frames, as recorded: DIR/old.json, DIR/new.json)
 *                                            [--reuse-old FILE]     (a B++ side recorded before with --save-raw, instead of running it again:
 *                                                                    for sensitivity runs against a broken copy; the gate never reuses)
 *                                            [--compare-raw OLD.json,NEW.json]   (no run: compare two recorded sides, e.g. A/A noise pairs)
 *
 * A 3H copy of Stage 3H0's live_wire.js (left unchanged), repaired for B++:
 *   - 3H0's script pressed END after a second NEW RUN inside the 30 s cooldown.  Since Stage 3D HQ2 NEW RUN is the server's decision: that
 *     press is refused (cooldown) and the run menu, where END lives, never opens, so the script waited for #runEnd forever (3H1 finding
 *     F-021).  Here the refused press is recorded as it is, the pause is closed, and A then turns on its admin UNLIMITED NEW RUN (nrfree), so
 *     a third NEW RUN is approved, the run menu opens and END is pressed;
 *   - every phase has a time limit (default 30 s): a phase that does not finish is an error (exit 2), never a wait without end; the error
 *     reports what both pages showed at that moment (and, with --shots, screenshots them);
 *   - the refused press's button text is read 800 ms after the press, while it still says why (3H0 read it after the 2.5 s it is shown);
 *   - the run fails when a side recorded no frame.
 * --old-dir is a complete game folder of the accepted B++ head (git archive 143b63f); --new-dir defaults to the working tree.  Each is served
 * by its own `node server.js PORT` (synthetic admin passcode), one after the other.  Timing is real (and slow: software rendering), so the
 * comparison is structural: per phase and page, which message types went each way, every key set seen for each type, the exact counts of
 * the scripted event messages, and who saw whom in the peer lists.
 *
 * Phases: both in the menu; setup (B, an admin, removes every monster and makes both players gods); B enters; A enters; A's NEW RUN
 * (approved) and SPAWN; A's second NEW RUN inside the cooldown (refused); A's UNLIMITED NEW RUN on, a third NEW RUN (approved); END to the
 * menu; A enters again; a death through the admin preview, then RESPAWN; the server stops and restarts (both reconnect). */
'use strict';
const fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const Q = require('../../stage-3c-qa2/qa2_lib.js'); const { sleep } = Q;
const ARG = { 'step-timeout': '30000' }; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const REPO = path.resolve(__dirname, '..', '..', '..');
const PASS = 'h0-synthetic-admin';
const STEP_MS = +ARG['step-timeout'];
/* the periodic traffic (counts depend on timing): poses, snapshots, B+'s fresher poses, pings */
const PERIODIC = new Set(['p', 's', 'q', 'ping', 'pong']);
function serve(dir, port) {
  const p = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }) });
  p.log = []; p.stdout.on('data', d => p.log.push(String(d))); p.stderr.on('data', d => p.log.push('ERR ' + String(d)));
  return p;
}
const stop = p => new Promise(r => { if (!p || p.exitCode !== null) return r(); p.once('exit', () => r()); try { process.kill(p.pid, 'SIGTERM'); } catch (e) { r(); } });
async function up(port) { for (let i = 0; i < 100; i++) { if (await Q.get(port, '/index.html') === 200) return true; await sleep(100); } return false; }
const withLimit = (name, pr) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(`phase ${name}: not finished in ${STEP_MS} ms`)), STEP_MS))]);
async function variant(dir, port, label) {
  let srv = serve(dir, port);
  if (!await up(port)) { await stop(srv); throw new Error(label + ': the server in ' + dir + ' did not start: ' + srv.log.join('').slice(0, 300)); }
  const b = await Q.browser();
  try {
    const room = 'h2live' + label;
    const frames = { A: [], B: [] };
    let phase = 'boot';
    /* (post-3H Trial 2) only the game's socket's frames: the page now also opens the main menu's lounge (/social), which is not the game's wire */
    const tap = who => async s => { const other = new Set(); await s.cdp.send('Network.enable'); s.cdp.on('Network.webSocketCreated', e => { if (!/\/ws(\?|$)/.test(e.url)) other.add(e.requestId); });
      s.cdp.on('Network.webSocketFrameSent', e => { if (!other.has(e.requestId)) frames[who].push([phase, 'tx', e.response.payloadData]); }); s.cdp.on('Network.webSocketFrameReceived', e => { if (!other.has(e.requestId)) frames[who].push([phase, 'rx', e.response.payloadData]); }); };
    const A = await Q.page(b, port, { room, viewport: { width: 1280, height: 720 }, before: tap('A') });
    const B = await Q.page(b, port, { room, viewport: { width: 1280, height: 720 }, before: tap('B') });
    const ids = {}, phaseIds = {}, log = [];
    const idOf = async s => s.P.evaluate(() => window.__wsTap && window.__wsTap.id);
    /* what each page shows and believes, for the report of a phase that failed */
    const state = s => s.P.evaluate(() => {
      const h = id => { const e = document.getElementById(id); return e ? e.hidden : null; }, X = window.__api;
      return { started: X && X.started ? X.started() : null, paused: X && X.paused ? X.paused() : null, caught: !!(X && X.G && X.G.caught),
        hidden: { menu: h('menu'), dialog: h('dialog'), runMenu: h('runMenu'), caught: h('caught'), won: h('won') }, reset: (document.getElementById('reset') || {}).textContent,
        focus: document.activeElement ? document.activeElement.id || document.activeElement.tagName : null, nr: window.__nrDebug ? window.__nrDebug() : null,
        online: !!(window.__net && window.__net.on), ws: window.__ws ? window.__ws.readyState : null };
    }).catch(e => ({ error: String(e).slice(0, 200) }));
    const step = async (name, fn, wait) => {
      phase = name; const t0 = Date.now();
      if (fn) try { await withLimit(name, fn()); } catch (e) {
        e.diag = { variant: label, phase: name, A: await state(A), B: await state(B), serverLog: srv.log.join('').split('\n').filter(Boolean).slice(-25) };
        if (ARG.shots) { fs.mkdirSync(ARG.shots, { recursive: true }); for (const [w, s] of [['A', A], ['B', B]]) await s.P.screenshot({ path: path.join(ARG.shots, `${label}_${name}_${w}.png`) }).catch(() => { }); }
        throw e;
      }
      await sleep(wait); phaseIds[name] = { A: await idOf(A), B: await idOf(B) };   // ids after the phase (a restarted server gives new ones)
      log.push([name, Date.now() - t0]);
    };
    const click = (s, sel) => s.P.click(sel, { timeout: STEP_MS - 2000 });
    const pause = async s => { await s.P.keyboard.press('Escape'); await sleep(600); };
    const nrBtn = s => s.P.evaluate(() => { const b = document.getElementById('reset'); return b ? b.textContent : null; });
    const shown = (s, id) => s.P.evaluate(i => { const e = document.getElementById(i); return !!e && !e.hidden; }, id);
    await step('menu', null, 3000);
    ids.A = await idOf(A); ids.B = await idOf(B);
    /* no chance in the world: B (an admin from here on) removes every monster and makes both players gods, so the only events are the
     * scripted ones */
    await step('setup', async () => {
      await B.P.evaluate(p => window.__net.testAuth(p), PASS); await sleep(1000);
      await B.P.evaluate(ids => { const tx = o => window.__ws.send(JSON.stringify(o)); tx({ t: 'a', c: 'hounds', mode: 'remove', n: 10 }); tx({ t: 'a', c: 'smilers', mode: 'remove', n: 10 });
        tx({ t: 'a', c: 'god', id: ids.A }); tx({ t: 'a', c: 'god', id: ids.B }); }, ids);
    }, 2000);
    await step('B_enters', () => Q.start(B.P, 'OBS-B'), 4000);
    await step('A_enters', () => Q.start(A.P, 'RUN-A'), 4000);
    await step('A_new_run', async () => { await pause(A); await click(A, '#reset'); }, 5000);
    const menuAfterFirst = await shown(A, 'runMenu');
    await step('A_spawn', () => click(A, '#runSpawn'), 4000);
    /* the refusal is read 800 ms after the press (the button says why for 2.5 s, then goes back to NEW RUN); the seconds left are timing,
     * so its digits become N */
    let refusedLabel = null;
    await step('A_new_run_again', async () => { await pause(A); await click(A, '#reset'); await sleep(800); refusedLabel = String(await nrBtn(A)).replace(/\d+/g, 'N'); }, 2200);
    const menuAfterRefused = await shown(A, 'runMenu');
    await step('A_close_pause', () => A.P.keyboard.press('Escape'), 1500);
    await step('A_unlimited', async () => {
      await A.P.evaluate(p => window.__net.testAuth(p), PASS); await sleep(800);
      await A.P.evaluate(() => window.__ws.send(JSON.stringify({ t: 'a', c: 'nrfree', on: 1 })));
    }, 1500);
    await step('A_new_run_admin', async () => { await pause(A); await click(A, '#reset'); }, 5000);
    const menuAfterAdmin = await shown(A, 'runMenu');
    await step('A_end', () => click(A, '#runEnd'), 4000);
    await step('A_enters_again', () => Q.start(A.P, 'RUN-A'), 4000);
    await step('A_admin_death', async () => {
      await A.P.evaluate(() => { window.__ws.send(JSON.stringify({ t: 'a', c: 'near', k: 'hound' })); });
      await sleep(800);
      await A.P.evaluate(() => window.__ws && window.__ws.send(JSON.stringify({ t: 'a', c: 'preview', k: 'hound', var: 'A' })));
    }, 14000);
    await step('A_respawn', async () => { const vis = await A.P.evaluate(() => !document.getElementById('caught').hidden); if (vis) await click(A, '#retry'); else await A.P.evaluate(() => document.getElementById('retry').click()); }, 4000);
    await step('server_down', async () => { await stop(srv); }, 1500);
    await step('server_restart', async () => { srv = serve(dir, port); if (!await up(port)) throw new Error('restart failed'); }, 7000);
    phase = 'done';
    const errs = { A: A.errs.slice(), B: B.errs.slice() };
    return { frames, ids, phaseIds, errs, log, ui: { menuAfterFirst, refusedLabel, menuAfterRefused, menuAfterAdmin }, serverLog: srv.log.join('').split('\n').filter(Boolean) };
  } finally { await b.close().catch(() => { }); await stop(srv); }
}
/* The comparison is structural (3H0's rule, kept), because the live game runs on real time and two runs of the SAME build differ in timing
 * races the protocol allows:
 *   - the scripted session and event messages must match in number; other types only in presence;
 *   - key sets ignore the fields whose presence is a timing race: which wake a snapshot falls on (s.mk, ad, you, nf, dbg, dx), a late
 *     joiner's elapsed time (fx.el), a soft correction (tp.pc);
 *   - the outage phases (server_down, server_restart) compare presence only, counts never: reconnect timing varies (3H0 H0-5). */
const EXACT = new Set(['join', 'leave', 'respawn', 'admin', 'a', 'kick', 'revive', 'exit', 'nr', 'nra', 'nrf']);
const RACY = { s: ['mk', 'ad', 'you', 'nf', 'dbg', 'dx'], fx: ['el'], tp: ['pc'] };
/* Stage 3H2: two races of B+ that 3H0's rule (written before B+) did not know, found by this tool's own B++ A/A run (both sides the same
 * game: 9 differences, all of them these two):
 *   - 'q' (B+'s fresher poses) is sent only on a tick between two snapshots on which a peer's pose has changed.  In this script nobody
 *     walks: a pose changes only at a spawn, a teleport or a rejoin, and each of those falls between snapshots or on one by chance (in
 *     one B++ recording of six, the only 'q' of the whole run came after the server restart).  So whether 'q' is seen at all is timing:
 *     its key sets are compared over the whole run and both pages together ('run|*|rx'), when both runs saw one; its presence is not.
 *     (bpp_caps_q pins 'q' exactly; a client that stops asking for caps is caught here by the caps messages themselves);
 *   - the first snapshots after a (re)connect may come before the caps answer, and only snapshots after it carry k: s.k is a race in
 *     the phases where caps is asked (boot, server_restart).  The goldens pin both exactly (bpp_caps_q, protocol_bpp.json). */
const SPARSE = new Set(['q']);
const RACY_IN = { boot: { s: ['k'] }, server_restart: { s: ['k'] } };
/* 3H0's outage rule (counts never compared while the server stops and restarts) did not go far enough on this machine: the pages draw
 * at about 2 frames a second under software rendering, so each sends a pose about every 0.5 s, and whether one falls between the
 * server's stop and the page noticing the closed socket is timing (B sent 1 or 2 poses there in six B++ recordings, none in a seventh).
 * In the outage phases the periodic traffic ('p', 's', 'q', ping / pong) is left out altogether; the session messages (hi, caps,
 * join, admin, bodies, ...) are still compared, in presence. */
const OUTAGE = new Set(['server_down', 'server_restart']);
function summarize(v) {
  const out = {};
  for (const who of ['A', 'B']) {
    for (const [ph, dir, data] of v.frames[who]) {
      if (ph === 'done') continue;                                          // frames after the scripted session, while the browser closes
      const ids = v.phaseIds[ph] || v.ids, label = id => id === ids.A ? 'A' : id === ids.B ? 'B' : id == null ? 'none' : 'other';
      let m; try { m = JSON.parse(data); } catch (e) { m = { t: '~unparsed' }; }
      const t = m.t || '~none';
      if (OUTAGE.has(ph) && PERIODIC.has(t) && !SPARSE.has(t)) continue;
      const k = SPARSE.has(t) ? `run|*|${dir}` : `${ph}|${who}|${dir}`; const o = out[k] = out[k] || { types: {}, keys: {}, peersSeen: [] };
      o.types[t] = (o.types[t] || 0) + 1;
      const racy = (RACY[t] || []).concat((RACY_IN[ph] || {})[t] || []);
      const ks = Object.keys(m).filter(x => !racy.includes(x)).join(','); o.keys[t] = o.keys[t] || []; if (!o.keys[t].includes(ks)) o.keys[t].push(ks);
      if (t === 's' && Array.isArray(m.p)) for (const p of m.p) { const l = label(p.id); if (!o.peersSeen.includes(l)) o.peersSeen.push(l); }
    }
  }
  for (const [k, o] of Object.entries(out)) {
    const outage = OUTAGE.has(k.split('|')[0]);
    o.events = Object.fromEntries(Object.entries(o.types).filter(([t]) => !PERIODIC.has(t)).sort(([a], [b]) => a < b ? -1 : 1).map(([t, n]) => [t, EXACT.has(t) && !outage ? n : 'present']));
    o.periodic = Object.keys(o.types).filter(t => PERIODIC.has(t)).sort();
    o.keys = Object.fromEntries(Object.keys(o.keys).sort().map(t => [t, o.keys[t].sort()])); o.peersSeen.sort(); delete o.types;
  }
  return out;
}
(async () => {
  if (!ARG['old-dir'] && !ARG['compare-raw']) throw new Error('--old-dir is required (a complete B++ game folder)');
  const res = {}, want = String(ARG.variants || 'old,new').split(',');
  for (const [label, dir, port] of [['old', path.resolve(ARG['old-dir'] || '.'), 8621], ['new', path.resolve(ARG['new-dir'] || REPO), 8622]]) {
    if (!want.includes(label)) continue;
    const raw = ARG['compare-raw'] ? ARG['compare-raw'].split(',')[label === 'old' ? 0 : 1] : label === 'old' ? ARG['reuse-old'] : null, reuse = !!raw;
    const t0 = Date.now(); const v = reuse ? JSON.parse(fs.readFileSync(raw, 'utf8')) : await variant(dir, port, label);
    if (!reuse) v.ms = Date.now() - t0;
    if (reuse) console.log(`${label}: the recorded run ${raw} (game ${v.dir})`);
    if (ARG['save-raw'] && !reuse) { fs.mkdirSync(ARG['save-raw'], { recursive: true }); fs.writeFileSync(path.join(ARG['save-raw'], label + '.json'), JSON.stringify(Object.assign({ dir }, v))); }
    res[label] = { dir: reuse ? v.dir : dir, reused: reuse ? raw : undefined, ms: reuse ? v.ms : Date.now() - t0, ids: v.ids, errors: v.errs, phases: v.log, ui: v.ui, serverLog: v.serverLog.filter(l => !/The Far Backrooms →/.test(l)), summary: summarize(v), frames: { A: v.frames.A.length, B: v.frames.B.length } };
    console.log(`${label}: ${res[label].frames.A} + ${res[label].frames.B} frames in ${res[label].ms} ms; errors A ${v.errs.A.length} B ${v.errs.B.length}; ui ${JSON.stringify(v.ui)}`);
  }
  if (want.length < 2) { if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify({ tool: 'dev/stage-3h/golden/live_wire_h2.js', single: want[0], run: res[want[0]] }, null, 1) + '\n'); console.log('LIVE WIRE: one variant only (no comparison)'); process.exitCode = 2; return; }
  const keys = [...new Set(Object.keys(res.old.summary).concat(Object.keys(res.new.summary)))].sort();
  const diffs = [];
  for (const k of keys) {
    const a = res.old.summary[k] || null, n = res.new.summary[k] || null;
    if (k.startsWith('run|')) { if (a && n && JSON.stringify(a.keys) !== JSON.stringify(n.keys)) diffs.push({ at: k, field: 'keys', old: JSON.stringify(a.keys), new: JSON.stringify(n.keys) }); continue; }   // (SPARSE: key sets only, when both saw it)
    for (const f of ['events', 'periodic', 'keys', 'peersSeen']) { const x = JSON.stringify(a && a[f]), y = JSON.stringify(n && n[f]); if (x !== y) diffs.push({ at: k, field: f, old: x, new: y }); }
  }
  // (post-Trial 4 review: Trial 4 renamed the button "Spontaneously Combust?", an authorized change of its words only; that one label is
  // read as B++'s NEW RUN, and what follows it - the refusal's words - and every menu state are still compared)
  const asBpp = ui => Object.assign({}, ui, { refusedLabel: typeof ui.refusedLabel === 'string' ? ui.refusedLabel.replace(/^Spontaneously Combust\?(?= · |$)/, 'NEW RUN') : ui.refusedLabel });
  if (JSON.stringify(asBpp(res.old.ui)) !== JSON.stringify(asBpp(res.new.ui))) diffs.push({ at: 'ui', field: 'NEW RUN button and run menu', old: JSON.stringify(res.old.ui), new: JSON.stringify(res.new.ui) });
  const empty = ['old', 'new'].filter(l => !res[l].frames.A || !res[l].frames.B);
  const ok = !diffs.length && !empty.length;
  const report = { tool: 'dev/stage-3h/golden/live_wire_h2.js', comparedAt: new Date().toISOString(), phases: keys, structurallyIdentical: !diffs.length, emptySides: empty, ok, diffs, old: res.old, new: res.new };
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(report, null, 1) + '\n');
  console.log(diffs.length ? `STRUCTURAL DIFFERENCES: ${diffs.length}\n` + diffs.slice(0, 12).map(d => `  ${d.at} ${d.field}\n    old ${String(d.old).slice(0, 220)}\n    new ${String(d.new).slice(0, 220)}`).join('\n') : 'live wire: structurally identical in every phase');
  if (empty.length) console.log('FAIL: no frames recorded on ' + empty.join(', '));
  console.log('LIVE WIRE: ' + (ok ? 'PASS' : 'FAIL'));
  process.exitCode = ok ? 0 : 1;
})().catch(e => {
  console.error('ERROR', e && e.stack || e);
  if (e && e.diag) { console.error('STATE WHEN THE PHASE FAILED ' + JSON.stringify(e.diag, null, 1)); if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify({ tool: 'dev/stage-3h/golden/live_wire_h2.js', ok: false, error: String(e.message || e), diag: e.diag }, null, 1) + '\n'); }
  console.log('LIVE WIRE: ERROR'); process.exitCode = 2;
});
