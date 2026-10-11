/* net-wire.js - the look / light / corpse field codec of the multiplayer layer (mp.js).
 *
 * Stage 3H0: moved out of mp.js without a change, so the wire formats these fields use live in one small file:
 *   look        'hat|texture|hands|main|backpack'  (lookStr: game look -> wire; parseLook: wire -> game look, backpack always 'none')
 *   light parts 'c1,c2,c3[,c4]' in the order of the game's own part table  (partList: equipment -> wire; partObj: wire -> parts)
 *   corpse      the server's body record -> the game's body record  (toRec)
 * The functions read window.__api (the game bundle) when they are called, exactly as they did inside mp.js, and keep no state.
 * Loaded by index.html before mp.js (only assets/net-interp.js comes between them), as a classic script; its only global is
 * window.__mpLib.wire, which mp.js reads once at
 * start-up.  Never loaded by the server. */
(() => {
const lookStr = L => [L.hat, L.texture, L.hands, L.main, L.backpack].join('|');
/* light parts <-> 'c1,c2,c3' strings (order comes from the game's own part table) */
const partList = eq => { const A = window.__api; if (!A || !A.gear || !eq) return ''; const P = A.gear.parts(eq, eq.kind); return A.gear.defs[eq.kind].map(d => P[d[0]]).join(','); };
const partObj = (kind, s) => { const A = window.__api, defs = A && A.gear && A.gear.defs[kind]; if (!defs) return {}; const v = String(s || '').split(','), o = {}; defs.forEach((d, i) => { if (/^#[0-9a-f]{6}$/i.test(v[i])) o[d[0]] = v[i]; }); return o; };
const parseLook = s => { const [hat, texture, hands, main] = String(s || 'none|plain|#e6bb76|#ffcc77|none').split('|'); return { hat, texture, hands, main, backpack: 'none' }; };   // Stage 3C: cosmetic backpacks are gone; an older client's pack is not drawn
/* everyone's bodies (one per player): the server's record -> the game's */
function toRec(b) {
  return { id: 'r:' + b.k + ':' + Math.round(b.x) + ':' + Math.round(b.y), ownerId: 'r' + b.k, remote: true, name: b.n, cause: b.c, x: b.x, y: b.y, angle: b.a, scaleX: b.sx, scaleY: b.sy, attackAngle: b.aa, lo: b.lo ? 1 : 0,
    appearance: parseLook(b.lk), equipment: { kind: b.eq.kind, color: b.eq.color, parts: { [b.eq.kind]: partObj(b.eq.kind, b.eq.parts) } }, blood: b.bl.map(([x, y, seed]) => ({ x, y, seed })), dropped: { x: b.dr[0], y: b.dr[1], angle: b.dr[2] }, hat: { x: b.ht[0], y: b.ht[1], angle: b.ht[2] },
    ...(b.ph && Array.isArray(b.hd) && b.hd.length === 4 ? { hands: [[b.hd[0], b.hd[1]], [b.hd[2], b.hd[3]]], hatOn: b.ho ? 1 : 0, trail: Array.isArray(b.tr) ? b.tr : [], ph: 1 } : {}) };
}
(window.__mpLib = window.__mpLib || {}).wire = Object.freeze({ lookStr, partList, partObj, parseLook, toRec });
})();
