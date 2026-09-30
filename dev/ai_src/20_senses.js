
/* ---------------------------------------------------------------- perception, memory, social awareness */
const POSTURE_VIS = [1, 1, 1.12, .62, .45, .72, 1, .4];     // stand walk run crouch crawl slide vault down (how visible a body is)
const KIND_GLARE = { flashlight: 1, headlamp: .85, lantern: .8, camcorder: .2 };

function newMemory() { return { p: new Map(), sounds: [], others: new Map(), visited: new Map() }; }
function rec(e, id) {
  let r = e.mem.p.get(id);
  if (!r) e.mem.p.set(id, r = { id, aw: 0, seen: false, seenAt: -99, heardAt: -99, lkx: 0, lky: 0, lvx: 0, lvy: 0, conf: 0, hx: 0, hy: 0, st: 0, stamina: 100, ex: 0, prof: 1, light: false, iso: 0, first: -99, lost: 0, hLoud: -99, hvx: 0, hvy: 0, crawl: null, crawlAt: -99 });
  return r;
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

function updateVision(e, eng, dt, cands) {
  const geo = eng.geo, now = eng.now, cfg = e.sp.vision;
  e.seenNow.clear();
  for (const r0 of e.mem.p.values()) r0.seen = false;
  for (const p of cands) {
    if (!p.alive) continue;
    const r = rec(e, p.id), dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    let vis = false, strength = 0;
    const stName = W_SN[p.st] || 'stand';
    let range = cfg.range * (.5 + .7 * e.tr.VISION);
    const lit = geo.lightLevel(p.x, p.y, null), own = p.light ? (KIND_GLARE[p.kind] || 1) : 0;
    let lightF = cfg.dark ? .82 + .18 * Math.max(lit, own) : .3 + .7 * Math.max(lit, own * .9);
    if (p.light && !cfg.dark) lightF *= 1 + .55 * own;                         // a lit lantern is a beacon
    if (e.sp.lightSensitive) lightF *= 1 - e.tr.LIGHT_SENS * .15 * own;         // glare doesn't help a smiler see, it hurts
    const motion = .7 + .5 * clamp(p.sp / 172, 0, 1.4);
    range *= lightF * (POSTURE_VIS[p.st] || 1) * motion * (e.act === 'listen' ? .8 : 1);
    const floor = cfg.floor || 70;                                            // something crouched in the dark right beside it is noticed regardless of posture
    if (d <= Math.max(range, floor)) {
      const bearing = Math.atan2(dy, dx), inFov = d < 110 || Math.abs(angDiff(bearing, e.ang + (e.head || 0))) <= cfg.fov / 2;
      // under an occluder (a table, the wall round a hole) a body can only be made out from close by, whatever the light: not visible from across the room
      const cz = WORLD.crawlAt ? WORLD.crawlAt(p.x, p.y) : null;
      if (inFov && (!cz || d < cz.reveal) && geo.sees(e.x, e.y, p.x, p.y, p.prof)) { vis = true; strength = clamp(Math.pow(1 - d / Math.max(range, floor), .55), .08, 1); }
    }
    r.seen = vis; r.dist = d;
    if (vis) {
      r.aw = Math.min(1, r.aw + strength * dt * (cfg.gain || 3.2));
      if (r.seenAt < now - 6) r.first = now;
      const cw = WORLD.crawlAt ? WORLD.crawlAt(p.x, p.y, 34) : null; if (cw) { r.crawl = cw.id; r.crawlAt = now; } else if (now - r.crawlAt > 2) r.crawl = null;   // seen going into (or at the mouth of) a crawlspace: remembered
      r.seenAt = now; r.lkx = p.x; r.lky = p.y; r.lvx = p.vx; r.lvy = p.vy; r.conf = 1; r.st = p.st; r.stamina = p.stamina; r.ex = p.ex; r.prof = p.prof; r.light = p.light; r.lost = 0;
      e.seenNow.add(p.id);
    }
  }
  for (const r0 of e.mem.p.values()) if (!r0.seen) r0.lost += dt;
}

/* the sound bus delivers each event to every entity once */
function hearEvent(e, eng, ev) {
  const geo = eng.geo, d = Math.hypot(ev.x - e.x, ev.y - e.y);
  const focus = ev.src > 0 && ev.src === e.target && (e.state === S.HUNTING || e.state === S.SEARCHING) && (ev.type === 'run' || ev.type === 'slide' || ev.type === 'vault' || ev.type === 'land') ? 1.3 : 1;   // a hunting animal tracks its prey's running footfalls further - careful movement gets no such penalty
  let eff = ev.r * (.42 + e.tr.HEARING * 1.05) * focus * (e.act === 'listen' ? 1.5 : 1) * (e.state === S.FEEDING ? .65 : 1) * (e.state === S.DORMANT ? .75 : 1) * (e.deaf > 0 ? .3 : 1);
  if (d > eff * 1.05) return;
  const clear = geo.los(e.x, e.y, ev.x, ev.y);
  if (!clear) eff *= .6;
  if (d > eff) return;
  const I = ev.I * Math.pow(1 - d / eff, .7);
  if (I < .03) return;
  const unc = (26 + d * .16) * (clear ? 1 : 1.75) * (1.55 - e.tr.INTELLIGENCE * .45) * (1.4 - e.tr.HEARING * .35) * (ev.type === 'breath' ? 1.5 : 1);
  const a = eng.rng() * TAU, m = Math.sqrt(eng.rng()) * unc, hx = ev.x + Math.cos(a) * m, hy = ev.y + Math.sin(a) * m;
  const h = { x: hx, y: hy, I, type: ev.type, t: eng.now, src: ev.src, unc, clear, ox: ev.x, oy: ev.y };
  e.hear = h; e.heardCount = (e.heardCount || 0) + 1;
  e.mem.sounds.unshift(h); if (e.mem.sounds.length > 8) e.mem.sounds.pop();
  if (ev.src > 0) {
    const r = rec(e, ev.src);
    const loud = I > .3 || ev.type === 'run' || ev.type === 'slide' || ev.type === 'vault' || ev.type === 'land';
    if (loud) { const pdt = eng.now - r.hLoud; if (pdt > .15 && pdt < 1.6) { r.hvx = lerp(r.hvx, (hx - r.hx) / pdt, .5); r.hvy = lerp(r.hvy, (hy - r.hy) / pdt, .5); } else if (pdt >= 1.6) { r.hvx = 0; r.hvy = 0; } r.hLoud = eng.now; }   // where the footsteps are going
    r.heardAt = eng.now; r.hx = hx; r.hy = hy; r.aw = Math.min(1, r.aw + I * .9);
    if (eng.now - r.seenAt > 1.2) {                                              // not in sight: the sound is all we have
      const k = Math.min(1, I * 1.4 + .25);
      r.lkx = lerp(r.lkx, hx, r.conf < .35 ? 1 : k); r.lky = lerp(r.lky, hy, r.conf < .35 ? 1 : k);
      r.conf = Math.max(r.conf, .4 + .5 * I); r.st = ev.st !== undefined ? ev.st : r.st;
      if (ev.vx !== undefined) { r.lvx = ev.vx; r.lvy = ev.vy; }
    }
  }
  return h;
}

function decayMemory(e, dt, now) {
  const half = memHalfLife(e);
  for (const r of e.mem.p.values()) {
    if (!r.seen) { r.aw = Math.max(0, r.aw - dt * (.05 + .16 * (1 - e.tr.PERSISTENCE))); r.conf = Math.max(0, r.conf - dt / half); }
  }
  for (let i = e.mem.sounds.length - 1; i >= 0; i--) if (now - e.mem.sounds[i].t > 25) e.mem.sounds.splice(i, 1);
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
function threatsAround(e, eng, victimId, cands) {
  const now = eng.now, out = [], v = cands.find(p => p.id === victimId), vx = v ? v.x : e.x, vy = v ? v.y : e.y;
  for (const p of cands) {
    if (p.id === victimId || !p.alive) continue;
    const r = e.mem.p.get(p.id); let cert = 0, how = '', x = p.x, y = p.y;
    if (r && r.seen) { cert = 1; how = 'seen'; }
    else if (r && now - r.heardAt < 2.6 && Math.hypot(r.hx - vx, r.hy - vy) < 1100) { cert = .65; how = 'heard'; x = r.hx; y = r.hy; }
    else if (p.light && Math.hypot(p.x - e.x, p.y - e.y) < 1700 && eng.geo.los(e.x, e.y, p.x, p.y)) { cert = .6; how = 'light'; }
    else if (r && now - r.seenAt < 9 && Math.hypot(r.lkx - vx, r.lky - vy) < 650) { cert = .42 * (1 - (now - r.seenAt) / 9); how = 'together'; x = r.lkx; y = r.lky; }
    if (cert <= 0) continue;
    const d = Math.hypot(x - vx, y - vy), toV = Math.atan2(vy - y, vx - x), heading = Math.atan2(p.vy, p.vx);
    const approaching = how !== 'together' && p.sp > 50 && Math.abs(angDiff(heading, toV)) < 1.1 && d < 1400;
    out.push({ id: p.id, cert, how, dist: d, approaching, x, y, seesUs: how === 'seen' });
  }
  return out;
}
const W_SN = WORLD.SN;
