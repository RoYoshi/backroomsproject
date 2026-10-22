/** @part public/assets/skinstealer.js - Spacious Audio: the Skin-Stealer's dread - only while this page can actually see it; a module: skinSight
 * Trial 3 R10 (dev/trial-3-r9-overhaul/; Trial 3 is not owner-approved).  The owner: the heartbeat and the sting when the local player
 * actually SEES the Skin-Stealer, and only while it is in sight - never because it is near, hunting or waiting unseen.  The established
 * dread (the Hound's and the Smilers' proximity k, core's mp.frame.js) is not touched: this module only answers, once a frame, how strongly
 * this page sees a Skin-Stealer now (ks) and whether a new sighting has just been confirmed (sting).  mp.frame.js plays the heartbeat on
 * max(k, ks) and the sting on its own; the drone, the vignette, the shake and the flicker stay k's alone.
 * SEEN means seen as the page draws it (the creatures layer: the sight mask and the darkness), for each mirrored Skin-Stealer that is not in
 * a borrowed skin (a convincing disguise is never given away by a cue; the moment the skin drops, at its wind-up, it is a Skin-Stealer):
 *   on screen   its body (about 30 px round its centre) inside the page with this frame's camera;
 *   in sight    a ray from the player (the bundle's own __api.Uc, the function the sight mask is cast with: walls and pillars) reaches its
 *               centre or a point 18 px either side across the line of sight, within the mask's 700 px;
 *   readable    the client's own exposureAt (__api.Ul: the near aura, the torch, the lamps, the night vision, the range fade) at that point
 *               is at least LEGIBLE (.25; dev/trial-3-r9-overhaul/DESIGN_DECISIONS.md): darkness hides it as it hides it on screen; (R16) or
 *               another wanderer's light lights it there (BR-RoLE's __light.sample peers, the light the page draws it in), taken through
 *               the same range fade and scale as exposureAt's own torch.
 * A sighting is CONFIRMED after CONFIRM seconds of being seen without a break, and on at least two frames (R16: at a few frames a second
 * one frame's flicker at a wall's edge would otherwise confirm it); a flicker at a wall's edge confirms nothing.  The intensity
 * of a seen one grows as it comes closer (never below a floor while it is in sight); ks rises fast (ATTACK) and falls in RELEASE seconds
 * when no one is seen.  The sting: once, on a confirmed sighting of a Skin-Stealer that is armed, at most every STING_GAP seconds for all of
 * them; a Skin-Stealer is armed again only after REARM seconds out of sight.  Several in sight: the strongest leads (max), one heartbeat.
 * No random draw, no timer of its own: everything advances with the frame's dt.  sightLog: the last 64 events (onset, release, sting,
 * rearm) for the browser checks.
 * imports: head { API clamp K }, mirror { list }
 * exports: -
 * provides: skinSight
 * uses: -
 * writes: -
 */
function skinSight({ head: { API, clamp, K }, mirror: { list } }) {
const MASK = 700, SIDE = 18, BODY = 30, LEGIBLE = .25, CONFIRM = .12, ATTACK = 12, RELEASE = .5, FLOOR = .35, STING_GAP = 8, REARM = 2.5;
const S = new Map();                                       // entity id -> { on: seconds seen without a break, fr: frames so, off: seconds unseen, conf, armed }
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let LS = null;                                             // (R16) BR-RoLE's light sample, reused (no allocation per frame)
/* (R16) another wanderer's light at (x, y), d px from this player, as exposureAt would read a torch there (its range fade and scale) */
function peersLegible(x, y, d, lit) {
  const L = window.__light; if (!L || !L.sample) return 0;
  if (!LS && L.mk) LS = L.mk();
  const s = L.sample(x, y, lit, LS || undefined), p = s && s.peers || 0;
  return p > 0 ? (1 - sm(420, 670, d)) * Math.min(1, .04 + p * 2.08) : 0;
}
const log = [];
let ks = 0, clock = 0, lastSting = -1e9;
const note = (ev, id, d) => { log.push([+clock.toFixed(2), ev, id, Math.round(d || 0)]); if (log.length > 64) log.shift(); };
/* how this page sees a body at (x, y): 0 (not at all) .. 1 (all three points in sight and readable) */
function seen(A, H, o, ctx) {
  const d = Math.hypot(o.x - H.x, o.y - H.y); if (d > MASK + SIDE) return { f: 0, d };
  const sc = +ctx.sc || 1, W = +ctx.W || innerWidth, Hh = +ctx.H || innerHeight, c = ctx.cam;
  if (c) { const sx = W / 2 + (o.x - c.x) * sc, sy = Hh / 2 + (o.y - c.y) * sc, m = BODY * sc; if (sx < -m || sy < -m || sx > W + m || sy > Hh + m) return { f: 0, d }; }
  const ux = (o.x - H.x) / (d || 1), uy = (o.y - H.y) / (d || 1), lit = !!(A.lightOn && A.lightOn()); let n = 0;
  for (const k of [0, -1, 1]) {
    const qx = o.x - uy * SIDE * k, qy = o.y + ux * SIDE * k, dq = Math.hypot(qx - H.x, qy - H.y); if (dq > MASK) continue;
    if (dq > 1 && A.Uc(H.x, H.y, Math.atan2(qy - H.y, qx - H.x), dq + 1) < dq - .5) continue;      // a wall or a pillar between: not in the mask
    if (A.Ul(qx, qy, H, lit) >= LEGIBLE || peersLegible(qx, qy, dq, lit) >= LEGIBLE) n++;             // dark there: the darkness hides it (R16: unless somebody else's light is on it)
  }
  return { f: n / 3, d };
}
/* once a frame (core's mp.frame.js): ctx { cam, sc, W, H, run }.  Returns { k: ks 0..1, sting: a confirmed new sighting this frame, n: how
 * many are in sight }.  No Skin-Stealer, or not in a run: ks falls to 0 and nothing else happens */
function sight(dt, ctx) {
  dt = clamp(+dt || 0, 0, .25); clock += dt; ctx = ctx || {};
  const A = API(), H = A && A.H, all = list();
  let want = 0, sting = false, n = 0;
  if (all.length || S.size) {
    const live = new Set();
    for (const o of all) {
      live.add(o.id);
      let s = S.get(o.id); if (!s) { s = { on: 0, fr: 0, off: 1e9, conf: false, armed: true }; S.set(o.id, s); }
      const v = ctx.run && H && A.Uc && A.Ul && !o.dg ? seen(A, H, o, ctx) : { f: 0, d: 1e9 };   // (a borrowed skin: never a cue)
      if (v.f > 0) { s.on += dt; s.fr++; s.off = 0; } else { if (s.conf) note('release', o.id, v.d); s.on = 0; s.fr = 0; s.off += dt; s.conf = false; if (!s.armed && s.off >= REARM) { s.armed = true; note('rearm', o.id, v.d); } }
      if (v.f > 0 && !s.conf && s.on >= CONFIRM && s.fr >= 2) {
        s.conf = true; note('onset', o.id, v.d);
        if (s.armed && clock - lastSting >= STING_GAP) { s.armed = false; lastSting = clock; sting = true; note('sting', o.id, v.d); }
      }
      if (s.conf) { n++; want = Math.max(want, FLOOR + (1 - FLOOR) * clamp(1 - v.d / MASK, 0, 1)); }
    }
    for (const id of [...S.keys()]) if (!live.has(id)) S.delete(id);
  }
  ks = want > ks ? Math.min(want, ks + (want - ks) * Math.min(1, dt * ATTACK) + dt * 2) : Math.max(want, ks - dt / RELEASE);
  if (ks < 1e-3 && !want) ks = 0;
  return { k: ks, sting, n };
}
K.sight = sight;
K.sightLog = log;
}
