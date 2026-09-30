
/* ---------------------------------------------------------------- SMILER: darkness with a face.  Patient, watchful, tied to the light. */
const SACT = { '': 0, watch: 1, follow: 2, wait: 3, creep: 4, rush: 5, fade: 6, cornered: 7, lightfail: 8, stare: 9, back: 10, circle: 11, block: 12, hold: 13 };
const LIT_MAX = .5;                                                        // above this a smiler will not stand in the light
const SMILER = {
  name: 'Smiler', kind: 'smiler', initial: S.HIDDEN, radius: 23, clearance: 21, vTop: 250, turnPenalty: .3, roamSpeed: 80,
  traits: { INTELLIGENCE: .86, SADISM: .58, HUNGER: .12, PATIENCE: .9, CURIOSITY: .58, CAUTION: .66, TERRITORIALITY: .7, AGGRESSION: .5, PERSISTENCE: .62, SOCIAL: .72, HEARING: .42, VISION: .92, LIGHT_SENS: .86, MEMORY: .82 },
  jitter: .13,
  caps: { CAN_VAULT: true, VAULT_SPEED: .6, CAN_CROUCH: false, CAN_CRAWL: false, CAN_SLIDE: false, CAN_OPEN_DOORS: true, CAN_BREAK_DOORS: false, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.1, ACCELERATION: 520 },
  vision: { range: 1000, fov: 2.4, dark: true, gain: 2.4 },
  lightSensitive: true,
  speeds: { roam: 84, follow: 108, stalk: 88, creep: 44, rush: 246, retreat: 178 },
  init(eng, e) { e.face = 0; e.faceT = 0; e.exposed = 0; e.watch = null; e.follow = null; e.style = null; e.special = null; e.disap = null; e.post = { x: e.x, y: e.y }; e.cool.special = rand(eng, 60, 200); e.rushT = 0; },
  pathCost(eng, e) {
    const geo = eng.geo, black = eng.geo.a.blackout();
    return j => (!black && geo.lamp[j] >= .2 ? 520 : 0);
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
    const s = r.aw * .5 + r.conf * .5 + (others === 0 ? .7 : -.35 * others) - Math.hypot(r.lkx - e.x, r.lky - e.y) / 5000 + (r.ex ? .2 : 0) + (r.light ? -.05 : .05);
    if (s > bs) { bs = s; best = { r, pv, alone: others === 0, others }; }
  }
  return best;
}
function sExposure(eng, e, dt) {
  if (e.state === S.PLAYING || e.state === S.ATTACKING || e.state === S.DISAPPEARING || e.trav) { e.exposed = 0; return false; }
  const lit = litAt(eng, e.x, e.y); e.dbg.lit = +lit.toFixed(2); e.lit = lit;
  if (lit > .62 - e.tr.LIGHT_SENS * .08 || (lit > LIT_MAX && e.state === S.HIDDEN)) e.exposed += dt; else e.exposed = Math.max(0, e.exposed - dt * 2);
  if (e.exposed > .22) { beginDisappear(eng, e, 'lit'); return true; }
  return false;
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
function beginWatch(eng, e, r) { setState(e, S.WATCHING, 'watch'); e.target = r.id; e.watch = { until: eng.now + rand(eng, 4, 13) * (.6 + e.tr.PATIENCE * .8), rid: r.id }; sFace(e, 1); }
function beginFollow(eng, e, r) { setState(e, S.FOLLOWING, 'follow'); e.target = r.id; e.follow = { since: eng.now, until: eng.now + rand(eng, 25, 70) * (.6 + e.tr.PERSISTENCE), rid: r.id, goalT: 0 }; sFace(e, .55); }
function beginStalk(eng, e, r, style) { setState(e, S.STALKING, 'creep'); e.target = r.id; e.style = style || 'rush'; e.stalk = { since: eng.now, hold: 0, rid: r.id }; sFace(e, .85); }

function smilerTick(eng, e, dt, thinkNow) {
  const now = eng.now, black = eng.geo.a.blackout();
  e.face += clamp(e.faceT - e.face, -dt * (e.faceT > e.face ? .8 : 1.4), dt * (e.faceT > e.face ? .8 : 1.4));
  e.cool.special = Math.max(0, (e.cool.special || 0) - dt);
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
          const boldness = e.tr.CURIOSITY * .5 + (prey.alone ? .35 : -.2) + (black ? .15 : 0) + e.mood.boredom * .2;
          if (prey.r.dist < 1000 && e.hiddenFor > .8 && eng.rng() < clamp(boldness, .04, .8) * .16) { beginWatch(eng, e, prey.r); break; }
          if (!prey.alone && eng.rng() < .012 && e.tr.SOCIAL > .4) beginFollow(eng, e, prey.r);         // groups are followed, not engaged
          if (prey.r.dist < 190 && e.hiddenFor > .5) { beginDisappear(eng, e, 'too-close'); break; }
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
        if (d < 240 || beam) { beginDisappear(eng, e, d < 240 ? 'approached' : 'beam'); break; }
        if (now > w.until) {
          const prey = sPrey(eng, e), alone = prey && prey.alone;
          const pick = pickW(eng.rng, [{ k: 'follow', w: alone ? 1.6 : .8 }, { k: 'again', w: .6 }, { k: 'fade', w: .8 + (1 - e.tr.CURIOSITY) }, { k: 'stalk', w: alone && e.tr.AGGRESSION > .3 ? .7 + e.tr.SADISM * .5 : 0 }]);
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
      if (F.goal && d > 380) {
        const nxt = e.path[0] || F.goal, l = litAt(eng, nxt.x, nxt.y);
        if (l > LIT_MAX && !black) { stopMoving(eng, e, dt); setAct(e, 'wait'); }                               // the edge of the light: it waits there, grinning
        else { setAct(e, 'follow'); follow(eng, e, dt, e.sp.speeds.follow * (r.seen ? 1 : .9), { arrive: 30 }); }
      } else { stopMoving(eng, e, dt); if (r.seen) faceToward(e, tx, ty, dt, 2); }
      if (thinkNow) {
        const prey = sPrey(eng, e);
        if (prey && prey.r === r && r.seen) {
          const dark = litAt(eng, pv.x, pv.y) < .45 || black;
          if (prey.alone && dark && now - F.since > 6 && eng.rng() < (.08 + e.tr.AGGRESSION * .1) * (black ? 2 : 1) * (prey.r.ex ? 1.5 : 1)) { beginStalk(eng, e, r); break; }
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
      const gx = pv.x + pv.vx * .18, gy = pv.y + pv.vy * .18;
      if (eng.geo.lineClear(e.x, e.y, pv.x, pv.y, 16, 'walk')) { e.path = [{ x: gx, y: gy }]; e.goal = { x: gx, y: gy }; e.goalKey = 'direct'; e.pathAge = 0; } else goTo(eng, e, pv.x, pv.y, { every: .35 });
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
