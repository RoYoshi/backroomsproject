
/* ---------------------------------------------------------------- SMILER: darkness with a face.  Patient, watchful, tied to the light. */
const SACT = { '': 0, watch: 1, follow: 2, wait: 3, creep: 4, rush: 5, fade: 6, cornered: 7, lightfail: 8, stare: 9, back: 10, circle: 11, block: 12, hold: 13 };
const QUIRKS = ['bold', 'patient', 'curious', 'revealer', 'cautious'];
const LIT_MAX = .5;                                                        // above this a smiler will not stand in the light
const SMILER = {
  name: 'Smiler', kind: 'smiler', initial: S.HIDDEN, radius: 23, clearance: 21, vTop: 250, turnPenalty: .3, roamSpeed: 80,
  traits: { INTELLIGENCE: .86, SADISM: .58, HUNGER: .12, PATIENCE: .9, CURIOSITY: .58, CAUTION: .66, TERRITORIALITY: .7, AGGRESSION: .5, PERSISTENCE: .62, SOCIAL: .72, HEARING: .42, VISION: .92, LIGHT_SENS: .86, MEMORY: .82 },
  jitter: .13,
  caps: { CAN_VAULT: true, VAULT_SPEED: .6, CAN_CROUCH: false, CAN_CRAWL: false, CAN_SLIDE: false, CAN_OPEN_DOORS: true, CAN_BREAK_DOORS: false, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.1, ACCELERATION: 520 },
  vision: { range: 1000, fov: 2.4, dark: true, gain: 2.4, floor: 230 },
  lightSensitive: true,
  speeds: { roam: 84, follow: 108, stalk: 88, creep: 44, rush: 246, retreat: 178 },
  init(eng, e) { e.face = 0; e.faceT = 0; e.exposed = 0; e.watch = null; e.follow = null; e.style = null; e.special = null; e.disap = null; e.post = { x: e.x, y: e.y }; e.cool.special = rand(eng, 60, 200); e.rushT = 0;
    e.quirk = eng.rng() < .14 ? QUIRKS[(eng.rng() * QUIRKS.length) | 0] : null;        // a small chance of an unusual individual: still the same creature, still the same rules
    e.enc = new Map(); e.seenFails = new WeakSet(); e.blackSeen = false; e.glance = null; e.rvT = 0; e.lastForm = -99; e.hiddenFor = 0; e.waitMore = rand(eng, 8, 30); },   // (a smiler that has just appeared also moves on after a while: before this it waited forever until it had been hidden once)
  pathCost(eng, e) {
    const geo = eng.geo, black = eng.geo.a.blackout(), pen = e.quirk === 'bold' ? 300 : 520;
    return j => (!black && geo.lamp[j] >= .2 ? pen : 0);
  },
};
const litAt = (eng, x, y) => eng.geo.lightLevel(x, y, eng.lightPlayers());
function darkCellNear(eng, e, R, minD = 0, from = null, prefer = null) {
  const geo = eng.geo; let best = null, bs = -1e9;
  for (let i = 0; i < 34; i++) {
    const a = eng.rng() * TAU, d = rand(eng, minD, R), x = (from || e).x + Math.cos(a) * d, y = (from || e).y + Math.sin(a) * d, c = geo.cellAt(x, y);
    if (c < 0 || geo.cls[c] !== 1) continue;
    const p = { x: geo.cx(c), y: geo.cy(c) }, lit = litAt(eng, p.x, p.y); if (lit > LIT_MAX * .8) continue;
    let sc = -lit * 300 - Math.hypot(p.x - e.x, p.y - e.y) * .4 + (prefer ? prefer(p) : 0) + eng.rng() * 40;
    for (const pl of eng.pl) {                                                // believable repositioning (spec 49/51): never just behind someone, never in the open in front of them;
      if (!pl.alive) continue; const dd = Math.hypot(p.x - pl.x, p.y - pl.y); if (dd > 900) continue;
      const rel = Math.abs(angDiff(Math.atan2(p.y - pl.y, p.x - pl.x), pl.angle)), see = eng.geo.los(p.x, p.y, pl.x, pl.y);
      if (rel > 2.3 && dd < 650) sc -= 260;                                    // directly behind them: the "spawned behind me" cheat
      if (see && dd < 520) sc -= 160;
      else if (see && rel > .9 && rel < 1.9 && dd > 380) sc += 30;             // the edge of where they are looking, out of their way, is fair
    }
    if (sc > bs) { bs = sc; best = p; }
  }
  return best;
}
function sFace(e, target) { e.faceT = target; }
function sSpotPlayers(eng, e) {                                             // who is in view (from memory records refreshed by vision)
  const out = [];
  for (const id of e.seenNow) { const r = e.mem.p.get(id), pv = eng.playerById(id); if (pv && pv.alive && !pv.caught) out.push({ r, pv, d: r.dist }); }
  return out.sort((a, b) => a.d - b.d);
}
/* who is with whom, as far as this entity knows: people it has seen (or heard) near the target, judged by where it last saw them - not by where they are
 * now. That knowledge fades with its memory (a long-memoried smiler keeps it for a couple of minutes), and it lasts several times longer for a companion
 * it saw right beside somebody who has not moved since: nothing it has perceived says they parted. */
function othersNear(eng, e, r) {
  let n = 0; const win = memHalfLife(e) * 2.6, still = r.seen && Math.hypot(r.lvx, r.lvy) < 30;
  for (const o of e.mem.p.values()) {
    if (o.id === r.id) continue;
    const d = Math.hypot(o.lkx - r.lkx, o.lky - r.lky), age = eng.now - Math.max(o.seenAt, o.heardAt);
    if (!o.seen && age > win * (still && d < 260 ? 3.5 : 1)) continue;
    const pv = eng.playerById(o.id); if (!pv || !pv.alive) continue;
    if (d < 900) n++;
  }
  return n;
}
function sPrey(eng, e) {                                                    // pick who to work on: isolated, quiet-ish, in the dark
  let best = null, bs = -1e9;
  for (const r of e.mem.p.values()) {
    if (r.conf < .05 && !r.seen) continue;
    const pv = eng.playerById(r.id); if (!pv || !pv.alive || pv.caught) continue;
    const others = othersNear(eng, e, r);
    const s = r.aw * .5 + r.conf * .5 + (others === 0 ? .7 : -.35 * others) - Math.hypot(r.lkx - e.x, r.lky - e.y) / 5000 + (r.ex ? .2 : 0) + (r.light ? -.05 : .05) + encFor(e, r.id).ran * .06 - encFor(e, r.id).lit * .1;
    if (s > bs) { bs = s; best = { r, pv, alone: others === 0, others }; }
  }
  return best;
}
/* it does not call somebody "alone" on a first glance: it has had a proper long look at them and nobody else has shown up */
const soloKnown = (eng, e, r) => eng.now - r.first > 14 && eng.now - r.seenAt < 4;
function sExposure(eng, e, dt) {
  if (e.state === S.PLAYING || e.state === S.ATTACKING || e.state === S.DISAPPEARING || e.trav) { e.exposed = 0; return false; }
  const lit = litAt(eng, e.x, e.y); e.dbg.lit = +lit.toFixed(2); e.lit = lit;
  const qb = e.quirk === 'bold' ? .07 : e.quirk === 'cautious' ? -.07 : 0;
  if (lit > .62 + qb - e.tr.LIGHT_SENS * .08 || (lit > LIT_MAX + qb && e.state === S.HIDDEN)) e.exposed += dt; else e.exposed = Math.max(0, e.exposed - dt * 2);
  if (e.exposed > .22) { const bp = beamOn(eng, e); if (bp && e.seenNow.has(bp.id)) encOf(e, bp.id).lit = Math.min(6, encOf(e, bp.id).lit + 1); beginDisappear(eng, e, 'lit'); return true; }
  return false;
}
/* ENCOUNTER MEMORY (spec 47): a short list per person, kept only while the creature's ordinary memory keeps it, never a profile that outlives the encounter.
 * lit = how often they lit me up, ran = how much they ran, calm = how long they stayed still and easy, lostAt = when I lost sight of them. */
function encOf(e, id) { let c = e.enc.get(id); if (!c) { if (e.enc.size >= 8) e.enc.delete(e.enc.keys().next().value); e.enc.set(id, c = { lit: 0, ran: 0, calm: 0, lostAt: -99, was: false, esc: 0 }); } return c; }
function encTick(eng, e, dt) {
  const k = Math.exp(-dt / (memHalfLife(e) * 2.2 + 20));
  for (const c of e.enc.values()) { c.lit *= k; c.ran *= k; c.calm *= k; c.esc *= k; }
  for (const id of e.enc.keys()) if (!eng.byId.has(id)) e.enc.delete(id);
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id), c = encOf(e, id); if (!r) continue;
    if (r.st === 2 && r.dist < 900) c.ran = Math.min(5, c.ran + dt * .25);
    else if (Math.hypot(r.lvx, r.lvy) < 40) c.calm = Math.min(5, c.calm + dt * .06);
    if (!c.was && eng.now - c.lostAt < 40 && eng.now - c.lostAt > 3) c.esc = Math.max(0, c.esc - .5);   // it found them again: they did not get away
    c.was = true;
  }
  for (const [id, c] of e.enc) if (c.was && !e.seenNow.has(id)) { c.was = false; c.lostAt = eng.now; }
  e.dbg.enc = [...e.enc].map(([id, c]) => id + ':l' + c.lit.toFixed(1) + '/r' + c.ran.toFixed(1) + '/c' + c.calm.toFixed(1)).join(' ');
  e.dbg.quirk = e.quirk || '-';
}
const encFor = (e, id) => e.enc.get(id) || { lit: 0, ran: 0, calm: 0, lostAt: -99, esc: 0 };
function beamOn(eng, e) {                                                   // a torch that is actually pointing at this creature (its own geometry, not a screen)
  for (const p of eng.lightPlayers()) { const d = dist(e.x, e.y, p.x, p.y); if (d < 800 && Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.angle)) < .42) return p; }
  return null;
}
/* a watcher (the person it is following/watching) is looking its way */
const observedBy = (e, pv, r, cone = .55, R = 900) => r && r.seen && dist(e.x, e.y, pv.x, pv.y) < R && Math.abs(angDiff(Math.atan2(e.y - pv.y, e.x - pv.x), pv.angle)) < cone;

/* SPEC 52: a lamp failing is information, not a trigger.  What a smiler makes of it is a weighted roll; "nothing" is one of the answers */
function lightEvent(eng, e, near) {
  const pr = sPrey(eng, e), q = e.quirk;
  const opts = [{ k: 'reveal', w: 1.2 + (q === 'revealer' ? 1.4 : 0) }, { k: 'closer', w: pr ? .9 * (pr.alone ? 1 : .3) * (q === 'bold' ? 1.6 : q === 'cautious' ? .3 : 1) : 0 },
    { k: 'shift', w: .8 }, { k: 'vanish', w: .55 + (q === 'cautious' ? .8 : 0) }, { k: 'nothing', w: 1.5 + (q === 'patient' ? 1.2 : 0) }];
  const pick = pickW(eng.rng, opts); e.dbg.lightEv = pick + '@' + eng.now.toFixed(0);
  if (e.state === S.PROVOKED || e.state === S.ATTACKING || e.state === S.PLAYING || e.state === S.DISAPPEARING) return;
  if (pick === 'reveal') { e.reveal = { until: eng.now + rand(eng, 1.5, 4) }; sFace(e, 1); }
  else if (pick === 'closer' && pr) {
    const g = darkCellNear(eng, e, 380, 90, e, p => -Math.abs(dist(p.x, p.y, pr.r.lkx, pr.r.lky) - Math.max(260, dist(e.x, e.y, pr.r.lkx, pr.r.lky) * .72)) * .5);
    if (g) { plan(eng, e, g.x, g.y); e.nud = { goal: g, until: eng.now + 5 }; }
  } else if (pick === 'shift') { const g = darkCellNear(eng, e, 420, 140, e); if (g) { plan(eng, e, g.x, g.y); e.nud = { goal: g, until: eng.now + 6 }; } }
  else if (pick === 'vanish') beginDisappear(eng, e, 'lights-out', 200);
}
function watchLights(eng, e) {
  const black = eng.geo.a.blackout();
  if (black && !e.blackSeen) { e.blackSeen = true; lightEvent(eng, e); } else if (!black) e.blackSeen = false;
  for (const f of eng.geo.fails) if (!e.seenFails.has(f) && f.until > eng.now) { e.seenFails.add(f); if (!(e.att && e.att.kind === 'lightfail') && dist(f.x, f.y, e.x, e.y) < f.r + 500 && eng.rng() < .75) lightEvent(eng, e); }
}
/* SPEC 57: small systemic reactions that cost almost nothing.  Called every tick; they only nudge head, face and a step or two. */
function micro(eng, e, dt, thinkNow) {
  const now = eng.now, still = e.state === S.HIDDEN || e.state === S.WATCHING || (e.state === S.FOLLOWING && e.act === 'wait');
  if (e.reveal && now > e.reveal.until) e.reveal = null;
  if (e.reveal && e.state !== S.DISAPPEARING) sFace(e, 1);
  if (e.nud) {                                                            // a couple of steps toward a slightly better dark spot, creeping
    const N = e.nud; if (now > N.until || !e.path.length || dist(e.x, e.y, N.goal.x, N.goal.y) < 30 || e.state === S.DISAPPEARING || e.state === S.PROVOKED || e.state === S.ATTACKING || e.state === S.PLAYING) e.nud = null;
    else if (e.state === S.HIDDEN || e.state === S.WATCHING) { const nx = e.path[0], l = nx ? litAt(eng, nx.x, nx.y) : 0; if (l < LIT_MAX || eng.geo.a.blackout()) follow(eng, e, dt, e.sp.speeds.creep, { arrive: 26 }); else e.nud = null; }
  }
  if (!e.hear || now - e.hear.t > 2.4 || !still || e.nud) e.hearHead = 0;
  else { const a = angDiff(Math.atan2(e.hear.y - e.y, e.hear.x - e.x), e.ang); e.hearHead = clamp(a, -.9, .9) * .7; if (e.state === S.HIDDEN && Math.abs(a) > .6) faceToward(e, e.hear.x, e.hear.y, dt, .7); }
  if (e.state === S.WATCHING && !e.nud) {
    const w = e.watch, others = [...e.seenNow].filter(id => !w || id !== w.rid);
    if (!e.glance && others.length && thinkNow && eng.rng() < .05) { const o = eng.playerById(others[0]); if (o) e.glance = { until: now + rand(eng, .7, 1.6), x: o.x, y: o.y }; }
    if (e.glance && now > e.glance.until) e.glance = null;
    if (e.glance) e.hearHead = clamp(angDiff(Math.atan2(e.glance.y - e.y, e.glance.x - e.x), e.ang), -1, 1) * .8;
    if (e.quirk === 'revealer' && thinkNow) { e.rvT -= .12; if (e.rvT <= 0) { e.rvT = rand(eng, 2.4, 5.5); sFace(e, e.faceT > .5 ? .12 : 1); } }
    const bp = beamOn(eng, e);
    if (bp && e.lit > .3 && e.lit < .62 && thinkNow) {                           // the edge of a torch beam reaches it: one small step back into the dark
      const away = Math.atan2(e.y - bp.y, e.x - bp.x), tx = e.x + Math.cos(away) * 46, ty = e.y + Math.sin(away) * 46;
      if (eng.geo.clear(tx, ty, 21, 'walk') && litAt(eng, tx, ty) < e.lit) { e.moved = moveCollide(eng, e, Math.cos(away) * 22, Math.sin(away) * 22); e.dbg.backed = (e.dbg.backed || 0) + 1; }
    } else if (e.lit > .32 && thinkNow && !e.nud && eng.rng() < .25) {        // keeps itself in the dark: a step to a darker neighbouring spot
      const g = darkCellNear(eng, e, 170, 50, e); if (g && litAt(eng, g.x, g.y) < e.lit - .12) { plan(eng, e, g.x, g.y); e.nud = { goal: g, until: now + 3 }; }
    }
  }
  e.head = (e.head || 0) + ((e.hearHead || 0) - (e.head || 0)) * Math.min(1, dt * 2.2) * (e.state === S.WATCHING && !e.glance && e.watch && e.mem.p.get(e.watch.rid)?.seen ? 0 : 1);
}
function beginDisappear(eng, e, why, minD = 260) {
  const from = e.mem.p.size ? bestLead(e, eng.now) : null;
  const away = from ? { x: from[0].lkx, y: from[0].lky } : { x: e.x, y: e.y };
  const g = darkCellNear(eng, e, 520, minD, e, p => Math.hypot(p.x - away.x, p.y - away.y) * .35) || darkCellNear(eng, e, 900, 120, e);
  setState(e, S.DISAPPEARING, 'fade'); e.disap = { goal: g || { x: e.x, y: e.y }, why, t: 0, dur: rand(eng, 1.1, 2.2) };
  if (g) plan(eng, e, g.x, g.y);
  sFace(e, 0);
}
function beginHidden(eng, e) { setState(e, S.HIDDEN, ''); e.post = { x: e.x, y: e.y }; e.watch = null; e.hiddenFor = 0; e.waitMore = rand(eng, 6, 20) * (.6 + e.tr.PATIENCE); sFace(e, 0); e.target = null; e.style = null; }
function beginWatch(eng, e, r) { setState(e, S.WATCHING, 'watch'); e.target = r.id; e.watch = { until: eng.now + rand(eng, 4, 13) * (.6 + e.tr.PATIENCE * .8) * (e.quirk === 'patient' ? 1.7 : e.quirk === 'bold' ? .7 : 1), rid: r.id }; sFace(e, 1); }
function beginFollow(eng, e, r) {
  const en = encFor(e, r.id), hunt = eng.rng() < clamp(.34 + e.tr.AGGRESSION * .3 + e.tr.SADISM * .15 + en.ran * .05 - en.lit * .05 + (e.quirk === 'bold' ? .15 : e.quirk === 'cautious' ? -.15 : 0), .1, .85);   // decided when it starts following, not each tick: a follow may simply never go anywhere
  e.dbg.intent = hunt ? 'hunt' : 'loiter';
  setState(e, S.FOLLOWING, 'follow'); e.hunt = hunt; e.target = r.id; e.follow = { since: eng.now, until: eng.now + rand(eng, 25, 70) * (.6 + e.tr.PERSISTENCE) * (e.quirk === 'patient' ? 2.4 : 1), rid: r.id, goalT: 0, frz: 0, obsT: -99 }; sFace(e, .55); }
function beginStalk(eng, e, r, style) { setState(e, S.STALKING, 'creep'); e.target = r.id; e.style = style || 'rush'; e.stalk = { since: eng.now, hold: 0, rid: r.id }; sFace(e, .85); }

function smilerTick(eng, e, dt, thinkNow) {
  const now = eng.now, black = eng.geo.a.blackout();
  e.face += clamp(e.faceT - e.face, -dt * (e.faceT > e.face ? .8 : 1.4), dt * (e.faceT > e.face ? .8 : 1.4));
  e.cool.special = Math.max(0, (e.cool.special || 0) - dt);
  encTick(eng, e, dt); watchLights(eng, e);
  if (sExposure(eng, e, dt) && e.state !== S.DISAPPEARING) return null;
  let res = null; const wasHidden = e.state === S.HIDDEN;
  switch (e.state) {
    case S.HIDDEN: case S.DORMANT: {
      if (!e.relocating) stopMoving(eng, e, dt); e.hiddenFor = (e.hiddenFor || 0) + dt; sFace(e, 0);          // (a relocating smiler drifts on below: it must not also be braked and moved here)
      if (!thinkNow) break;
      const seen = sSpotPlayers(eng, e);
      if (seen.length) {
        const prey = sPrey(eng, e);
        if (prey && prey.r.aw > .3) {
          e.head = angDiff(Math.atan2(prey.pv.y - e.y, prey.pv.x - e.x), e.ang) * .5;
          const en = encFor(e, prey.r.id), boldness = e.tr.CURIOSITY * .5 + (prey.alone ? .35 : -.2) + (black ? .15 : 0) + e.mood.boredom * .2 + en.calm * .04 - en.lit * .07 + (e.quirk === 'bold' ? .2 : e.quirk === 'cautious' ? -.15 : 0);
          if (prey.r.dist < 1000 && e.hiddenFor > .8 && eng.rng() < clamp(boldness, .04, .8) * .16) { beginWatch(eng, e, prey.r); break; }
          if (!prey.alone && eng.rng() < .012 && e.tr.SOCIAL > .4) beginFollow(eng, e, prey.r);         // groups are followed, not engaged
          if (prey.r.dist < (e.quirk === 'cautious' ? 300 : 190) && e.hiddenFor > .5) { beginDisappear(eng, e, 'too-close'); break; }
        }
      } else {
        // it lost sight of somebody a little while ago and has not forgotten: it comes to look, from the dark, rather than starting from nothing
        for (const [id, c] of e.enc) {
          const r = e.mem.p.get(id), pv = eng.playerById(id); if (!r || !pv || !pv.alive || pv.caught) continue;
          if (eng.now - c.lostAt < 45 && eng.now - c.lostAt > 4 && r.conf > .18 && e.hiddenFor > 2 && eng.rng() < .012 * (.5 + e.tr.PERSISTENCE)) { beginFollow(eng, e, r); e.dbg.returned = (e.dbg.returned || 0) + 1; break; }
        }
        if (e.quirk === 'curious' && e.hear && eng.now - e.hear.t < 3 && !e.relocating && eng.rng() < .04) {         // the odd one goes to look at a noise instead of at the person
          const g = darkCellNear(eng, e, 500, 120, { x: e.hear.x, y: e.hear.y }); if (g) { plan(eng, e, g.x, g.y); e.relocating = { goal: g }; e.hiddenFor = 0; e.dbg.investigated = (e.dbg.investigated || 0) + 1; }
        }
      }
      if (e.hiddenFor > e.waitMore && (e.mood.boredom > .5 || eng.rng() < .01)) { beginDisappear(eng, e, 'relocate', 700); e.disap.reloc = true; }
      break;
    }
    case S.WATCHING: {
      stopMoving(eng, e, dt); const w = e.watch; const r = w && e.mem.p.get(w.rid), pv = r && eng.playerById(r.id);
      if (!w || !r || !pv || !pv.alive || pv.caught) { beginHidden(eng, e); break; }
      if (r.seen) { faceToward(e, pv.x, pv.y, dt, 2.2); e.head = 0; } else e.head = Math.sin(e.t * 1.2) * .3;
      sFace(e, r.seen ? 1 : .6);
      if (thinkNow) {
        const d = dist(e.x, e.y, pv.x, pv.y);
        const beam = e.lit > .45;
        const near = e.quirk === 'cautious' ? 340 : 240; if (d < near || beam) { const bp = beam && beamOn(eng, e); if (bp) encOf(e, bp.id).lit = Math.min(6, encOf(e, bp.id).lit + 1); beginDisappear(eng, e, d < near ? 'approached' : 'beam'); break; }
        if (now > w.until) {
          const prey = sPrey(eng, e), alone = prey && prey.alone;
          const pick = pickW(eng.rng, [{ k: 'follow', w: alone ? 1.6 : .8 }, { k: 'again', w: .6 }, { k: 'fade', w: .8 + (1 - e.tr.CURIOSITY) }, { k: 'stalk', w: alone && soloKnown(eng, e, r) && e.tr.AGGRESSION > .3 ? .7 + e.tr.SADISM * .5 : 0 }]);
          if (pick === 'follow') beginFollow(eng, e, r); else if (pick === 'again') w.until = now + rand(eng, 3, 9); else if (pick === 'stalk') beginStalk(eng, e, r); else beginDisappear(eng, e, 'watched');
        }
      }
      break;
    }
    case S.FOLLOWING: {
      const F = e.follow, r = F && e.mem.p.get(F.rid), pv = r && eng.playerById(r.id);
      if (!F || !r || !pv || !pv.alive || pv.caught || now > F.until) { beginDisappear(eng, e, 'gave-up', 200); break; }
      if (r.conf < .12 && !r.seen) { beginHidden(eng, e); break; }
      sFace(e, r.seen ? .6 : .3);
      const tx = r.seen ? pv.x : r.lkx, ty = r.seen ? pv.y : r.lky, d = dist(e.x, e.y, tx, ty);
      F.goalT -= dt;
      if (F.goalT <= 0) {
        F.goalT = .7;                                                     // a dark spot to trail from: behind/beside, 450-800px off, never in the light
        const want = rand(eng, 460, 820), g = darkCellNear(eng, e, want + 260, Math.max(200, want - 260), { x: tx, y: ty }, p => -Math.abs(dist(p.x, p.y, tx, ty) - want) * .5 + (eng.geo.sees(p.x, p.y, tx, ty, 1) ? 90 : 0));
        if (g) { F.goal = g; plan(eng, e, g.x, g.y); }
        else if (d > 1500) F.goal = null;
      }
      const obs = observedBy(e, pv, r, .5, 900); if (obs) F.obsT = now; F.frz = obs ? F.frz + dt : Math.max(0, F.frz - dt * .5);
      if (F.frz > 12) { beginDisappear(eng, e, 'watched-too-long'); break; }                                // standing still forever under its eye does not make it wait forever
      if (F.goal && d > 380) {
        const nxt = e.path[0] || F.goal, l = litAt(eng, nxt.x, nxt.y);
        if (obs || now - F.obsT < 1.3) { stopMoving(eng, e, dt); setAct(e, 'wait'); faceToward(e, tx, ty, dt, 1.4); }                 // looked at: it stops; and stays stopped a moment after they look back
        else if (l > LIT_MAX && !black) { stopMoving(eng, e, dt); setAct(e, 'wait'); }                               // the edge of the light: it waits there, grinning
        else { setAct(e, 'follow'); follow(eng, e, dt, e.sp.speeds.follow * (r.seen ? 1 : .9), { arrive: 30 }); }
      } else { stopMoving(eng, e, dt); if (r.seen) faceToward(e, tx, ty, dt, 2); }
      if (thinkNow) {
        const prey = sPrey(eng, e);
        if (prey && prey.r === r && r.seen) {
          const dark = litAt(eng, pv.x, pv.y) < .45 || black;
          const en = encFor(e, r.id); if (prey.alone && (e.hunt || (r.ex && eng.rng() < .3) || r.st === 2 && eng.rng() < .3) && soloKnown(eng, e, r) && dark && now - F.since > 6 && eng.rng() < (.08 + e.tr.AGGRESSION * .1) * (black ? 2 : 1) * (prey.r.ex ? 1.5 : 1) * (1 + en.ran * .25) * (1 - Math.min(.6, en.lit * .12)) * (e.quirk === 'bold' ? 1.5 : e.quirk === 'cautious' ? .5 : 1)) { beginStalk(eng, e, r); break; }
          if (!prey.alone && eng.rng() < .015) { beginDisappear(eng, e, 'group'); break; }
        }
        if (e.lit > .5) beginDisappear(eng, e, 'lit');
      }
      break;
    }
    case S.STALKING: {
      const K = e.stalk, r = K && e.mem.p.get(K.rid), pv = r && eng.playerById(r.id);
      if (!K || !r || !pv || !pv.alive || pv.caught) { beginHidden(eng, e); break; }
      sFace(e, .85);
      const d = dist(e.x, e.y, pv.x, pv.y), watched = r.seen && Math.abs(angDiff(Math.atan2(e.y - pv.y, e.x - pv.x), pv.angle)) < .55 && d < 720;
      const nxt = e.path[0], nl = nxt ? litAt(eng, nxt.x, nxt.y) : 0;
      goTo(eng, e, pv.x, pv.y, { every: .5 });
      if (watched && eng.rng() < .35 + e.tr.CAUTION * .2 && d > 260) { K.hold += dt; stopMoving(eng, e, dt); setAct(e, 'hold'); if (K.hold > rand(eng, 3, 6)) { beginDisappear(eng, e, 'watched-too-long'); break; } }
      else if (nl > LIT_MAX && !black) { stopMoving(eng, e, dt); setAct(e, 'wait'); K.hold += dt * .5; if (K.hold > 9) { beginDisappear(eng, e, 'no-dark-way'); break; } }
      else { K.hold = Math.max(0, K.hold - dt); setAct(e, 'creep'); follow(eng, e, dt, e.sp.speeds.stalk, { arrive: 20 }); }
      if (thinkNow) {
        if (!r.seen && now - r.seenAt > 4.5) { beginFollow(eng, e, r); break; }
        const black2 = black, pl = litAt(eng, pv.x, pv.y), dark = pl < .5 || black2, los = r.seen && eng.geo.los(e.x, e.y, pv.x, pv.y);
        const alone = sPrey(eng, e)?.alone !== false;
        // a victim standing in the light, with the dark right there beside it: the one thing the lights cannot save it from is the lights themselves
        if (!dark && alone && los && d < 560 && e.cool.special <= 0 && eng.rng() < .03) {
          e.style = 'lightfail'; setState(e, S.ATTACKING, 'lightfail'); e.att = { t: 0, stage: 0, rid: r.id, kind: 'lightfail', next: 0 }; e.cool.special = rand(eng, 240, 420); break;
        }
        if (d < 330 && dark && los) {
          const arcs = openArcs(eng.geo, pv.x, pv.y), running = r.st === 2;
          // how will it strike?
          if (!K.decided) {
            K.decided = true;
            const roll = eng.rng();
            let style = 'rush';
            if (arcs.arcs <= 1 && arcs.frac < .34) style = 'cornered';
            else if (alone && roll < e.tr.SADISM * .6 && !running) style = 'play';
            e.style = style;
          }
          if (e.style === 'cornered') { setState(e, S.ATTACKING, 'cornered'); e.att = { t: 0, slow: rand(eng, 2.4, 5.2), rid: r.id, kind: 'cornered' }; break; }
          if (e.style === 'play' || running || eng.rng() < .02) { setState(e, S.PROVOKED, 'rush'); e.rushT = 0; e.target = r.id; e.provoked = { rid: r.id, style: e.style }; sFace(e, 1); break; }
        }
        if (d < 200 && r.seen && !K.close) { K.close = now; }
      }
      break;
    }
    case S.PROVOKED: {
      const P = e.provoked, r = P && e.mem.p.get(P.rid), pv = r && eng.playerById(r.id);
      if (!P || !r || !pv || !pv.alive || pv.caught) { beginDisappear(eng, e, 'lost-prey'); break; }
      e.rushT += dt; sFace(e, 1);
      if (thinkNow && e.rushT > .8 && dist(e.x, e.y, pv.x, pv.y) > 130) {                                    // committed, but not latched: if the prey is no longer alone, or lit, it goes back to watching
        const grp = othersNear(eng, e, r), lit = litAt(eng, pv.x, pv.y) > .75;
        if ((grp > 0 && eng.rng() < .35) || (lit && eng.rng() < .2)) { e.dbg.stoodDown = (e.dbg.stoodDown || 0) + 1; beginWatch(eng, e, r); e.watch.until = now + rand(eng, 3, 7); stopMoving(eng, e, dt); break; }
      }
      const gx = pv.x + pv.vx * .18, gy = pv.y + pv.vy * .18;
      if (directOk(eng, e, pv.x, pv.y, 2000) && directOk(eng, e, gx, gy, 2000)) directTo(eng, e, gx, gy); else goTo(eng, e, pv.x, pv.y, { every: .35 });
      const nxt = e.path[0], nl = nxt ? litAt(eng, nxt.x, nxt.y) : 0;
      if (nl > .68 && !black && dist(e.x, e.y, pv.x, pv.y) > 90) { stopMoving(eng, e, dt); setAct(e, 'wait'); e.rushBlocked = (e.rushBlocked || 0) + dt; if (e.rushBlocked > 1.4) { e.rushBlocked = 0; beginDisappear(eng, e, 'light-wall'); break; } }
      else { e.rushBlocked = 0; setAct(e, 'rush'); follow(eng, e, dt, e.sp.speeds.rush, { arrive: 8, noSlow: false }); }
      if (dist(e.x, e.y, pv.x, pv.y) < e.r + 15) res = { pv, dir: e.ang, speed: e.speed, style: P.style === 'play' ? 'play' : 'rush' };
      else if (e.rushT > 4.2 || dist(e.x, e.y, pv.x, pv.y) > 760) beginDisappear(eng, e, 'lost-nerve');
      break;
    }
    case S.ATTACKING: {
      const A = e.att, r = A && e.mem.p.get(A.rid), pv = r && eng.playerById(r.id);
      if (!A || !r || !pv || !pv.alive || pv.caught) { beginDisappear(eng, e, 'lost-prey'); break; }
      A.t += dt; sFace(e, 1);
      if (A.kind === 'cornered') {                                        // it will not hurry: the grin just gets closer while the exits close
        const d = dist(e.x, e.y, pv.x, pv.y); faceToward(e, pv.x, pv.y, dt, 2.5);
        const flee = r.seen && pv.sp > 60 && Math.abs(angDiff(Math.atan2(pv.vy, pv.vx), Math.atan2(e.y - pv.y, e.x - pv.x))) < .7;   // it tries to run past
        const speed = A.t > A.slow || flee ? e.sp.speeds.rush : e.sp.speeds.creep;
        if (d > 30) { e.speed = approach(e.speed, speed, 900 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); }
        if (d < e.r + 15) res = { pv, dir: e.ang, speed: e.speed, style: 'cornered' };
        if (A.t > A.slow + 4 && d > 400) beginDisappear(eng, e, 'lost-nerve');
      } else if (A.kind === 'lightfail') {                                // the lights go, it is closer, they come back, it is closer again...
        const d = dist(e.x, e.y, pv.x, pv.y); faceToward(e, pv.x, pv.y, dt, 3);
        A.next -= dt;
        if (A.next <= 0) {
          if (A.stage < 3) {
            A.stage++; const dur = A.stage === 1 ? rand(eng, 1.1, 1.5) : A.stage === 2 ? rand(eng, .8, 1.1) : 1.4;
            eng.lightFail(pv.x, pv.y, 560, dur + (A.stage < 3 ? 0 : 0));
            A.dark = eng.now + dur; A.next = dur + (A.stage < 3 ? rand(eng, 1.2, 1.9) : 9);
            A.step = A.stage < 3 ? Math.max(0, (d - 130) * (A.stage === 1 ? .38 : .5)) : 0; A.moved = 0;
          }
        }
        if (A.dark && eng.now < A.dark && A.step > 0 && A.moved < A.step) { const s = Math.min(A.step - A.moved, 330 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * s, Math.sin(e.ang) * s); A.moved += s; e.speed = 330; }
        else { stopMoving(eng, e, dt); }
        if (A.stage === 3 && eng.now >= A.dark - .9) { e.speed = e.sp.speeds.rush * 1.2; e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); }
        if (d < e.r + 15) res = { pv, dir: e.ang, speed: e.speed, style: 'lightfail' };
        if (A.t > 16) beginDisappear(eng, e, 'gave-up');
      }
      break;
    }
    case S.DISAPPEARING: {
      const D = e.disap; if (!D) { beginHidden(eng, e); break; }
      D.t += dt; sFace(e, 0);
      if (e.path.length) follow(eng, e, dt, e.sp.speeds.retreat, { arrive: 24 }); else stopMoving(eng, e, dt);
      if (D.t > D.dur && e.face < .05) { if (D.reloc) { const g = darkCellNear(eng, e, 2600, 900, e); if (g) { setState(e, S.HIDDEN, ''); e.disap = null; plan(eng, e, g.x, g.y); e.relocating = { goal: g }; e.hiddenFor = 0; e.waitMore = rand(eng, 8, 24); break; } } beginHidden(eng, e); }
      break;
    }
    case S.PLAYING: {
      if (!e.cap) beginDisappear(eng, e, 'done');
      break;
    }
    default: beginHidden(eng, e);
  }
  micro(eng, e, dt, thinkNow);
  // relocation after DISAPPEARING(reloc): drift to the new post in the dark
  if (e.relocating && e.state === S.HIDDEN && wasHidden) { const g = e.relocating.goal; if (e.path.length && dist(e.x, e.y, g.x, g.y) > 40 && !e.seenNow.size) { const nxt = e.path[0], l = litAt(eng, nxt.x, nxt.y); if (l < LIT_MAX || black) follow(eng, e, dt, e.sp.speeds.roam, { arrive: 30 }); } else { e.relocating = null; e.post = { x: e.x, y: e.y }; } }
  return res;
}

/* the play of a smiler: it does not rush.  It withdraws into the dark, stares, comes back a step at a time. ------------------------ */
function sPlayTick(eng, e, cap, pv, dt) {
  if (!pv) return;
  const P = cap.plan, d = dist(e.x, e.y, pv.x, pv.y); sFace(e, 1);
  if (!P || eng.now > P.until) {
    const act = pickW(eng.rng, [{ k: 'stare', w: 1.3 }, { k: 'creep', w: 1.1 }, { k: 'back', w: 1 + e.tr.CAUTION * .3 }, { k: 'circle', w: .7 }, { k: 'block', w: cap.phase === 'crawl' ? .9 : .2 }]);
    cap.plan = { act, until: eng.now + rand(eng, 1.6, 4), dir: eng.rng() < .5 ? 1 : -1 }; cap.plays++; setAct(e, act === 'creep' ? 'cornered' : act);
  }
  const p = cap.plan; cap.drag = null;
  if (p.act === 'stare') { stopMoving(eng, e, dt); faceToward(e, pv.x, pv.y, dt, 2); e.head = Math.sin(e.t * 1.1) * .1; }
  else if (p.act === 'creep') { faceToward(e, pv.x, pv.y, dt, 2.5); if (d > 90) { e.speed = approach(e.speed, 40, 400 * dt); e.moved = moveCollide(eng, e, Math.cos(e.ang) * e.speed * dt, Math.sin(e.ang) * e.speed * dt); } else stopMoving(eng, e, dt); }
  else if (p.act === 'back') {
    const away = Math.atan2(e.y - pv.y, e.x - pv.x), tx = e.x + Math.cos(away) * 60, ty = e.y + Math.sin(away) * 60;
    if (d < 420 && litAt(eng, tx, ty) < LIT_MAX && eng.geo.clear(tx, ty, 21, 'walk')) { e.speed = approach(e.speed, 70, 400 * dt); e.moved = moveCollide(eng, e, Math.cos(away) * e.speed * dt, Math.sin(away) * e.speed * dt); } else stopMoving(eng, e, dt);
    faceToward(e, pv.x, pv.y, dt, 2.5);
  } else if (p.act === 'circle') {
    const a = Math.atan2(e.y - pv.y, e.x - pv.x) + p.dir * dt * (85 / Math.max(120, d)), r = clamp(d, 150, 260), tx = pv.x + Math.cos(a) * r, ty = pv.y + Math.sin(a) * r;
    if (litAt(eng, tx, ty) < LIT_MAX) steerTo(eng, e, tx, ty, 90, dt, { noSlow: true, turnMul: 1.5 }); else stopMoving(eng, e, dt); faceToward(e, pv.x, pv.y, dt, 2.5);
  } else if (p.act === 'block') {                                        // stand between the victim and the way out
    const arcs = openArcs(eng.geo, pv.x, pv.y); let bd = -1, ba = 0;
    for (let i = 0; i < arcs.open.length; i++) if (arcs.open[i]) { const a = i / arcs.open.length * TAU; const dd = Math.abs(angDiff(a, Math.atan2(e.y - pv.y, e.x - pv.x))); if (bd < 0 || dd < bd) { bd = dd; ba = a; } }
    const tx = pv.x + Math.cos(ba) * 170, ty = pv.y + Math.sin(ba) * 170;
    if (eng.geo.clear(tx, ty, 21, 'walk') && litAt(eng, tx, ty) < LIT_MAX) steerTo(eng, e, tx, ty, 100, dt, { noSlow: true }); else stopMoving(eng, e, dt); faceToward(e, pv.x, pv.y, dt, 2);
  }
}
SMILER.capture = {
  quick(e, ctx) {
    let q = .5 + (1 - e.tr.SADISM) * .35 - e.tr.SADISM * .5 * ctx.iso;
    if (ctx.danger > .25) q += .3; if (ctx.approaching) q = Math.max(q, .97);
    return clamp(q, .12, .98);
  },
  variants(eng, e, pv, ctx, attack) {
    const style = attack && attack.style;
    return [
      { k: 'A', w: style === 'rush' || !style ? 2 : .05 },                      // out of the darkness
      { k: 'B', w: style === 'cornered' ? 4 : ctx.deadEnd ? 1.2 : 0 },           // pinned in a dead end
      { k: 'C', w: style === 'lightfail' ? 6 : 0 },                              // the lights fail
      { k: 'D', w: style === 'play' ? 3 : 0 },
    ];
  },
  onBegin(eng, e, cap, pv) { setState(e, S.PLAYING, 'stare'); },
  playTick(eng, e, cap, pv, dt) { sPlayTick(eng, e, cap, pv, dt); },
  decide(eng, e, cap, pv) {
    const r = eng.rng(), pk = .34 + e.tr.SADISM * .15 + e.mood.excitement * .2, pr = .34 * (cap.plays > 2 ? 1 : .4);
    return r < pk && cap.plays > 1 ? 'kill' : r < pk + pr && cap.plays > 1 ? 'release' : 'continue';
  },
  onInterrupt(eng, e, cap, pv, ctx, x) {
    const r = eng.rng();
    if (ctx.approaching > 0 || ctx.danger > .8) return r < .45 + e.tr.AGGRESSION * .3 ? 'kill' : 'release';
    if (x.noisy) return r < .5 ? 'release' : 'continue';
    return 'continue';
  },
  onRelease(eng, e, cap, pv) { setAct(e, 'back'); },
  releaseTick(eng, e, cap, pv, dt) {                                          // it backs into the dark and simply watches you
    const d = dist(e.x, e.y, pv.x, pv.y); sFace(e, 1);
    if (d < 380) { const away = Math.atan2(e.y - pv.y, e.x - pv.x), tx = e.x + Math.cos(away) * 50, ty = e.y + Math.sin(away) * 50; if (eng.geo.clear(tx, ty, 21, 'walk') && litAt(eng, tx, ty) < LIT_MAX) { e.speed = approach(e.speed, 62, 400 * dt); e.moved = moveCollide(eng, e, Math.cos(away) * e.speed * dt, Math.sin(away) * e.speed * dt); } else stopMoving(eng, e, dt); setAct(e, 'back'); }
    else { stopMoving(eng, e, dt); setAct(e, 'stare'); }
    faceToward(e, pv.x, pv.y, dt, 2.5);
  },
  onResume(eng, e, cap, pv) { const r = rec(e, pv.id); r.aw = 1; r.seen = true; r.seenAt = eng.now; setState(e, S.PROVOKED, 'rush'); e.provoked = { rid: pv.id, style: 'rush' }; e.rushT = 0; e.target = pv.id; e.dbg.resumed = (e.dbg.resumed || 0) + 1; },
  onLetGo(eng, e, cap, pv) { beginDisappear(eng, e, 'let-go', 320); e.dbg.letGo = (e.dbg.letGo || 0) + 1; },
  afterKill(eng, e, ctx, pv) {
    const near = ctx.threats.filter(t => t.cert >= .5 && (t.approaching || t.dist < 600));
    e.mood.excitement = .8;
    if (near.length) { beginDisappear(eng, e, 'witnessed'); return; }
    setState(e, S.WATCHING, 'watch'); e.target = pv.id; e.watch = { until: eng.now + rand(eng, 3, 8), rid: pv.id, body: true }; sFace(e, 1);   // it stays a moment, grinning at the body
  },
};
SMILER.tick = smilerTick;
SMILER.snap = e => ({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: SACT[e.act] | 0, v: Math.round(e.speed), f: +e.face.toFixed(2), h: +(e.head || 0).toFixed(2), tg: e.target > 0 && (e.state === S.STALKING || e.state === S.FOLLOWING || e.state === S.WATCHING || e.state === S.PROVOKED) ? e.target : 0, cp: e.cap ? e.cap.pid : 0, lt: +(e.lit || 0).toFixed(2), sp: e.att && e.att.kind === 'lightfail' ? 1 : 0 });
