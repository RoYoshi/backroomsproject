/* Stage 3E-0 - how fresh the other Wanderers' poses are, measured on the real server (development only)
 *
 *   node dev/stage-3e-0/net_lab.js --game DIR --out FILE.json [--label L] [--secs 12] [--fps 60] [--send 50] [--caps 0|1]
 *                                  [--movers 1] [--lat 0] [--jitter 0] [--fjit 0]
 *
 * The real server.js (synthetic admin passcode) and ordinary players over WebSockets that speak what mp.js speaks (no test passcode:
 * every position goes through the server's movement checks).  Each player's connection goes through its own small TCP proxy that
 * counts the real bytes both ways (WebSocket frames: headers, masks and payloads) and can add a one-way delay (--lat ms) plus a
 * random extra (--jitter ms, order kept: TCP never reorders).  A quiet admin connection (direct, never joined) removes the monsters
 * and makes everybody immortal.
 *   observer  stands still at the centre of an open hall and records every snapshot ('s') and, if it asked for them ('caps'), every
 *             player-only update ('q'): arrival time, bytes, and the mover's pose in it
 *   mover     walks a circle of 150 px round the observer, 6 s a lap of: walk 200 px/s 2.5 s, sprint 300 px/s 1 s, a dead stop 0.8 s,
 *             then walk back the other way 1.7 s (a sharp turn); it sends its pose as mp.js does: once a frame at --fps (frames
 *             jittered by up to --fjit ms), whenever more than --send ms have passed since the last send (25 ms once the server has
 *             answered its 'caps' when --caps 1).  Its true pose is known at every instant (the circle)
 *   others    (--movers N > 1) walk wide loops round the hall at 200 px/s, as load, sending the same way
 * Writes: the mover's sends, the observer's messages, both connections' real bytes, the server process's CPU time, and the pose the
 * observer can show at every frame of a 30 / 60 / 144 / 240 fps display, for A (HQ5: the snapshot replaces the drawn position; heading
 * eased .35 a frame) and B (position and heading eased by elapsed time, .3 / .35 at 60 fps; a jump over 96 px is shown at once),
 * against the newest pose received and against the truth. */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), net = require('net');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || path.join(__dirname, '..', '..')), PASS = 'd3-synthetic-admin';
const SECS = +(ARG.secs || 12), FPS = +(ARG.fps || 60), SEND = +(ARG.send || 50), CAPS = ARG.caps === '1', MOVERS = Math.max(1, Math.min(6, +(ARG.movers || 1)));
const LAT = +(ARG.lat || 0), JIT = +(ARG.jitter || 0), FJIT = +(ARG.fjit || 0), LABEL = ARG.label || 'run';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => performance.timeOrigin + performance.now();
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const q = (a, f) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(2); };
const mean = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null;
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

/* a TCP proxy for one client: real bytes counted both ways; optional delay + jitter, order kept */
function proxy(to) {
  const st = { c2s: 0, s2c: 0 };
  const srv = net.createServer(c => {
    const s = net.connect(to, '127.0.0.1'); c.setNoDelay(true); s.setNoDelay(true);
    const lane = (dst, key) => { let last = 0; return d => { st[key] += d.length; const at = Math.max(last, now() + LAT + rnd() * JIT); last = at; const w = at - now();
      if (w <= 0.5) { if (!dst.destroyed) dst.write(d); } else setTimeout(() => { if (!dst.destroyed) dst.write(d); }, w); }; };
    c.on('data', lane(s, 'c2s')); s.on('data', lane(c, 's2c'));
    const end = () => setTimeout(() => { c.destroy(); s.destroy(); }, LAT + JIT + 5);
    c.on('close', end); s.on('close', end); c.on('error', end); s.on('error', end);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ port: srv.address().port, st, srv })));
}
function openCentre() {                                                   // an open hall: every point within 260 px of the centre clear by 24 px
  const S = require(path.join(GAME, 'sim.js'))({ seed: 7 });
  for (let y = 3400; y < 6800; y += 48) for (let x = 3000; x < 9000; x += 48) {
    let ok = true;
    for (const r of [0, 70, 140, 200, 260]) { for (let k = 0; k < 24 && ok; k++) { const a = k / 24 * Math.PI * 2; if (!S.clearAt(x + Math.cos(a) * r, y + Math.sin(a) * r, 24)) ok = false; } if (!ok) break; }
    if (ok) return [x, y];
  }
  throw new Error('no open centre');
}
/* the mover's lap (6 s): [duration s, speed px/s, direction] */
const LAP = [[2.5, 200, 1], [1, 300, 1], [.8, 0, 1], [1.7, 200, -1]], R = 150;
function lapAt(t) {                                                       // angle along the circle and direction of travel, t s after the start
  const L = LAP.reduce((s, g) => s + g[0], 0), n = Math.floor(t / L); let th = n * LAP.reduce((s, g) => s + g[0] * g[1] * g[2], 0) / R, tt = t - n * L, dir = 1, sp = 0;
  for (const [d, v, s] of LAP) { const u = Math.min(tt, d); th += u * v * s / R; if (tt <= d) { dir = s; sp = v; break; } tt -= d; dir = s; }
  return { th, dir, sp };
}
(async () => {
  const PORT = await freePort(), env = Object.assign({}, process.env, { ADMIN_PASSCODE: PASS }); delete env.BODY_TTL; delete env.PORT;
  const srv = spawn('node', ['server.js', String(PORT)], { cwd: GAME, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 100; i++) { const ok = await new Promise(r => { const c = net.connect(PORT, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); }); if (ok) break; await sleep(100); }
  const [CX, CY] = openCentre(), room = 'e0lab' + PORT;
  const out = { tool: 'dev/stage-3e-0/net_lab.js', label: LABEL, game: GAME, secs: SECS, fps: FPS, send: SEND, caps: CAPS, movers: MOVERS, lat: LAT, jitter: JIT, fjit: FJIT, centre: [CX, CY] };
  const conn = p => new Promise((res, rej) => { const ws = new WebSocket(`ws://127.0.0.1:${p}/ws?room=${room}`); ws.onopen = () => res(ws); ws.onerror = rej; });
  try {
    const adm = await conn(PORT), atx = o => adm.send(JSON.stringify(o));
    adm.onmessage = () => { };
    atx({ t: 'admin', pass: PASS, quiet: 1 }); await sleep(300);
    const mk = async (name, role, i) => {
      const px = await proxy(PORT), c = { name, role, i, px, ws: await conn(px.port), id: 0, fast: false, last: 0, sends: [], rx: [], tp: 0, x: CX, y: CY, a: 0 };
      c.ws.onmessage = ev => { const t = now(), raw = String(ev.data); let m; try { m = JSON.parse(raw); } catch (e) { return; }
        if (m.t === 'hi') c.id = m.id; else if (m.t === 'caps') c.fast = !!m.fp; else if (m.t === 'tp') c.tp++;
        if (c.role === 'observer' && (m.t === 's' || m.t === 'q')) c.rx.push([t, m.t, Buffer.byteLength(raw), m.p, m.w, m.k]); };
      c.tx = o => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(o)); };
      if (CAPS) c.tx({ t: 'caps', fp: 1 });
      return c;
    };
    const obs = await mk('Observer', 'observer', -1), P = [];
    for (let i = 0; i < MOVERS; i++) P.push(await mk(i ? 'Load' + i : 'Mover', i ? 'load' : 'mover', i));
    const all = [obs, ...P];
    const pose = (c, t) => {                                              // where each one is t s after the start, and its heading
      if (c.role === 'observer') return [CX, CY, 0, 0];
      if (c.role === 'mover') { const L = lapAt(t); return [CX + Math.cos(L.th) * R, CY + Math.sin(L.th) * R, L.th + L.dir * Math.PI / 2, L.sp]; }
      const a0 = c.i / MOVERS * Math.PI * 2, th = a0 + t * 200 / 230; return [CX + Math.cos(th) * 230, CY + Math.sin(th) * 230, th + Math.PI / 2, 200];
    };
    const packet = (c, x, y, a, sp) => ({ t: 'p', x: Math.round(x), y: Math.round(y), vx: 0, vy: 0, a: +(Math.atan2(Math.sin(a), Math.cos(a))).toFixed(2), r: sp > 250 ? 1 : 0, l: 0, ir: 0, k: 'flashlight',
      lp: '', n: c.name, c: '#ffe7b2', f: -1, lk: 'none|plain|#e6bb76|#ffcc77|none', mv: { s: sp > 250 ? 2 : sp > 0 ? 1 : 0, q: 0, st: 100, ex: 0, sp: Math.round(sp), ev: [] } });
    for (const c of all) { c.tx({ t: 'join' }); await sleep(60); }
    for (const c of P) atx({ t: 'a', c: 'god', id: c.id }); atx({ t: 'a', c: 'god', id: obs.id });
    for (let i = 0; i < 6; i++) atx({ t: 'a', c: 'hounds', mode: 'remove' }); for (let i = 0; i < 8; i++) atx({ t: 'a', c: 'smilers', mode: 'remove' });
    for (let k = 0; k < 4; k++) { for (const c of all) { const [x, y, a, sp] = pose(c, 0); c.tx(packet(c, x, y, a, 0)); } await sleep(60); }   // where each spawns (the server checks it as a spawn spot)
    await sleep(1500);
    for (const c of all) { c.rx.length = 0; c.sends.length = 0; c.tp = 0; c.px.st.c2s = 0; c.px.st.s2c = 0; }
    const stat = () => { try { const st = fs.readFileSync(`/proc/${srv.pid}/stat`, 'utf8').split(' '); return (+st[13] + +st[14]) / 100; } catch (e) { return null; } };
    const T0 = now(), cpu0 = stat(), FMS = 1000 / FPS;
    let frame = 0; const t1 = T0 + SECS * 1000;
    await new Promise(done => {                                           // the clients' frames
      const tick = () => {
        const t = now(); if (t >= t1) return done();
        for (const c of all) {
          const lim = c.fast ? 25 : SEND;
          if (t - c.last > lim) { const [x, y, a, sp] = pose(c, (t - T0) / 1000); c.last = t; c.tx(packet(c, x, y, a, sp)); if (c.role === 'mover') c.sends.push([+(t - T0).toFixed(2), Math.round(x), Math.round(y), +a.toFixed(3), sp]); }
        }
        frame++; const nx = T0 + frame * FMS + (FJIT ? (rnd() - .5) * FJIT : 0); setTimeout(tick, Math.max(0, nx - now()));
      };
      tick();
    });
    const secs = (now() - T0) / 1000, cpu1 = stat(), M = P[0];
    out.server = { cpuSec: cpu0 != null && cpu1 != null ? +(cpu1 - cpu0).toFixed(2) : null, cpuPct: cpu0 != null && cpu1 != null ? +((cpu1 - cpu0) / secs * 100).toFixed(1) : null, errors: log.split('\n').filter(l => /Error|failed/.test(l)).slice(0, 5) };
    /* the mover's sends */
    const si = M.sends.map((s, i) => i ? s[0] - M.sends[i - 1][0] : null).slice(1);
    out.mover = { id: M.id, sends: M.sends.length, perSec: +(M.sends.length / secs).toFixed(2), intervalMs: { mean: mean(si), p50: q(si, .5), p95: q(si, .95), max: q(si, 1) }, fastAck: M.fast,
      upBytesPerSec: Math.round(M.px.st.c2s / secs), corrections: M.tp };
    /* what the observer received of the mover */
    const rel = obs.rx.map(r => [+(r[0] - T0).toFixed(2), r[1], r[2], (r[3] || []).map(p => Array.isArray(p) ? p : [p.id, p.x, p.y, p.a]).find(p => p[0] === M.id) || null]);
    const byType = {}; for (const r of rel) { const b = byType[r[1]] || (byType[r[1]] = { n: 0, bytes: 0, withMover: 0, newMover: 0 }); b.n++; b.bytes += r[2]; }
    let prev = null; const fresh = [];
    for (const r of rel) { if (!r[3]) continue; byType[r[1]].withMover++; const k = r[3][1] + ',' + r[3][2] + ',' + r[3][3]; if (k !== prev) { byType[r[1]].newMover++; fresh.push(r); } prev = k; }
    for (const b of Object.values(byType)) { b.perSec = +(b.n / secs).toFixed(2); b.meanPayload = Math.round(b.bytes / Math.max(1, b.n)); delete b.bytes; }
    const fi = fresh.map((r, i) => i ? r[0] - fresh[i - 1][0] : null).slice(1);
    const sendAt = new Map(); for (const s of M.sends) { const k = s[1] + ',' + s[2]; (sendAt.get(k) || sendAt.set(k, []).get(k)).push(s); }
    const ages = []; for (const r of fresh) { const l = sendAt.get(r[3][1] + ',' + r[3][2]) || [], s = l.filter(v => v[0] <= r[0]).pop(); if (s && s[4] > 0) ages.push(r[0] - s[0]); }   // (the latest send of that position before it arrived)
    const seenPos = new Set(fresh.map(r => r[3][1] + ',' + r[3][2]));
    const movingSends = M.sends.filter(s => s[4] > 0);
    out.observer = { messages: byType, downBytesPerSec: Math.round(obs.px.st.s2c / secs), upBytesPerSec: Math.round(obs.px.st.c2s / secs), fastAck: obs.fast,
      newMoverPosePerSec: +(fresh.length / secs).toFixed(2), newPoseIntervalMs: { mean: mean(fi), p50: q(fi, .5), p95: q(fi, .95), max: q(fi, 1) },
      poseAgeMs: { n: ages.length, mean: mean(ages), p50: q(ages, .5), p95: q(ages, .95), max: q(ages, 1) },
      moverSendsNeverSeen: movingSends.filter(s => !seenPos.has(s[1] + ',' + s[2])).length, moverMovingSends: movingSends.length };
    out.load = P.slice(1).map(c => ({ up: Math.round(c.px.st.c2s / secs), down: Math.round(c.px.st.s2c / secs), corrections: c.tp }));
    /* what a display of the observer would show of the mover */
    const tgt = fresh.map(r => [r[0], r[3][1], r[3][2], r[3][3]]);
    const truth = t => { const [x, y, a, sp] = pose(M, t / 1000); return [x, y, a, sp]; };
    const angD = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    out.display = {};
    for (const mode of ['A', 'B']) for (const fps of [30, 60, 144, 240]) {
      const dt = 1 / fps; let i = 0, o = null, lastSeenIdx = -1, rx = null, ry = null; const eL = [], eT = [], eH = [], steps = [], stall = []; let maxStep = 0;
      for (let t = tgt[0][0] + 1; t < secs * 1000 - 50; t += dt * 1000) {
        while (i < tgt.length && tgt[i][0] <= t) i++;
        const cur = tgt[i - 1]; if (!cur) continue;
        if (!o) o = { x: cur[1], y: cur[2], ang: cur[3], tx: cur[1], ty: cur[2], a: cur[3] };
        if (i - 1 !== lastSeenIdx) {                                      // a message arrived since the last frame
          for (let j = lastSeenIdx + 1; j <= i - 1; j++) { const m = tgt[j];
            if (mode === 'A') { o.x = m[1]; o.y = m[2]; } else if (Math.hypot(m[1] - o.x, m[2] - o.y) > 96) { o.x = m[1]; o.y = m[2]; }
            o.tx = m[1]; o.ty = m[2]; o.a = m[3]; }
          lastSeenIdx = i - 1;
        }
        const aP = mode === 'A' ? .3 : 1 - Math.pow(.7, 60 * dt), aR = mode === 'A' ? .35 : 1 - Math.pow(.65, 60 * dt);
        o.x += (o.tx - o.x) * aP; o.y += (o.ty - o.y) * aP; o.ang += angD(o.a, o.ang) * aR;
        const tr = truth(t), st = rx === null ? 0 : Math.hypot(o.x - rx, o.y - ry); rx = o.x; ry = o.y;   // (what moved on screen since the last frame, an arrival's jump included)
        eL.push(Math.hypot(o.x - o.tx, o.y - o.ty)); eT.push(Math.hypot(o.x - tr[0], o.y - tr[1])); eH.push(Math.abs(angD(o.ang, tr[2])) * 180 / Math.PI);
        if (tr[3] > 0) { steps.push(st); stall.push(st < .05 ? 1 : 0); maxStep = Math.max(maxStep, st); }
      }
      const sm = mean(steps), sd = steps.length ? Math.sqrt(steps.reduce((s, v) => s + (v - sm) ** 2, 0) / steps.length) : null;
      out.display[mode + '@' + fps] = { renderToLatestPx: { mean: mean(eL), p95: q(eL, .95), max: q(eL, 1) }, renderToTruthPx: { mean: mean(eT), p95: q(eT, .95), max: q(eT, 1) },
        headingErrDeg: { mean: mean(eH), p95: q(eH, .95) }, movingFrames: { stepPxMean: sm, stepCv: sm ? +(sd / sm).toFixed(3) : null, stalledShare: +(mean(stall) || 0).toFixed(3), maxStepPx: +maxStep.toFixed(1) } };
    }
    out.timeline = { sends: M.sends, observed: rel.map(r => [r[0], r[1], r[2], r[3] ? r[3].slice(1) : null]) };
    for (const c of all) { try { c.ws.close(); } catch (e) { } c.px.srv.close(); }
    try { adm.close(); } catch (e) { }
  } finally { srv.kill(); }
  fs.writeFileSync(ARG.out, JSON.stringify(out) + '\n');
  const d = out.display;
  console.log(JSON.stringify({ label: LABEL, mover: out.mover, observer: Object.assign({}, out.observer, { messages: undefined }), msgs: out.observer.messages, server: out.server,
    A60: d['A@60'], B60: d['B@60'] }));
  process.exit(0);
})();
