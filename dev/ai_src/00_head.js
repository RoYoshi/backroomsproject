/* ai.js - reusable entity AI for The Far Backrooms (v16).  UMD: require('./ai.js') on the server.
 * Everything an entity does is built from the same components:
 *   PERCEPTION (vision with walls / darkness / posture, hearing from a sound bus)  ->  MEMORY (last known position, staleness)
 *   PERSONALITY (traits with per-instance variation)  ->  STATE FRAMEWORK  ->  MOVEMENT + TRAVERSAL (vault / crawl / tight gaps)
 *   TARGET SELECTION, SEARCHING, SOCIAL AWARENESS (only from what the entity can perceive), CAPTURE + KILL SELECTION.
 * Species (Hound, Smiler) are just data plus a `think` function on top of these parts.  The engine is server
 * authoritative and never reads a player list directly for decisions: it only sees what perception hands it. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./world.js'), require('./world_motion.js'));
  else root.AI = factory(root.WORLD, root.TFB_MOTION);
})(typeof self !== 'undefined' ? self : this, function (WORLD, MOTION) {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function mkRng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// Stable, unsigned FNV-1a derivation; tags separate fixed-size entity streams from the world director.
function deriveSeed(seed, ...tags) {
  let h = (2166136261 ^ (seed >>> 0)) >>> 0;
  for (const tag of tags) { const s = String(tag); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; h = Math.imul(h ^ 255, 16777619) >>> 0; }
  return h;
}
function entityStreams(seed, kind, id) {
  const out = {}; for (const tag of ['personality', 'behavior', 'search', 'perception', 'schedule']) out[tag] = mkRng(deriveSeed(seed, kind, id, tag));
  return out;
}
const S = {                                    // the shared state framework (species use the subset they need)
  DORMANT: 'DORMANT', ROAMING: 'ROAMING', CURIOUS: 'CURIOUS', ALERT: 'ALERT', WATCHING: 'WATCHING', STALKING: 'STALKING', HUNTING: 'HUNTING',
  SEARCHING: 'SEARCHING', CAUTIOUS: 'CAUTIOUS', FRUSTRATED: 'FRUSTRATED', EXCITED: 'EXCITED', FEEDING: 'FEEDING', PLAYING: 'PLAYING', RETREATING: 'RETREATING',
  HIDDEN: 'HIDDEN', FOLLOWING: 'FOLLOWING', PROVOKED: 'PROVOKED', ATTACKING: 'ATTACKING', DISAPPEARING: 'DISAPPEARING',
};
const SNAMES = Object.keys(S), SCODE = {}; SNAMES.forEach((k, i) => SCODE[k] = i);
const TRAITS = ['INTELLIGENCE', 'SADISM', 'HUNGER', 'PATIENCE', 'CURIOSITY', 'CAUTION', 'TERRITORIALITY', 'AGGRESSION', 'PERSISTENCE', 'SOCIAL', 'HEARING', 'VISION', 'LIGHT_SENS', 'MEMORY'];

/* a coarse spatial hash for "who is near" queries (players, sounds) */
class Hash {
  constructor(cs = 384) { this.cs = cs; this.m = new Map(); }
  clear() { this.m.clear(); }
  key(cx, cy) { return cx * 4096 + cy; }
  add(o, x, y) { const k = this.key(Math.floor(x / this.cs), Math.floor(y / this.cs)); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(o); }
  near(x, y, r, fn) {
    const cs = this.cs, x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs), y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const a = this.m.get(this.key(cx, cy)); if (a) for (const o of a) fn(o); }
  }
}
