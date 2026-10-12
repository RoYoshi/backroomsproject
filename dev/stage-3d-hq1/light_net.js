/* Stage 3D HQ1 - the dying light on the wire: the server's profile, where it goes and what nobody else can set (development only)
 *
 *   node dev/stage-3d-hq1/light_net.js --game DIR [--out FILE.json]
 *
 * The real server.js (synthetic admin passcode), WebSocket clients only.  A victim dies again and again through the admin death preview
 * with its light in different states; an observer watches.  Checks (STAGE_3D_HQ1_AUDIT.md gates L2, L3, L6, L7):
 *   H1 a lit flashlight: the victim's kill record (mk), the observer's replay (fx) and the corpse carry the same profile lf =
 *      [hold 3-7, fade 1-2, seed]; the corpse adds the release time relative to its making, equal to the server physics' own
 *      (death_srv run again here on the same record) within 1 ms
 *   H2 a lantern and a headlamp the same; the headlamp's release is the death's start (its 4th number = - the death's length)
 *   H3 a light that was off, and a camcorder: no lf anywhere
 *   H4 the profile is the server's: forged client messages carrying an lf (a death replay, a corpse, a NEW RUN record with lf) change
 *      nothing; the NEW RUN record never has one
 *   H5 one death, one profile: the same death id gives the same profile to every client; different deaths differ
 *   H6 sizes: the replay under 400 B, the corpse record (with lf) within D7's 384 B + 32
 *   H7 corpse ages come in tenths of a second
 * Exit 0 only if every check passes. */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || path.join(__dirname, '..', '..')), PASS = 'd3-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = []; const check = (name, ok, note) => { R.push({ name, ok: !!ok, note }); console.log((ok ? 'PASS ' : 'FAIL ') + name + '\n       ' + note); };
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const DS = require(path.join(GAME, 'death_srv.js')), sim = require(path.join(GAME, 'sim.js'))({ seed: 1 });
let PORT = 0;
async function client(room, name, admin) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws?room=${room}`), c = { ws, name, id: 0, mks: [], fx: [], bodies: null, bodyMsgs: [], kind: 'flashlight', l: 1 };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t === 'hi') c.id = m.id; else if (m.t === 's') { if (m.mk) c.mks.push({ at: Date.now(), mk: m.mk }); }
    else if (m.t === 'fx') c.fx.push(Object.assign({ at: Date.now(), bytes: Buffer.byteLength(ev.data) }, m)); else if (m.t === 'bodies') { c.bodies = m.b; c.bodyMsgs.push({ at: Date.now(), b: m.b, bytes: Buffer.byteLength(ev.data) }); } };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.tx = o => ws.readyState === 1 && ws.send(typeof o === 'string' ? o : JSON.stringify(o));
  c.pos = (x, y) => c.tx({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a: 0, r: 0, l: c.l, k: c.kind, n: name, c: '#ffe7b2', lk: 'none|plain|#e6bb76|#ffcc77|none', mv: { s: 0, st: 100, ex: 0, sp: 0, ev: [] } });
  await sleep(150); c.tx({ t: 'join' }); await sleep(250);
  if (admin) { c.tx({ t: 'admin', pass: PASS }); await sleep(200); }
  return c;
}
const LY = 3504;
async function place(c, x) { c.pos(x, LY); await sleep(150); c.pos(x, LY); await sleep(300); }
async function until(f, ms = 9000) { const t = Date.now(); while (Date.now() - t < ms) { const v = f(); if (v) return v; await sleep(40); } return null; }
const durOf = mk => DS.durOf(mk);
/* the server's own physical run, again, from the record the victim got */
function expectedRel(mk, kind) {
  if (kind === 'headlamp') return -durOf(mk);
  const info = { name: 'VIC', look: 'none|plain|#e6bb76|#ffcc77|none', ek: kind, ec: '#ffe7b2', ep: '', vx: mk.vx, vy: mk.vy, ex: mk.ex, light: true };
  const P = DS.begin(mk, info, sim), R2 = DS.DP.finish(P); return +((!(R2.S.eqAt >= 0) || info.ek === "headlamp" ? 0 : R2.S.eqAt) - R2.dur).toFixed(3);
}

(async () => {
  PORT = await freePort();
  const env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL;
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  await sleep(1200);
  const out = { tool: 'dev/stage-3d-hq1/light_net.js', game: GAME, checks: R, deaths: [] };
  try {
    const room = 'ln' + PORT;
    const O = await client(room, 'OBS', true); O.tx({ t: 'a', c: 'god', id: O.id }); O.l = 0; await place(O, 4700);
    const V = await client(room, 'VIC', true); V.tx({ t: 'a', c: 'god', id: V.id }); await place(V, 5000);
    async function die(kind, lit, v = 'A') {
      V.kind = kind; V.l = lit ? 1 : 0; await place(V, 5000); await sleep(300);
      const n0 = V.mks.length, f0 = O.fx.length, b0 = O.bodyMsgs.length;
      V.tx({ t: 'a', c: 'preview', k: 'hound', var: v });
      const k = await until(() => V.mks.length > n0 && V.mks[V.mks.length - 1], 8000); const mk = k && k.mk;
      const fx = await until(() => O.fx.slice(f0).find(f => f.k === 'death' && f.id === V.id), 4000);
      const body = mk && await until(() => (O.bodies || []).find(b => b.k === V.id && b.de === mk.de), durOf(mk) * 1000 + 3000);
      const msg = body && O.bodyMsgs.slice(b0).find(m => m.b.some(b => b.k === V.id && b.de === mk.de));
      V.tx({ t: 'a', c: 'revive', id: V.id }); await sleep(900);
      const d = { kind, lit, mk, fx: fx ? Object.assign({}, fx) : null, body, corpseBytes: body ? Buffer.byteLength(JSON.stringify(body)) : null, expectedRel: mk && lit && kind !== 'camcorder' ? expectedRel(mk, kind) : null, msgAg: msg ? msg.b.find(b => b.k === V.id).ag : null };
      out.deaths.push(d); return d;
    }
    const F = await die('flashlight', true);
    check('H1 a lit flashlight: the same profile on the kill record, the replay and the corpse; the corpse\'s release equals the server physics\'',
      F.mk && Array.isArray(F.mk.lf) && F.fx && JSON.stringify(F.fx.lf) === JSON.stringify(F.mk.lf) && F.body && Array.isArray(F.body.lf) && F.body.lf.length === 4
        && JSON.stringify(F.body.lf.slice(0, 3)) === JSON.stringify(F.mk.lf) && F.mk.lf[0] >= 3 && F.mk.lf[0] <= 7 && F.mk.lf[1] >= 1 && F.mk.lf[1] <= 2 && Math.abs(F.body.lf[3] - F.expectedRel) <= .001,
      `mk ${JSON.stringify(F.mk && F.mk.lf)} fx ${JSON.stringify(F.fx && F.fx.lf)} corpse ${JSON.stringify(F.body && F.body.lf)} expected release ${F.expectedRel}`);
    const La = await die('lantern', true), Hd = await die('headlamp', true);
    check('H2 a lantern and a headlamp likewise; the headlamp\'s light starts with the death (release = - the death\'s length)',
      [La, Hd].every(d => d.mk && Array.isArray(d.mk.lf) && d.fx && JSON.stringify(d.fx.lf) === JSON.stringify(d.mk.lf) && d.body && d.body.lf && Math.abs(d.body.lf[3] - d.expectedRel) <= .001) && Math.abs(Hd.body.lf[3] + durOf(Hd.mk)) <= .001,
      `lantern ${JSON.stringify(La.body && La.body.lf)} (expected ${La.expectedRel}); headlamp ${JSON.stringify(Hd.body && Hd.body.lf)} (expected ${Hd.expectedRel})`);
    const Off = await die('flashlight', false), Cam = await die('camcorder', true);
    check('H3 a light that was off, and a camcorder: no profile anywhere', [Off, Cam].every(d => d.mk && !('lf' in d.mk) && d.fx && !('lf' in d.fx) && d.body && !('lf' in d.body)),
      `off: mk ${JSON.stringify(Off.mk && Off.mk.lf)} fx ${JSON.stringify(Off.fx && Off.fx.lf)} corpse ${JSON.stringify(Off.body && Off.body.lf)}; camcorder: mk ${JSON.stringify(Cam.mk && Cam.mk.lf)} corpse ${JSON.stringify(Cam.body && Cam.body.lf)}`);
    // H4: forged messages
    V.kind = 'flashlight'; V.l = 1; await place(V, 5000);
    const f0 = O.fx.length, bodies0 = JSON.stringify(O.bodies);
    V.tx({ t: 'fx', k: 'death', c: 'Hound', x: 5000, y: LY, a: 0, sx: 4950, sy: LY, v: 'A', w: 0, lf: [99, 99, 1], de: 999 });
    V.tx({ t: 'b', c: 'Hound', n: 'VIC', x: 5000, y: LY, a: 0, sx: 1, sy: 1, aa: 0, bl: [], dr: [5000, LY, 0], ht: [5000, LY, 0], ph: 1, lo: 1, lf: [99, 99, 1, 0] });
    await sleep(1200); const forgedFx = O.fx.slice(f0).filter(f => f.k === 'death');
    V.tx({ t: 'b', c: 'Vanish', n: 'VIC', x: 5000, y: LY, a: 0, sx: 1, sy: 1, aa: 0, bl: [], dr: [5010, LY, 0], ht: [5000, LY, 0], lo: 1, lf: [99, 99, 1, 0] });
    const van = await until(() => (O.bodies || []).find(b => b.k === V.id && b.c === 'Vanish'), 3000);
    check('H4 the profile is the server\'s: a forged replay or corpse with lf changes nothing; the NEW RUN record carries none',
      !forgedFx.length && (!van || !('lf' in van)) && !(O.bodies || []).some(b => b.lf && b.lf[0] === 99),
      `forged replays relayed: ${forgedFx.length}; NEW RUN record ${van ? JSON.stringify(van).slice(0, 160) : 'none'}; bodies before ${bodies0 === JSON.stringify(O.bodies) ? 'unchanged' : 'changed'}`);
    // H5: one death, one profile; different deaths differ; the profile function over 1,000 deaths
    const lfs = [F, La, Hd].map(d => JSON.stringify(d.mk.lf));
    const DP = DS.DP, hs = new Set(), fs2 = new Set(); let bad = 0;
    for (let de = 1; de <= 1000; de++) for (const k of ['flashlight', 'lantern', 'headlamp']) { const p = DP.lightProfile(1, de, k); if (!(p[0] >= 3 && p[0] <= 7 && p[1] >= 1 && p[1] <= 2)) bad++; hs.add(p[0]); fs2.add(p[1]); if (JSON.stringify(p) !== JSON.stringify(DP.lightProfile(1, de, k))) bad++; }
    check('H5 one profile per death (every client the same), different deaths different; over 1,000 deaths hold covers 3-7 and fade 1-2 in tenths',
      new Set(lfs).size === 3 && !bad && hs.size === 41 && fs2.size === 11 && DP.lightProfile(1, 1, 'camcorder') === null,
      `profiles ${lfs.join(' ')}; holds ${hs.size} values ${Math.min(...hs)}-${Math.max(...hs)}, fades ${fs2.size} values; out of range or not repeatable: ${bad}`);
    check('H6 sizes: the replay under 400 B; a corpse record with its light profile within D7\'s 384 B + 32', F.fx && F.fx.bytes < 400 && F.corpseBytes > 0 && F.corpseBytes <= 416,
      `replay ${F.fx && F.fx.bytes} B; corpse ${F.corpseBytes} B (no light: ${Off.corpseBytes} B)`);
    await sleep(1500); const m2 = O.bodyMsgs[O.bodyMsgs.length - 1];
    check('H7 corpse ages in tenths of a second', out.deaths.every(d => d.msgAg == null || Math.abs(d.msgAg * 10 - Math.round(d.msgAg * 10)) < 1e-9) && m2 && m2.b.every(b => Math.abs(b.ag * 10 - Math.round(b.ag * 10)) < 1e-9),
      `ages: ${JSON.stringify(m2 ? m2.b.map(b => b.ag) : null)}`);
    check('H8 no server errors', !/Error|failed/.test(log), log.split('\n').filter(l => /Error|failed/.test(l)).slice(0, 3).join(' | ') || 'none');
  } finally { srv.kill(); }
  out.ok = R.length >= 8 && R.every(c => c.ok);
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
  console.log(`${R.filter(c => c.ok).length}/${R.length} passed`); process.exit(out.ok ? 0 : 1);
})();
