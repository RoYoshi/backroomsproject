/* ents.js - client side of the v16 entities: the redesigned Hound and Smiler (drawn procedurally, articulated),
 * their sounds, and the admin-only AI debug overlay.  The server decides everything they do (ai.js); this file only
 * draws and voices what the snapshots say.  Loaded after the game bundle; mp.js feeds it. */
(() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const rnd = (a, b) => a + Math.random() * (b - a);
const E = window.__ents = {
  /* code tables (the server sends its own in the hello message; these are the same lists) */
  tab: {
    s: ['DORMANT', 'ROAMING', 'CURIOUS', 'ALERT', 'WATCHING', 'STALKING', 'HUNTING', 'SEARCHING', 'CAUTIOUS', 'FRUSTRATED', 'EXCITED', 'FEEDING', 'PLAYING', 'RETREATING', 'HIDDEN', 'FOLLOWING', 'PROVOKED', 'ATTACKING', 'DISAPPEARING'],
    h: ['', 'listen', 'sniff', 'freeze', 'wind', 'lunge', 'recover', 'feed', 'vault', 'circle', 'stare', 'drag', 'growl', 'rest', 'pace', 'back', 'guard'],
    m: ['', 'watch', 'follow', 'wait', 'creep', 'rush', 'fade', 'cornered', 'lightfail', 'stare', 'back', 'circle', 'block', 'hold'],
  },
  setTables(t) { if (t && t.s && t.h && t.m) E.tab = t; },
};
const API = () => window.__api;
/* the game's own (single-player) code and its audio cues know the monsters by these older names */
const HLS = { HUNTING: 'chase', STALKING: 'stalk', SEARCHING: 'search', CURIOUS: 'investigate', ALERT: 'investigate', FRUSTRATED: 'search' };
const SLS = { WATCHING: 'watch', FOLLOWING: 'stalk', STALKING: 'stalk', PROVOKED: 'pursue', ATTACKING: 'pursue', PLAYING: 'pursue' };

/* ---------------------------------------------------------------- snapshot -> slot objects (smoothed for display) */
E.slotH = function (o, t, dt) {
  const k = 1 - Math.exp(-dt * 15), px = o.x, py = o.y;
  if (Math.hypot(t.x - o.x, t.y - o.y) > 260) { o.x = t.x; o.y = t.y; o.angle = t.a; }
  else { o.x += (t.x - o.x) * k; o.y += (t.y - o.y) * k; }
  o.angle += angDiff(t.a, o.angle) * (1 - Math.exp(-dt * 14));
  o.distance += Math.hypot(o.x - px, o.y - py);
  o.state = E.tab.s[t.s] || 'ROAMING'; o.ls = HLS[o.state] || 'patrol'; o.act = E.tab.h[t.ac] || ''; o.v = t.v; o.head = t.h; o.lunge = t.l; o.tg = t.tg; o.cp = t.cp; o.pack = t.k; o.net = 1;
};
E.slotS = function (o, t, dt) {
  const k = 1 - Math.exp(-dt * 12), px = o.x, py = o.y;
  if (Math.hypot(t.x - o.x, t.y - o.y) > 260) { o.x = t.x; o.y = t.y; o.angle = t.a; }
  else { o.x += (t.x - o.x) * k; o.y += (t.y - o.y) * k; }
  o.angle += angDiff(t.a, o.angle) * (1 - Math.exp(-dt * 10));
  o.distance = (o.distance || 0) + Math.hypot(o.x - px, o.y - py);
  o.state = E.tab.s[t.s] || 'HIDDEN'; o.ls = SLS[o.state] || 'lurk'; o.act = E.tab.m[t.ac] || ''; o.v = t.v; o.face = t.f; o.head = t.h; o.tg = t.tg; o.cp = t.cp; o.lit = t.lt; o.special = t.sp; o.net = 1; o.sid = t.i;
};
