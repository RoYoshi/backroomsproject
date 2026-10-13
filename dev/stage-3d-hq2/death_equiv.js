/* Stage 3D HQ2 - the eight Hound/Smiler deaths are the same as HQ1's, number for number (development only; E08)
 *
 *   node dev/stage-3d-hq2/death_equiv.js --old DIR --new DIR [--out FILE.json]
 *
 * Loads dphys.js from each game folder in its own private window object (as death_srv.js does), builds the real level from each one's
 * sim.js, and runs every death variant - Hound A-D, Smiler A-D - from the same inputs on both: 12 places on Level 0 (open floor, near
 * walls, corridors), 4 facings, with and without the victim's speed and exhaustion, each light kind and hat.  Each run goes to its end
 * (dphys.finish, as the server's aftermath does) and is compared whole: the body, the remains (blood, hands, light, hat, trail), the
 * attacker's end, the blows, every physics event and every traced position.  Also the light profile of 200 death ids per light kind.
 * Exit 0 only if every run is identical. */
'use strict';
const fs = require('fs'), path = require('path');
const ARG = {}; for (let i = 2; i < process.argv.length; i += 2) ARG[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
function load(dir) {
  const box = {}; new Function('window', fs.readFileSync(path.join(dir, 'dphys.js'), 'utf8'))(box);
  return { DP: box.__dphys, sim: require(path.join(path.resolve(dir), 'sim.js'))({ seed: 11 }) };
}
const O = load(ARG.old), N = load(ARG.new);
const spots = [];
for (let y = 600; y < 6600 && spots.length < 12; y += 470) for (let x = 600; x < 9000 && spots.length < 12; x += 1130) if (O.sim.clearAt(x, y, 26)) spots.push([x, y]);
const kinds = [['Hound', 'A'], ['Hound', 'B'], ['Hound', 'C'], ['Hound', 'D'], ['Smiler', 'A'], ['Smiler', 'B'], ['Smiler', 'C'], ['Smiler', 'D']];
const gear = ['flashlight', 'lantern', 'headlamp', 'camcorder'], hats = ['none', 'cap', 'beanie', 'hardhat'];
const res = { tool: 'dev/stage-3d-hq2/death_equiv.js', old: ARG.old, new: ARG.new, runs: 0, same: 0, diffs: [], perVariant: {} };
const strip = R => JSON.stringify({ body: R.body, remains: R.remains, attacker: R.attacker, bursts: R.bursts, dur: R.dur, angle: R.angle, ev: R.S.ev, trace: R.S.trace, trail: R.S.trail, t: R.S.t, state: R.S.state });
let i = 0;
for (const [kind, v] of kinds) {
  const pv = res.perVariant[kind + ' ' + v] = { runs: 0, same: 0 };
  for (const [x, y] of spots) for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + .3, src = { x: x - Math.cos(a) * 46, y: y - Math.sin(a) * 46 }, w = kind === 'Hound' && v === 'C' ? [x + Math.cos(a) * 70, y + Math.sin(a) * 70, a] : 0;
    const o = { kind, v, w, victim: { x, y, angle: a }, src, vx: (i % 3) * 60 - 60, vy: (i % 5) * 30 - 60, exhausted: i % 4 === 0, eqKind: gear[i % 4], hat: hats[i % 4] };
    const ro = O.DP.finish(O.DP.prepare(Object.assign({}, o, { walls: (p, q) => O.sim.blockersAt(p, q), clear: (p, q, r) => O.sim.clearAt(p, q, r) })));
    const rn = N.DP.finish(N.DP.prepare(Object.assign({}, o, { walls: (p, q) => N.sim.blockersAt(p, q), clear: (p, q, r) => N.sim.clearAt(p, q, r) })));
    const so = strip(ro), sn = strip(rn); res.runs++; pv.runs++; i++;
    if (so === sn) { res.same++; pv.same++; } else if (res.diffs.length < 10) res.diffs.push({ kind, v, x, y, a, old: so.slice(0, 300), new: sn.slice(0, 300) });
  }
}
res.lightProfiles = { compared: 0, same: 0 };
for (const k of ['flashlight', 'lantern', 'headlamp', 'camcorder']) for (let de = 1; de <= 200; de++) { res.lightProfiles.compared++; if (JSON.stringify(O.DP.lightProfile(3, de, k)) === JSON.stringify(N.DP.lightProfile(3, de, k))) res.lightProfiles.same++; }
res.ok = res.runs > 0 && res.same === res.runs && res.lightProfiles.same === res.lightProfiles.compared;
if (ARG.out) fs.writeFileSync(ARG.out, JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify({ spots: spots.length, runs: res.runs, same: res.same, perVariant: res.perVariant, lightProfiles: res.lightProfiles, diffs: res.diffs.length, ok: res.ok }));
process.exit(res.ok ? 0 : 1);
