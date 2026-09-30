/* Part 1 audit remediation - the parts that live in the simulation (the wire-level ones are in audit_net.js).
 *   node dev/tests/run.js s_audit.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { World, DT, LONG } = require('./lib.js');
const GAME = require('../paths.js');
const SPECIES = require(GAME + '/ai.js').SPECIES;
const S = []; const add = (name, fn) => S.push({ name, fn });
const X0 = 5000, Y0 = LONG.y;

/* a victim held (not killed) by a hound: the play branch of a capture */
function held(seed) {
  const sp = SPECIES.hound, old = sp.capture.quick; sp.capture.quick = () => false;
  try {
    const w = World(seed + 2600); w.sim.admin.blackout('on'); w.sim.debug.V.blackout = true;
    const v = w.player(X0, Y0, {}); v.stop('stand'); v.angle = Math.PI;
    const e = w.hound(X0 - 34, Y0); e.ang = 0; e.state = 'HUNTING'; e.target = v.id;
    w.run(3, () => (v.caught && !v.dead) ? false : true, 1);
    return v.caught && !v.dead ? { w, v, e } : null;
  } finally { sp.capture.quick = old; }
}

add('L1 lifecycle: a living, free player cannot respawn', () => {
  const w = World(1), p = w.player(X0, Y0, {}); w.run(.5, null); p.stamina = 40;
  const x = p.x, y = p.y, ok = w.sim.respawn(p);
  return { ok: ok === false && p.x === x && p.y === y && p.stamina === 40 && !p.dead, note: `respawn -> ${ok}; position ${Math.round(p.x)},${Math.round(p.y)} (unchanged), stamina ${p.stamina} (unchanged)` };
});
add('L2 lifecycle: a dead player respawns (at the spawn point, full stamina, protected)', () => {
  const w = World(2), p = w.player(X0, Y0, {}); p.dead = 'Hound'; p.stamina = 12;
  const ok = w.sim.respawn(p), Ic = w.sim.debug.Ic;
  return { ok: ok === true && !p.dead && Math.hypot(p.x - Ic.x, p.y - Ic.y) < 1 && p.stamina === 100 && p.safe > 0, note: `respawn -> ${ok}; at ${p.x},${p.y}, stamina ${p.stamina}, protection ${p.safe}s` };
});
add('L3 lifecycle: held in a capture but not dead - no respawn and no new run (the capture ends in a death or a release)', () => {
  const rs = []; for (let s = 1; s <= 12 && rs.length < 4; s++) { const A = held(s); if (!A) continue; const { w, v } = A; const x = v.x, y = v.y;
    const r1 = w.sim.respawn(v), r2 = w.sim.join(v); rs.push({ r1, r2, still: !!v.caught && Math.hypot(v.x - x, v.y - y) < 1 });
    let end = ''; w.run(40, () => { if (v.dead) { end = 'dead'; return false; } if (!v.caught) { end = 'released'; return false; } }, 1);
    rs[rs.length - 1].end = end; rs[rs.length - 1].after = end === 'dead' ? w.sim.respawn(v) : null; }
  return { ok: rs.length >= 3 && rs.every(r => r.r1 === false && r2false(r) && r.still) && rs.filter(r => r.end === 'dead').every(r => r.after === true),
    note: `${rs.length} holds: respawn ${rs.map(r => r.r1).join(',')}; new run ${rs.map(r => r.r2).join(',')}; still held in place ${rs.filter(r => r.still).length}/${rs.length}; ended ${rs.map(r => r.end || 'still held').join(',')}; respawn once dead ${rs.filter(r => r.end === 'dead').map(r => r.after).join(',') || '-'}` };
});
function r2false(r) { return r.r2 === false; }
add('L4 lifecycle: an admin revive leaves one respawn (and only one)', () => {
  const w = World(3), p = w.player(X0, Y0, {}); p.dead = 'Hound';
  p.dead = ''; p.reviveOk = true;                                      // what server.js does on the admin's REVIVE
  const a = w.sim.respawn(p), b = w.sim.respawn(p);
  return { ok: a === true && b === false, note: `first respawn after a revive ${a}, a second one ${b}` };
});
add('L5 movement check: open floor and short hops pass; through a wall does not; a long hop needs a real route that short', () => {
  const w = World(4), sim = w.sim;
  const open = sim.moveOk(X0, Y0, X0 + 40, Y0, 500), longOk = sim.moveOk(X0, Y0, X0 + 400, Y0, 500);
  let wall = null; for (let y = 600; y < 6600 && !wall; y += 96) for (let x = 600; x < 8900 && !wall; x += 96) for (let k = 110; k <= 250 && !wall; k += 20) if (sim.clearAt(x, y, 22) && sim.clearAt(x, y - k, 22) && !sim.moveOk(x, y, x, y - k, 700)) wall = [x, y, x, y - k];
  const inWall = sim.moveOk(X0, Y0, X0, Y0 - 3000, 1e5);
  // table / wall hole / vault props are passable for the check (the client's own movement deals with them)
  const W = require(GAME + '/world.js'), c = W.CRAWL.find(q => q.type === 'gap'), x0 = c.exits[0], x1 = c.exits[1], hole = sim.moveOk(x0.x, x0.y, x1.x, x1.y, 500);
  return { ok: open && longOk && !!wall && !inWall && hole, note: `40 px on open floor ${open}; 400 px down the corridor ${longOk}; across a wall with no way round ${wall ? 'refused' : 'NOT FOUND'}; into solid rock ${inWall}; through wall hole ${c.id} ${hole}` };
});
add('L6 the death plan numbers are one table: the bundle\'s death class and the server fallback read the same knock / drag / blows as v22 did', () => {
  // the v22 table (ents_src/25_death.js before the audit fix), kept here verbatim as the reference
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const OLD = (kind, v, wd) => { const P = { kn: 34, dr: kind === 'Hound' ? 128 : 86, hits: null, kt: [.08, .36], dw: [2.03, 3.12], spin: 1.65, squish: 1 };
    if (kind === 'Hound') { if (v === 'A') { P.kn = 46; P.dr = 40; P.hits = [.2, .62, 1.05, 1.55]; P.spin = 1.9; } else if (v === 'B') { P.kn = 12; P.dr = 140; P.hits = [.3, .85, 1.5, 2.1]; P.dw = [.9, 2.2]; P.spin = 1.2; } else if (v === 'C') { P.kn = clamp(wd - 17, 0, 110); P.dr = 0; P.kt = [.04, .2]; P.hits = [.2, .21, .8, 1.4]; P.spin = 2.2; } else { P.kn = 24; P.dr = 26; P.hits = [.45, .95, 1.55]; P.spin = .3; P.squish = 1.9; } }
    else { if (v === 'B') { P.kn = 0; P.dr = 0; P.hits = [.7, 1.2, 1.7]; P.spin = 1.4; } else if (v === 'C') { P.kn = 18; P.dr = 36; P.hits = [.55, 1.1, 1.6]; } else if (v === 'D') { P.kn = 26; P.dr = 70; P.hits = [.6, 1.2, 1.8]; P.dw = [1.6, 3.0]; } }
    return P; };
  const win = {}; vm.runInNewContext(fs.readFileSync(path.join(GAME, 'dphys.js'), 'utf8'), { window: win, Math, console });
  let diff = 0, n = 0; for (const k of ['Hound', 'Smiler']) for (const v of ['A', 'B', 'C', 'D']) for (const wd of [10, 40, 90, 200]) { n++; const a = OLD(k, v, wd), b = win.__dphys.PLAN(k, v, wd); for (const f of ['kn', 'dr', 'hits', 'kt', 'dw', 'spin', 'squish']) if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) diff++; }
  return { ok: diff === 0 && n === 32, note: `${n} kind / variant / wall-distance combinations, ${diff} differing values` };
});
add('L7 the server fallback corpse is the physical death run to rest: deterministic, on open floor, gear and hands present', () => {
  const D = require(GAME + '/death_srv.js'), w = World(5), sim = w.sim, out = [];
  for (const v of ['A', 'B', 'C', 'D']) for (const k of ['Hound', 'Smiler']) {
    const kill = { k, v, x: X0, y: Y0, a: 0, ax: X0 - 40, ay: Y0, w: 0 }, info = { name: 'T', look: 'cap|plain|#e6bb76|#ffcc77|none', ek: 'flashlight', ec: '#ffe7b2', ep: '', vx: 120, vy: 0, ex: 0, light: true };
    const a = D.bodyFor(7, kill, info, sim).body, b = D.bodyFor(7, kill, info, sim).body;
    out.push({ same: JSON.stringify(a) === JSON.stringify(b), clear: sim.clearAt(a.x, a.y, 8), gear: a.eq.kind === 'flashlight' && a.dr.length === 3, hands: a.hd.length === 4, moved: Math.hypot(a.x - X0, a.y - Y0) });
  }
  return { ok: out.every(o => o.same && o.clear && o.gear && o.hands), note: `8 deaths: identical twice ${out.filter(o => o.same).length}/8, corpse on open floor ${out.filter(o => o.clear).length}/8, light dropped ${out.filter(o => o.gear).length}/8, hands ${out.filter(o => o.hands).length}/8; bodies came to rest ${out.map(o => Math.round(o.moved)).join(', ')} px from where the kill began` };
});
module.exports = S;
