/* Stage 3D HQ2 - npm test's 2F F13 with HQ2's lifecycle (development only)
 *
 *   node dev/stage-3d-hq2/f13_hq2.js [--out FILE.json]
 *
 * dev/tests/s_shared2f.js F13 ("death/respawn/leave/world reset clear encounter identity") throws on HQ2: its 'leave' case starts with
 * sim.vanish, the NEW RUN vanish window H2-1 removed (a living player now leaves the world only through NEW RUN, sim.newRun).  The older
 * test is not edited; this is its replacement, the same assertions on the same fixture (dev/tests/lib.js World 513, a hound that has
 * learnt the player's habits), for every way out of an encounter HQ2 has:
 *   death       killed (the admin preview, the real kill path)
 *   respawn     dead, then respawned
 *   disconnect  the connection gone
 *   newrun      NEW RUN (sim.newRun, H2-1), then a join            (F13's 'leave' was: vanish, leave, join)
 *   leave       killed, then to the menu (sim.leave), then a join  (leaving from death, the one leave HQ2 allows)
 *   world       a world reset (the engine cleared)
 * Afterwards the hound remembers nothing of that player: no habit, no hypothesis, no debug habit naming it (the world: no entity left).
 * Exit 0 when every case holds. */
'use strict';
const path = require('path'), fs = require('fs'), assert = require('node:assert/strict');
const { World, LONG, AI } = require(path.join(__dirname, '..', 'tests', 'lib'));
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const Y = LONG.y;
function entity(w, kind = 'hound', still = false) { const e = w[kind](5000, Y, { id: 41 }); e.ang = 0; e.tierT = 1e9; e.rest = 1e9; e.act = 'rest'; if (still) e.sp = { ...e.sp, tick() {} }; return e; }   // (s_shared2f.js, as it is)
function habits(w, e, p) { const r = e.mem.p.get(p.id); assert(r?.seen); for (let i = 0; i < 6; i++) { const t = w.eng.now + i * 2; r.visual = { ...r.visual, x: i % 2 ? 5400 : 5180, y: Y, vx: 100, vy: 0, t }; r.seenAt = t; AI.habitObserve(e, r, t); } AI.cleanHabits(e, w.eng.now + 10); return r; }   // (s_shared2f.js, as it is)
const out = { tool: 'dev/stage-3d-hq2/f13_hq2.js', replaces: 'dev/tests/s_shared2f.js 2F F13', cases: [] };
for (const how of ['death', 'respawn', 'disconnect', 'newrun', 'leave', 'world']) {
  const c = { how }; out.cases.push(c);
  try {
    const w = World(513), e = entity(w, 'hound', true), p = w.player(5250, Y); w.run(.3); habits(w, e, p); AI.habitBias(e, p.id, 5180, Y, 10);
    c.before = { habit: e.mem.habits.has(p.id), hypotheses: e.mem.hypotheses.filter(h => h.pid === p.id).length };
    assert(c.before.habit, 'setup: the hound has learnt the player\'s habits');
    if (how === 'death') { assert(w.sim.admin.previewKill(p, 'hound', 'A').ok); assert(p.dead); }
    if (how === 'respawn') { p.dead = true; assert(w.sim.respawn(p)); }
    if (how === 'disconnect') w.sim.removePlayer(p);
    if (how === 'newrun') { assert.equal(w.sim.newRun(p, 1000), ''); assert(w.sim.join(p, 1003)); }
    if (how === 'leave') { assert(w.sim.admin.previewKill(p, 'hound', 'A').ok); assert(p.dead); assert(w.sim.leave(p, 1003)); assert(w.sim.join(p, 1003)); }
    if (how === 'world') w.eng.clear();
    if (how === 'world') { assert.equal(w.eng.entities.length, 0); assert(!w.eng.beams); assert(!w.eng.beamHist?.size); }
    else { assert(!e.mem.habits.has(p.id)); assert(!e.mem.hypotheses.some(h => h.pid === p.id)); assert(!e.dbg.habit || e.dbg.habit.pid !== p.id); }
    c.ok = true;
  } catch (err) { c.ok = false; c.error = String(err && err.message || err).slice(0, 300); }
  console.log((c.ok ? 'PASS ' : 'FAIL ') + `F13 (HQ2) ${how}: the encounter identity is cleared` + (c.error ? '  ' + c.error : ''));
}
out.ok = out.cases.every(c => c.ok);
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(out, null, 1) + '\n');
console.log(`${out.cases.filter(c => c.ok).length}/${out.cases.length} checks passed`);
process.exit(out.ok ? 0 : 1);
