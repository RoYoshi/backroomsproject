/* PART 2 / STAGE 2C-IR - infrared is structurally outside AI perception.
 *   node dev/tests/run.js s_ir.js        (the network side: node dev/tests/ir_net.js; the picture: python3 dev/tests/ir_test.py)
 * I1  the simulation and the AI have no infrared at all: ai.js / sim.js never name it, and server.js keeps it on the connection only
 * I2  toggling infrared alone changes no AI decision: the same world twice, players with the camcorder raised, infrared OFF in one run and
 *     HIGH in the other (written onto the player objects under every name the client uses, as if it had leaked) -> identical decisions
 * I3  a raised camcorder is not a light to the AI in either run (no beams, no light evidence) */
'use strict';
const fs = require('fs'), path = require('path');
const { World, LONG, over, rate } = require('./lib.js');
const GAME = require('../paths.js');
const S = []; const add = (name, fn) => S.push({ name, fn });
const LY = LONG.y;

add('I1 infrared never reaches the simulation: ai.js / sim.js do not name it; server.js stores it on the connection, not on the player', () => {
  const code = f => fs.readFileSync(path.join(GAME, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');   // code only: the comments may talk about infrared
  const ai = code('ai.js'), sim = code('sim.js'), srv = fs.readFileSync(path.join(GAME, 'server.js'), 'utf8');
  const IRWORDS = /\.ir\b|\birNet\b|\binfra|\bnvOn\b|__cam\b|\birLevel\b/;
  const aiHit = (ai.match(new RegExp(IRWORDS.source, 'g')) || []).length, simHit = (sim.match(new RegExp(IRWORDS.source, 'g')) || []).length;
  const onPlayer = /(player|\bp)\.ir\s*=/.test(srv), onConn = /me\.ir\s*=/.test(srv), sent = /ir:\s*c\.ir/.test(srv);
  return { ok: aiHit === 0 && simHit === 0 && !onPlayer && onConn && sent, note: `infrared names in ai.js ${aiHit}, in sim.js ${simHit}; server.js writes it on the player ${onPlayer}, on the connection ${onConn}, relays it to the other clients ${sent}` };
});

function trace(seed, ir) {
  const w = World(seed), hs = [w.hound(4300, LY), w.hound(6600, LY)], sm = w.smiler(7400, LY);
  for (const h of hs) h.ang = 0;
  const ps = [w.player(5000, LY, { light: true, kind: 'camcorder', angle: Math.PI }), w.player(5800, LY, { light: true, kind: 'camcorder', angle: 0 }), w.player(3500, LY, { light: true, kind: 'flashlight', angle: 0 })];
  ps[0].go(4100, LY, 'walk'); ps[1].go(7000, LY, 'run'); ps[2].go(4600, LY, 'walk');
  const tr = []; let leads = 0, lit = 0;
  w.run(25, () => {
    for (const p of ps) if (p.equipment.kind === 'camcorder') { p.ir = ir; p.irNet = ir; p.irLevel = ir; p.nv = ir > 0; p.nvOn = ir > 0; p.raised = true; }
    for (const p of ps) if (p.equipment.kind === 'camcorder' && p.light) lit++;
    for (const e of [...hs, sm]) leads += e.mem.leads.length;
    tr.push([...hs, sm].map(e => `${e.x.toFixed(4)},${e.y.toFixed(4)},${e.state},${e.act},${e.target},${e.mem.leads.length}`).join('|'));
  }, 1);
  return { tr, leads, lit, kills: w.kills.length };
}
add('I2 toggling infrared alone changes no AI decision (OFF vs HIGH, same world, same players, tick by tick)', () => {
  const rs = over([1, 2, 3, 4], s => { const A = trace(s, 0), B = trace(s, 2); const i = A.tr.findIndex((x, j) => x !== B.tr[j]); return { ok: i < 0 && A.tr.length === B.tr.length, at: i, n: A.tr.length, k: A.kills }; });
  return { ok: rate(rs) === 1, note: `${rs.filter(r => r.ok).length}/${rs.length} worlds identical over ${rs[0].n} ticks with infrared OFF and HIGH${rs.some(r => !r.ok) ? ' - first difference at ' + rs.map(r => r.at).join(',') : ''} (kills in the runs: ${rs.map(r => r.k).join(',')})` };
});
add('I3 a raised camcorder is no light to the AI: no lit player, no light evidence from it', () => {
  const w = World(5), h = w.hound(5000, LY); h.ang = 0; h.state = 'ROAMING'; h.act = 'rest'; h.rest = 1e9;
  const p = w.player(5500, LY, { light: true, kind: 'camcorder', angle: Math.PI }); p.stop('stand'); p.ir = 2;
  w.run(3, null);
  return { ok: !p.light && w.eng.lightPlayers().length === 0 && h.mem.leads.length === 0, note: `visible light ${p.light}; lit players the AI knows of ${w.eng.lightPlayers().length}; light leads ${h.mem.leads.length}` };
});
module.exports = S;
