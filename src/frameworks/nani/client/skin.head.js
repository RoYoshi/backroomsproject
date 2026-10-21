/** @part public/assets/skinstealer.js - N.A.N.I.: the Skin-Stealer on the page (Trial 3): the script's head, its code tables and small math; a module: skinHead
 * Trial 3: the page's side of the third species.  The server decides everything it does (generated/server/ai.js, ai.skinstealer.js);
 * this script only mirrors what the snapshots say and draws it, through the page's existing seams: N.A.N.I.'s mp.js module hands it
 * the server's list (window.__skin.mirror, once a frame, then window.__skin.draw); it draws into the bundle's creatures layer
 * (window.__api.layer(): the same sight mask and darkness as everything else), shaded by BR-RoLE's light sample (window.__light).
 * The compiled client is not changed (the gate's port and bundle steps prove it is still the shipped program).
 * imports: -
 * exports: ACTS, angDiff, API, BODY_SCALE, clamp, hooks, K, lend, lerp, sm, STATES, TAU
 * provides: skinHead
 * uses: -
 * writes: -
 */
/* skinstealer.js - the Skin-Stealer on the page (Trial 3; dev/trial-3-skin-stealer/DESIGN_DECISIONS.md).  Loaded after mp.js. */
(() => {
'use strict';
function skinHead() {
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const API = () => window.__api;
/* (predator refinement R5) the undisguised body's drawn size: its one scale (dev/trial-3-predator-refinement/BALANCE_TABLE.md; UNAPPROVED).
 * Only the drawing grows: the server's body (radius 24), its reach and its routes are unchanged, and a borrowed skin is the page's own
 * Wanderer avatar at a player's size */
const BODY_SCALE = 1.3;
/* the script's public object: each module adds its own entries (mirror: the snapshot's list, and (T6) where an entity is drawn for chat.js;
 * body: draw, clear; kill: the attacker in a death; audio: a death's sounds) */
const K = window.__skin = {};
/* what a later module lends an earlier one, inside the script only (never on the page): kill's test of a creature whose kill is playing */
const hooks = { hidden: null, frame: null, audio: null };
const lend = (name, fn) => { if (name in hooks) hooks[name] = fn; };
/* the codes as the server sends them: the shared states (ai.head.js S, numbered SCODE) and the Skin-Stealer's acts (ai.skinstealer.js
 * KACT); dev/tools/checks/facts.json holds every copy of each to the same list */
const STATES = ['DORMANT', 'ROAMING', 'CURIOUS', 'ALERT', 'WATCHING', 'STALKING', 'HUNTING', 'SEARCHING', 'CAUTIOUS', 'FRUSTRATED', 'EXCITED', 'FEEDING', 'PLAYING', 'RETREATING', 'HIDDEN', 'FOLLOWING', 'PROVOKED', 'ATTACKING', 'DISAPPEARING'];
const ACTS = ['', 'watch', 'back', 'leave', 'wait', 'lure', 'intercept', 'search', 'listen', 'approach', 'creep', 'chase', 'wind', 'pounce', 'recover', 'feed', 'mimic', 'rest', 'pace'];
return { ACTS, angDiff, API, BODY_SCALE, clamp, hooks, K, lend, lerp, sm, STATES, TAU };
}
