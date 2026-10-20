/** @part public/assets/skinstealer.js - N.A.N.I.: the server's Skin-Stealers mirrored on the page; a module: skinMirror
 * Each server Skin-Stealer in the snapshot's ss list (sent only while there is one) gets a record here, drawn ~100 ms in the past on the
 * server's clock (B++'s interpolation, window.__netPose with the key 'k' + id, which net-interp.js keeps), otherwise eased toward the
 * newest sample.  A record the server no longer sends is dropped at once; a new world (the epoch) or a closed connection clears them all.
 * At most MAX records: the admin ceiling is 4 (sim.ai.js ADMIN_MAX_SKINSTEALERS).  (T6) dg: the look it wears in a borrowed skin (the wire's
 * hat|texture|hands|main, checked here as the server checked it); K.where(id): where it is drawn, for chat.js's entity lines.
 * imports: head { ACTS angDiff K STATES }
 * exports: clear, list
 * provides: skinMirror
 * uses: -
 * writes: -
 */
function skinMirror({ head: { ACTS, angDiff, K, STATES } }) {
const MAX = 8, LOOK = /^[a-z]{1,12}\|[a-z]{1,12}\|#[0-9a-fA-F]{6}\|#[0-9a-fA-F]{6}$/;
const slots = new Map();                                   // entity id -> { id, x, y, angle, state, act, v, head, dg, distance }
function mirror(list, dt) {
  dt = Math.max(0, Math.min(.25, +dt || 0));
  const seen = new Set();
  for (const t of Array.isArray(list) ? list : []) {
    if (!t || !Number.isSafeInteger(t.i) || !Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
    let o = slots.get(t.i);
    if (!o) { if (slots.size >= MAX) continue; o = { id: t.i, x: t.x, y: t.y, angle: +t.a || 0, distance: 0 }; slots.set(t.i, o); }
    seen.add(t.i);
    const px = o.x, py = o.y, ip = window.__netPose ? window.__netPose('k' + t.i) : null;
    if (ip) { o.x = ip.x; o.y = ip.y; o.angle = ip.a; }
    else if (Math.hypot(t.x - o.x, t.y - o.y) > 260) { o.x = t.x; o.y = t.y; o.angle = +t.a || 0; }
    else { const k = 1 - Math.exp(-dt * 14); o.x += (t.x - o.x) * k; o.y += (t.y - o.y) * k; o.angle += angDiff(+t.a || 0, o.angle) * (1 - Math.exp(-dt * 12)); }
    o.distance += Math.hypot(o.x - px, o.y - py);
    o.state = STATES[t.s] || 'ROAMING'; o.act = ACTS[t.ac] || ''; o.v = +t.v || 0; o.head = +t.h || 0;
    o.dg = typeof t.dg === 'string' && LOOK.test(t.dg) ? t.dg : null;                       // (T6) the skin it wears: a wanderer's look, checked
  }
  for (const id of [...slots.keys()]) if (!seen.has(id)) slots.delete(id);
}
const clear = () => { slots.clear(); };
const list = () => [...slots.values()];
K.mirror = mirror;
K.where = id => { const o = slots.get(id); return o ? { x: o.x, y: o.y } : null; };   // (T6) where this page draws entity id (chat.js: its line's bubble and voice)
return { clear, list };
}
