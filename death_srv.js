/* death_srv.js - the server's side of a death's aftermath (never served to browsers).
 *
 * A death is a world event: the server decides it (ai.js -> sim.js p.kill).  Normally the victim's own client plays the physical
 * death (dphys.js), tells everyone else to replay it ('fx') and, when the body comes to rest, reports the corpse ('b').  If that client
 * disappears first, this module stands in for it with the SAME simulation: dphys.js is loaded here, fed the inputs the victim's client
 * would have used (the server's kill record, the victim's look and gear), and its last frame becomes the corpse.  So a corpse and its
 * dropped light always exist, exactly one of each (bodies are keyed by player id), and every observer sees the same thing.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const box = { window: {TFB_MOTION:require('./world_motion')}, console, Math };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'dphys.js'), 'utf8'), box, { filename: 'dphys.js' });
const DP = box.window.__dphys;

/* what the victim's client would have sent as 'fx' for a death, from the server's own record */
function fxFor(id, kill, info) {
  return { t: 'fx', k: 'death', id, c: kill.k === 'Smiler' ? 'Smiler' : 'Hound', x: kill.x, y: kill.y, a: kill.a, sx: kill.ax, sy: kill.ay,
    v: /^[ABCD]$/.test(kill.v) ? kill.v : 'A', w: kill.w || 0, lk: info.look, ek: info.ek, ec: info.ec, ep: info.ep, vx: Math.round(info.vx || 0), vy: Math.round(info.vy || 0), ex: info.ex ? 1 : 0, srv: 1 };
}
/* the corpse record (the same fields the victim's client reports in 'b'), from the physical death run to its end */
function bodyFor(id, kill, info, sim) {
  const hat = String(info.look || '').split('|')[0] || 'none';
  const R = DP.simulate({ kind: kill.k, v: kill.v, w: kill.w, victim: { x: kill.x, y: kill.y, angle: kill.a }, src: { x: kill.ax, y: kill.ay },
    vx: info.vx, vy: info.vy, exhausted: !!info.ex, eqKind: info.ek, hat, walls: (x, y) => sim.blockersAt(x, y), clear: (x, y, r) => sim.clearAt(x, y, r) });
  const b = R.body, m = R.remains, f = v => +(+v).toFixed(3);
  return {
    body: { k: id, n: info.name, x: Math.round(b.x), y: Math.round(b.y), a: f(b.angle), sx: f(b.scaleX), sy: f(b.scaleY), c: R.kind, aa: f(R.angle), lk: info.look,
      eq: { kind: info.ek, color: info.ec, parts: info.ep }, bl: R.bursts.slice(0, 6).map(q => [Math.round(q.x), Math.round(q.y), (q.seed | 0) % 1000]),
      dr: [Math.round(m.dropped.x), Math.round(m.dropped.y), f(m.dropped.angle)], ht: [Math.round(m.hat.x), Math.round(m.hat.y), f(m.hat.angle)], lo: info.light ? 1 : 0,
      ph: 1, hd: m.hands.flat().map(v => Math.max(-80, Math.min(80, v))), ho: m.hatOn ? 1 : 0, tr: m.trail, srv: 1 },
    attacker: R.attacker, dur: R.dur };
}
const durOf = kill => (DP.DURS[kill.k === 'Smiler' ? 'Smiler' : 'Hound'] || {})[kill.v] || 4.4;
module.exports = { fxFor, bodyFor, durOf, DP };
