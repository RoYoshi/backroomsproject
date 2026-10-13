/* Stage 3D HQ2 - the browser's prediction (move.js) on its own, headless: the real move.js in a sandbox, as the game runs it (development only)
 *
 *   node dev/stage-3d-hq2/predict_unit.js --game DIR --old DIR [--out FILE.json]          (--old: a tree whose move.js is HQ1's)
 *
 * move.js is loaded exactly as dev/move_model.js does (the level from the game's own sim.js and world.js), with window.__peerBodies - the
 * other living players, as mp.js keeps them - set by the test.  Every run is a fixed input script at the game's fixed 60 Hz step, fed by
 * frame schedules through timing_policy.consume as the browser loop does.
 *   P1 solo, unchanged: with no other player (no list, or an empty one) every tick of seven scripts (stand, walk, sprint, crouch-walk,
 *      a vault, a crawl through a wall hole, sprint + slide) is identical, number for number, to HQ1's move.js
 *   P2 frame rate: walking into a standing player, at 30, 60, 120, 144, 240, 360 frames a second and a jittered schedule, gives the same
 *      trace tick for tick; never closer than D (36 px) to him at any tick
 *   P3 the server agrees: the positions a page would send (every third tick, whole pixels) go through the server's own rule
 *      (server/peers.js resolve) as free moves - no correction at all with no lag - head-on in the corridor, past his shoulder when he
 *      stands aside, round him on open floor, through a crowd of five
 *   P4 the slide: 12 px off his line on open floor the player slides round him and gets past; dead centre it stops at contact, never
 *      pushed sideways; a sprint-slide into him dies at contact, like against a wall
 *   P5 the vault: over a counter with nobody there it vaults; with a player standing on the landing it does not start (a bump: the player
 *      stays on its side); with a player beside the run-up, not in the way, it still vaults
 * Exit 0 only if every check holds. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const GAME = path.resolve(ARG.game || '.'), OLD = ARG.old ? path.resolve(ARG.old) : null;
const createSim = require(path.join(GAME, 'sim.js')), WORLD = require(path.join(GAME, 'world.js')), timing = require(path.join(GAME, 'timing_policy.js'));
const PEERS = require(path.join(GAME, 'server', 'peers.js'));
const sim = createSim({ seed: 3 });
const out = { tool: 'dev/stage-3d-hq2/predict_unit.js', game: GAME, old: OLD, checks: [] };
const check = (name, ok, info) => { out.checks.push({ name, ok: !!ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(info).slice(0, 300)); };
const r3 = v => Math.round(v * 1000) / 1000;

function mover(dir, peers) {                                              // one copy of move.js, as dev/move_model.js loads it
  const SRC = new vm.Script(fs.readFileSync(path.join(dir, 'move.js'), 'utf8'), { filename: 'move.js' });
  const H = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, distance: 0, stamina: 100, sprinting: false, exhausted: false, equipment: { kind: 'flashlight' } };
  const keys = new Set(), api = { H, keys, Bc: (x, y) => sim.blockersAt(x, y), Oc: sim.adapter.rooms };
  const win = { WORLD, __api: api }; if (peers !== undefined) win.__peerBodies = peers;
  let clock = 0;
  const ctx = vm.createContext({ window: win, performance: { now: () => clock * 1000 }, Math, console, document: { getElementById: () => null } });
  SRC.runInContext(ctx);
  const mv = win.__mv;
  return { H, mv, keys, win, tick(ix, iy, run, crouch, slide, dt) { clock += dt; if (slide) keys.add('KeyC'); else if (!!crouch !== mv.crouch && !mv.zone) mv.crouch = !!crouch; mv.step(ix, iy, run, dt); keys.delete('KeyC'); mv.prevC = false; } };
}
/* a script: start, then for each tick an input (towards a goal, or a fixed direction); the run goes through timing.consume */
function run(dir, peers, start, script, frames) {
  const m = mover(dir, peers), H = m.H; H.x = start[0]; H.y = start[1];
  const trace = []; let acc = 0, t = 0, k = 0;
  for (const fdt of frames) {
    acc = timing.consume(acc, fdt, dt => {
      const inp = script(t, H, m); t += dt; k++;
      m.tick(inp[0], inp[1], !!inp[2], !!inp[3], !!inp[4], dt);
      trace.push([H.x, H.y, H.vx, H.vy, H.stamina, m.mv.s, !!m.mv.vault]);
    }).accumulator;
  }
  return { trace, H, mv: m.mv };
}
const constant = (fps, secs) => Array(Math.round(fps * secs)).fill(1 / fps);
function jittered(secs) { const pat = [1 / 240, 1 / 90, 1 / 165, 1 / 48, 1 / 120, 1 / 75], o = []; let t = 0, i = 0; while (t < secs - 1e-12) { const d = Math.min(pat[i++ % pat.length], secs - t); o.push(d); t += d; } return o; }
const toward = (gx, gy, runK, crouch) => (t, H) => { const dx = gx - H.x, dy = gy - H.y, d = Math.hypot(dx, dy); return d < 2 ? [0, 0, 0, crouch] : [dx / d, dy / d, runK, crouch]; };
const minDist = (tr, q) => Math.min(...tr.map(r => Math.hypot(r[0] - q[0], r[1] - q[1])));
function serverAgrees(tr, peersList) {                                    // what a page sends (every third tick, whole px) through the server's own rule
  let sx = null, sy = null, n = 0, notFree = 0, worst = 0;
  for (let i = 2; i < tr.length; i += 3) {
    const x = Math.round(tr[i][0]), y = Math.round(tr[i][1]);
    if (sx == null) { sx = x; sy = y; continue; }
    const r = PEERS.resolve(sx, sy, x, y, peersList, PEERS.D_BODY); n++;
    if (r.how !== 'free') { notFree++; worst = Math.max(worst, Math.hypot(r.x - x, r.y - y)); }
    sx = r.x; sy = r.y;
  }
  return { packets: n, notFree, worstMissPx: r3(worst) };
}

const CORR = { y: 720, x0: 812, xb: 1012 }, HALL = { x: 4450, y: 3450 };

/* P1: solo, identical to HQ1 */
if (OLD) {
  const Lw = WORLD.LOW.find(q => q.type === 'low'), lr = Lw.rect, acr = lr.h < lr.w, Gp = WORLD.CRAWL.find(c => c.type === 'gap'), g0 = Gp.exits[0], g1 = Gp.exits[1];
  const vS = acr ? [Lw.cx, lr.y - 120] : [lr.x - 120, Lw.cy], vG = acr ? [Lw.cx, lr.y + lr.h + 140] : [lr.x + lr.w + 140, Lw.cy];
  const scripts = {
    stand: [[4000, 3504], () => [0, 0, 0, 0]],
    walk: [[3200, 3504], toward(3700, 3504, 0, 0)],
    sprint: [[3630, 3504], toward(5200, 3504, 1, 0)],
    crouchWalk: [[4000, 3504], toward(4300, 3504, 0, 1)],
    vault: [vS, toward(vG[0], vG[1], 1, 0)],
    crawlThroughAHole: [[g0.x + g0.nx * 80, g0.y + g0.ny * 80], (t, H) => { const tg = t < 2 ? [g0.x, g0.y] : [g1.x + g1.nx * 60, g1.y + g1.ny * 60], dx = tg[0] - H.x, dy = tg[1] - H.y, d = Math.hypot(dx, dy); return d < 2 ? [0, 0, 0, 1] : [dx / d, dy / d, 0, 1]; }],
    sprintSlide: [[5200, 3504], (t, H) => [1, 0, 1, 0, t > 1.2 && t < 1.22]],
  };
  const diffs = {}; let ticks = 0;
  for (const [nm, [st, sc]] of Object.entries(scripts)) for (const pv of [undefined, []]) {
    const a = run(OLD, undefined, st, sc, constant(60, 4)).trace, b = run(GAME, pv, st, sc, constant(60, 4)).trace;
    ticks += b.length;
    const bad = a.length !== b.length ? -1 : a.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(b[i]));
    if (bad !== -1) diffs[nm + (pv ? ' (empty list)' : ' (no list)')] = bad;
  }
  const vt = run(GAME, [], vS, scripts.vault[1], constant(60, 4)).trace;
  check('P1 solo, unchanged: with no other player (no list, or an empty one) every tick of seven scripts - stand, walk, sprint, crouch-walk, a vault, a crawl through a wall hole, sprint + slide - is identical, number for number, to HQ1\'s move.js',
    Object.keys(diffs).length === 0 && vt.some(r => r[6]), { scripts: Object.keys(scripts).length * 2, ticks, firstDifferingTick: diffs, theVaultHappened: vt.some(r => r[6]) });
} else check('P1 solo, unchanged (needs --old)', false, { why: 'no --old tree given' });

/* P2: frame rate */
{
  const bob = [CORR.xb, CORR.y], sc = toward(1400, CORR.y, 1, 0), runs = {};
  for (const f of [30, 60, 120, 144, 240, 360]) runs[f + ' FPS'] = run(GAME, [bob], [CORR.x0, CORR.y], sc, constant(f, 4)).trace;
  runs.jittered = run(GAME, [bob], [CORR.x0, CORR.y], sc, jittered(4)).trace;
  const base = JSON.stringify(runs['60 FPS']), same = Object.entries(runs).filter(([k, v]) => JSON.stringify(v) !== base).map(([k]) => k);
  const md = Math.min(...Object.values(runs).map(tr => minDist(tr, bob))), end = runs['60 FPS'][runs['60 FPS'].length - 1];
  check('P2 sprinting into a standing player at 30, 60, 120, 144, 240, 360 FPS and a jittered schedule: the same trace tick for tick (240 fixed ticks); never closer than D; stopped at contact',
    same.length === 0 && runs['60 FPS'].length === 240 && md >= 36 && Math.hypot(end[0] - bob[0], end[1] - bob[1]) < 37.5, { differing: same, ticks: runs['60 FPS'].length, minDistance: r3(md), endDistance: r3(Math.hypot(end[0] - bob[0], end[1] - bob[1])) });
}

/* P3 + P4: the server agrees; the slide */
{
  const head = run(GAME, [[CORR.xb, CORR.y]], [CORR.x0, CORR.y], toward(1400, CORR.y, 1, 0), constant(60, 4)).trace;
  const aside = run(GAME, [[CORR.xb, CORR.y - 30]], [CORR.x0, CORR.y], (t, H) => [1, (CORR.y - H.y) * .02, 1, 0], constant(60, 4)).trace;
  const wide = run(GAME, [[HALL.x, HALL.y]], [HALL.x - 150, HALL.y + 12], (t, H) => [1, (HALL.y + 12 - H.y) * .02, 0, 0], constant(60, 4)).trace;
  const centre = run(GAME, [[HALL.x, HALL.y]], [HALL.x - 150, HALL.y], toward(HALL.x + 300, HALL.y, 0, 0), constant(60, 4)).trace;
  const crowd = [[HALL.x, HALL.y], [HALL.x + 30, HALL.y - 34], [HALL.x + 30, HALL.y + 34], [HALL.x + 60, HALL.y], [HALL.x - 10, HALL.y + 70]];
  const into = run(GAME, crowd, [HALL.x - 140, HALL.y + 20], toward(HALL.x + 40, HALL.y + 10, 1, 0), constant(60, 4)).trace;
  const slide = run(GAME, [[CORR.xb, CORR.y]], [CORR.x0 - 200, CORR.y], (t, H) => [1, 0, 1, 0, t > .9 && t < .92], constant(60, 3));
  const ag = { headOn: serverAgrees(head, [[CORR.xb, CORR.y]]), pastHisShoulder: serverAgrees(aside, [[CORR.xb, CORR.y - 30]]), roundHimOnOpenFloor: serverAgrees(wide, [[HALL.x, HALL.y]]), deadCentre: serverAgrees(centre, [[HALL.x, HALL.y]]), intoACrowdOfFive: serverAgrees(into, crowd) };
  check('P3 the server agrees: every position a page would send (every third tick, whole px) is a free move under the server\'s own rule - head-on, past his shoulder, round him, dead centre, into a crowd of five: no correction at all with no lag',
    Object.values(ag).every(a => a.notFree === 0 && a.packets > 30), ag);
  const wEnd = wide[wide.length - 1], wMin = minDist(wide, [HALL.x, HALL.y]), wSide = Math.max(...wide.map(r => Math.abs(r[1] - HALL.y)));
  const cEnd = centre[centre.length - 1], cYs = centre.map(r => r[1]);
  const aEnd = aside[aside.length - 1];
  const sl = slide.trace, sMin = minDist(sl, [CORR.xb, CORR.y]), sEnd = sl[sl.length - 1], slid = sl.some(r => r[5] === 'slide');
  const cMin = Math.min(...crowd.map(q => minDist(into, q)));
  out.slide = { wide: { end: [r3(wEnd[0]), r3(wEnd[1])], min: r3(wMin), widestSideways: r3(wSide) }, centre: { end: [r3(cEnd[0]), r3(cEnd[1])], y: [Math.min(...cYs), Math.max(...cYs)] }, aside: { end: [r3(aEnd[0]), r3(aEnd[1])], min: r3(minDist(aside, [CORR.xb, CORR.y - 30])) }, sprintSlide: { slid, min: r3(sMin), end: [r3(sEnd[0]), r3(sEnd[1])], state: sEnd[5] }, crowdMin: r3(cMin) };
  check('P4 the slide: 12 px off his line on open floor she slides round him and gets past (never closer than D); past his shoulder in the corridor when he stands aside; dead centre she stops at contact and is never pushed sideways',
    wEnd[0] > HALL.x + 100 && wMin >= 36 && aEnd[0] > CORR.xb + 100 && minDist(aside, [CORR.xb, CORR.y - 30]) >= 36 && cEnd[0] < HALL.x && Math.hypot(cEnd[0] - HALL.x, cEnd[1] - HALL.y) < 37.5 && Math.min(...cYs) === HALL.y && Math.max(...cYs) === HALL.y && cMin >= 36, out.slide);
  check('P4 a sprint-slide into a standing player dies at contact, as against a wall (never closer than D, on her own side)', slid && sMin >= 36 && sEnd[0] < CORR.xb, out.slide.sprintSlide);
}

/* P5: the vault */
{
  const Lw = WORLD.LOW.find(q => q.type === 'low'), lr = Lw.rect, acr = lr.h < lr.w;
  const vS = acr ? [Lw.cx, lr.y - 120] : [lr.x - 120, Lw.cy], vG = acr ? [Lw.cx, lr.y + lr.h + 140] : [lr.x + lr.w + 140, Lw.cy];
  const landing = acr ? [Lw.cx, lr.y + lr.h + 22] : [lr.x + lr.w + 22, Lw.cy], beside = acr ? [Lw.cx + 60, lr.y - 50] : [lr.x - 50, Lw.cy + 60];
  const sc = toward(vG[0], vG[1], 1, 0);
  const free = run(GAME, [], vS, sc, constant(60, 3)), blocked = run(GAME, [landing], vS, sc, constant(60, 3)), side = run(GAME, [beside], vS, sc, constant(60, 3));
  const farSide = tr => { const e = tr[tr.length - 1]; return acr ? e[1] > lr.y + lr.h : e[0] > lr.x + lr.w; };
  out.vault = { obstacle: { x: lr.x, y: lr.y, w: lr.w, h: lr.h }, free: { vaulted: free.trace.some(r => r[6]), farSide: farSide(free.trace) }, landingTaken: { vaulted: blocked.trace.some(r => r[6]), farSide: farSide(blocked.trace), min: r3(minDist(blocked.trace, landing)) }, someoneBeside: { vaulted: side.trace.some(r => r[6]), farSide: farSide(side.trace), min: r3(minDist(side.trace, beside)) } };
  check('P5 the vault: with nobody there it vaults the counter; with a player standing on the landing it does not start (she stays on her side, never closer than D); with a player beside the run-up, not in the way, it still vaults',
    out.vault.free.vaulted && out.vault.free.farSide && !out.vault.landingTaken.vaulted && !out.vault.landingTaken.farSide && out.vault.landingTaken.min >= 36 && out.vault.someoneBeside.vaulted && out.vault.someoneBeside.farSide && out.vault.someoneBeside.min >= 36, out.vault);
}

out.ok = out.checks.length === 6 && out.checks.every(c => c.ok);
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
console.log(`${out.checks.filter(c => c.ok).length}/${out.checks.length} checks passed`);
process.exit(out.ok ? 0 : 1);
