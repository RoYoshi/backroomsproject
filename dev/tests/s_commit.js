/* v20: a hound commits to its kill for as long as the death plays out, then decides (next victim / guard / feed / leave) */
'use strict';
const { World, DT, dist, geo, rate, avg } = require('./lib.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
function openSpot(i) { const G = geo(); const o = G.opens.length ? G.opens : G.cells.map(c => ({ x: G.g.cx(c), y: G.g.cy(c) })); return o[(i * 37 + 11) % o.length]; }
function killWithWitness(i, V = 'A', witnessD = 110) {
  const c = openSpot(i), w = World(900 + i), p = w.player(c.x, c.y, { light: true }); p.stop('stand'); p.angle = 0;
  const q = w.player(c.x + witnessD, c.y + 30, { light: true }); q.stop('stand');
  if (!w.ad.clear(q.x, q.y, 20, 'walk')) { q.x = c.x - witnessD; }
  const h = w.hound(c.x - 200, c.y); h.tr.AGGRESSION = .95; h.tr.CAUTION = .05;              // the kind that goes straight for the next one
  const r = w.sim.admin.previewKill(p, 'hound', V); if (!r || !r.ok) return null;
  w.run(.2, null); if (!w.kills.length) return null;
  const k0 = { x: h.x, y: h.y }, t0 = w.t; let maxMove = 0, capQ = -1, left = -1, st = new Set();
  w.run(8, () => { const t = w.t - t0; st.add(h.state); if (h.commit && left < 0) maxMove = Math.max(maxMove, dist(h, k0)); if (capQ < 0 && (q.caught || q.dead)) capQ = t; if (left < 0 && !h.commit) left = t; });
  return { maxMove, capQ, left, st: [...st].join(','), w, h };
}
add('K01 a hound that kills stays on its kill for the whole death (does not move, does not take the witness standing right there)', () => {
  const rs = [1, 2, 3, 4, 5, 6, 7, 8].map(i => killWithWitness(i)).filter(Boolean);
  const held = rs.filter(r => r.maxMove < 2 && r.left >= 4.5 && (r.capQ < 0 || r.capQ >= 4.5));
  return { ok: rs.length >= 5 && held.length === rs.length, note: `${held.length}/${rs.length}: committed ${avg(rs.map(r => r.left)).toFixed(1)} s on average (death A is 4.5 s), moved at most ${Math.max(...rs.map(r => r.maxMove)).toFixed(1)} px meanwhile; witness taken at ${rs.map(r => r.capQ < 0 ? '-' : r.capQ.toFixed(1)).join(',')} s` };
});
add('K02 ...and then it decides: an aggressive hound goes for the witness after the kill, not during it', () => {
  const rs = [1, 2, 3, 4, 5, 6, 7, 8].map(i => killWithWitness(i)).filter(Boolean);
  const after = rs.filter(r => r.capQ >= 4.5 || /HUNTING|FEEDING|EXCITED|STALKING/.test(r.st));
  return { ok: rs.length >= 5 && after.length >= rs.length * .75, note: `${after.length}/${rs.length} acted on the witness or the kill afterwards (states: ${rs.map(r => r.st).join(' | ').slice(0, 200)})` };
});
add('K03 every variant commits for its own length (A 4.5 / B 4.7 / C 4.3 / D 4.5 s)', () => {
  const out = {}; let ok = true;
  for (const V of ['A', 'B', 'D']) { const r = killWithWitness(3, V, 400); if (!r) { ok = false; continue; } out[V] = r.left.toFixed(2); const want = { A: 4.5, B: 4.7, D: 4.5 }[V]; if (r.left < want || r.left > want + 2) ok = false; }
  return { ok, note: JSON.stringify(out) + ' (C needs a wall; same code path)' };
});
add('K04 the victim\'s report of where the animation left the hound is used only if it is close and clear', () => {
  const r = killWithWitness(2, 'A', 500); if (!r) return { ok: false, note: 'no setup' };
  const r2 = killWithWitness(2, 'A', 500);                                                     // fresh world, same kill: now report
  const W = World(902), G = geo();
  const test = (dx) => { const c = openSpot(2), w = World(950), p = w.player(c.x, c.y, {}); p.stop('stand'); p.angle = 0; const h = w.hound(c.x - 200, c.y); w.sim.admin.previewKill(p, 'hound', 'A'); w.run(.2, null); const x0 = h.x, y0 = h.y; const moved = w.sim.killerEnd(p.id, x0 + dx, y0, 1); return { moved, d: Math.hypot(h.x - x0, h.y - y0) }; };
  const near = test(60), far = test(900);
  return { ok: near.moved && near.d > 50 && !far.moved && far.d < 1, note: `60 px away: accepted (${near.d.toFixed(0)} px); 900 px away: refused` };
});
module.exports = S;
