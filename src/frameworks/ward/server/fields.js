/* server/fields.js - the checks server.js applies to the fields clients send.
 *
 * Stage 3H0: moved out of server.js without a change:
 *   num(v, lo, hi)   +v clamped to [lo, hi]; anything that is not a number counts as 0 (before the clamp)
 *   kindOf(k)        a light kind: one of KINDS, an older name mapped by LEGACY, otherwise 'flashlight'
 *   cleanParts(s)    3 to 5 '#rrggbb' colours joined by commas, otherwise ''
 *   HEX              the '#rrggbb' test used for colours
 *   DEFAULT_LOOK     the look a player has until it sends one
 *   cleanLook(s)     'hat|texture|hands|main|backpack' when every part is an allowed value, otherwise null
 * Pure: no state, nothing required, nothing done at load but defining them.  Never served: the server's allowlist does not reach this
 * folder. */
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, +v || 0));
const KINDS = ['flashlight', 'headlamp', 'lantern', 'camcorder'], LEGACY = { chestlamp: 'headlamp', torch: 'lantern' };
const kindOf = k => KINDS.includes(k) ? k : (LEGACY[k] || 'flashlight');
const cleanParts = s => { const a = String(s || '').split(','); return a.length >= 3 && a.length <= 5 && a.every(c => /^#[0-9a-f]{6}$/i.test(c)) ? a.join(',') : ''; };
const HEX = /^#[0-9a-f]{6}$/i, DEFAULT_LOOK = 'none|plain|#e6bb76|#ffcc77|none';
function cleanLook(s) {                       // hat|texture|hands|main|backpack, validated
  const [h, t, ha, m, b] = String(s || '').split('|');
  return ['none', 'cap', 'beanie', 'hardhat'].includes(h) && ['plain', 'freckles', 'stripes', 'patched'].includes(t) &&
    HEX.test(ha) && HEX.test(m) && ['none', 'canvas', 'utility'].includes(b) ? [h, t, ha, m, b].join('|') : null;
}
module.exports = { num, kindOf, cleanParts, HEX, DEFAULT_LOOK, cleanLook };
