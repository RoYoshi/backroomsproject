
/* ---------------------------------------------------------------- perception, memory, social awareness */
const POSTURE_VIS = [1, 1, 1.12, .62, .45, .72, 1, .4];     // stand walk run crouch crawl slide vault down (how visible a body is)
const KIND_GLARE = { flashlight: 1, headlamp: .85, lantern: .8 };  // (v23: the camcorder emits no visible light at all - it is not in this table)

/* ================================================================ Part 2 (v23, stage 2C): the evidence law.
 * The server knows the truth; an entity acts only on evidence it legitimately has.  Two kinds of knowledge, kept apart:
 *   ATTRIBUTED  e.mem.p  - one record per player the entity has actually SEEN (sight is what tells one person from another).  Its target
 *                          (e.target) is always one of these.  Each record keeps its fused belief (lkx/lky/conf) plus a short list of typed
 *                          evidence entries (r.ev: see / sound / light), each with position, uncertainty radius, confidence and time.
 *   ANONYMOUS   e.mem.leads - things it noticed that it cannot pin on anybody: a lit wall, a beam crossing a doorway, a light source seen
 *                          without the person behind it.  pid is always null.  A lead is an INVESTIGATION GOAL (e.inv), never a target.
 *                          It becomes attributed only when the entity then sees a player where the lead points (attributeLeads).
 * Records are created by sight or explicit admin/contact paths; unidentified hearing creates anonymous leads.  Nothing here
 * reads where an unsensed player really is. */
const EV_MAX = 4, LEAD_MAX = 6, LEAD_MAXAGE = 45;
function newMemory() { return { p: new Map(), sounds: [], others: new Map(), visited: new Map(), leads: [], leadId: 0, soundId: 0, habits: new Map(), hypotheses: [] }; }
function rec(e, id) {
  let r = e.mem.p.get(id);
  if (!r && e.mem.p.size >= INTEL.players) { const old = [...e.mem.p.values()].sort((a,b) => Math.max(a.seenAt,a.heardAt)-Math.max(b.seenAt,b.heardAt) || a.id-b.id)[0]; forgetIdentity(e, old.id); }
  if (!r) e.mem.p.set(id, r = { id, aw: 0, seen: false, seenAt: -99, heardAt: -99, lkx: 0, lky: 0, lvx: 0, lvy: 0, conf: 0, hx: 0, hy: 0, st: 0, stamina: 100, ex: 0, prof: 1, light: false, iso: 0, first: -99, lost: 0, hLoud: -99, hvx: 0, hvy: 0, crawl: null, crawlAt: -99, ev: [], downAt: -99, heldAt: -99 });
  return r;
}
/* one typed evidence entry on an attributed record (the newest of each kind is kept) */
function noteEv(r, k, x, y, u, c, t) {
  const ev = r.ev || (r.ev = []), q = ev.find(o => o.k === k);
  if (q) { q.x = x; q.y = y; q.u = u; q.c = c; q.t = t; }
  else { ev.unshift({ k, x, y, u, c, t }); if (ev.length > EV_MAX) ev.pop(); }
}
/* an anonymous lead: merged into a matching recent one (same place, give or take both uncertainties), otherwise a new one */
function addLead(e, now, L) {
  const leads = e.mem.leads;
  for (const q of leads) {
    if (evidenceModality(q.k) !== evidenceModality(L.k)) continue;
    if (now - q.t > 6 || Math.hypot(q.x - L.x, q.y - L.y) > (q.u + L.u) * .6) continue;
    const w = L.c / (L.c + q.c * .8);
    q.x += (L.x - q.x) * w; q.y += (L.y - q.y) * w; q.u = Math.max(L.u * .75, Math.min(q.u, L.u) * .95);          // seeing the same thing again firms it up a little, never past what one look can tell
    q.urg = Math.max(leadUrgency(q, now), L.urg || 0);                         // (3B-N) a fresh strong sound renews the lead's urgency; an old one has decayed
    q.c = Math.min(1, Math.max(q.c, L.c) + .05); q.t = now; q.n++; q.sal = Math.max(q.sal * .7, L.sal); q.k = L.k === 'source' ? 'source' : q.k; if (L.dir !== undefined) q.dir = L.dir;
    return q;
  }
  const n = Object.assign({ id: ++e.mem.leadId, pid: null, t0: now, t: now, n: 1 }, L); leads.push(n);
  if (leads.length > LEAD_MAX) { let wi = 0; for (let i = 1; i < leads.length; i++) if (leads[i].c < leads[wi].c) wi = i; leads.splice(wi, 1); }
  return n;
}
/* sight of a player where a lead points turns the lead into attributed evidence (the only way a lead ever gets a name) */
function attributeLeads(e, r, p, now) {
  const leads = e.mem.leads;
  for (let i = leads.length - 1; i >= 0; i--) {
    const L = leads[i]; if (L.k !== 'source' || !p.light || now - L.t > .5 || Math.hypot(L.x-p.x,L.y-p.y)>60) continue;
    const owners=[...e.seenNow].map(id=>e.mem.p.get(id)).filter(r=>r.visual&&r.light&&Math.hypot(r.visual.x-L.x,r.visual.y-L.y)<60); if(owners.length!==1||owners[0].id!==r.id) continue;
    noteEv(r, 'light', L.x, L.y, L.u, L.c, L.t); leads.splice(i, 1);
    if (e.inv && e.inv.lead === L.id) e.inv = null;
  }
}
/* the strongest anonymous lead (an investigation goal, not a target) */
function bestAnonLead(e, now, modality) {
  let best = null, bs = 0;
  for (const L of e.mem.leads) { if (modality && evidenceModality(L.k) !== modality) continue; const s = observationScore(e, L, now) + L.sal * .3; if (s > bs) { bs = s; best = L; } }
  return best;
}
/* where the entity believes a player is: the body itself while it is seen, otherwise its memory (never the truth) */
function perc(eng, e, r) {
  if (r.seen) { const p = r.visual; if (p) return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, sp: Math.hypot(p.vx, p.vy), angle: p.angle, seen: true, p }; }
  const est = estimate(e, r, eng.now, eng.geo); return { x: est.x, y: est.y, vx: r.lvx, vy: r.lvy, sp: Math.hypot(r.lvx, r.lvy), seen: false, p: null, unc: est.unc };
}
/* a body in physical contact (capture range): contact is physics, not perception */
function touching(eng, e, id, reach) { const p = eng.playerById(id); return p && p.alive && !p.caught && Math.hypot(p.x - e.x, p.y - e.y) < reach ? p : null; }
/* has this entity perceived that the player is out of the hunt (dead, or in another creature's grip)?  Only what it saw; the player leaving the
 * game (record deleted) is housekeeping */
function tgtGone(eng, e, r) {
  if (!r || !eng.byId.has(r.id)) return true;
  if (r.seen && r.visual) return !r.visual.alive || !!r.visual.caught;
  return (r.downAt > -50 && r.downAt >= r.seenAt - .01) || (r.heldAt > -50 && r.heldAt >= r.seenAt - .01);
}
/* target commitment: once it has picked somebody it keeps them for a moment unless it has truly lost them (no per-tick flicker between two people) */
const TARGET_DWELL = 1.5;
function setTarget(e, id, now) { if (e.target !== id) { e.target = id; e.tgtSince = now; } }
function mayRetarget(e, now) { const cur = e.target > 0 ? e.mem.p.get(e.target) : null; return !cur || cur.conf < .2 || now - (e.tgtSince ?? -99) > TARGET_DWELL; }
/* EYE CONTACT: this entity sees the player, and the player is looking at it (the character's facing, sent by its client - not a screen), from a
 * distance at which the player could make it out: close by, or with the entity itself in light.  Used by Part 2 stages 2D/2E; debug-visible now. */
const EYE_CONE = .35;
function facedBy(eng, e, p, r, emit = 0, own = null) {        // emit: how visible the entity makes itself in the dark (a Smiler's gleaming face)
  if (!p || !p.alive || !r || !r.seen) return null;             // own: the light on itself as the entity knows it (2D Smiler: the lamp field + beams it saw) -
  const d = Math.hypot(e.x - p.x, e.y - p.y); if (d > 900) return null;    //      then nobody's torch is read from where they really are
  const off = Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.angle)); if (off > EYE_CONE) return null;
  const lit = Math.max(emit, own !== null ? own : eng.geo.lightLevel(e.x, e.y, eng.lightPlayers()));
  if (d > 240 && lit < .3) return null;
  return { d, off, lit };
}
function memAge(e, r, now) { return now - Math.max(r.seenAt, r.heardAt); }
function memHalfLife(e) { return lerp(7, 46, e.tr.MEMORY); }        // seconds until an old sighting is (mostly) forgotten
/* where might the player be now?  the last known position pushed along its last heading, with growing uncertainty */
function estimate(e, r, now, geo) {
  const age = Math.max(0, now - r.seenAt), sp = Math.hypot(r.lvx, r.lvy);
  const dur = Math.min(age, 3.2) * (sp > 20 ? 1 : 0), k = sp > 1 ? 1 / sp : 0;
  let D = Math.min(sp * dur * .55, 520);
  if (geo && D > 0) D = Math.max(0, Math.min(D, geo.ray(r.lkx, r.lky, Math.atan2(r.lvy, r.lvx), D + 40) - 34));   // it went that way - but not through a wall
  return { x: r.lkx + r.lvx * k * D, y: r.lky + r.lvy * k * D, unc: 60 + Math.min(1100, sp * age * .5 + age * 18) };
}

function visualObservation(e, eng, p) {
  const geo = eng.geo, cfg = e.sp.vision;
  if (!p.alive) return {vis:false,strength:0,d:Infinity};
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);        // (v23: no record is made for somebody it does not see)
    let vis = false, strength = 0;
    const stName = W_SN[p.st] || 'stand';
    let range = cfg.range * (.5 + .7 * e.tr.VISION);
    const lit = geo.lightLevel(p.x, p.y, null), own = p.light ? (KIND_GLARE[p.kind] || 1) : 0;
    let lightF = cfg.dark ? .82 + .18 * Math.max(lit, own) : .3 + .7 * Math.max(lit, own * .9);
    if (p.light && !cfg.dark) lightF *= 1 + .55 * own;                         // a lit lantern is a beacon
    const motion = .7 + .5 * clamp(p.sp / 172, 0, 1.4);
    range *= lightF * (POSTURE_VIS[p.st] || 1) * motion * (e.act === 'listen' ? .8 : 1);
    const floor = cfg.floor || 70;                                            // something crouched in the dark right beside it is noticed regardless of posture
    if (d <= Math.max(range, floor)) {
      const bearing = Math.atan2(dy, dx), inFov = d < 110 || Math.abs(angDiff(bearing, e.ang + (e.head || 0))) <= cfg.fov / 2;
      // under an occluder (a table, the wall round a hole) a body can only be made out from close by, whatever the light: not visible from across the room
      const cz = WORLD.crawlAt ? WORLD.crawlAt(p.x, p.y) : null;
      if (inFov && (!cz || d < cz.reveal) && geo.sees(e.x, e.y, p.x, p.y, p.prof)) { vis = true; strength = clamp(Math.pow(1 - d / Math.max(range, floor), .55), .08, 1); }
    }
  return { vis, strength, d };
}

function updateVision(e, eng, dt, cands) {
  const geo = eng.geo, now = eng.now, cfg = e.sp.vision;
  e.seenNow.clear();
  for (const r0 of e.mem.p.values()) r0.seen = false;
  for (const p of cands) {
    if (!p.alive) continue;
    let r = e.mem.p.get(p.id); const {vis, strength, d} = visualObservation(e, eng, p);
    if (!vis) continue;
    if (!r) r = rec(e, p.id);
    r.seen = vis; r.dist = d;
    if (vis) {
      if (p.caught) r.heldAt = now;                                              // it can see that somebody else has them
      r.aw = Math.min(1, r.aw + strength * dt * (cfg.gain || 3.2));
      if (r.seenAt < now - 6) r.first = now;
      const cw = WORLD.crawlAt ? WORLD.crawlAt(p.x, p.y, 34) : null; if (cw) { r.crawl = cw.id; r.crawlAt = now; } else if (now - r.crawlAt > 2) r.crawl = null;   // seen going into (or at the mouth of) a crawlspace: remembered
      r.seenAt = now; r.lkx = p.x; r.lky = p.y; r.lvx = p.vx; r.lvy = p.vy; r.conf = 1; r.st = p.st; r.stamina = p.stamina; r.ex = p.ex; r.prof = p.prof; r.light = p.light; r.lost = 0;
      r.visual = {id:p.id,x:p.x,y:p.y,vx:p.vx,vy:p.vy,angle:p.angle,alive:p.alive,caught:!!p.caught,st:p.st,ex:p.ex,t:now};
      habitObserve(e, r, now);
      noteEv(r, 'see', p.x, p.y, 16, 1, now);
      e.seenNow.add(p.id);
    }
  }
  for (const id of e.seenNow) { const r=e.mem.p.get(id); if(e.mem.leads.length) attributeLeads(e,r,{...r.visual,light:r.light},now); }
  // a body it can see lying where it last saw that person: it knows they are down (a dead player is no longer a candidate, so this looks at
  // the records it already has, and only at a spot in its own view)
  if (e.tier === 'near') for (const r0 of e.mem.p.values()) {
    if (r0.seen || r0.downAt >= r0.seenAt) continue;
    const pv = eng.playerById(r0.id); if (!pv || pv.alive || !pv.dead) continue;
    const d = Math.hypot(pv.x - e.x, pv.y - e.y);
    if (d < 900 && (d < 110 || Math.abs(angDiff(Math.atan2(pv.y - e.y, pv.x - e.x), e.ang + (e.head || 0))) <= cfg.fov / 2) && geo.los(e.x, e.y, pv.x, pv.y)) r0.downAt = now;
  }
  for (const r0 of e.mem.p.values()) if (!r0.seen) r0.lost += dt;
}

/* the sound bus delivers each event to every entity once */
function hearEvent(e, eng, ev) {
  const geo = eng.geo, d = Math.hypot(ev.x - e.x, ev.y - e.y);
  const identified = identifySound(eng, e, ev);
  const focus = identified && identified.id === e.target && (e.state === S.HUNTING || e.state === S.SEARCHING) && (ev.type === 'run' || ev.type === 'slide' || ev.type === 'vault' || ev.type === 'land') ? 1.3 : 1;   // a hunting animal tracks its prey's running footfalls further - careful movement gets no such penalty
  let eff = ev.r * (.42 + e.tr.HEARING * 1.05) * focus * (e.act === 'listen' ? 1.5 : 1) * (e.state === S.FEEDING ? .65 : 1) * (e.state === S.DORMANT ? .75 : 1) * (e.deaf > 0 ? .3 : 1);
  if (d > eff * 1.05) return;
  const clear = geo.los(e.x, e.y, ev.x, ev.y);
  if (!clear) eff *= .6;
  if (d > eff) return;
  const I = ev.I * Math.pow(1 - d / eff, .7);
  if (I < .03) return;
  const unc = (26 + d * .16) * (clear ? 1 : 1.75) * (1.55 - e.tr.INTELLIGENCE * .45) * (1.4 - e.tr.HEARING * .35) * (ev.type === 'breath' ? 1.5 : 1);
  const a = e.streams.perception() * TAU, m = Math.sqrt(e.streams.perception()) * unc, hx = ev.x + Math.cos(a) * m, hy = ev.y + Math.sin(a) * m;
  const h = { id: ++e.mem.soundId, x: hx, y: hy, I, type: ev.type, t: eng.now, src: identified ? identified.id : (ev.ent || ev.src < 0) ? -1 : 0, pid: identified ? identified.id : null, attribution: identified ? 'identified' : 'anonymous', modality: 'sound', c: Math.min(1,.4+.5*I), u: unc, unc, clear };
  /* (Stage 3B-N) a Hound already after somebody it has lost from sight connects an unidentified movement sound to that person when the sound fits
   * where they could be by now - its own memory, the time since, the sound's own (fuzzed) position.  An inference, not an identification: it
   * never reads who really made the sound, so another person's footsteps in the right place fool it just the same. */
  const inferred = !identified && h.src === 0 && e.kind === 'hound' ? houndInferSource(eng, e, h) : null;
  if (inferred) { h.src = h.pid = inferred.id; h.attribution = 'inferred'; }
  h.urg = soundUrgency(h, eng.now);
  e.hear = h; e.heardCount = (e.heardCount || 0) + 1;
  e.mem.sounds.unshift(h); if (e.mem.sounds.length > 8) e.mem.sounds.pop();
  if (identified || inferred) {
    const r = identified || inferred;
    const loud = I > .3 || ev.type === 'run' || ev.type === 'slide' || ev.type === 'vault' || ev.type === 'land';
    // (3B-N) successive inferred steps support one trail: the trail point moves part way to each step (no jump to every footstep's blur), and
    // the heading comes from that trail, never faster than a person runs
    const trail = inferred && eng.now - r.heardAt < 1.6, nx = trail ? lerp(r.hx, hx, .45) : hx, ny = trail ? lerp(r.hy, hy, .45) : hy;
    if (loud) { const pdt = eng.now - r.hLoud; if (pdt > .15 && pdt < 1.6) { r.hvx = lerp(r.hvx, (nx - r.hx) / pdt, .5); r.hvy = lerp(r.hvy, (ny - r.hy) / pdt, .5); if (inferred) { const v = Math.hypot(r.hvx, r.hvy); if (v > 320) { r.hvx *= 320 / v; r.hvy *= 320 / v; } } } else if (pdt >= 1.6) { r.hvx = 0; r.hvy = 0; } r.hLoud = eng.now; }   // where the footsteps are going
    r.heardAt = eng.now; r.hx = nx; r.hy = ny; r.aw = Math.min(1, r.aw + I * .9);
    noteEv(r, 'sound', hx, hy, unc, Math.min(1, .4 + .5 * I), eng.now);
    if (eng.now - r.seenAt > 1.2) {                                              // not in sight: the sound is all we have
      const k = Math.min(1, I * 1.4 + .25);
      r.lkx = lerp(r.lkx, hx, r.conf < .35 ? 1 : k); r.lky = lerp(r.lky, hy, r.conf < .35 ? 1 : k);
      r.conf = Math.max(r.conf, .4 + .5 * I); r.st = inferred ? (W_S[ev.type] ?? r.st) : ev.st !== undefined ? ev.st : r.st;   // inferred: only what the sound itself says (a running step is running)
      // (v23) which way it is going: only what the footsteps themselves say (the heading built from successive heard positions, fuzz and all).
      // It used to copy the player's true velocity here - the one place hearing leaked the truth.
      if (loud && Math.hypot(r.hvx, r.hvy) > 1) { r.lvx = r.hvx; r.lvy = r.hvy; }
    }
  }
  if (!identified && h.src === 0) h.lead = addLead(e, eng.now, {k:'sound',x:h.x,y:h.y,u:h.unc,c:h.c,sal:h.I,type:h.type,urg:h.urg}).id;
  return h;
}

function decayMemory(e, dt, now) {
  const half = memHalfLife(e);
  for (const r of e.mem.p.values()) {
    if (!r.seen) { r.aw = Math.max(0, r.aw - dt * (.05 + .16 * (1 - e.tr.PERSISTENCE))); r.conf = Math.max(0, r.conf - dt / half); }
    if (r.ev && r.ev.length) for (let i = r.ev.length - 1; i >= 0; i--) if (now - r.ev[i].t > half * 3) r.ev.splice(i, 1);
  }
  for (let i = e.mem.sounds.length - 1; i >= 0; i--) if (now - e.mem.sounds[i].t > 25) e.mem.sounds.splice(i, 1);
  // anonymous leads fade like any memory (a little faster: it never knew what they were); turning a light off stops new ones, it does not erase these
  const L = e.mem.leads;
  for (let i = L.length - 1; i >= 0; i--) { const q = L[i]; q.c -= dt / (half * .6); q.sal *= Math.exp(-dt / 4); if (q.c < .05 || now - q.t > LEAD_MAXAGE) { L.splice(i, 1); if (e.inv && e.inv.lead === q.id) e.inv = null; } }
}

/* the strongest lead this entity has on any player: [record, score] */
function bestLead(e, now, filter) {
  let best = null, bs = 0;
  for (const r of e.mem.p.values()) {
    if (filter && !filter(r)) continue;
    const age = memAge(e, r, now);
    const s = r.aw * .8 + r.conf * .7 - Math.min(1, age / 30) * .3 + (r.seen ? .5 : 0);
    if (s > bs && r.conf > .02) { bs = s; best = r; }
  }
  return best ? [best, bs] : null;
}

/* SOCIAL AWARENESS: who else is around a victim, judged only from things this entity could perceive:
 *  sighting, footsteps / noise, a light beam glimpsed at range, or having seen them together a moment ago. */
/* (v23) built from its own records and leads only - it used to walk the true player list and read the exact position of anybody carrying a lit
 * torch in line of sight.  A light it saw without the person is an anonymous threat (id 0): it adds to the danger, it names nobody. */
function threatsAround(e, eng, victimId, cands) {
  const now = eng.now, out = [], v = cands.find(p => p.id === victimId), vx = v ? v.x : e.x, vy = v ? v.y : e.y;
  for (const r of e.mem.p.values()) {
    if (r.id === victimId || tgtGone(eng, e, r)) continue;
    let cert = 0, how = '', x = r.lkx, y = r.lky, vxh = 0, vyh = 0;
    const lt = r.ev && r.ev.find(q => q.k === 'light' && now - q.t < 2.6);
    if (r.seen && r.visual) { const p = r.visual; cert = 1; how = 'seen'; x = p.x; y = p.y; vxh = p.vx; vyh = p.vy; }
    else if (now - r.heardAt < 2.6 && Math.hypot(r.hx - vx, r.hy - vy) < 1100) { cert = .65; how = 'heard'; x = r.hx; y = r.hy; vxh = r.hvx; vyh = r.hvy; }
    else if (lt && Math.hypot(lt.x - vx, lt.y - vy) < 1700) { cert = .6; how = 'light'; x = lt.x; y = lt.y; }
    else if (now - r.seenAt < 9 && Math.hypot(r.lkx - vx, r.lky - vy) < 650) { cert = .42 * (1 - (now - r.seenAt) / 9); how = 'together'; }
    if (cert <= 0 || Math.hypot(x - e.x, y - e.y) > 2200) continue;
    const d = Math.hypot(x - vx, y - vy), toV = Math.atan2(vy - y, vx - x), heading = Math.atan2(vyh, vxh);
    const approaching = how !== 'together' && Math.hypot(vxh, vyh) > 50 && Math.abs(angDiff(heading, toV)) < 1.1 && d < 1400;
    out.push({ id: r.id, cert, how, dist: d, approaching, x, y, seesUs: how === 'seen' });
  }
  for (const L of e.mem.leads) {
    if (now - L.t > 2.6) continue; const d = Math.hypot(L.x - vx, L.y - vy); if (d > 1100) continue;
    out.push({ id: 0, cert: .45, how: L.k === 'sound' ? 'sound-anon' : 'light-anon', dist: d, approaching: false, x: L.x, y: L.y, seesUs: false });
  }
  return out;
}
const W_SN = WORLD.SN, W_S = WORLD.S;
