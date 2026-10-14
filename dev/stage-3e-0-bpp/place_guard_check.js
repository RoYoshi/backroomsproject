/* Stage 3E-0 B++-0 - what the placement guard must NOT change, and the one thing it does (development only)
 *
 *   node dev/stage-3e-0-bpp/place_guard_check.js --game DIR --out FILE.json
 *
 * The real server.js (synthetic admin passcode), ordinary players over WebSockets, a quiet admin that places and records (as
 * place_replay.js).  Run on B+ and on B++-0; the answers must be the same except where marked 'differs by design'.
 *   join_spawn      join, first pose at a spawn spot (504, 888): the server takes it; then a sprint at 300 px/s for 0.5 s: followed
 *   join_nonspawn   join, first pose at a spot that is not a spawn spot (1012, 690): corrected at once (a 'tp' back), as before
 *   after_sprint    BRING to (1012, 690); the page takes it at once and sprints +x at 300 px/s for 0.5 s: followed from the first pose
 *   grace_jump      BRING to (1012, 690); 150 ms later the page claims (1512, 690): 500 px in 150 ms, a free line, inside the budget.
 *                   B+ took it (the refilled budget); B++-0 ignores it (no legal motion covers it) - differs by design: stricter
 *   later_jump      the same claim 1.5 s after the placement (the grace over): taken by both - the burst budget is unchanged
 *   crowd           Other stands at (1012, 720); the mover is BROUGHT onto him: put on the nearest free spot; its stale old poses
 *                   (535 px back) for 80 ms, then it walks away from Other: never closer than D (36 px) to him, ends where its page is
 * Exit 0 always (a measurement). */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game), PASS = 'd3-synthetic-admin';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

(async () => {
  const PORT = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.PORT; delete env.BODY_TTL;
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(PORT, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) break; await sleep(100); }
  const conn = room => new Promise((res, rej) => { const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${room}`); ws.onopen = () => res(ws); ws.onerror = rej; });
  const R = { tool: 'dev/stage-3e-0-bpp/place_guard_check.js', game: GAME, checks: {} };
  async function setup(name) {
    const room = 'pg' + PORT + name, adm = await conn(room), T = new Map();
    adm.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 's') for (const q of m.p) { if (!T.has(q.id)) T.set(q.id, []); T.get(q.id).push([Date.now(), q.x, q.y]); } };
    const atx = o => adm.readyState === 1 && adm.send(JSON.stringify(o));
    atx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(250); atx({ t: 'p', x: 3000, y: 3000, a: 0, l: 0, k: 'flashlight', n: 'PLACER' });
    const player = async (nm, first) => {
      const ws = await conn(room), P = { ws, nm, pos: first.slice(), tps: [], id: 0, auto: true };
      ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'hi') P.id = m.id; if (m.t === 'tp') { P.tps.push([Date.now(), m.x, m.y, m.pc | 0]); if (P.auto) P.pos = [m.x, m.y]; } };
      P.send = (x, y) => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a: 0, r: 0, l: 1, k: 'flashlight', n: nm, c: '#ffe7b2', f: -1, lk: 'none|plain|#e6bb76|#ffcc77|none' }));
      ws.send(JSON.stringify({ t: 'caps', fp: 1 })); ws.send(JSON.stringify({ t: 'join' })); await sleep(60);
      P.stop = false; (async () => { while (!P.stop) { P.send(...P.pos); await sleep(25); } })();
      return P;
    };
    const clear = () => { for (let i = 0; i < 6; i++) atx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) atx({ t: 'a', c: 'smilers', mode: 'remove' }); };
    const bring = async (id, x, y) => { atx({ t: 'p', x, y, a: 0, l: 0, k: 'flashlight', n: 'PLACER' }); await sleep(80); atx({ t: 'a', c: 'bring', id }); };
    const at = id => { const t = T.get(id) || []; return t.length ? t[t.length - 1].slice(1) : null; };
    const close = (...ps) => { for (const p of ps) { p.stop = true; try { p.ws.close(); } catch (e) { } } try { adm.close(); } catch (e) { } };
    return { atx, player, clear, bring, at, T, close };
  }
  const walk = async (P, from, vx, secs) => { P.auto = false; const t0 = Date.now(); while (Date.now() - t0 < secs * 1000) { P.pos = [from[0] + vx * (Date.now() - t0) / 1000, from[1]]; await sleep(10); } P.pos = [from[0] + vx * secs, from[1]]; P.auto = true; };
  try {
    { /* join_spawn */
      const E = await setup('js'), M = await E.player('Mover', [504, 888]); await sleep(500); E.clear(); E.atx({ t: 'a', c: 'god', id: M.id }); await sleep(600);
      const a0 = E.at(M.id), n0 = M.tps.length, t0 = Date.now(); await walk(M, [504, 888], 300, .5); await sleep(400);
      const a1 = E.at(M.id), tr = (E.T.get(M.id) || []).filter(r => r[0] >= t0).map(r => [r[0] - t0, r[1], r[2]]);
      R.checks.join_spawn = { serverAtSpawn: a0, serverEnd: a1, pageEnd: M.pos.map(Math.round), tpsDuringWalk: M.tps.length - n0, track: tr.slice(0, 16),
        ok: !!(a0 && a0[0] === 504 && a0[1] === 888 && a1 && Math.abs(a1[0] - 654) <= 2 && M.tps.length === n0) }; E.close(M);
    }
    { /* join_nonspawn */
      const E = await setup('jn'), M = await E.player('Mover', [1012, 690]); await sleep(400);
      R.checks.join_nonspawn = { tps: M.tps.map(t => [t[1], t[2], t[3]]), serverAt: E.at(M.id), ok: M.tps.length >= 1 && !(M.tps[0][1] === 1012 && M.tps[0][2] === 690) }; E.close(M);
    }
    for (const kind of ['after_sprint', 'grace_jump', 'later_jump']) {
      const E = await setup(kind.slice(0, 4)), M = await E.player('Mover', [504, 888]); await sleep(500); E.clear(); E.atx({ t: 'a', c: 'god', id: M.id }); await sleep(1200);
      const n0 = M.tps.length; await E.bring(M.id, 1012, 690);
      for (let i = 0; i < 40 && M.tps.length === n0; i++) await sleep(10);
      const tpAt = Date.now(), placed = M.tps.length > n0 ? M.tps[M.tps.length - 1].slice(1, 3) : null;
      let row = { placed };
      if (kind === 'after_sprint') {
        await walk(M, placed, 300, .5); await sleep(400);
        const tr = (E.T.get(M.id) || []).filter(r => r[0] >= tpAt), end = E.at(M.id);
        let lagMax = 0; for (const r of tr) { const el = (r[0] - tpAt) / 1000; if (el < .15 || el > .5) continue; lagMax = Math.max(lagMax, (placed[0] + 300 * el) - r[1]); }
        Object.assign(row, { serverEnd: end, pageEnd: M.pos.map(Math.round), correctionsAfter: M.tps.length - n0 - 1, serverBehindPageMaxPx: Math.round(lagMax), track: tr.map(r => [r[0] - tpAt, r[1], r[2]]).slice(0, 16) });
        row.ok = !!(end && Math.abs(end[0] - M.pos[0]) <= 2 && row.correctionsAfter === 0 && lagMax < 60);
      } else {
        await sleep(kind === 'grace_jump' ? 150 : 1500);
        M.auto = false; const claimAt = Date.now(); M.pos = [1512, 690]; await sleep(300);
        const end = E.at(M.id), took = !!(end && Math.abs(end[0] - 1512) <= 2);
        Object.assign(row, { claimMsAfterPlacement: claimAt - tpAt, serverAfterClaim: end, tookTheJump: took, tpsAfterClaim: M.tps.filter(t => t[0] > claimAt).map(t => [t[0] - claimAt, t[1], t[2], t[3]]) });
        M.auto = true;
      }
      R.checks[kind] = row; E.close(M);
    }
    { /* crowd */
      const E = await setup('cr'), O = await E.player('Other', [1012, 720]), M = await E.player('Mover', [504, 888]); await sleep(500); E.clear(); E.atx({ t: 'a', c: 'god', id: M.id }); E.atx({ t: 'a', c: 'god', id: O.id });
      await E.bring(O.id, 1012, 720); await sleep(1500);
      const n0 = M.tps.length; M.auto = false; await E.bring(M.id, 1012, 720);
      for (let i = 0; i < 40 && M.tps.length === n0; i++) await sleep(10);
      const tpAt = Date.now(), placed = M.tps.length > n0 ? M.tps[M.tps.length - 1].slice(1, 3) : null;
      await sleep(80); const o = E.at(O.id), dir = placed && o && placed[0] >= o[0] ? 1 : -1;     // (80 ms of its stale old spot, then it takes the free spot and walks away from Other)
      M.pos = placed.slice(); M.auto = true; await walk(M, placed, 200 * dir, .4); await sleep(400);
      const tm = (E.T.get(M.id) || []).filter(r => r[0] >= tpAt), to = E.T.get(O.id) || [];
      let dmin = 1e9; for (const r of tm) { const q = [...to].reverse().find(s => s[0] <= r[0] + 30); if (q) dmin = Math.min(dmin, Math.hypot(r[1] - q[1], r[2] - q[2])); }
      const end = E.at(M.id);
      R.checks.crowd = { other: o, placed, placedFromOther: placed && o ? Math.round(Math.hypot(placed[0] - o[0], placed[1] - o[1])) : null, minDistanceToOther: Math.round(dmin * 10) / 10, serverEnd: end, pageEnd: M.pos.map(Math.round),
        correctionsAfter: M.tps.filter(t => t[0] > tpAt + 5).map(t => [t[0] - tpAt, t[1], t[2], t[3]]), ok: !!(placed && dmin >= 35.2 && end && Math.hypot(end[0] - M.pos[0], end[1] - M.pos[1]) <= 3) };
      E.close(M, O);
    }
  } finally { srv.kill(); }
  R.serverErrors = log.split('\n').filter(l => /Error|TypeError|failed/.test(l)).slice(0, 5);
  if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(R.checks).map(([k, v]) => [k, { ok: v.ok, took: v.tookTheJump, end: v.serverEnd || v.serverAfterClaim || v.serverAt, corr: v.correctionsAfter, lag: v.serverBehindPageMaxPx, dmin: v.minDistanceToOther }]))), R.serverErrors);
})();
