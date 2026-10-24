/** @part generated/server/ai.js - N.A.N.I.: the Skin-Stealer's mind (Trial 3 R11): who could see it, what changed since its last think, what it knows of its quarry
 * provides: skBodyInSight, skExposedTo, skLegible, skMindDbg, skMindKept, skMindLog, skMindNew, skMindTick, skObsOf, skSpotExposed
 * uses: angDiff, skFatigueSee, skWinded, sm
 * writes: -
 */
/* ---------------------------------------------------------------- THE SKIN-STEALER'S MIND (Trial 3 R11; dev/trial-3-r9-overhaul/)
 * The owner (October 22): it sneaks across the player's view into its hiding place; its reasoning is odd; it should be always attentive,
 * responsive and opportunistic.  R8's only notion of being observed was eye contact (facedBy: a person facing it within .35 rad).  But a
 * player's screen shows everything round them that is in their sight and lit, whichever way they face.  This part gives the creature the
 * three things R11 needs, from its own senses only (Trial 3's evidence law: what it sees now, what it heard, what it remembers):
 *   1 WHO COULD SEE IT.  A person it SEES now: it sees where they are, how they face and whether their light is on, so it can judge - by
 *     the rules of the person's own screen, mirrored on the server's copy of the level - whether it stands in their view: within their
 *     sight mask (700 px, a clear line to its body), and readable there (the client's exposureAt terms: the near aura, their torch as it
 *     sees it pointed, the level's lamps; the range fade).  A person it does NOT see now it can only suspect: from its belief of where they
 *     are (never where they really are), with their torch assumed able to point anywhere.  skExposedTo(eng, observer, x, y).
 *   2 WHAT CHANGED.  On each think it compares what it perceives with its last think: a person newly in its sight, one gone from it, a new
 *     sound, a seen person turning to face it, coming into or leaving that person's view, someone in arm's reach, a seen quarry winded, its
 *     own strike missed or hit a wall.  Each is an EVENT with the time; the first change of plan after it records how long the creature
 *     took to respond (the latency the pack asks to measure).  Nothing here decides: the decision (ai.skinstealer.js) reads them.
 *   3 WHAT IT KNOWS.  Per person it has seen: when it first and last saw them, whether they could see it (their view) and whether they met
 *     its eyes, and THEY SAW ME - the last time they could see it, kept for SKM.sawTtl seconds (renewed while it lasts) - distinct from
 *     I SUSPECT THEY COULD SEE ME (from a belief only) and THEIR PLACE IS UNKNOWN.  And a short log of its hunt's evidence (seen, heard,
 *     inferred, disproved) for the overlay and the tests.
 * Cost: on a think (10 Hz near), for each person it sees, three rays and a lamp read; nothing per tick, nothing for people it does not
 * sense.  No record of a person it has not seen is ever made here; no player's real place is read for anybody not in e.seenNow. */
const SKM = Object.freeze({
  mask: 700, side: 18, legible: .25,             // a person's sight mask (px); the body's half width across the line of sight; readable from (the client's rule)
  edge: 30,                                      // (R16) a still body as drawn: its hands and head reach 18-30 px out (R14-4) - a WAITING spot hides all of it
  sawTtl: 8,                                     // seconds 'they saw me' is kept after they last could see it
  eyesTtl: 4,                                    // seconds 'they met my eyes' is kept
  turnIn: .6, turnOut: .9,                       // a seen person TURNS to face it: their facing comes within turnIn rad of it from beyond turnOut
  evMax: 24, logMax: 12,                         // events kept; hunt evidence kept
  reach: 90,                                     // a person within this is 'at arm's reach' as an event (the grab itself is the strike's)
});
/* how readable a body at (x, y) is to an observer ob {x, y, angle, light, kind} (the client's exposureAt, vision.ts, on the server's copy
 * of the level).  ob.angle null: the creature does not know which way they face (a belief): their torch is taken as able to point at it */
function skLegible(eng, ob, x, y) {
  const geo = eng.geo, d = Math.hypot(x - ob.x, y - ob.y);
  let s = (1 - sm(28, 100, d)) * .5;
  if (ob.light && geo.a.qc) {
    const src = { x: ob.x, y: ob.y, angle: ob.angle === null || ob.angle === undefined ? Math.atan2(y - ob.y, x - ob.x) : ob.angle, equipment: { kind: ob.kind || 'flashlight' } };
    const q = geo.a.qc(src, { x, y }, true); if (q > s && geo.los(ob.x, ob.y, x, y)) s = q;
  }
  // (R16) another person's torch lights it for this one too (the screen draws every wanderer's light): the lights it knows of - the people
  // it sees now, their torches as it sees them (skWatchers gives them as ob.lights); never anybody's it does not see
  if (ob.lights && geo.a.qc) for (const L of ob.lights) {
    const src = { x: L.x, y: L.y, angle: L.angle === null || L.angle === undefined ? Math.atan2(y - L.y, x - L.x) : L.angle, equipment: { kind: L.kind || 'flashlight' } };
    const q = geo.a.qc(src, { x, y }, true); if (q > s && geo.los(L.x, L.y, x, y)) s = q;
  }
  const i = geo.cellAt(x, y);
  if (i >= 0 && !(geo.a.blackout && geo.a.blackout())) { let l = geo.lamp[i] || 0; for (const f of geo.fails) if (f.until > eng.now && Math.hypot(x - f.x, y - f.y) < f.r) l *= .06; if (l > s) s = l; }
  return (1 - sm(420, 670, d)) * Math.min(1, .04 + s * 2.08);
}
/* could ob make out a body at (x, y)?  in their sight mask (a clear line, within 700 px, to its centre or a point SKM.side to either side)
 * and readable there */
function skExposedTo(eng, ob, x, y) {
  const d = Math.hypot(x - ob.x, y - ob.y); if (d > SKM.mask + SKM.side) return false;
  const ux = (x - ob.x) / (d || 1), uy = (y - ob.y) / (d || 1), geo = eng.geo;
  for (const k of [0, -1, 1]) {
    const qx = x - uy * SKM.side * k, qy = y + ux * SKM.side * k;
    if (Math.hypot(qx - ob.x, qy - ob.y) > SKM.mask || !geo.los(ob.x, ob.y, qx, qy)) continue;
    if (skLegible(eng, ob, qx, qy) >= SKM.legible) return true;
  }
  return false;
}
/* (R16) could someone at (ox, oy) see any part of a still body at (x, y) - its centre, or a point SKM.edge to either side across the line of
 * sight (the drawn figure keeps within 40 px of its centre; its hands and head reach 18-30 px out, R14-4)?  For choosing where to WAIT:
 * the spot must hide all of it, as the screen would show it; moving, the body is audited as before (SKM.side, the covert way's margin) */
function skBodyInSight(geo, ox, oy, x, y) {
  if (geo.los(ox, oy, x, y)) return true;
  const d = Math.hypot(x - ox, y - oy) || 1, ux = (x - ox) / d, uy = (y - oy) / d;
  return geo.los(ox, oy, x - uy * SKM.edge, y + ux * SKM.edge) || geo.los(ox, oy, x + uy * SKM.edge, y - ux * SKM.edge);
}
/* (R16) could ob make out any part of a still body waiting at (x, y)?  skExposedTo, and its edges SKM.edge out */
function skSpotExposed(eng, ob, x, y) {
  if (skExposedTo(eng, ob, x, y)) return true;
  const d = Math.hypot(x - ob.x, y - ob.y); if (d > SKM.mask + SKM.edge) return false;
  const ux = (x - ob.x) / (d || 1), uy = (y - ob.y) / (d || 1), geo = eng.geo;
  for (const k of [-1, 1]) {
    const qx = x - uy * SKM.edge * k, qy = y + ux * SKM.edge * k;
    if (Math.hypot(qx - ob.x, qy - ob.y) > SKM.mask || !geo.los(ob.x, ob.y, qx, qy)) continue;
    if (skLegible(eng, ob, qx, qy) >= SKM.legible) return true;
  }
  return false;
}
/* an observer as the creature knows them: a person it sees now (their place, facing and light, as it sees them), or - from a belief - a
 * place with an unknown facing (null) and the light it last saw them with */
function skObsOf(eng, e, r, at) {
  if (r && r.seen && r.visual) {                                                   // (R16: their light's kind as it last saw it - read live only while it sees them)
    const mo = e.mind && e.mind.obs.get(r.id), L = r.light && e.seenNow.has(r.id) ? (eng.lights || []).find(l => l.id === r.id) : null;
    return { x: r.visual.x, y: r.visual.y, angle: r.visual.angle, light: !!r.light, kind: L ? L.kind : mo && mo.kind ? mo.kind : 'flashlight', seen: true };
  }
  if (at) return { x: at.x, y: at.y, angle: null, light: !!(r && r.light), kind: 'flashlight', seen: false };
  return null;
}
/* a fresh mind (at its spawn, and when the engine clears it) */
function skMindNew() { return { obs: new Map(), seen: new Set(), ev: [], evN: {}, sid: 0, miss: 0, wall: 0, planObj: null }; }
/* 'they saw me' for a person: the last time they could see it, while that is fresh (SKM.sawTtl) */
const skSawMe = (eng, e, pid) => { const o = e.mind && e.mind.obs.get(pid); return o && eng.now - o.sawAt <= SKM.sawTtl ? o : null; };
function skEvent(e, now, k, pid, x) { const M = e.mind; M.ev.push({ t: +now.toFixed(2), k, pid: pid || 0, x: x || '', resp: -1, how: '', plan: e.plan ? e.plan.k : '' }); while (M.ev.length > SKM.evMax) M.ev.shift(); M.evN[k] = (M.evN[k] || 0) + 1; }
/* the decision weighed its unanswered events of these kinds and KEPT its plan (a plan that goes on without a sighting, a plan clearly still
 * the best) - or (R13) answered them with a strike: that is its answer too, at this time */
function skMindKept(e, now, kinds, how) { const M = e.mind; if (!M) return; for (const v of M.ev) if (v.resp < 0 && kinds.includes(v.k)) { v.resp = +(now - v.t).toFixed(2); v.how = how || 'kept'; } }
/* a line of its hunt's evidence: seen | heard | inferred | disproved, where and how sure */
function skMindLog(e, H, now, k, x, y, u, note) { if (!H) return; const L = H.log || (H.log = []); L.push([+now.toFixed(1), k, Math.round(x), Math.round(y), Math.round(u || 0), String(note || '').slice(0, 40)]); while (L.length > SKM.logMax) L.shift(); }
/* on its think, before deciding: the people it sees now, whether they could see it, what changed */
function skMindTick(eng, e) {
  const now = eng.now, M = e.mind; if (!M) return;
  // the first change of plan after an event is its response (a plan object replaced, or let go)
  if (e.plan !== M.planObj) { M.planObj = e.plan; for (const v of M.ev) if (v.resp < 0) { v.resp = +(now - v.t).toFixed(2); v.how = 'changed'; } }
  const seenNow = new Set();
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id); if (!r || !r.visual) continue; seenNow.add(id);
    let o = M.obs.get(id);
    if (!o) { o = { pid: id, firstAt: now, seenAt: now, inView: false, sawAt: -99, eyesAt: -99, off: Math.PI, winded: false, near: false }; M.obs.set(id, o); }
    if (!M.seen.has(id)) skEvent(e, now, 'sight', id);
    o.seenAt = now; if (r.light) { const L = (eng.lights || []).find(l => l.id === id); if (L) o.kind = L.kind; }   // (R16: the light it sees them carry, kept)
    const ob = skObsOf(eng, e, r), view = skExposedTo(eng, ob, e.x, e.y), off = Math.abs(angDiff(Math.atan2(e.y - ob.y, e.x - ob.x), ob.angle || 0));
    if (view && !o.inView) skEvent(e, now, 'exposed', id); else if (!view && o.inView) skEvent(e, now, 'hidden', id);
    o.inView = view; if (view) o.sawAt = now;
    if (off < SKM.turnIn && o.off > SKM.turnOut) skEvent(e, now, 'turned', id);
    o.off = off;
    if (view && off < .35) o.eyesAt = now;
    const near = r.dist < SKM.reach; if (near && !o.near) skEvent(e, now, 'reach', id); o.near = near;
    skFatigueSee(eng, e, r, o, now); const wd = skWinded(eng, e, r, now); if (wd && !o.winded) skEvent(e, now, 'winded', id); o.winded = wd;   // (R20: its belief from what it saw and heard - R11-R19 read their stamina)
  }
  for (const id of M.seen) if (!seenNow.has(id)) { skEvent(e, now, 'lost', id); const o = M.obs.get(id); if (o) o.inView = false; }
  M.seen = seenNow;
  for (const [id, o] of M.obs) if (!eng.byId.has(id) || now - o.seenAt > 120) M.obs.delete(id);   // (a person who left the game, or long gone from its thoughts)
  // a new sound (not its own kind's), its own strike's outcome
  const snd = e.mem.sounds[0]; if (snd && snd.id > M.sid) { if (snd.src !== -1) skEvent(e, now, 'sound', snd.pid || 0, Math.round(snd.I * 100) / 100); M.sid = snd.id; }
  if (e.tally.miss > M.miss) skEvent(e, now, 'miss'); M.miss = e.tally.miss;
  if (e.tally.wall > M.wall) skEvent(e, now, 'wall'); M.wall = e.tally.wall;
}
/* the overlay's and the tests' view: the people it sees and whether they could see it; recent events with their response times */
function skMindDbg(eng, e) {
  const M = e.mind; if (!M) return null;
  const obs = [...M.obs.values()].filter(o => eng.now - o.seenAt < 2).map(o => ({ pid: o.pid, view: o.inView ? 1 : 0, saw: +(eng.now - o.sawAt).toFixed(1), eyes: +(eng.now - o.eyesAt).toFixed(1) }));
  return { obs, ev: M.ev.slice(-6).map(v => [v.t, v.k, v.pid, v.resp, v.how]) };
}
