
/* ---------------------------------------------------------------- SMILER (Part 2, stage 2D): the canon Smiler.
 * Canon (Backrooms Wikidot, Entity 3, rev. 83 - the approved Canon Lock):
 *   "attracted to light, and will chase anything they see with a light"            -> light draws it; a light carrier it sees is chased
 *   "will only start to attack if you panic and retreat, or if a loud noise is made" -> the only ways it strikes (plus a chase that catches up)
 *   "keep eye contact, and move away slowly"                                         -> eye contact holds it; moving away slowly is the way out
 *   "turn off all sources of light" / "keep quiet" / "don't run away panicking unless the Smiler starts to chase you"
 *   "reside in dark areas", "reflective eyes and teeth gleaming in the dark", body unknown (rumoured, unconfirmed: not drawn)
 * Everything it does comes from what it perceives (2C evidence law): its records (players it has seen), heard sounds, anonymous light leads,
 * eye contact (facedBy), and the light that falls on itself (only from its own observations + the fixed lamp field).  It never reads where an
 * unsensed player is.  The one system rule outside its knowledge: a placement validator (eng.placementOk) may refuse a resting spot that is
 * right behind somebody - it says "invalid", never "who" or "where".
 *
 * BEHAVIOUR (states are the shared framework's names; the act says which canon behaviour it is):
 *   HIDDEN/lurk      waits in the dark; the eyes are a faint gleam.  Restless after a while: walks to another dark spot.
 *   FOLLOWING/drawn  goes to look at something: a light it noticed (anonymous lead), a sound, where it lost somebody.  Gets there, looks, tries a
 *                    couple of likely openings, then admits it was wrong and goes back to the dark.  It can pick the wrong spot.
 *   WATCHING         somebody in view: it stares (face full).  No eye contact: it comes closer - to a watching distance, nearer as it gets agitated.
 *     /hold          sustained eye contact (held, not a one-frame glance): it does not come at the one watching it.  Somebody moving away slowly
 *                    while watching it is let go.  Somebody who just stands there is not: it creeps in and drifts sideways (keep looking or lose it),
 *                    and at close range even small sounds count.  Watching it is counterplay, not a shield.
 *   (close range)    walking in on it is not covered by the hold (v23.1.2): coming at it raises agitation however hard you stare, and somebody who
 *                    has walked in to point-blank (< 140 px) and is not backing off is struck.  Its own creep never counts as their advance.
 *   (multiplayer)    a fresh light it observes elsewhere draws it off somebody it is only watching in the dark (once per person in a while), but
 *                    not off somebody holding it with their eyes; the unlit person it left does not pull it back unless it walks right into them.
 *   PROVOKED/chase   a light carrier in view and agitation over its threshold: it chases (canon).  Running is the right answer now; the light going
 *                    out stops the lure (after a moment), breaking line of sight loses it.  A chase that catches up is an attack.
 *   ATTACKING/rush   the canon triggers: somebody it can see retreating fast (panic), or a loud noise close by.  A short burst; if it misses it
 *                    goes back to chasing (light) or watching.
 *   DISAPPEARING/withdraw  it walks away into the dark - it has lost interest, let somebody go, or lost them.  No vanishing, no teleport.
 * AGITATION (0..1, debug-visible): rises with a light carrier in view, a beam in its eyes, fresh light, being close, losing eye contact up close,
 * noise; falls slowly when nothing happens; rises only a little while it is being watched.  It sets when a light becomes a chase, how close it comes,
 * and how fast a retreat counts as panic.
 * PERSONALITY (bounded, from the shared trait jitter): PATIENCE (how long it waits / watches, how slowly it gets agitated), CURIOSITY (how weak a
 * lead it goes to look at), PERSISTENCE (how long it chases blind / searches), AGGRESSION = boldness (watching distance, chase threshold). */
const SACT = { '': 0, watch: 1, follow: 2, wait: 3, creep: 4, rush: 5, fade: 6, cornered: 7, lightfail: 8, stare: 9, back: 10, circle: 11, block: 12, hold: 13, lurk: 14, drawn: 15, search: 16, chase: 17, drift: 18 };
const SMILER = {
  name: 'Smiler', kind: 'smiler', initial: S.HIDDEN, radius: 23, clearance: 21, vTop: 300, turnPenalty: .3, roamSpeed: 80,
  // only PATIENCE, CURIOSITY, PERSISTENCE, AGGRESSION (boldness), HEARING, VISION and MEMORY drive the canon Smiler; the rest are kept for the shared framework
  traits: { INTELLIGENCE: .8, SADISM: .1, HUNGER: .1, PATIENCE: .7, CURIOSITY: .55, CAUTION: .5, TERRITORIALITY: .5, AGGRESSION: .5, PERSISTENCE: .55, SOCIAL: .3, HEARING: .55, VISION: .92, LIGHT_SENS: .86, MEMORY: .75 },
  jitter: .13,
  caps: { CAN_VAULT: true, VAULT_SPEED: .6, CAN_CROUCH: false, CAN_CRAWL: false, CAN_SLIDE: false, CAN_OPEN_DOORS: true, CAN_BREAK_DOORS: false, CAN_USE_TIGHT_GAPS: false, TURNING_ABILITY: 3.1, ACCELERATION: 520 },
  vision: { range: 1000, fov: 2.4, dark: true, gain: 2.4, floor: 230 },
  // chase (v23.1.1: 255, was 232 - QA: too easy to outrun): still under a fresh sprint (285 px/s), over a winded or deep-carpet sprint (~236):
  // a fresh runner who reacts at once still gains a little ground, but escape needs stamina, routing and breaking line of sight
  speeds: { roam: 80, approach: 92, investigate: 118, creep: 34, drift: 40, chase: 255, rush: 300, retreat: 110 },
  init(eng, e) {
    e.face = .25; e.faceT = .25; e.ag = 0; e.att = new Map(); e.lurkT = 0; e.goalS = null; e.watchT = 0; e.lostT = 0; e.chaseBlind = 0; e.lightOff = 0; e.strikeT = 0;
    e.grace = 0; e.lastHearT = -1; e.agWhy = ''; e.drift = eng.rng() < .5 ? 1 : -1; e.driftT = 0; e.holdT = 0;
    const T = e.tr; e.pz = { patience: T.PATIENCE, curiosity: T.CURIOSITY, persistence: T.PERSISTENCE, bold: T.AGGRESSION };
    e.dbg.why = 'waiting in the dark'; e.dbg.ab = '';
  },
};
/* derived, bounded parameters (personality changes the creature's timing and nerve, not what it is) */
const sP = e => { const z = e.pz; return {
  chaseAt: clamp(.62 - .2 * (z.bold - .5), .5, .74), loom: lerp(150, 110, z.bold), watchD: lerp(330, 220, z.bold),
  lurkFor: lerp(10, 30, z.patience), watchFor: lerp(12, 32, z.patience), blind: lerp(1.6, 3.6, z.persistence), searchFor: lerp(8, 18, z.persistence),
  leadMin: lerp(.45, .2, z.curiosity), gain: lerp(1.25, .75, z.patience), decay: lerp(.045, .085, z.patience) }; };
function sFace(e, target) { e.faceT = target; }
function sWhy(eng, e, why) { if (e.dbg.why !== why) { e.dbg.why = why; e.dbg.whyAt = eng.now; } }
/* the light on the creature itself: the fixed lamp field where it stands, or a beam it has just seen in its eyes (its own observation, 2C) */
function sLit(eng, e) { const lamp = eng.geo.lightLevel(e.x, e.y, null), beam = e.flashAt !== undefined && eng.now - e.flashAt < .6 ? .85 : 0; return Math.max(lamp, beam); }
/* a resting spot in the dark (fixed lamp field only - it does not know where anybody's torch is unless it saw it), on open floor, that the
 * placement validator accepts.  dir: a preferred heading (away from something) */
function darkSpot(eng, e, minD, maxD, from, dir) {
  const geo = eng.geo, o = from || e; let best = null, bs = -1e9;
  for (let i = 0; i < 30; i++) {
    const a = dir !== undefined && i < 20 ? dir + (eng.rng() - .5) * 1.6 : eng.rng() * TAU, d = rand(eng, minD, maxD), c = geo.cellAt(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d);
    if (c < 0 || geo.cls[c] !== 1) continue;
    const x = geo.cx(c), y = geo.cy(c), lit = geo.lightLevel(x, y, null);
    if (!eng.placementOk(x, y)) continue;
    let cover = 0; for (let k = 0; k < 6; k++) if (geo.ray(x, y, k / 6 * TAU, 200) < 160) cover++;
    const sc = -lit * 400 + Math.min(cover, 3) * 25 - Math.abs(d - (minD + maxD) / 2) * .15 + eng.rng() * 40;
    if (sc > bs) { bs = sc; best = { x, y }; }
  }
  return best;
}
/* ---------------------------------------------------------------- transitions (each one says why: debug) */
function beginHidden(eng, e, why) { setState(e, S.HIDDEN, 'lurk'); e.goalS = null; e.lurkT = 0; e.watchT = 0; sFace(e, .25); sWhy(eng, e, why || 'waiting in the dark'); }
function beginDrawn(eng, e, g, why, fast) {
  setState(e, S.FOLLOWING, fast ? 'search' : 'drawn'); e.goalS = { x: g.x, y: g.y, u: g.u || 120, k: g.k || 'lead', lead: g.lead || 0, t0: eng.now, phase: 'go', legs: 0, maxLegs: 1 + Math.round(e.pz.persistence * 2), pause: 0, fast: !!fast, dir: g.dir, off: g.off };
  plan(eng, e, g.x, g.y); sFace(e, .45); sWhy(eng, e, why);
}
function beginWatch(eng, e, r, why) { setState(e, S.WATCHING, 'watch'); setTarget(e, r.id, eng.now); e.watchT = 0; e.lostT = 0; e.holdT = 0; sFace(e, 1); sWhy(eng, e, why); }
function beginStalk(eng, e, r, why) { beginChase(eng, e, r, why || 'debug'); }              // (engine debug command name kept)
function beginChase(eng, e, r, why) { setState(e, S.PROVOKED, 'chase'); setTarget(e, r.id, eng.now); e.chaseBlind = 0; e.lightOff = 0; e.chaseT = 0; sFace(e, 1); sWhy(eng, e, why); }
function beginStrike(eng, e, r, why) { setState(e, S.ATTACKING, 'rush'); setTarget(e, r.id, eng.now); e.strikeT = 0; sFace(e, 1); e.ag = Math.max(e.ag, .8); sWhy(eng, e, why); e.dbg.strikes = (e.dbg.strikes | 0) + 1; }
function beginWithdraw(eng, e, why, dir) {
  const g = darkSpot(eng, e, 380, 1000, e, dir) || darkSpot(eng, e, 200, 700, e);
  if (!g) { beginHidden(eng, e, why); return; }
  setState(e, S.DISAPPEARING, 'fade'); e.goalS = { x: g.x, y: g.y, t0: eng.now }; plan(eng, e, g.x, g.y); sFace(e, 0); sWhy(eng, e, why);
  if (e.target > 0) e.dbg.ab = why + ' @' + eng.now.toFixed(0);
}
/* ---------------------------------------------------------------- perception summaries */
/* sustained eye contact per player (the 2C facedBy test, plus hysteresis: a glance or a one-frame flick of the mouse does nothing) */
const EC_ON = .4, EC_LAPSE = .3;
function sAttention(eng, e, tdt) {
  const seen = new Set(e.seenNow);
  for (const id of seen) {
    const r = e.mem.p.get(id), p = eng.playerById(id), f = facedBy(eng, e, p, r, e.face > .5 ? .55 : 0, e.lit);   // its gleaming face can be met in the dark; the light on it = what it knows (sLit)
    let a = e.att.get(id); if (!a) e.att.set(id, a = { t: 0, lapse: 9, had: false });
    if (f) { a.t += tdt; a.lapse = 0; } else { a.lapse += tdt; if (a.lapse > EC_LAPSE) { if (a.t >= EC_ON) a.had = true; a.t = 0; } }
  }
  for (const [id, a] of e.att) if (!seen.has(id)) { a.lapse += tdt; if (a.lapse > EC_LAPSE) { if (a.t >= EC_ON) a.had = true; a.t = 0; } if (!eng.byId.has(id)) e.att.delete(id); }
}
const heldBy = (e, id) => { const a = e.att.get(id); return !!a && a.t >= EC_ON; };
function watcher(e) { for (const [id, a] of e.att) if (a.t >= EC_ON) return id; return 0; }
/* how fast a seen player is moving away from the creature (+) or toward it (-), from consecutive sightings */
function sRadial(eng, e, r, tdt) {
  const P = perc(eng, e, r), d = Math.hypot(P.x - e.x, P.y - e.y);
  if (r.seen && r.dPrev !== undefined && tdt > 0) r.dRate = lerp(r.dRate || 0, (d - r.dPrev) / tdt, .5); else if (!r.seen) r.dRate = 0;
  // (v23.1.2) close-range pressure: how fast THEY are coming at it (their own velocity toward it, seen), and how far they have walked in on it
  // lately (decays over ~6 s).  Its own creep never counts - only the person closing the gap.
  const adv = r.seen && d > 1 ? (P.vx * (e.x - P.x) + P.vy * (e.y - P.y)) / d : 0;
  r.adv = lerp(r.adv || 0, adv, .5);
  if (tdt > 0) r.closed = Math.max(0, (r.closed || 0) * Math.exp(-tdt / 6) + (r.seen && adv > 15 ? adv * tdt : 0));
  r.dPrev = d; return { P, d };
}
/* ---------------------------------------------------------------- target choice: who it is working on (Smiler-specific commitment, see below) */
/* Scored only from perceived signals: in view, carrying a light it sees, a light of theirs it has just seen (beam / source pinned on them), a loud
 * sound it pinned on them, distance to where it believes they are.  The current target keeps a bonus and a 3 s dwell (longer than the shared 1.5 s:
 * this is a patient creature - it should be seen to settle on somebody, not flick between people).  A canon trigger (panic, noise) switches at once. */
const SM_DWELL = 3;
function sScore(eng, e, r) {
  const now = eng.now, P = perc(eng, e, r), d = Math.hypot(P.x - e.x, P.y - e.y);
  const lt = r.ev && r.ev.find(q => q.k === 'light' && now - q.t < 1.5);
  return (r.seen ? .6 : 0) + (r.seen && r.light ? 1 : 0) + (lt ? .5 : 0) + (now - r.hLoud < 2 ? .4 : 0) - d / 1500 + (e.target === r.id ? .35 : 0);
}
function sChoose(eng, e) {
  const now = eng.now; let best = null, bs = -1e9;
  for (const r of e.mem.p.values()) {
    if (tgtGone(eng, e, r)) continue;
    if (!r.seen && (now - r.seenAt > 2.5 || r.conf < .3)) continue;
    const s = sScore(eng, e, r); if (s > bs) { bs = s; best = r; }
  }
  if (!best) return null;
  const cur = e.target > 0 ? e.mem.p.get(e.target) : null;
  if (cur && cur !== best && !tgtGone(eng, e, cur) && (cur.seen || now - cur.seenAt < 2)) {
    const cs = sScore(eng, e, cur);
    if (bs < cs + .3 || now - (e.tgtSince ?? -99) < SM_DWELL) return cur;
    e.dbg.retarget = `P${cur.id} -> P${best.id} (${bs.toFixed(2)} vs ${cs.toFixed(2)})`;
  }
  return best;
}
/* ---------------------------------------------------------------- agitation: bounded, gradual, decaying, only from perceived events */
function sAgitation(eng, e, tdt, tgt, d) {
  const now = eng.now, Pm = sP(e); let g = 0; const why = [];
  for (const id of e.seenNow) { const r = e.mem.p.get(id); if (r && r.light) { g += id === e.target ? .13 : .06; why.push('light in view'); break; } }
  if (e.flashAt !== undefined && now - e.flashAt < .5) { g += .28; why.push('beam in its eyes'); }
  // somebody it is watching who does not watch it back: it grows bolder (canon: keep eye contact)
  if (tgt && tgt.seen && e.state === S.WATCHING && !heldBy(e, tgt.id) && d < 600) { g += .045; why.push('not being watched'); }
  if (e.inv && now - e.inv.t < .5 && (e.inv.c || 0) > .5) { g += .06; why.push('fresh light'); }
  if (tgt && tgt.seen && d < Pm.loom * 1.6) { g += .05; why.push('close'); }
  const w = watcher(e); if (w) { g *= .35; g += .015; why.push('being watched'); }
  // (v23.1.2) somebody walking in on it: eye contact does not soften this - the gaze holds it back, it does not license coming closer
  for (const id of e.seenNow) { const r = e.mem.p.get(id); if (!r || (r.adv || 0) < 20) continue; const dd = r.dist || 1e9; if (dd < 450) { g += .12 + .45 * (1 - dd / 450); why.push('approached it'); break; } }
  if (g > 0) e.ag += g * Pm.gain * tdt; else e.ag -= Pm.decay * (e.seenNow.size ? .5 : 1) * tdt;
  e.ag = clamp(e.ag, 0, 1); e.agWhy = why.join(', ');
}
function sBump(e, v, why) { e.ag = clamp(e.ag + v, 0, 1); e.agWhy = why; }
/* ---------------------------------------------------------------- the canon triggers */
/* panic: somebody it sees retreating fast, close by (outside a chase, and not in the moment after a chase ended) */
function sPanic(eng, e) {
  if (eng.now < e.grace || e.state === S.PROVOKED || e.state === S.ATTACKING) return null;
  const slow = 165 - 70 * e.ag, R = 380 + 220 * e.ag;
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id); if (!r || tgtGone(eng, e, r)) continue;
    const P = perc(eng, e, r), d = Math.hypot(P.x - e.x, P.y - e.y);
    if (d < R && P.sp > slow && (r.dRate || 0) > 90) return r;
  }
  return null;
}
/* (v23.1.2) close-range pressure - somebody who walked in on it, to point-blank range.  Gameplay inference, not canon text: the canon way out is
 * to keep eye contact and move AWAY slowly; closing in on it is the opposite, so it does not get the protection of the hold.  A quiet person who
 * stays put or backs away is never struck for proximity (amendment 3): its own creep stops at its looming distance and never counts as their
 * advance; only the distance THEY closed (r.closed, from their own movement) does. */
const PB = 140;
function sIntrude(eng, e) {
  if (e.state === S.PROVOKED || e.state === S.ATTACKING) return null;
  for (const id of e.seenNow) {
    const r = e.mem.p.get(id); if (!r || tgtGone(eng, e, r)) continue;
    const d = r.dist || 1e9; if (d > PB) continue;
    if ((r.closed || 0) > 40 && (r.adv || 0) > -10) return r;                // walked in on it and still not backing off
    if (e.ag > .85 && (r.adv || 0) > 15) return r;                             // already wound up: any step toward it, this close
  }
  return null;
}
/* noise: a loud sound close by (at high agitation, and very close, small ones too) */
function sNoise(eng, e) {
  const h = e.hear; if (!h || h.t <= e.lastHearT) return null; e.lastHearT = h.t;
  if (h.src < 0) return null;
  const d = Math.hypot(h.x - e.x, h.y - e.y), loud = h.type === 'run' || h.type === 'slide' || h.type === 'vault' || h.type === 'land' || h.I > .5;
  const small = e.ag > .7 && ((d < 230 && h.I > .08) || (d < 120 && h.I > .02));     // (v23.1.2: right beside it, even a crouched step)
  if (!((loud && d < 520 + 200 * e.tr.HEARING) || small)) return { weak: true, h, d };
  return { h, d, r: h.src > 0 ? e.mem.p.get(h.src) : null };
}
/* ---------------------------------------------------------------- the decision step (think rate: 10 Hz near, ~3 Hz mid) */
function sThink(eng, e) {
  const now = eng.now, tdt = Math.min(.5, now - (e.thinkAt ?? now)); e.thinkAt = now;
  const Pm = sP(e);
  sAttention(eng, e, tdt);
  let tgt = e.target > 0 ? e.mem.p.get(e.target) : null; if (tgt && tgtGone(eng, e, tgt)) { e.dbg.ab = `P${tgt.id}: saw them go down @${now.toFixed(0)}`; tgt = null; }
  let d = 1e9; if (tgt) { const q = sRadial(eng, e, tgt, tdt); d = q.d; }
  for (const id of e.seenNow) { const r = e.mem.p.get(id); if (r && r !== tgt) sRadial(eng, e, r, tdt); }
  sAgitation(eng, e, tdt, tgt, d);
  // canon triggers first
  const pr = sPanic(eng, e); if (pr) { beginStrike(eng, e, pr, `P${pr.id} retreated fast in front of it (panic)`); return; }
  const ir = sIntrude(eng, e); if (ir) { const c = Math.round(ir.closed || 0); ir.closed = 0; beginStrike(eng, e, ir, `P${ir.id} walked in on it to point-blank (${Math.round(ir.dist)} px, closed ${c} px)`); return; }
  const nz = sNoise(eng, e);
  if (nz && !nz.weak && e.state !== S.ATTACKING) {
    if (nz.r && nz.r.seen && e.state !== S.PROVOKED && !(now < e.grace && nz.r === tgt)) { beginStrike(eng, e, nz.r, `a loud ${nz.h.type} from P${nz.r.id}, close`); return; }
    sBump(e, .25, 'loud noise');
    if (e.state === S.HIDDEN || e.state === S.FOLLOWING || e.state === S.DISAPPEARING) { beginDrawn(eng, e, { x: nz.h.x, y: nz.h.y, u: nz.h.unc, k: 'sound' }, `a loud ${nz.h.type} nearby`, true); return; }
  }
  switch (e.state) {
    case S.HIDDEN: case S.DORMANT: {
      e.lurkT += tdt;
      const r = sChoose(eng, e); if (r && r.seen) { beginWatch(eng, e, r, `P${r.id} in view${r.light ? ' with a light' : ''}`); return; }
      const L = e.inv && e.mem.leads.find(q => q.id === e.inv.lead);
      if (L && L.c * (.5 + L.sal) >= Pm.leadMin) { beginDrawn(eng, e, { x: L.x, y: L.y, u: L.u, k: L.k, lead: L.id, dir: L.dir }, `drawn to a ${L.k} lead (±${Math.round(L.u)} px)`); return; }
      if (nz && nz.weak && nz.d < 900 && nz.h.I > .15 && eng.rng() < .35 * e.pz.curiosity) { beginDrawn(eng, e, { x: nz.h.x, y: nz.h.y, u: nz.h.unc, k: 'sound' }, `a ${nz.h.type} it heard`); return; }
      if (e.lurkT > Pm.lurkFor) beginWithdraw(eng, e, 'restless: moves to another dark spot');
      return;
    }
    case S.FOLLOWING: {
      const G = e.goalS; if (!G) { beginHidden(eng, e); return; }
      const r = sChoose(eng, e);
      // (the unlit person it just left for a light does not pull it straight back, unless they are right up against it: it can pass close by somebody in the dark on its way to a light)
      if (r && r.seen && !(G.off === r.id && !r.light && Math.hypot(r.lkx - e.x, r.lky - e.y) > 80)) { beginWatch(eng, e, r, `found P${r.id}${r.light ? ' (with a light)' : ''}`); return; }
      // a better light lead than the one it is following
      const L = e.inv && e.mem.leads.find(q => q.id === e.inv.lead);
      if (L && L.id !== G.lead && now - L.t < .5 && L.c * (.5 + L.sal) > Pm.leadMin * 1.3) { beginDrawn(eng, e, { x: L.x, y: L.y, u: L.u, k: L.k, lead: L.id, dir: L.dir, off: G.off }, `a fresher ${L.k} lead`); return; }
      if (G.lead && !e.mem.leads.some(q => q.id === G.lead) && G.phase === 'go' && now - G.t0 > 2) { e.dbg.ab = `lead #${G.lead} faded @${now.toFixed(0)}`; }
      if (now - G.t0 > Pm.searchFor + 6) { beginWithdraw(eng, e, `nothing at the ${G.k}: it was wrong`); return; }
      return;
    }
    case S.WATCHING: {
      if (e.afterKillAt !== undefined && now - e.afterKillAt < lerp(1.5, 4, e.pz.patience)) return;     // it lingers over a kill a moment
      const r = sChoose(eng, e) || tgt;
      if (!r) { beginWithdraw(eng, e, 'nobody left to watch'); return; }
      if (r !== tgt) { setTarget(e, r.id, now); tgt = r; d = sRadial(eng, e, r, 0).d; }
      e.watchT += tdt;
      if (!r.seen) {
        e.lostT += tdt;
        if (now - (e.heldRetreatAt ?? -99) < 2.5 && e.heldRetreatId === r.id) { beginWithdraw(eng, e, `let P${r.id} go: they kept their eyes on it and backed out of sight`, Math.atan2(e.y - r.lky, e.x - r.lkx)); return; }
        if (e.lostT > 1.5) { const est = estimate(e, r, now, eng.geo); beginDrawn(eng, e, { x: est.x, y: est.y, u: est.unc, k: 'lost' }, `lost sight of P${r.id}: goes where it thinks they went (±${Math.round(est.unc)} px)`); }
        return;
      }
      e.lostT = 0;
      // canon: light is what draws it.  A fresh light somewhere else (a lead it observed - not a person it knows) pulls it off somebody it is
      // only watching in the dark, unless that somebody holds it with their eyes (the counterplay: one player holds it while another moves)
      if (!r.light && !watcher(e) && e.watchT > 2 && !(e.pulledOff && e.pulledOff.id === r.id && now - e.pulledOff.t < 15)) {   // (once per person in a while: no back-and-forth)
        const L = e.inv && e.mem.leads.find(q => q.id === e.inv.lead), P = perc(eng, e, r);
        if (L && now - L.t < .5 && L.c * (.5 + L.sal) >= Pm.leadMin * 1.3 && Math.hypot(L.x - P.x, L.y - P.y) > L.u + 150) {
          beginDrawn(eng, e, { x: L.x, y: L.y, u: L.u, k: L.k, lead: L.id, dir: L.dir, off: r.id }, `a light elsewhere drew it off P${r.id} (${L.k}, ±${Math.round(L.u)} px)`); e.pulledOff = { id: r.id, t: now }; return;
        }
      }
      if (r.light && e.ag >= Pm.chaseAt) { beginChase(eng, e, r, `P${r.id} carries a light it can see (agitation ${e.ag.toFixed(2)})`); return; }
      const held = heldBy(e, r.id);
      if (held) {
        e.holdT += tdt;
        if ((r.dRate || 0) > 25) { e.ag = Math.max(0, e.ag - .05 * tdt); e.heldRetreatAt = now; e.heldRetreatId = r.id; if (d > 600) { beginWithdraw(eng, e, `let P${r.id} go: watched it and moved away slowly`, Math.atan2(e.y - r.lky, e.x - r.lkx)); return; } }
        sWhy(eng, e, (r.dRate || 0) > 25 ? `held by P${r.id}'s eyes; they are backing away` : `held by P${r.id}'s eyes; they are not moving away: it creeps and drifts`);
      } else {
        e.holdT = 0;
        const a = e.att.get(r.id); if (a && a.had && a.lapse > .5 && a.lapse < .5 + tdt * 1.5 && d < 300) sBump(e, .2, 'eye contact broken up close');
        sWhy(eng, e, `watching P${r.id}${r.light ? ' (light on)' : ''}, agitation ${e.ag.toFixed(2)}`);
        if (!watcher(e) && ((e.watchT > Pm.watchFor && e.ag < .25) || e.watchT > Pm.watchFor * 2.2)) beginWithdraw(eng, e, `lost interest in P${r.id}: nothing happened`, Math.atan2(e.y - r.lky, e.x - r.lkx));
      }
      return;
    }
    case S.PROVOKED: {
      const r = tgt; if (!r) { beginWithdraw(eng, e, 'chase target gone'); return; }
      e.chaseT = (e.chaseT || 0) + tdt;
      if (r.seen) {
        e.chaseBlind = 0;
        if (!r.light) { e.lightOff += tdt; if (e.lightOff > 1.2) { e.grace = now + 3; beginWatch(eng, e, r, `P${r.id}'s light went out: the lure is gone`); return; } } else e.lightOff = 0;
      } else {
        e.chaseBlind += tdt;
        if (e.chaseBlind > Pm.blind) { const est = estimate(e, r, now, eng.geo); e.grace = now + 3; beginDrawn(eng, e, { x: est.x, y: est.y, u: est.unc, k: 'lost' }, `lost P${r.id} in the chase: searches where they might be (±${Math.round(est.unc)} px)`, true); e.dbg.ab = `chase of P${r.id}: lost sight @${now.toFixed(0)}`; return; }
      }
      if (e.chaseT > 30) { e.grace = now + 3; beginWatch(eng, e, r, 'a long chase: it slows to watching'); }
      return;
    }
    case S.ATTACKING: {
      const r = tgt; e.strikeT += tdt;
      if (!r) { beginWithdraw(eng, e, 'strike target gone'); return; }
      if (e.strikeT > 1.8) {
        e.grace = now + 2.5;
        if (r.seen && r.light) beginChase(eng, e, r, `missed P${r.id}; they still carry a light`);
        else if (r.seen) beginWatch(eng, e, r, `missed P${r.id}`);
        else { const est = estimate(e, r, now, eng.geo); beginDrawn(eng, e, { x: est.x, y: est.y, u: est.unc, k: 'lost' }, `missed P${r.id} and lost sight`, true); }
      }
      return;
    }
    case S.DISAPPEARING: {
      const r = sChoose(eng, e); if (r && r.seen && r.light && e.ag > Pm.chaseAt * .7) { beginWatch(eng, e, r, `turned back: P${r.id}'s light`); return; }
      if (e.goalS && now - e.goalS.t0 > 25) beginHidden(eng, e, 'settled where it was');
      return;
    }
    case S.PLAYING: return;
    default: beginHidden(eng, e);
  }
}
/* ---------------------------------------------------------------- movement (every tick) */
function sMove(eng, e, dt) {
  const now = eng.now, Pm = sP(e), sp = e.sp.speeds;
  switch (e.state) {
    case S.HIDDEN: case S.DORMANT: stopMoving(eng, e, dt); e.head = Math.sin(e.t * .7) * .25; return null;
    case S.FOLLOWING: {
      const G = e.goalS; if (!G) { stopMoving(eng, e, dt); return null; }
      if (G.phase === 'go') {
        const st = follow(eng, e, dt, G.fast ? sp.investigate : sp.approach, { arrive: 30 });
        if (st === 'arrived' || st === 'nopath' || Math.hypot(G.x - e.x, G.y - e.y) < 40) { G.phase = 'look'; G.pause = 0; setAct(e, 'search'); }
      } else if (G.phase === 'look') {
        stopMoving(eng, e, dt); e.head = Math.sin(e.t * 2.2) * .7; G.pause += dt;
        if (G.pause > lerp(1, 2.2, e.pz.patience)) {
          if (G.legs >= G.maxLegs) { beginWithdraw(eng, e, `looked at the ${G.k} and found nobody: it was wrong`); return null; }
          // a likely opening from here: the open directions, the one the light came from first (if it knows), not the way it came
          let best = null, bs = -1e9; const back = G.x0 !== undefined ? Math.atan2(G.y0 - e.y, G.x0 - e.x) : e.ang + Math.PI;
          for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, L = eng.geo.ray(e.x, e.y, a, 520); if (L < 200) continue; const sc = Math.min(L, 520) * .3 + (G.dir !== undefined ? Math.cos(angDiff(a, G.dir)) * 120 : 0) - (Math.cos(angDiff(a, back)) > .7 ? 150 : 0) + eng.rng() * 90; if (sc > bs) { bs = sc; best = a; } }
          G.legs++; if (best === null) { beginWithdraw(eng, e, `nowhere to look from the ${G.k}`); return null; }
          const D = Math.min(380, eng.geo.ray(e.x, e.y, best, 420) - 40); G.x0 = e.x; G.y0 = e.y; G.x = e.x + Math.cos(best) * D; G.y = e.y + Math.sin(best) * D; G.phase = 'go'; plan(eng, e, G.x, G.y); setAct(e, 'search');
          sWhy(eng, e, `searching from the ${G.k}: leg ${G.legs}/${G.maxLegs}`);
        }
      }
      return null;
    }
    case S.WATCHING: {
      const r = e.target > 0 ? e.mem.p.get(e.target) : null; if (!r) { stopMoving(eng, e, dt); return null; }
      const P = perc(eng, e, r), d = Math.hypot(P.x - e.x, P.y - e.y);
      faceToward(e, P.x, P.y, dt, 2.2); e.head = 0;
      if (!r.seen) { stopMoving(eng, e, dt); setAct(e, 'wait'); return null; }
      const held = heldBy(e, r.id), other = !held && watcher(e);
      if (held) {
        const retreating = (r.dRate || 0) > 25;
        if (!retreating && d > Pm.loom + 20) { setAct(e, 'creep'); goTo(eng, e, P.x, P.y, { every: .6 }); follow(eng, e, dt, sp.creep, { arrive: Pm.loom }); }
        else if (!retreating) {                                                  // up close and held: it shifts sideways, so the one watching must keep finding it
          setAct(e, 'drift'); e.driftT -= dt; if (e.driftT <= 0) { e.driftT = rand(eng, 1.5, 3.5); e.drift = -e.drift; }
          const a = Math.atan2(e.y - P.y, e.x - P.x) + e.drift * dt * (sp.drift / Math.max(80, d)), tx = P.x + Math.cos(a) * d, ty = P.y + Math.sin(a) * d;
          if (eng.geo.clear(tx, ty, e.rc, 'walk')) { e.moved = moveCollide(eng, e, tx - e.x, ty - e.y); e.speed = sp.drift; } else { e.drift = -e.drift; stopMoving(eng, e, dt); }
        } else { setAct(e, 'hold'); stopMoving(eng, e, dt); }
        return null;
      }
      const want = e.ag < .4 ? Pm.watchD : Pm.loom, go = e.act === 'watch' ? d > want + 8 : d > want + 60;    // (hysteresis: no stop-start at the edge)
      if (go) { setAct(e, 'watch'); goTo(eng, e, P.x, P.y, { every: .6 }); follow(eng, e, dt, sp.approach * (other ? .4 : 1), { arrive: want }); }
      else { setAct(e, 'stare'); stopMoving(eng, e, dt); }
      return null;
    }
    case S.PROVOKED: case S.ATTACKING: {
      const r = e.target > 0 ? e.mem.p.get(e.target) : null; if (!r) { stopMoving(eng, e, dt); return null; }
      const P = perc(eng, e, r), v = e.state === S.ATTACKING ? sp.rush : sp.chase;
      if (r.seen && directOk(eng, e, P.x, P.y, 900)) directTo(eng, e, P.x, P.y); else goTo(eng, e, P.x, P.y, { every: .4 });
      follow(eng, e, dt, v, { arrive: 8, noSlow: false });
      const body = touching(eng, e, r.id, e.r + 15);
      if (body) return { pv: body, dir: e.ang, speed: e.speed, style: e.state === S.ATTACKING ? 'rush' : 'chase' };
      return null;
    }
    case S.DISAPPEARING: {
      const G = e.goalS; if (!G) { beginHidden(eng, e); return null; }
      const st = follow(eng, e, dt, sp.retreat, { arrive: 24 });
      if (st === 'arrived' || st === 'nopath' || Math.hypot(G.x - e.x, G.y - e.y) < 34) beginHidden(eng, e, 'back in the dark');
      return null;
    }
    case S.PLAYING: { if (!e.cap) beginWithdraw(eng, e, 'done'); return null; }
  }
  return null;
}
function smilerTick(eng, e, dt, thinkNow) {
  e.face += clamp(e.faceT - e.face, -dt * (e.faceT > e.face ? .8 : 1.4), dt * (e.faceT > e.face ? .8 : 1.4));
  e.lit = sLit(eng, e);
  if (thinkNow) sThink(eng, e);
  const res = sMove(eng, e, dt);
  e.dbg.sm = { ag: +e.ag.toFixed(2), agw: e.agWhy, lit: +e.lit.toFixed(2), w: watcher(e), ht: +e.holdT.toFixed(1), why: e.dbg.why, ab: e.dbg.ab, rt: e.dbg.retarget || '',
    pz: { pat: +e.pz.patience.toFixed(2), cur: +e.pz.curiosity.toFixed(2), per: +e.pz.persistence.toFixed(2), bold: +e.pz.bold.toFixed(2) },
    ec: [...e.att].filter(([, a]) => a.t > 0).map(([id, a]) => [id, +a.t.toFixed(1)]), cl: e.target > 0 && e.mem.p.get(e.target) ? Math.round(e.mem.p.get(e.target).closed || 0) : 0, dw: e.target > 0 ? +(eng.now - (e.tgtSince ?? eng.now)).toFixed(1) : null, st: e.dbg.strikes | 0 };
  return res;
}

/* a capture forced into PLAY by the admin tool (canon Smilers kill at once - see SMILER.capture.quick): it stares, then withdraws a step */
function sPlayTick(eng, e, cap, pv, dt) {
  if (!pv) return;
  const P = cap.plan, d = dist(e.x, e.y, pv.x, pv.y); sFace(e, 1);
  if (!P || eng.now > P.until) { const act = pickW(eng.rng, [{ k: 'stare', w: 1.3 }, { k: 'back', w: 1 }]); cap.plan = { act, until: eng.now + rand(eng, 1.6, 4) }; cap.plays++; setAct(e, act); }
  const p = cap.plan; cap.drag = null;
  if (p.act === 'back' && d < 420) { const away = Math.atan2(e.y - pv.y, e.x - pv.x), tx = e.x + Math.cos(away) * 60, ty = e.y + Math.sin(away) * 60; if (eng.geo.clear(tx, ty, 21, 'walk')) { e.speed = approach(e.speed, 70, 400 * dt); e.moved = moveCollide(eng, e, Math.cos(away) * e.speed * dt, Math.sin(away) * e.speed * dt); } else stopMoving(eng, e, dt); }
  else stopMoving(eng, e, dt);
  faceToward(e, pv.x, pv.y, dt, 2.5);
}
SMILER.capture = {
  quick() { return 1; },                                                       // canon: no "play" with a victim (Canon Lock: do not invent sadism)
  variants(eng, e, pv, ctx, attack) {
    return [
      { k: 'A', w: ctx.deadEnd ? 1 : 3 },                                       // out of the darkness
      { k: 'B', w: ctx.deadEnd ? 3 : .4 },                                      // pinned where there is no way out
      { k: 'C', w: 0 }, { k: 'D', w: 0 },                                       // (light-failure / play deaths: admin previews only)
    ];
  },
  onBegin(eng, e, cap, pv) { setState(e, S.PLAYING, 'stare'); },
  playTick(eng, e, cap, pv, dt) { sPlayTick(eng, e, cap, pv, dt); },
  decide(eng, e, cap, pv) { const r = eng.rng(); return cap.plays > 1 && r < .5 ? 'kill' : cap.plays > 2 && r < .7 ? 'release' : 'continue'; },
  onInterrupt(eng, e, cap, pv, ctx, x) { return ctx.approaching > 0 || ctx.danger > .8 ? 'kill' : 'continue'; },
  onRelease(eng, e, cap, pv) { setAct(e, 'back'); },
  releaseTick(eng, e, cap, pv, dt) { stopMoving(eng, e, dt); faceToward(e, pv.x, pv.y, dt, 2.5); sFace(e, 1); },
  onResume(eng, e, cap, pv) { const r = rec(e, pv.id); r.aw = 1; r.seen = true; r.seenAt = eng.now; beginStrike(eng, e, r, 'resumed'); },
  onLetGo(eng, e, cap, pv) { beginWithdraw(eng, e, 'let go'); },
  afterKill(eng, e, ctx, pv) {
    e.ag = .3; setState(e, S.WATCHING, 'stare'); setTarget(e, 0, eng.now); e.watchT = lerp(0, 8, e.pz.patience); sFace(e, 1);
    sWhy(eng, e, 'a kill: it lingers a moment, then goes back to the dark');
    e.afterKillAt = eng.now;
  },
};
SMILER.tick = smilerTick;
SMILER.snap = e => ({ i: e.id, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, a: +e.ang.toFixed(3), s: SCODE[e.state], ac: SACT[e.act] | 0, v: Math.round(e.speed), f: +e.face.toFixed(2), h: +(e.head || 0).toFixed(2), tg: e.target > 0 && (e.state === S.WATCHING || e.state === S.PROVOKED || e.state === S.ATTACKING) ? e.target : 0, cp: e.cap ? e.cap.pid : 0, lt: +(e.lit || 0).toFixed(2), sp: 0 });
