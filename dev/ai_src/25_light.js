
/* ---------------------------------------------------------------- visible light as evidence (Part 2, stage 2C)
 * Player lights are a physical signal.  What a light does is worked out once for everybody (beamsOf: where each visible emitter's light really
 * falls - the rays stop at walls); what one entity can make of it is worked out from its own position (observeBeam: only the parts it has a
 * line of sight to, inside its field of view).  Three qualities of knowledge come out of it:
 *   the SOURCE is in view      -> 'source' lead at that spot (a light, not yet a person: sight of the body is what names somebody)
 *   a BEAM crossing its view   -> 'beam' lead: the brighter end of the visible beam says which way the light came from, not how far
 *   a LIT WALL / FLOOR patch   -> 'litwall' / 'litfloor' lead: somewhere on the open side of that patch, with a wide uncertainty
 * inferLead() is a pure function of the observation record (plus the fixed level geometry): it cannot reach the carrier's true position, which
 * a test checks by moving an unsensed carrier while replaying the identical observations (s_evidence E6).
 * Infrared is not in here and cannot get in: beams are built only from the visible-light emitter table (kinds[k].power > 0).  2C-IR will keep
 * infrared outside the engine's player view altogether.
 * Cost: beams at ~8 Hz for all lit players (3 rays + 2 samples each), each near entity looks at them at 4 Hz, a handful of LOS rays per beam. */
const LIGHT_DT = .25, BEAM_DT = .12;
const BEAM_RAYS = [0, -.3, .3], BEAM_AIR = [.3, .62];
const q05 = v => Math.round(v * 20) / 20;                                    // brightness as the eye has it: coarse
function beamsOf(eng) {
  if (eng.beamsT > eng.now && eng.beams) return eng.beams;
  eng.beamsT = eng.now + BEAM_DT;
  const geo = eng.geo, kinds = geo.a.kinds || {}, out = [], hist = eng.beamHist || (eng.beamHist = new Map()), live = new Set();
  for (const p of eng.lights) {
    const K = kinds[p.kind]; if (!K || !(K.power > 0)) continue;             // no visible emitter, no beam (the camcorder has none)
    live.add(p.id);
    let h = hist.get(p.id); if (!h) hist.set(p.id, h = { on: false, onAt: -99, cx: 0, cy: 0 });
    if (!h.on) { h.on = true; h.onAt = eng.now; }
    const omni = !!K.omni, dirs = omni ? [0, 1, 2, 3, 4, 5].map(i => i / 6 * TAU) : BEAM_RAYS.map(o => p.angle + o * K.arc);
    const rays = [];
    for (let i = 0; i < dirs.length; i++) {
      const a = dirs[i], d = geo.ray(p.x, p.y, a, K.range), wall = d < K.range - 2, dd = Math.max(0, d - 4);
      const I = q05(K.power * (1 - sm(24, K.range, d)) * (omni || i === 0 ? 1 : .6));
      if (I <= 0) continue;
      rays.push({ x: p.x + Math.cos(a) * dd, y: p.y + Math.sin(a) * dd, wall, I });
    }
    const air = [];
    if (!omni) { const d0 = geo.ray(p.x, p.y, p.angle, K.range); for (const f of BEAM_AIR) { const t = d0 * f; air.push({ x: p.x + Math.cos(p.angle) * t, y: p.y + Math.sin(p.angle) * t, I: q05(K.power * (1 - sm(24, K.range, t))) }); } }
    let cx = 0, cy = 0; for (const r of rays) { cx += r.x; cy += r.y; } if (rays.length) { cx /= rays.length; cy /= rays.length; }
    const moved = Math.hypot(cx - h.cx, cy - h.cy) > 40; h.cx = cx; h.cy = cy;
    out.push({ o: { x: p.x, y: p.y }, ang: p.angle, arc: omni ? TAU : K.arc, range: K.range, omni, rays, air, fresh: eng.now - h.onAt < .8, moved });
  }
  for (const [id, h] of hist) if (!live.has(id)) { if (!eng.byId.has(id)) hist.delete(id); else h.on = false; }
  eng.beams = out; return out;
}
/* what this entity can actually see of one beam (or null) - the observation record, nothing else leaves this function */
function observeBeam(eng, e, b) {
  const geo = eng.geo, fov = e.sp.vision.fov, look = e.ang + (e.head || 0);
  const inView = (x, y, d) => d < 110 || Math.abs(angDiff(Math.atan2(y - e.y, x - e.x), look)) <= fov / 2;
  const dO = Math.hypot(b.o.x - e.x, b.o.y - e.y);
  let src = null, flash = false;
  const inCone = b.omni || Math.abs(angDiff(Math.atan2(e.y - b.o.y, e.x - b.o.x), b.ang)) < b.arc * .5;
  // 2E: a visible beam physically reaching a Hound is an attention stimulus even from behind.
  // Only the visible emitter is observed; a human still requires updateVision. Keep Smilers unchanged.
  const hitHound = e.kind === 'hound' && inCone && dO < b.range;
  if (dO < (inCone ? 1700 : 650) && (inView(b.o.x, b.o.y, dO) || hitHound) && geo.los(e.x, e.y, b.o.x, b.o.y)) { src = { x: b.o.x, y: b.o.y }; flash = e.kind === 'hound' ? hitHound : inCone && dO < b.range * 1.6; }
  const pts = [], air = [];
  for (const h of b.rays) { const d = Math.hypot(h.x - e.x, h.y - e.y); if (d < 1500 && inView(h.x, h.y, d) && geo.los(e.x, e.y, h.x, h.y)) pts.push({ x: Math.round(h.x), y: Math.round(h.y), I: h.I, w: h.wall ? 1 : 0 }); }
  for (const h of b.air) { const d = Math.hypot(h.x - e.x, h.y - e.y); if (d < 900 && inView(h.x, h.y, d) && geo.los(e.x, e.y, h.x, h.y)) air.push({ x: Math.round(h.x), y: Math.round(h.y), I: h.I }); }
  if (!src && !pts.length && !air.length) return null;
  return { src, flash, pts, air, fresh: b.fresh, moved: b.moved };
}
/* which way is open from a spot (static level geometry only): the lit face of a wall faces the room the light came from */
function openSide(geo, x, y) {
  let nx = 0, ny = 0; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; if (geo.ray(x, y, a, 64) >= 62) { nx += Math.cos(a); ny += Math.sin(a); } }
  const l = Math.hypot(nx, ny); return l > .3 ? { x: nx / l, y: ny / l } : null;
}
/* THE INFERENCE: observation -> anonymous lead.  Pure: (entity position, observation, level geometry) -> lead.  Never the carrier. */
function inferLead(e, o, geo) {
  if (o.src) return { k: 'source', x: o.src.x, y: o.src.y, u: 35, c: o.flash ? .95 : .8, sal: o.flash ? 1 : clamp(.55 + (o.fresh ? .3 : 0) + (o.moved ? .1 : 0), 0, 1), flash: o.flash };
  const all = o.pts.concat(o.air); if (!all.length) return null;
  let maxI = 0; for (const q of all) maxI = Math.max(maxI, q.I);
  const c = clamp(.22 + .07 * all.length + (o.fresh ? .15 : 0) + (o.moved ? .08 : 0) + maxI * .4, .2, .8), sal = clamp(.25 + (o.fresh ? .4 : 0) + (o.moved ? .25 : 0) + maxI * .3, 0, 1);
  let bx, by, dir, k, u;
  if (o.air.length >= 2) {                                                   // a beam in the air: the bright end points back at the light
    const s = o.air.slice().sort((a, b) => b.I - a.I), a0 = s[0], a1 = s[s.length - 1];
    dir = a0.I > a1.I ? Math.atan2(a0.y - a1.y, a0.x - a1.x) : null;
    if (dir === null) { bx = (a0.x + a1.x) / 2; by = (a0.y + a1.y) / 2; }
    else { const G = Math.max(0, Math.min(170, geo.ray(a0.x, a0.y, dir, 200) - 26)); bx = a0.x + Math.cos(dir) * G; by = a0.y + Math.sin(dir) * G; }
    k = 'beam'; u = 170 + .15 * Math.hypot(a0.x - e.x, a0.y - e.y);
  } else {                                                                    // only lit surfaces: somewhere on their open side
    let cx = 0, cy = 0; for (const q of all) { cx += q.x; cy += q.y; } cx /= all.length; cy /= all.length;
    const n = openSide(geo, cx, cy), G = n ? Math.max(0, Math.min(220, geo.ray(cx, cy, Math.atan2(n.y, n.x), 250) - 26)) : 0;
    bx = cx + (n ? n.x * G : 0); by = cy + (n ? n.y * G : 0);
    k = o.pts.some(q => q.w) ? 'litwall' : 'litfloor'; u = 260 + .2 * Math.hypot(cx - e.x, cy - e.y);
  }
  const L = { k, x: bx, y: by, u, c, sal }; if (dir !== undefined && dir !== null) L.dir = +dir.toFixed(3);
  return L;
}
/* one near entity, 4 times a second: look at the lights */
function lightSense(eng, e) {
  if ((e.lsT || 0) > eng.now) return; e.lsT = eng.now + LIGHT_DT;
  let obs = [];
  for (const b of beamsOf(eng)) { if (Math.hypot(b.o.x - e.x, b.o.y - e.y) > 1900 + b.range) continue; const o = observeBeam(eng, e, b); if (o) obs.push(o); }
  if (eng.obsHook) obs = eng.obsHook(e, obs) || [];                          // (tests: record / replay exactly what the entity observed)
  e.lightObs = obs.length;
  obs.sort((a,b) => { const A=a.src||a.pts[0]||a.air[0]||{}, B=b.src||b.pts[0]||b.air[0]||{}; return (A.x||0)-(B.x||0) || (A.y||0)-(B.y||0); });
  for (const o of obs) {
    const L = inferLead(e, o, eng.geo); if (!L) continue;
    if (L.k === 'source') {                                                   // a light it sees in the hand of somebody it is looking at right now: that is their light
      const owners = [...e.seenNow].map(id=>e.mem.p.get(id)).filter(r=>r.visual && r.light && Math.hypot(r.visual.x-L.x,r.visual.y-L.y)<60); const own=owners.length===1?owners[0]:null;
      if (own) { noteEv(own, 'light', L.x, L.y, L.u, L.c, eng.now); if (L.flash) e.flashAt = eng.now; e.dbg.light = `source (in the hand of P${own.id}) @${eng.now.toFixed(1)}`; continue; }
    }
    const q = addLead(e, eng.now, L);
    if (L.flash) e.flashAt = eng.now;
    e.dbg.light = `${L.k} c${L.c.toFixed(2)} u${Math.round(L.u)}${o.fresh ? ' fresh' : ''}${o.moved ? ' moving' : ''} @${eng.now.toFixed(1)}`;

  }
  const best = bestAnonLead(e, eng.now, 'light'), current=e.inv&&e.mem.leads.find(q=>q.id===e.inv.lead&&q.k!=='sound');
  if(best && (!current || best.id===current.id || observationScore(e,best,eng.now)>observationScore(e,current,eng.now)*1.25)) e.inv={lead:best.id,x:best.x,y:best.y,u:best.u,c:best.c*(.5+best.sal),k:best.k,t:best.t};

}
