/* death_srv.js - the server's side of a death's aftermath (never served to browsers).
 *
 * A death is a world event: the server decides it (ai.js -> sim.js p.kill).  Normally the victim's own client plays the physical
 * death (dphys.js), tells everyone else to replay it ('fx') and, when the body comes to rest, reports the corpse ('b').  If that client
 * disappears first, this module stands in for it with the SAME simulation: dphys.js is loaded here, fed the inputs the victim's client
 * would have used (the server's kill record, the victim's look and gear), and its last frame becomes the corpse.  So a corpse and its
 * dropped light always exist, exactly one of each (bodies are keyed by player id), and every observer sees the same thing.
 */
'use strict';
const fs = require('fs'), path = require('path');
/* Stage 3D: dphys.js runs in this process's own context (its 'window' is a private object), not a vm sandbox: the same code and the same
 * numbers, about four times faster once warm, because nothing crosses a context boundary at every wall query.  One short run of each
 * killer at load warms it up, so the first real fallback does not pay for the compiler. */
const box = {};
new Function('window', fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'generated', 'server', 'dphys.js'), 'utf8') + '\n//# sourceURL=dphys.js')(box);
const DP = box.__dphys;
for (const kind of ['Hound', 'Smiler']) DP.simulate({ kind, v: 'A', victim: { x: 500, y: 500, angle: 0 }, src: { x: 454, y: 500 }, walls: () => [], clear: () => true });

/* what the victim's client would have sent as 'fx' for a death, from the server's own record */
function fxFor(id, kill, info) {
  return { t: 'fx', k: 'death', id, c: kill.k === 'Smiler' ? 'Smiler' : 'Hound', x: kill.x, y: kill.y, a: kill.a, sx: kill.ax, sy: kill.ay,
    v: /^[ABCD]$/.test(kill.v) ? kill.v : 'A', w: kill.w || 0, lk: info.look, ek: info.ek, ec: info.ec, ep: info.ep, vx: Math.round(info.vx || 0), vy: Math.round(info.vy || 0), ex: info.ex ? 1 : 0, srv: 1 };
}
/* Stage 3D: the physical death as the server runs it - begun at the kill (begin), advanced a little on every pass of the server's loop
 * while it plays (step: the cost is spread over the death instead of landing in one tick), finished at its end (corpse).  Running it in
 * pieces ends exactly where one run ends (dphys.finish). */
function begin(kill, info, sim) {
  const hat = String(info.look || '').split('|')[0] || 'none';
  return DP.prepare({ kind: kill.k, v: kill.v, w: kill.w, victim: { x: kill.x, y: kill.y, angle: kill.a }, src: { x: kill.ax, y: kill.ay },
    vx: info.vx, vy: info.vy, exhausted: !!info.ex, eqKind: info.ek, hat, walls: (x, y) => sim.blockersAt(x, y), clear: (x, y, r) => sim.clearAt(x, y, r) });
}
const step = (P, secs) => DP.advance(P.S, Math.min(P.dur, Math.max(0, secs)));
/* the corpse record (the same fields the victim's client used to report in 'b'), from the physical death run to its end */
function corpse(id, kill, info, P) {
  const R = DP.finish(P), b = R.body, m = R.remains, f = v => +(+v).toFixed(3);
  return {
    body: { k: id, n: info.name, x: Math.round(b.x), y: Math.round(b.y), a: f(b.angle), sx: f(b.scaleX), sy: f(b.scaleY), c: R.kind, aa: f(R.angle), lk: info.look,
      eq: { kind: info.ek, color: info.ec, parts: info.ep }, bl: m.blood.slice(0, 8).map(q => [Math.round(q.x), Math.round(q.y), (q.seed | 0) % 1000]),
      dr: [Math.round(m.dropped.x), Math.round(m.dropped.y), f(m.dropped.angle)], ht: [Math.round(m.hat.x), Math.round(m.hat.y), f(m.hat.angle)], lo: info.light ? 1 : 0,
      ph: 1, hd: m.hands.flat().map(v => Math.max(-80, Math.min(80, v))), ho: m.hatOn ? 1 : 0, tr: m.trail, srv: 1,
      ...(m.gibs ? { gs: m.gibs.gs, gb: m.gibs.gb.slice(0, 8), gh: m.gibs.gh } : {}),                    // Stage 3D HQ3: a NEW RUN's gibs (dphys.gibRecord): the breakup's seed, each piece and both hands where they came to rest
      ...(Array.isArray(kill.lf) ? { lf: [kill.lf[0], kill.lf[1], kill.lf[2], f((info.ek === 'headlamp' || !(R.S.eqAt >= 0) ? 0 : R.S.eqAt) - R.dur)] } : {}) },   // Stage 3D HQ1: [hold, fade, seed, release - death length]
    attacker: R.attacker, dur: R.dur };
}
const bodyFor = (id, kill, info, sim) => corpse(id, kill, info, begin(kill, info, sim));
const durOf = kill => kill.k === 'Boom' ? DP.DURS.Boom.A : (DP.DURS[kill.k === 'Smiler' ? 'Smiler' : 'Hound'] || {})[kill.v] || 4.4;
/* Stage 3D HQ2: NEW RUN's self-destruction as a server event, beside the deaths.  The record (B): k 'Boom', where the player stood and
 * faced (x, y, a), the blast's seed and direction (s, d: dphys.boomPlan of the world and the event id) and, for a lit light, the HQ1
 * light profile (lf).  Its replay message, its run (the same 240 Hz physics every screen runs from the same numbers) and, at its end,
 * its corpse (corpse() above: cause 'Boom', the body, both hands, the light and the hat where they came to rest, the blood, the wall
 * marks, the light's release).  Stage 3D HQ3: the body is gibbed - the record also names the breakup's seed and where every piece and
 * both hands came to rest (gs, gb, gh), so every screen, a late joiner's and a reloaded one's included, draws the same remains. */
function boomFx(id, B, info) {
  return { t: 'fx', k: 'boom', id, x: B.x, y: B.y, a: B.a, d: B.d, s: B.s, lk: info.look, ek: info.ek, ec: info.ec, ep: info.ep, vx: Math.round(info.vx || 0), vy: Math.round(info.vy || 0), srv: 1 };
}
function boomBegin(B, info, sim) {
  const hat = String(info.look || '').split('|')[0] || 'none';
  return DP.prepare({ kind: 'Boom', victim: { x: B.x, y: B.y, angle: B.a }, dir: B.d, seed: B.s, vx: info.vx, vy: info.vy, eqKind: info.ek, hat,
    walls: (x, y) => sim.blockersAt(x, y), clear: (x, y, r) => sim.clearAt(x, y, r) });
}
module.exports = { fxFor, bodyFor, begin, step, corpse, durOf, DP, boomFx, boomBegin };
