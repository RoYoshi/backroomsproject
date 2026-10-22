/* dev/trial-3-r9-overhaul/tools/qa_sight.js - TEST-ONLY ground truth: can this player, in the game as it is drawn, make out a body at (x, y)?
 * (Trial 3 R9-R17; not owner-approved.)  A QA oracle for scenarios and tools ONLY: it reads where the player and the creature really are,
 * which the creature itself never may.  Nothing under src/ requires it.
 *
 * It mirrors the client's own rules (src/core/client/game/client/render.ts and shared/vision.ts), on the server's copy of the level:
 *   - the sight mask: the creatures layer is masked by visibilityPolygon(player, 700): a body is in it when a ray from the player reaches it
 *     before a wall or a pillar (the server adapter's ray, the same DDA + pillar test as the client's rayDistance), within 700 px;
 *   - the darkness: exposureAt(x, y, player, flash) = rangeFade(d) x min(1, .04 + max(near aura, carried light, lamp) x 2.08) - the same
 *     terms (the near aura (1 - smooth(28,100,d)) x .5, the carried light qc() with the LOS test, the static lamp field; no flicker);
 *   - the screen is not modelled (window sizes differ): a body inside the mask and readable counts as visible.
 * A body is sampled at its centre and 18 px to either side across the line of sight (the drawn body is about 42 px wide at R8's 1.3 scale).
 * LEGIBLE (.25): the threshold this pack's R10 also uses on the page (documented in DESIGN_DECISIONS.md). */
'use strict';
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const RADIUS = 700, LEGIBLE = .25, SIDE = 18;
function legibility(w, p, x, y) {
  const geo = w.eng.geo, d = Math.hypot(x - p.x, y - p.y);
  let s = (1 - sm(28, 100, d)) * .5;
  if (p.light && w.ad.qc) { const q = w.ad.qc(p, { x, y }, true); if (q > s && geo.los(p.x, p.y, x, y)) s = q; }
  const blackout = geo.a.blackout ? geo.a.blackout() : false, i = geo.cellAt(x, y);
  if (!blackout && i >= 0) s = Math.max(s, geo.lamp[i] || 0);
  return (1 - sm(420, 670, d)) * Math.min(1, .04 + s * 2.08);
}
/* { vis, frac, leg, d, los } for player p and a body at (x, y) */
function sees(w, p, x, y) {
  const geo = w.eng.geo, d = Math.hypot(x - p.x, y - p.y);
  if (!p || p.dead || d > RADIUS + SIDE) return { vis: false, frac: 0, leg: 0, d, los: false };
  const ux = (x - p.x) / (d || 1), uy = (y - p.y) / (d || 1); let n = 0, los = false, leg = 0;
  for (const k of [0, -1, 1]) {
    const qx = x - uy * SIDE * k, qy = y + ux * SIDE * k, dq = Math.hypot(qx - p.x, qy - p.y);
    if (dq > RADIUS || !geo.los(p.x, p.y, qx, qy)) continue;
    los = true; const l = legibility(w, p, qx, qy); leg = Math.max(leg, l); if (l >= LEGIBLE) n++;
  }
  return { vis: n > 0, frac: n / 3, leg: +leg.toFixed(3), d: Math.round(d), los };
}
module.exports = { sees, legibility, RADIUS, LEGIBLE };
