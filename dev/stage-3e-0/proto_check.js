/* Stage 3E-0 - B+'s server side, message by message (development only)
 *
 *   node dev/stage-3e-0/proto_check.js --game DIR [--out FILE.json]
 *
 * The real server.js (synthetic admin passcode), a quiet admin (never joined) and ordinary players over WebSockets, in an open hall:
 *   Fast (asks 'caps'), Old (never asks), Mover (asks; walks), Still (asks; stands still).  Checked:
 *    1. 'caps' is answered {t:'caps', fp:1}; Old never gets a 'q', and its snapshots carry no k (exactly what HQ5 sent it)
 *    2. a 'q' lists only OTHER players the last snapshot listed, alive, whose pose changed: [id, x, y, heading] (4 numbers, no
 *       cosmetics); never its own receiver; w = the world epoch; k = a tick between two snapshots, rising
 *    3. nobody moving: no 'q' at all
 *    4. after the admin WORLD reset: 'q' carry the new epoch (the 'world' message first)
 *    5. a player who dies is in no 'q' from its death on; one who disconnects, in none after its socket closes
 *    7. nobody outside the room and nobody not in a run gets a 'q': Elsewhere (asks; in another room, in a run there) and Lobby (asks; in
 *       this room, connected but never joined) get none while the Mover walks
 *    6. the movement checks are the same for a Fast client: a 500 px jump is refused (a correction 'tp'), a move through a wall is refused,
 *       (the packet spacing it takes, FAST_GAP 16 ms against 30 ms, is read from server.js, not measured here)
 * Exit 0 only if every check holds. */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game), PASS = 'd3-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
function openCentre(S) {
  for (let y = 3400; y < 6800; y += 48) for (let x = 3000; x < 9000; x += 48) {
    let ok = true;
    for (const r of [0, 70, 140, 200, 260]) { for (let k = 0; k < 24 && ok; k++) { const a = k / 24 * Math.PI * 2; if (!S.clearAt(x + Math.cos(a) * r, y + Math.sin(a) * r, 24)) ok = false; } if (!ok) break; }
    if (ok) return [x, y];
  }
  throw new Error('no open centre');
}
(async () => {
  const PORT = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL; delete env.PORT;
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(PORT, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) break; await sleep(100); }
  const S = require(path.join(GAME, 'sim.js'))({ seed: 7 }), [CX, CY] = openCentre(S), room = 'e0proto' + PORT;
  const R = { tool: 'dev/stage-3e-0/proto_check.js', game: GAME, checks: {} };
  const conn = (r = room) => new Promise((res, rej) => { const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${r}`); ws.onopen = () => res(ws); ws.onerror = rej; });
  const mk = async (name, caps, r) => { const c = { name, ws: await conn(r), got: [], id: 0, x: 0, y: 0 }; c.ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } m.__at = Date.now(); c.got.push(m); if (m.t === 'hi') c.id = m.id; };
    c.tx = o => c.ws.readyState === 1 && c.ws.send(JSON.stringify(o)); c.pos = (x, y, a = 0) => { c.x = x; c.y = y; c.tx({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a, r: 0, l: 0, k: 'flashlight', n: name, c: '#ffe7b2', f: -1, lk: 'none|plain|#e6bb76|#ffcc77|none' }); };
    if (caps) c.tx({ t: 'caps', fp: 1 }); return c; };
  try {
    const adm = await conn(); adm.onmessage = () => { }; const atx = o => adm.send(JSON.stringify(o)); atx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300);
    const F = await mk('Fast', true), O = await mk('Old', false), M = await mk('Mover', true), T = await mk('Still', true), all = [F, O, M, T];
    const spots = { Fast: [CX - 120, CY], Old: [CX + 120, CY], Mover: [CX, CY - 120], Still: [CX, CY + 120] };
    for (const c of all) { c.tx({ t: 'join' }); await sleep(60); }
    for (const c of all) atx({ t: 'a', c: 'god', id: c.id });
    for (let i = 0; i < 6; i++) atx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) atx({ t: 'a', c: 'smilers', mode: 'remove' });
    for (let k = 0; k < 4; k++) { for (const c of all) c.pos(...spots[c.name]); await sleep(60); }
    const E = await mk('Elsewhere', true, room + 'b'), L = await mk('Lobby', true); E.tx({ t: 'join' });
    await sleep(800);
    const capsEL = [E, L].map(c => (c.got.find(m => m.t === 'caps') || {}).fp ?? null);
    /* 1 + 3: caps (asked at connect); nobody moving */
    const capsAns = c => c.got.find(m => m.t === 'caps');
    R.checks.caps = { fast: capsAns(F) ? capsAns(F).fp : null, old: capsAns(O) ? capsAns(O).fp : null };
    R.checks.caps.ok = R.checks.caps.fast === 1 && R.checks.caps.old === null;
    for (const c of all) c.got.length = 0;
    for (let k = 0; k < 20; k++) { for (const c of all) c.pos(...spots[c.name]); await sleep(50); }
    R.checks.still = { qWhileStill: all.reduce((n, c) => n + c.got.filter(m => m.t === 'q').length, 0) };
    R.checks.still.ok = R.checks.still.qWhileStill === 0;
    /* 2: the Mover walks */
    for (const c of [...all, E, L]) c.got.length = 0;
    let th = 0; for (let k = 0; k < 60; k++) { th += .04; M.pos(CX + Math.sin(th) * 60, CY - 120 + Math.cos(th) * 10, th); for (const c of [F, O, T]) c.pos(...spots[c.name]); await sleep(33); }
    await sleep(100);
    const qF = F.got.filter(m => m.t === 'q'), qO = O.got.filter(m => m.t === 'q'), sF = F.got.filter(m => m.t === 's'), sO = O.got.filter(m => m.t === 's');
    const listed = new Set(sF.flatMap(m => m.p.map(p => p.id)));
    const qOk = qF.every(m => Array.isArray(m.p) && m.p.length && m.p.every(q => Array.isArray(q) && q.length === 4 && q.every(Number.isFinite) && q[0] !== F.id && listed.has(q[0])) && m.k % 2 === 1);
    const kRise = qF.every((m, i) => !i || m.k > qF[i - 1].k);
    const merged = F.got.filter(m => m.t === 's' || m.t === 'q').map(m => m.k), mergedRise = merged.every((k, i) => !i || k > merged[i - 1]);
    R.checks.q = { fastQ: qF.length, oldQ: qO.length, fastSnapshotsWithK: sF.filter(m => m.k != null).length, oldSnapshotsWithK: sO.filter(m => m.k != null).length, ids: [...new Set(qF.flatMap(m => m.p.map(q => q[0])))],
      moverId: M.id, w: [...new Set(qF.map(m => m.w))], shape: qOk, kRising: kRise, kRisingWithSnapshots: mergedRise, sample: qF[0] ? { t: 'q', w: qF[0].w, k: qF[0].k, p: qF[0].p } : null,
      stillGetsQ: T.got.filter(m => m.t === 'q').length, moverGetsOwn: M.got.filter(m => m.t === 'q' && m.p.some(q => q[0] === M.id)).length };
    R.checks.isolation = { elsewhereAnswered: capsEL[0], lobbyAnswered: capsEL[1],
      qElsewhere: E.got.filter(m => m.t === 'q').length, qLobby: L.got.filter(m => m.t === 'q').length, elsewhereSnapshotsNamingMover: E.got.filter(m => m.t === 's' && m.p.some(p => p.id === M.id)).length };
    R.checks.isolation.ok = capsEL[0] === 1 && capsEL[1] === 1 && R.checks.isolation.qElsewhere === 0 && R.checks.isolation.qLobby === 0 && R.checks.isolation.elsewhereSnapshotsNamingMover === 0;
    try { E.ws.close(); L.ws.close(); } catch (e) { }
    R.checks.q.ok = qF.length > 10 && qO.length === 0 && sF.length && sF.every(m => m.k != null) && sO.every(m => m.k == null) && qOk && kRise && mergedRise && R.checks.q.ids.length === 1 && R.checks.q.ids[0] === M.id && R.checks.q.moverGetsOwn === 0;
    /* 4: world reset */
    for (const c of all) c.got.length = 0;
    atx({ t: 'a', c: 'world' }); await sleep(200);
    for (const c of all) c.tx({ t: 'join' });                                // (a reset brings everyone back; keep the players in the run)
    for (let i = 0; i < 6; i++) atx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) atx({ t: 'a', c: 'smilers', mode: 'remove' });
    for (const c of all) atx({ t: 'a', c: 'god', id: c.id });
    await sleep(300);
    const wMsg = F.got.find(m => m.t === 'world');
    for (let k = 0; k < 40; k++) { th += .04; M.pos(M.x + Math.cos(th) * 6, M.y, th); await sleep(33); }
    const qAfter = F.got.filter(m => m.t === 'q'), firstQ = F.got.findIndex(m => m.t === 'q'), worldIdx = F.got.findIndex(m => m.t === 'world');
    R.checks.world = { worldMsg: wMsg ? wMsg.w : null, qEpochs: [...new Set(qAfter.map(m => m.w))], worldBeforeFirstQ: worldIdx >= 0 && (firstQ < 0 || worldIdx < firstQ) };
    R.checks.world.ok = !!wMsg && qAfter.length > 0 && qAfter.every(m => m.w === wMsg.w) && R.checks.world.worldBeforeFirstQ;
    /* 5: death and disconnect */
    for (const c of all) c.got.length = 0;
    atx({ t: 'a', c: 'god', id: M.id, on: 0 });
    M.tx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(200); M.tx({ t: 'a', c: 'preview', k: 'hound', var: 'A' }); await sleep(600);
    for (let k = 0; k < 30; k++) { M.pos(M.x + (k % 2 ? 5 : -5), M.y, k); await sleep(33); }
    const deadS = F.got.filter(m => m.t === 's').map(m => (m.p.find(p => p.id === M.id) || {}).d), dead = deadS.includes(1);
    const firstDead = F.got.findIndex(m => m.t === 's' && m.p.some(p => p.id === M.id && p.d));
    const qMoverAfterDeath = firstDead < 0 ? null : F.got.slice(firstDead).filter(m => m.t === 'q' && m.p.some(q => q[0] === M.id)).length;
    R.checks.death = { moverDiedOnServer: dead, qNamingHimAfterDeath: qMoverAfterDeath };
    R.checks.death.ok = dead && qMoverAfterDeath === 0;
    for (const c of all) c.got.length = 0;
    T.pos(T.x + 4, T.y); await sleep(60); const tId = T.id; T.ws.close(); const closedAt = Date.now(); await sleep(400);
    const qT = F.got.filter(m => m.t === 'q' && m.p.some(q => q[0] === tId) && m.__at > closedAt + 60).length, sT = F.got.filter(m => m.t === 's' && m.__at > closedAt + 120 && m.p.some(p => p.id === tId)).length;
    R.checks.disconnect = { qNamingHimAfterClose: qT, snapshotsNamingHimAfterClose: sT, ok: qT === 0 && sT === 0 };
    /* 6: the movement checks for a Fast client (and Old for comparison) */
    const tpCount = c => c.got.filter(m => m.t === 'tp').length;
    for (const c of all) c.got.length = 0;
    const [fx, fy] = spots.Fast; F.pos(fx + 500, fy); await sleep(150);
    R.checks.moves = { fastJump500Refused: tpCount(F) > 0 };
    let wall = null; for (let d = 30; d < 600 && !wall; d += 6) for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!S.clearAt(F.x + ux * d, F.y + uy * d, 2)) { wall = [ux, uy, d]; break; } }
    R.checks.moves.wallFound = !!wall;
    await sleep(1600);                                                        // (budget back)
    for (const c of all) c.got.length = 0;
    if (wall) { const [ux, uy, d] = wall; F.pos(F.x + ux * (d + 40), F.y + uy * (d + 40)); await sleep(150); R.checks.moves.fastThroughWallRefused = tpCount(F) > 0; }
    await sleep(1600);
    R.checks.moves.ok = R.checks.moves.fastJump500Refused && (!wall || R.checks.moves.fastThroughWallRefused);
    for (const c of all) try { c.ws.close(); } catch (e) { } try { adm.close(); } catch (e) { }
  } finally { srv.kill(); }
  R.serverErrors = log.split('\n').filter(l => /Error|TypeError|failed/.test(l)).slice(0, 5);
  R.ok = Object.values(R.checks).every(c => c.ok !== false) && !R.serverErrors.length;
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R)); process.exit(R.ok ? 0 : 1);
})();
